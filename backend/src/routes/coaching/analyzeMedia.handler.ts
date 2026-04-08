import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';

// ─── 프롬프트 빌더 ───

function buildCryPrompt(child: { name: string; ageInfo: string; gender: string; temperament: string }, description: string): string {
  return `너는 영유아 울음 분석 전문가야. 부모가 설명한 울음 특성을 분석해.

아이: ${child.name} (${child.ageInfo}, ${child.gender}, ${child.temperament})
부모 설명: ${description}

울음 유형별 판단 기준:
- 배고픔: 규칙적, 점점 강해짐, 입을 벌리거나 손을 빨음
- 졸림: 짜증 섞인 울음, 눈 비비기, 하품
- 통증: 갑작스럽고 높은 톤, 얼굴 붉어짐, 다리 구부림
- 과자극: 보챔, 고개 돌리기, 불규칙한 울음

반드시 아래 JSON만 출력해:
{
  "analysis": "울음 분석 종합 소견 2~3문장",
  "possibilities": [
    {"label": "배고픔", "likelihood": "높음/보통/낮음"},
    {"label": "졸림", "likelihood": "높음/보통/낮음"},
    {"label": "통증/불편", "likelihood": "높음/보통/낮음"},
    {"label": "과자극", "likelihood": "높음/보통/낮음"}
  ],
  "recommendations": ["대처법 1", "대처법 2", "대처법 3"],
  "needsDoctor": false
}`;
}

function buildPoopPrompt(child: { name: string; ageInfo: string; gender: string; temperament: string }, description: string): string {
  return `너는 영유아 대변 분석 전문가야. 부모가 설명한 대변 특성을 분석해.

아이: ${child.name} (${child.ageInfo}, ${child.gender}, ${child.temperament})
부모 설명: ${description}

대변 판단 기준:
- 정상: 노란색/갈색, 부드러운 형태
- 주의: 녹색(담즙 과다, 보통 무해), 무른 변(식이 변화 가능)
- 위험: 붉은색(혈변), 흰색/회색(담도 문제), 검은색(상부 출혈 가능), 물 같은 설사 지속

반드시 아래 JSON만 출력해:
{
  "analysis": "대변 분석 종합 소견 2~3문장",
  "possibilities": [
    {"label": "정상", "likelihood": "높음/보통/낮음"},
    {"label": "식이 관련", "likelihood": "높음/보통/낮음"},
    {"label": "소화 문제", "likelihood": "높음/보통/낮음"},
    {"label": "감염/질환", "likelihood": "높음/보통/낮음"}
  ],
  "recommendations": ["조치법 1", "조치법 2", "조치법 3"],
  "needsDoctor": false
}`;
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
    analysis: `${name}이의 울음 설명을 바탕으로 분석했어요. 아이의 상태를 좀 더 관찰하면서 아래 가능성을 확인해보세요.`,
    possibilities: [
      { label: '배고픔', likelihood: hasHunger ? '높음' : '보통' },
      { label: '졸림', likelihood: hasSleepy ? '높음' : '보통' },
      { label: '통증/불편', likelihood: hasPain ? '높음' : '낮음' },
      { label: '과자극', likelihood: '보통' },
    ],
    recommendations: [
      '마지막 수유/식사 시간을 확인해보세요.',
      '기저귀 상태와 체온을 체크해주세요.',
      '안아서 달래보고 반응을 살펴보세요.',
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
    analysis: `${name}이의 대변 설명을 바탕으로 분석했어요. ${needsDoctor ? '일부 주의가 필요한 징후가 있어요.' : '크게 걱정할 상황은 아닌 것 같아요.'}`,
    possibilities: [
      { label: '정상', likelihood: needsDoctor ? '낮음' : '높음' },
      { label: '식이 관련', likelihood: hasWatery ? '높음' : '보통' },
      { label: '소화 문제', likelihood: hasWatery ? '높음' : '낮음' },
      { label: '감염/질환', likelihood: needsDoctor ? '보통' : '낮음' },
    ],
    recommendations: needsDoctor
      ? ['소아과 방문을 권장합니다.', '대변 사진을 찍어 의사에게 보여주세요.', '최근 먹은 음식을 기록해주세요.']
      : ['수분 섭취를 충분히 해주세요.', '최근 식단 변화가 있었는지 확인해보세요.', '2~3일 관찰 후에도 지속되면 소아과에 문의하세요.'],
    needsDoctor,
  };
}

export function registerAnalyzeMediaHandler(router: Router): void {
  // ─── POST /api/coaching/analyze-media ───

  router.post('/analyze-media', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId, type, description } = req.body as {
        childId: string;
        type: 'cry' | 'poop';
        description: string;
      };

      if (!childId || !type || !description) {
        error(res, 'childId, type, description은 필수입니다');
        return;
      }
      if (type !== 'cry' && type !== 'poop') {
        error(res, "type은 'cry' 또는 'poop'만 가능합니다");
        return;
      }

      const child = await buildChildContext(childId, req.userId!);
      if (!child) { error(res, '자녀 정보 없음', 404); return; }

      if (!isGeminiAvailable()) {
        success(res, type === 'cry'
          ? buildMockCryAnalysis(child.name, description)
          : buildMockPoopAnalysis(child.name, description));
        return;
      }

      try {
        const prompt = type === 'cry'
          ? buildCryPrompt(child, description)
          : buildPoopPrompt(child, description);

        const parsed = await callGeminiJSON<{
          analysis?: string;
          possibilities?: Array<{ label: string; likelihood: string }>;
          recommendations?: string[];
          needsDoctor?: boolean;
        }>(prompt, {
          temperature: 0.3,
          maxTokens: 500,
        });

        success(res, {
          childName: child.name,
          type,
          analysis: parsed.analysis || '',
          possibilities: Array.isArray(parsed.possibilities) ? parsed.possibilities : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          needsDoctor: parsed.needsDoctor ?? false,
        });
      } catch {
        success(res, type === 'cry'
          ? buildMockCryAnalysis(child.name, description)
          : buildMockPoopAnalysis(child.name, description));
      }
    } catch {
      error(res, '미디어 분석 중 오류', 500);
    }
  });
}
