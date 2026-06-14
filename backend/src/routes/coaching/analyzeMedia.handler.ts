import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections } from '../../services/firestore';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { parseBody } from '../../utils/validate';
import { shouldRejectAIResponse } from '../../services/coaching/forbidden.filter';

// ─── 미디어 입력 검증 ───
const MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5MB (base64 디코드 후 기준)
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac',
  'audio/ogg', 'audio/webm',
]);

const AnalyzeMediaBodySchema = z.object({
  childId: z.string().min(1).max(128),
  type: z.enum(['cry', 'poop']),
  description: z.string().max(1000).optional(),
  mediaBase64: z.string().max(8 * 1024 * 1024).optional(), // ~6MB raw → 5MB base64-decoded cap
  mediaMimeType: z.string().max(64).optional(),
});

/**
 * base64 데이터 + MIME 검증.
 * 1) MIME 화이트리스트
 * 2) 디코드 후 사이즈 cap
 * 3) 매직넘버 — JPEG/PNG/WEBP 만 빠르게 검증, 그 외(audio)는 MIME 만 신뢰
 *    (audio 컨테이너는 종류가 많아 헤더 검증이 까다로움. 사이즈+MIME 가드만으로도 충분.)
 */
function validateMedia(
  base64: string,
  mimeType: string,
  kind: 'image' | 'audio',
): { ok: true; buffer: Buffer } | { ok: false; reason: string } {
  const allowed = kind === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_AUDIO_MIMES;
  if (!allowed.has(mimeType.toLowerCase())) {
    return { ok: false, reason: `허용되지 않는 미디어 형식입니다 (${mimeType})` };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, reason: '미디어 데이터를 디코딩할 수 없습니다' };
  }

  if (buf.length === 0) return { ok: false, reason: '빈 미디어 데이터입니다' };
  if (buf.length > MAX_MEDIA_BYTES) {
    return { ok: false, reason: `미디어 크기가 너무 큽니다 (최대 ${MAX_MEDIA_BYTES / 1024 / 1024}MB)` };
  }

  if (kind === 'image') {
    // 매직넘버 검증
    const isJPEG = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPNG = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isWEBP = buf.length > 12
      && buf.toString('ascii', 0, 4) === 'RIFF'
      && buf.toString('ascii', 8, 12) === 'WEBP';
    if (!isJPEG && !isPNG && !isWEBP) {
      return { ok: false, reason: '이미지 형식이 올바르지 않습니다 (JPEG/PNG/WebP 만 허용)' };
    }
  }

  return { ok: true, buffer: buf };
}

// ─── 분석 횟수 제한 ───

const ANALYSIS_LIMITS = { free: 3, paid: 90 } as const;

async function getUserTier(userId: string): Promise<'free' | 'paid'> {
  try {
    const doc = await collections.users.doc(userId).get();
    if (!doc.exists) return 'free';
    const data = doc.data() as Record<string, unknown>;
    if ((data.subscriptionTier as string) === 'PAID') {
      const exp = data.premiumExpiresAt as string | undefined;
      if (exp && new Date(exp) > new Date()) return 'paid';
    }
    const trial = data.trialStartedAt as string | undefined;
    if (trial) {
      const end = new Date(trial);
      end.setDate(end.getDate() + 7);
      if (new Date() < end) return 'paid';
    }
    return 'free';
  } catch { return 'free'; }
}

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 분석 횟수 한도 검사 + 증분 (원자적).
 * Firestore 트랜잭션으로 read+write 를 묶어 동시 호출에서도 한도가 정확히 지켜지도록 한다.
 * (이전 분리 구현은 동시 클릭 시 한도 우회 → Gemini billable 비용 폭주 위험.)
 */
async function checkAndIncrementUsage(
  userId: string, tier: 'free' | 'paid',
): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
  const limit = ANALYSIS_LIMITS[tier];
  const monthKey = getMonthKey();
  const docId = `${userId}_${monthKey}`;
  const ref = collections.analysisUsage.doc(docId);
  const db = admin.firestore();

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const used = doc.exists ? ((doc.data() as Record<string, unknown>).count as number ?? 0) : 0;

    if (used >= limit) {
      return { allowed: false, used, limit, remaining: 0 };
    }

    tx.set(ref, {
      count: used + 1,
      userId,
      month: monthKey,
      tier,
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { allowed: true, used: used + 1, limit, remaining: limit - used - 1 };
  });
}

// ─── 프롬프트 빌더 ───

function buildCryPrompt(child: { name: string; ageInfo: string; gender: string; temperament: string }, hasAudio: boolean): string {
  return `당신은 소아과 전문의 수준의 영유아 울음 분석 전문가입니다.
${hasAudio ? '첨부된 녹음파일의 울음소리를 청각적으로 분석해주세요. 울음의 톤, 강도, 리듬, 주파수 패턴, 호흡 간격을 면밀히 분석하세요.' : '부모가 설명한 울음 특성을 전문적으로 분석해주세요.'}

[아이 정보]
- 연령/성별: ${child.ageInfo}, ${child.gender}
- 기질 유형: ${child.temperament}

[월령별 울음 특성 참고]
- 0~3개월: 배고픔/졸림/불편이 주된 원인, 영아산통(콜릭) 가능성
- 4~8개월: 분리불안 시작, 낯가림, 이가 나는 통증
- 9~18개월: 좌절/짜증, 의사표현 욕구, 분리불안 심화
- 19~36개월: 감정 조절 미숙, 원하는 것 못할 때, 고집/떼
- 37개월~: 사회적 울음, 또래 관계, 두려움/공포

[기질별 울음 특성]
- ${child.temperament} 기질의 아이는 울음 패턴과 달래는 방법이 다를 수 있습니다. 기질에 맞는 맞춤 조언을 포함해주세요.

[울음 유형별 판단 기준]
1. 배고픔: 규칙적 리듬, 점점 강해짐, "네~네~" 소리, 입맛 다시기, 손 빨기
2. 졸림/피곤: 짜증 섞인 톤, 눈 비비기, 하품, 불규칙한 강약
3. 통증/불편: 갑작스럽고 높은 음, 날카로운 비명, 쉬지 않음, 얼굴 붉어짐, 다리 웅크리기
4. 과자극: 불규칙한 울음, 고개 돌리기, 간헐적 멈춤, 환경 과부하
5. 불안/분리불안: 부모 떨어질 때, 낯선 사람/환경, 안기면 진정
6. 영아산통(콜릭): 3의 법칙(하루3시간+, 주3일+, 3주+), 저녁~밤, 위로 안됨
7. 이앓이: 침 많이 흘림, 잇몸 부음, 물건 물기, 간헐적 예민함
8. 복통/가스: 다리 웅크리기, 배 팽만, 방귀, 수유 중/후 울음

반드시 아래 JSON 형식만 출력하세요:
{
  "analysis": "울음 분석 종합 소견 (4~6문장, 아이의 월령과 기질을 반영한 구체적 분석)",
  "possibilities": [
    {"label": "원인1", "likelihood": "높음/보통/낮음"},
    {"label": "원인2", "likelihood": "높음/보통/낮음"},
    {"label": "원인3", "likelihood": "높음/보통/낮음"},
    {"label": "원인4", "likelihood": "높음/보통/낮음"},
    {"label": "원인5", "likelihood": "높음/보통/낮음"}
  ],
  "recommendations": [
    "즉시 해볼 수 있는 구체적 대처법 1",
    "기질 맞춤 달래기 방법 2",
    "환경/루틴 개선 방법 3",
    "지속 시 확인할 사항 4",
    "주의 관찰 포인트 5"
  ],
  "needsDoctor": false
}

주의: possibilities는 가능성이 높은 순으로 정렬하고, 해당 월령에 맞지 않는 원인은 제외하세요.
recommendations는 부모가 바로 실천할 수 있는 구체적 행동을 적어주세요.`;
}

function buildPoopPrompt(child: { name: string; ageInfo: string; gender: string; temperament: string }, hasImage: boolean): string {
  return `당신은 소아과 전문의 수준의 영유아 대변 분석 전문가입니다.
${hasImage ? '첨부된 대변 사진을 의학적 관점에서 분석해주세요. 색상(RGB 계열), 형태(브리스톨 대변 척도 기준), 점도, 내용물(미소화물, 점액, 거품 등), 냄새 추정을 면밀히 분석하세요.' : '부모가 설명한 대변 특성을 전문적으로 분석해주세요.'}

[아이 정보]
- 연령/성별: ${child.ageInfo}, ${child.gender}
- 기질 유형: ${child.temperament}

[월령별 정상 대변 기준]
- 모유 수유아: 노란색~겨자색, 씨앗 같은 알갱이, 묽은 편, 하루 1~8회
- 분유 수유아: 연한 갈색~노란색, 좀 더 단단, 하루 1~4회
- 이유식 시작 후: 갈색 계열, 먹은 음식 색에 영향, 형태 다양
- 완료기 이후: 갈색, 바나나/소시지 형태, 하루 1~2회

[브리스톨 대변 척도]
- Type 1-2: 변비 (딱딱한 덩어리, 토끼똥)
- Type 3-4: 정상 (소시지/바나나 형태, 부드러움)
- Type 5-6: 무른 변 (부드러운 덩어리, 진흙 형태)
- Type 7: 설사 (완전히 액체)

[색상별 판단 기준]
- 노란색/갈색: 정상
- 녹색: 보통 무해 (담즙, 녹색 채소, 빠른 장 통과). 단, 거품+악취 동반 시 감염 의심
- 주황색: 당근/고구마 등 베타카로틴 음식 영향
- 검은색: 상부 위장관 출혈 가능 (단, 철분제/블루베리는 무해한 검은변)
- 빨간색/혈흔: 하부 출혈(항문열상, 알레르기성 장염, 감염). 소량이면 항문열상 흔함
- 흰색/회색/연한 크림색: 담도 폐쇄 의심 → 즉시 병원
- 까만 타르 같은 변: 태변(신생아) 또는 상부 출혈 → 생후 3일 이후면 병원

[주의 징후 (needsDoctor: true)]
- 흰색/회색 변
- 다량 혈변
- 48시간 이상 지속 설사 + 탈수 징후
- 38도 이상 발열 동반
- 심한 복통으로 아이가 자지 못함

반드시 아래 JSON 형식만 출력하세요:
{
  "analysis": "대변 분석 종합 소견 (4~6문장, 아이의 월령과 식이 단계를 고려한 구체적 분석. 색상, 형태, 점도, 특이사항을 각각 언급)",
  "possibilities": [
    {"label": "원인/상태 1", "likelihood": "높음/보통/낮음"},
    {"label": "원인/상태 2", "likelihood": "높음/보통/낮음"},
    {"label": "원인/상태 3", "likelihood": "높음/보통/낮음"},
    {"label": "원인/상태 4", "likelihood": "높음/보통/낮음"},
    {"label": "원인/상태 5", "likelihood": "높음/보통/낮음"}
  ],
  "recommendations": [
    "지금 바로 확인할 사항 1",
    "식이 조절 방법 2",
    "수분/유산균 관리 3",
    "관찰 포인트 4",
    "병원 방문 기준 5"
  ],
  "needsDoctor": false
}

주의: possibilities는 가능성 높은 순으로 정렬하세요.
recommendations는 부모가 바로 실천할 수 있는 구체적 행동을 적어주세요.
식이 단계(모유/분유/이유식/유아식)에 따라 정상 기준이 다르니 월령을 반드시 고려하세요.`;
}

// ─── Mock 빌더 ───

function buildMockCryAnalysis(
  name: string, description: string
): Record<string, unknown> {
  const hasHunger = description.includes('배고') || description.includes('먹') || description.includes('젖');
  const hasPain = description.includes('아프') || description.includes('높') || description.includes('급') || description.includes('갑자기');
  const hasSleepy = description.includes('졸') || description.includes('잠') || description.includes('눈');

  return {
    childName: name,
    type: 'cry',
    analysis: `아이의 울음소리를 분석했습니다. ${hasPain ? '갑작스럽고 강한 울음 패턴이 감지되었으며, 통증이나 불편감의 가능성이 있습니다. 체온과 기저귀 상태를 먼저 확인해 주세요.' : hasHunger ? '규칙적이고 점점 강해지는 울음 패턴으로, 배고픔 신호일 가능성이 높습니다. 마지막 수유 시간을 확인해 주세요.' : hasSleepy ? '짜증이 섞인 불규칙한 울음으로 피로/졸림의 신호일 수 있습니다. 수면 환경을 편안하게 만들어 주세요.' : '아이의 울음을 종합적으로 분석한 결과, 여러 가능성이 있습니다. 아래 체크리스트를 순서대로 확인해 보세요.'}`,
    possibilities: [
      { label: '배고픔', likelihood: hasHunger ? '높음' : '보통' },
      { label: '졸림/피로', likelihood: hasSleepy ? '높음' : '보통' },
      { label: '통증/불편', likelihood: hasPain ? '높음' : '낮음' },
      { label: '기저귀/체온', likelihood: '보통' },
      { label: '과자극/환경', likelihood: '낮음' },
    ],
    recommendations: [
      '마지막 수유/식사 시간을 확인하고, 2시간 이상 지났다면 수유를 시도해보세요.',
      '기저귀 상태를 확인하고, 체온을 측정해주세요 (정상: 36.5~37.5도).',
      '안아서 천천히 흔들어 주며, 쉿 소리나 백색소음으로 달래보세요.',
      '너무 밝거나 시끄러운 환경이라면 조용하고 어두운 곳으로 이동해보세요.',
      '30분 이상 달래도 울음이 멈추지 않으면 소아과 전화 상담을 고려하세요.',
    ],
    needsDoctor: hasPain,
  };
}

function buildMockPoopAnalysis(
  name: string, description: string
): Record<string, unknown> {
  const hasRed = description.includes('빨간') || description.includes('피') || description.includes('혈');
  const hasWhite = description.includes('하얀') || description.includes('흰') || description.includes('회색');
  const hasWatery = description.includes('물') || description.includes('설사');
  const needsDoctor = hasRed || hasWhite;

  return {
    childName: name,
    type: 'poop',
    analysis: `아이의 대변을 분석했습니다. ${needsDoctor ? '주의가 필요한 징후가 확인되었습니다. 혈변이나 백색변은 소화기 문제를 나타낼 수 있으므로 소아과 방문을 권장합니다. 대변 사진을 보존하여 의사에게 보여주세요.' : hasWatery ? '무른 변 또는 묽은 형태가 관찰됩니다. 일시적인 식이 변화나 장 운동 변화로 인한 것일 수 있으나, 탈수 징후(입술 건조, 소변량 감소)를 주의 깊게 관찰해 주세요.' : '현재 대변 상태는 해당 월령의 정상 범위에 해당합니다. 색상과 형태가 양호하며, 특별한 이상 징후는 보이지 않습니다.'}`,
    possibilities: [
      { label: '정상 범위', likelihood: needsDoctor ? '낮음' : '높음' },
      { label: '식이 영향', likelihood: hasWatery ? '높음' : '보통' },
      { label: '소화 기능 변화', likelihood: hasWatery ? '높음' : '낮음' },
      { label: '장 감염/염증', likelihood: needsDoctor ? '높음' : '낮음' },
      { label: '알레르기 반응', likelihood: hasRed ? '보통' : '낮음' },
    ],
    recommendations: needsDoctor
      ? [
          '오늘 중으로 소아과를 방문해 주세요.',
          '대변이 묻은 기저귀를 비닐에 밀봉하여 병원에 가져가세요.',
          '최근 48시간 동안 먹은 음식과 약을 메모해 주세요.',
          '체온을 측정하고, 38도 이상이면 응급실을 고려하세요.',
          '수분 섭취를 소량씩 자주 시켜주세요 (모유/분유/이온음료).',
        ]
      : [
          '수분 섭취를 충분히 해주세요 (모유/분유는 평소대로, 이유식 아이는 물 추가).',
          '최근 새로 먹인 음식이 있다면 2~3일 중단 후 변화를 관찰하세요.',
          '유산균(프로바이오틱스)을 소아과 상담 후 시작해 볼 수 있어요.',
          '배를 시계 방향으로 부드럽게 마사지해 장 운동을 도와주세요.',
          '3일 이상 같은 양상이 지속되면 소아과를 방문하세요.',
        ],
    needsDoctor,
  };
}

export function registerAnalyzeMediaHandler(router: Router): void {
  // ─── POST /api/coaching/analyze-media ───

  router.post('/analyze-media', authMiddleware, async (req: Request, res: Response) => {
    try {
      const body = parseBody(req, res, AnalyzeMediaBodySchema);
      if (!body) return;
      const { childId, type, description, mediaBase64, mediaMimeType } = body;

      if (!mediaBase64 && !description) {
        error(res, '미디어 파일 또는 설명이 필요합니다');
        return;
      }

      // 미디어 화이트리스트 + 매직넘버 + 사이즈 검증
      if (mediaBase64) {
        if (!mediaMimeType) {
          error(res, '미디어 형식(mimeType)이 필요합니다');
          return;
        }
        const kind: 'image' | 'audio' = type === 'poop' ? 'image' : 'audio';
        const v = validateMedia(mediaBase64, mediaMimeType, kind);
        if (!v.ok) {
          error(res, v.reason, 400);
          return;
        }
      }

      // 자녀 소유권 / 컨텍스트 검증을 quota 차감 *이전* 에 수행 — 잘못된 childId 로
      // 호출 시 사용자 quota 가 헛으로 소모되는 것 방지 (P1 audit fix).
      const child = await buildChildContext(childId, req.userId!);
      if (!child) { error(res, '자녀 정보 없음', 404); return; }

      // 횟수 제한 체크 (검증 통과 후에만 차감)
      const tier = await getUserTier(req.userId!);
      const usage = await checkAndIncrementUsage(req.userId!, tier);
      if (!usage.allowed) {
        const limitLabel = tier === 'free' ? '무료 회원 월 3회' : '유료 회원 월 90회';
        const msg = `이번 달 분석 횟수를 모두 사용했어요 (${limitLabel}). ${tier === 'free' ? '프리미엄 구독 시 월 90회까지 이용 가능합니다.' : '다음 달에 다시 이용해주세요.'}`;
        res.status(429).json({
          success: false,
          error: msg,
          usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining },
        });
        return;
      }

      const fallbackDesc = description || (type === 'poop' ? '사진 분석 요청' : '녹음 분석 요청');

      if (!isGeminiAvailable()) {
        const mockData = type === 'cry'
          ? buildMockCryAnalysis('아이', fallbackDesc)
          : buildMockPoopAnalysis('아이', fallbackDesc);
        success(res, { ...mockData, usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining } });
        return;
      }

      try {
        const hasMedia = !!mediaBase64;
        const prompt = type === 'cry'
          ? buildCryPrompt(child, hasMedia)
          : buildPoopPrompt(child, hasMedia);

        const parsed = await callGeminiJSON<{
          analysis?: string;
          possibilities?: Array<{ label: string; likelihood: string }>;
          recommendations?: string[];
          needsDoctor?: boolean;
        }>(prompt, {
          temperature: 0.3,
          maxTokens: 1200,
          mediaData: mediaBase64 && mediaMimeType
            ? { mimeType: mediaMimeType, base64: mediaBase64 }
            : undefined,
        });

        // 응답 후처리: 사주/오행 등 금지 용어 검출 시 mock fallback
        if (shouldRejectAIResponse(parsed, 'analyzeMedia.handler')) {
          const mockData = type === 'cry'
            ? buildMockCryAnalysis('아이', fallbackDesc)
            : buildMockPoopAnalysis('아이', fallbackDesc);
          success(res, { ...mockData, usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining } });
          return;
        }

        success(res, {
          childName: child.name,
          type,
          analysis: parsed.analysis || '',
          possibilities: Array.isArray(parsed.possibilities) ? parsed.possibilities : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          needsDoctor: parsed.needsDoctor ?? false,
          usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining },
        });
      } catch {
        const mockData = type === 'cry'
          ? buildMockCryAnalysis('아이', fallbackDesc)
          : buildMockPoopAnalysis('아이', fallbackDesc);
        success(res, { ...mockData, usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining } });
      }
    } catch (err: unknown) {
      logger.error('route', err);
      error(res, '미디어 분석 중 오류', 500);
    }
  });
}
