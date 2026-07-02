import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections, genId } from '../../services/firestore';
import { maskChildName } from '../../utils/masking';

import { CoachingAIResponse, UserTier, TIER_CONFIGS, FREE_DAILY_LIMIT } from '../../services/coaching/types';
import { filterUselessQuestion } from '../../services/coaching/useless.filter';
import { detectRedFlags } from '../../services/coaching/red.flag.detector';
import { findTopCoachingEntries, formatCandidatesForPrompt } from '../../services/coaching/db.searcher';
import { logger } from '../../utils/logger';
import { buildChildContext, buildTrackingSummary } from '../../services/coaching/context.builder';
import {
  getConversationContext,
  updateConversationSummary,
  formatRecentTurns,
} from '../../services/coaching/conversation.summarizer';
import { buildPrompt } from '../../services/coaching/prompt.builder';
import { backfillFollowups } from '../../services/coaching/followup.templates';
import { callGeminiJSON } from '../../services/coaching/gemini.client';
import { callOpenAIJSON, isOpenAIAvailable } from '../../services/coaching/openai.client';
import { detectParentEmotion } from '../../services/coaching/emotion.detector';
import { getTimeContext } from '../../services/coaching/time.awareness';
import { getMilestoneContext } from '../../services/coaching/milestone.detector';
import { parseTrackingFromMessage, ParsedTracking } from '../../services/coaching/tracker.parser';
import { checkAndIncrementDailyLimit } from '../../utils/rateLimit';
import { z } from 'zod';
import { parseBody } from '../../utils/validate';
import { shouldRejectAIResponse } from '../../services/coaching/forbidden.filter';

// 입력 스키마. message 2000자 cap 은 prompt injection 완화 + Gemini token 폭주 방지.
const AskBodySchema = z.object({
  childId: z.string().min(1, '필수입니다').max(128),
  message: z.string().min(1, '필수입니다').max(2000, '메시지가 너무 깁니다 (최대 2000자)'),
  category: z.string().max(32).optional(),
  photoUrl: z.string().url().max(2048).optional(),
  audioUrl: z.string().url().max(2048).optional(),
  locale: z.enum(['ko', 'ja', 'zh-Hant']).optional(),
});

// ─── 카테고리 매핑 ───

const CATEGORY_KO: Record<string, string> = {
  crying: '울음', sleep: '수면', eating: '식사', poop: '대변',
  social: '사회성', growth: '성장', behavior: '행동', etc: '기타',
};

// ─── 헬퍼 함수 ───

async function getUserTier(userId: string): Promise<UserTier> {
  try {
    const doc = await collections.users.doc(userId).get();
    if (!doc.exists) return 'free';
    const data = doc.data() as Record<string, unknown>;

    // 유료 구독 확인
    if ((data.subscriptionTier as string) === 'PAID') {
      const premiumExpires = data.premiumExpiresAt as string | undefined;
      if (premiumExpires && new Date(premiumExpires) > new Date()) return 'paid';
    }

    // 체험판 확인 (7일)
    const trialStarted = data.trialStartedAt as string | undefined;
    if (trialStarted) {
      const trialEnd = new Date(trialStarted);
      trialEnd.setDate(trialEnd.getDate() + 7);
      if (new Date() < trialEnd) return 'paid';
    }

    return 'free';
  } catch (err) {
    logger.error('ask.handler/getUserTier', err);
    return 'free';
  }
}

// (구) getTodaySessionCount 는 read+save 분리로 race 위험 → checkAndIncrementDailyLimit 으로 대체.

// ─── Gemini AI 호출 (callGeminiJSON 래퍼) ───

/**
 * 인터뷰식(코치가 부모에게 되묻는) 후속질문 차단.
 * followupQuestions 는 "부모가 코치에게 물을 질문"이어야 하는데, 모델이 가끔
 * "언제부터 시작됐나요?"처럼 정보수집 질문을 흘린다 → 코드로 거른다(프롬프트 fail-safe).
 * 과거/평소/상태를 캐묻는 고정밀 마커만 차단 — 조언요청형('~하나요/할까요')은 보존.
 */
const INTERVIEW_FOLLOWUP_MARKERS = [
  '언제부터', '시작됐', '시작되었', '시작했', '시작된',
  '평소', '보통', '주로', '며칠', '얼마나 자주', '몇 번',
  '반응은', '반응이', '어떤가요', '어땠나요', '있었나요',
];
function isInterviewFollowup(q: string): boolean {
  return INTERVIEW_FOLLOWUP_MARKERS.some((m) => q.includes(m));
}

// 코칭 응답 구조 스키마 (Gemini controlled generation) — 필드 누락·타입 오류·파싱 실패 차단.
const COACHING_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    judgement: { type: 'STRING' },
    reasons: { type: 'ARRAY', items: { type: 'STRING' } },
    actions: { type: 'ARRAY', items: { type: 'STRING' } },
    medical: { type: 'STRING', nullable: true },
    personalNote: { type: 'STRING' },
    followupQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['judgement', 'reasons', 'actions', 'personalNote', 'followupQuestions'],
  propertyOrdering: ['judgement', 'reasons', 'actions', 'medical', 'personalNote', 'followupQuestions'],
};

// OpenAI strict json_schema 용 (모든 키 required + additionalProperties:false + nullable=타입배열).
const COACHING_RESPONSE_SCHEMA_OPENAI: Record<string, unknown> = {
  type: 'object',
  properties: {
    judgement: { type: 'string' },
    reasons: { type: 'array', items: { type: 'string' } },
    actions: { type: 'array', items: { type: 'string' } },
    medical: { type: ['string', 'null'] },
    personalNote: { type: 'string' },
    followupQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['judgement', 'reasons', 'actions', 'medical', 'personalNote', 'followupQuestions'],
  additionalProperties: false,
};

// 파싱된 객체 → CoachingAIResponse 매핑 (Gemini/OpenAI 공용).
function buildCoachingResponse(parsed: Record<string, unknown>): CoachingAIResponse {
  // followupQuestions(3개 배열) 우선, 없으면 구버전 단일 followupQuestion fallback.
  const followupQuestions = (Array.isArray(parsed.followupQuestions)
    ? (parsed.followupQuestions as unknown[])
    : [])
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    .map((q) => q.trim())
    .filter((q) => !isInterviewFollowup(q)) // 인터뷰식 되묻기 제거 (fail-safe)
    .slice(0, 3);
  const singleFollowup =
    followupQuestions[0] || (parsed.followupQuestion as string) || undefined;

  return {
    judgement: (parsed.judgement as string) || '아이 상황을 확인해보겠습니다.',
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons as string[] : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions as string[] : [],
    medical: (parsed.medical as string) || undefined,
    personalNote: (parsed.personalNote as string) || '',
    followupQuestion: singleFollowup,
    followupQuestions,
  };
}

async function callGemini(
  systemPrompt: string,
  runtimePrompt: string,
  maxTokens: number
): Promise<CoachingAIResponse> {
  const parsed = await callGeminiJSON<Record<string, unknown>>(runtimePrompt, {
    systemPrompt,
    temperature: 0.4,
    maxTokens,
    // ★ JSON 모드 + 스키마 강제(controlled generation) — 구조 100% 보장.
    responseMimeType: 'application/json',
    responseSchema: COACHING_RESPONSE_SCHEMA,
  });
  return buildCoachingResponse(parsed);
}

// 타사 폴백 — Gemini 전체 실패(과부하) 시 OpenAI gpt-5-nano 로 동일 스키마 호출.
async function callOpenAI(
  systemPrompt: string,
  runtimePrompt: string,
  maxTokens: number
): Promise<CoachingAIResponse> {
  const parsed = await callOpenAIJSON<Record<string, unknown>>(runtimePrompt, {
    systemPrompt,
    responseSchema: COACHING_RESPONSE_SCHEMA_OPENAI,
    maxTokens,
  });
  return buildCoachingResponse(parsed);
}

// ─── Mock 응답 (Gemini 없을 때) ───

function getMockResponse(temperament: string, category: string): CoachingAIResponse {
  const traitIntro: Record<string, string> = {
    '탐구형': '탐구형 기질의 아이는 호기심이 강해서',
    '활동형': '활동형 기질의 아이는 에너지가 넘쳐서',
    '조화형': '조화형 기질의 아이는 안정감을 중요하게 여겨서',
    '분석형': '분석형 기질의 아이는 규칙적인 환경을 좋아해서',
    '감성형': '감성형 기질의 아이는 감정에 민감해서',
  };

  const intro = traitIntro[temperament] ?? '아이의 기질 특성상';

  const categoryTips: Record<string, { reason: string; actions: string[] }> = {
    '울음': {
      reason: '울음은 아이의 가장 중요한 소통 수단이에요.',
      actions: ['체온을 확인해주세요.', '수유/기저귀/수면 상태를 점검해보세요.', '안아주며 달래보세요.'],
    },
    '수면': {
      reason: '수면 패턴은 월령에 따라 계속 변해요.',
      actions: ['일정한 취침 루틴을 만들어보세요.', '잠들기 30분 전 조용한 환경을 만들어주세요.', '낮잠 시간을 조절해보세요.'],
    },
    '식사': {
      reason: '식사 거부는 발달 과정에서 흔히 나타나요.',
      actions: ['억지로 먹이지 않고 노출 횟수를 늘려보세요.', '함께 먹는 분위기를 만들어보세요.', '한 번에 소량씩 제공해보세요.'],
    },
    '대변': {
      reason: '대변 양상은 식이와 소화 상태를 반영해요.',
      actions: ['수분 섭취를 충분히 해주세요.', '식이 변화가 있었는지 확인해보세요.', '횟수와 색을 기록해두세요.'],
    },
  };

  const tips = categoryTips[category] ?? {
    reason: '아이의 발달 과정에서 자연스럽게 나타나는 현상이에요.',
    actions: ['아이의 감정을 먼저 인정해주세요.', '일관된 루틴을 유지해보세요.', '1:1 놀이 시간을 가져보세요.'],
  };

  // ★ 정직한 폴백 — 가짜 답변처럼 보이지 않게 "일시 오류 + 재시도 안내"를 명확히 한다.
  //   (CLAUDE.md: 실패를 조용히 숨기지 말 것) 그동안 도움이 될 일반 팁은 함께 제공.
  return {
    judgement: '지금 답변을 불러오는 데 일시적인 문제가 있었어요. 잠시 후 같은 질문을 한 번만 다시 보내주시면 더 정확히 답해드릴게요.',
    reasons: [tips.reason, '아이마다 시기와 표현 방식이 달라요.'],
    actions: tips.actions,
    personalNote: `${intro} 우선 일반적인 안내를 드렸어요. 다시 시도하면 맞춤 답변이 정상적으로 나와요.`,
    followupQuestion: '내일 상태가 어떤지 알려주세요.',
    followupQuestions: [
      '왜 이런 걸까요?',
      '집에서 어떻게 도와줄까요?',
      '병원에 가봐야 할까요?',
    ],
  };
}

// ─── POST /api/coaching/ask -- 10단계 파이프라인 ───

export function registerAskHandler(router: Router): void {
  router.post('/ask', authMiddleware, async (req: Request, res: Response) => {
    try {
      const body = parseBody(req, res, AskBodySchema);
      if (!body) return;
      const { childId, message, category, photoUrl, audioUrl, locale } = body;

      // ─── Step 1: 카테고리 확인 ───
      const categoryKo = category ? (CATEGORY_KO[category] ?? category) : '기타';

      // ─── Step 2: 쓸모없는 질문 차단 ───
      const filter = filterUselessQuestion(message);
      if (filter.isUseless) {
        const sessionId = genId();
        await collections.coachingSessions.doc(sessionId).set({
          userId: req.userId,
          childId,
          message,
          category: categoryKo,
          answer: filter.rejectionMessage,
          reason: '',
          solutions: [],
          source: 'filter',
          createdAt: new Date().toISOString(),
        });
        success(res, {
          sessionId,
          answer: filter.rejectionMessage,
          reason: '',
          solutions: [],
          source: 'filter',
          category: categoryKo,
          redFlag: null,
          reasons: [],
          medical: null,
          followup: null,
        });
        return;
      }

      // ─── Step 3: 아이 프로필 로드 ───
      const child = await buildChildContext(childId, req.userId!);
      if (!child) {
        error(res, '자녀 정보를 찾을 수 없습니다', 404);
        return;
      }

      // ─── Step 4: 레드 플래그 검사 ───
      const redFlag = detectRedFlags(message, undefined, locale);

      // ─── Step 5: 사용자 티어 확인 ───
      const tier = await getUserTier(req.userId!);
      const config = TIER_CONFIGS[tier];

      // ─── Step 6: 하루 상담 횟수 체크 (무료) — 트랜잭션 원자화 ───
      // 보안 점검 (2026-05-04): redFlag 제외 시 비용 폭주 — monitor 키워드(예: "37.5도")만
      // 넣으면 무료 사용자가 무제한 Gemini 호출 가능. emergency/urgent 만 limit 면제.
      // 보안 점검 (2026-05-07): 기존 read→check→save 분리 호출은 동시 클릭 시 race 로
      //   둘 다 통과되어 한도 우회 가능 → Gemini billable 비용 폭주. 트랜잭션으로 원자화.
      const allowBypass = redFlag.detected &&
        (redFlag.urgency === 'emergency' || redFlag.urgency === 'urgent');
      if (!allowBypass) {
        const limitCheck = await checkAndIncrementDailyLimit(
          req.userId!, 'coaching', FREE_DAILY_LIMIT
        );
        if (!limitCheck.allowed) {
          success(res, {
            sessionId: null,
            answer: `오늘 상담 횟수(${FREE_DAILY_LIMIT}회)를 모두 사용했어요. 내일 다시 만나요!`,
            reason: '',
            solutions: [],
            source: 'limit',
            category: categoryKo,
            redFlag: null,
            reasons: [],
            medical: null,
            followup: null,
          });
          return;
        }
      }

      // ─── Step 7: 병렬 데이터 수집 ───
      const maskedMessage = maskChildName(message, child.name);

      const [dbCandidates, tracking, conversation] = await Promise.all([
        Promise.resolve(findTopCoachingEntries(
          message, category, child.temperament, config.dbCandidateCount, child.ageMonths
        )),
        buildTrackingSummary(childId, config.contextDays),
        getConversationContext(req.userId!, childId, tier),
      ]);

      // ─── Step 8: 컨텍스트 강화 + 프롬프트 조합 ───
      const parentEmotion = detectParentEmotion(message);
      const timeCtx = getTimeContext();
      const milestones = getMilestoneContext(child.ageMonths);
      const dbTexts = formatCandidatesForPrompt(dbCandidates);
      const recentTurnsText = formatRecentTurns(conversation.recentTurns);

      const redFlagContext = redFlag.detected && redFlag.message
        ? `[${redFlag.urgency.toUpperCase()}] ${redFlag.flags.join(', ')} - ${redFlag.message}`
        : '';

      const { systemPrompt, runtimePrompt } = buildPrompt({
        category: categoryKo,
        userMessage: maskedMessage,
        // CLAUDE.md 핵심 규칙: 아이 실명은 절대 AI prompt 에 들어가면 안 됨.
        // child.name 직접 전달은 마스킹 우회 — 항상 '아이' 라벨 사용.
        childName: '아이',
        ageInfo: child.ageInfo,
        gender: child.gender,
        temperament: `${child.temperament} (${child.temperamentDetail})`,
        temperamentDetail: child.temperamentDetail,
        specialNotes: child.specialNotes,
        sleepSummary: tracking.sleepSummary,
        mealSummary: tracking.mealSummary,
        poopSummary: tracking.poopSummary,
        conditionSummary: tracking.conditionSummary,
        recentChangeSummary: tracking.recentChangeSummary,
        conversationSummary: conversation.summary,
        recentChatTurns: recentTurnsText,
        dbCandidates: dbTexts,
        cryAnalysisInput: audioUrl ? `울음소리 녹음 제공됨 (${audioUrl})` : '',
        poopAnalysisInput: photoUrl ? `대변 사진 제공됨 (${photoUrl})` : '',
        parentEmotion: parentEmotion.emotion,
        emotionToneGuide: parentEmotion.toneGuide,
        redFlagContext,
        observedTraits: child.observedTraits,
        timeEmpathyHint: timeCtx.empathyHint,
        milestoneContext: milestones.combined,
      }, undefined, locale);

      // ─── Step 9: AI 호출 ───
      // CLAUDE.md: EMERGENCY 는 AI 응답 없이 즉시 119 안내. Gemini 호출 비용 + 응답 지연 회피.
      let aiResponse: CoachingAIResponse;
      if (redFlag.detected && redFlag.urgency === 'emergency') {
        const emergencyMsg = redFlag.message ?? '응급 상황으로 보여요. 즉시 119 또는 가까운 응급실로 가세요.';
        aiResponse = {
          redFlag: redFlag.flags.join(', '),
          judgement: '🚨 즉시 의료기관 방문 필요',
          reasons: redFlag.flags,
          actions: ['119 또는 가까운 응급실로 즉시 이동', '이동 중 의료진 안내에 따라 응급조치'],
          medical: emergencyMsg,
          personalNote: '앱 안내보다 119 가 먼저입니다. 망설이지 마세요.',
        };
      } else {
        try {
          aiResponse = await callGemini(systemPrompt, runtimePrompt, config.maxOutputTokens);
        } catch (gemErr) {
          // Gemini 전체(2.5-flash-lite → 3.1-flash-lite, 재시도 포함) 실패 → 타사 OpenAI 폴백.
          logger.warn('ask.handler/gemini', `Gemini 실패: ${gemErr instanceof Error ? gemErr.message.slice(0, 80) : ''}`);
          if (isOpenAIAvailable()) {
            try {
              aiResponse = await callOpenAI(systemPrompt, runtimePrompt, config.maxOutputTokens);
              logger.warn('ask.handler/openai-fallback', 'OpenAI gpt-5-nano 폴백 성공');
            } catch (oaErr) {
              logger.error('ask.handler/openai', oaErr);
              aiResponse = getMockResponse(child.temperament, categoryKo);
            }
          } else {
            aiResponse = getMockResponse(child.temperament, categoryKo);
          }
        }
        // 응답 후처리 (CLAUDE.md): 사주/오행/천간/지지 등 금지 용어가 응답에 새어나오면
        // hallucination 또는 prompt injection 의심 — fallback 으로 교체.
        if (shouldRejectAIResponse(aiResponse, 'ask.handler')) {
          aiResponse = getMockResponse(child.temperament, categoryKo);
        }
        // 레드플래그(emergency 외)가 있으면 AI 응답에 medical 추가
        if (redFlag.detected && redFlag.message) {
          aiResponse.medical = redFlag.message;
        }
      }

      // 팔로업 하이브리드: AI 결과(인터뷰식 필터됨)가 3개 미만이면 카테고리 템플릿으로 채워
      // 항상 3개 + 100% "부모가 코치에게 묻는" 시점 보장.
      aiResponse.followupQuestions = backfillFollowups(
        aiResponse.followupQuestions ?? [],
        categoryKo,
        locale,
      );
      aiResponse.followupQuestion = aiResponse.followupQuestions[0] ?? aiResponse.followupQuestion;

      // ─── Step 10: 응답 포맷 + 저장 ───
      const sessionId = genId();

      // 프론트 하위호환 매핑
      const answerText = aiResponse.judgement;
      const reasonText = aiResponse.personalNote;
      const solutionsList = aiResponse.actions;

      // 팔로업 스케줄링
      let followup: { days: number; question: string } | null = null;
      if (aiResponse.followupQuestion) {
        const followupId = genId();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        await collections.followups.doc(followupId).set({
          userId: req.userId,
          childId,
          sessionId,
          question: aiResponse.followupQuestion,
          dueDate: dueDate.toISOString(),
          respondedAt: null,
          response: null,
          coachingReply: null,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        followup = { days: 1, question: aiResponse.followupQuestion };
      }

      // 세션 저장
      await collections.coachingSessions.doc(sessionId).set({
        userId: req.userId,
        childId,
        message,
        category: categoryKo,
        answer: answerText,
        reason: reasonText,
        solutions: solutionsList,
        source: 'ai',
        redFlag: redFlag.detected ? redFlag.message : null,
        reasons: aiResponse.reasons,
        medical: aiResponse.medical ?? null,
        personalNote: aiResponse.personalNote,
        followupDays: followup ? 1 : null,
        followupQuestion: aiResponse.followupQuestion ?? null,
        followupQuestions: aiResponse.followupQuestions ?? [],
        photoUrl: photoUrl ?? null,
        audioUrl: audioUrl ?? null,
        dbCandidatesUsed: dbCandidates.map((c) => c.id),
        createdAt: new Date().toISOString(),
      });

      // 대화 요약 업데이트 (비동기, 응답 차단 안 함)
      updateConversationSummary(
        req.userId!,
        childId,
        message,
        answerText
      ).catch(() => {});

      // ─── 트래커 자동 파싱 (fire-and-forget) ───
      let trackerAutoSaved = false;
      const parsed: ParsedTracking | null = parseTrackingFromMessage(message);
      if (parsed) {
        trackerAutoSaved = true;
        const today = new Date().toISOString().slice(0, 10);
        const docId = `${childId}_${today}`;
        const updates: Record<string, unknown> = {
          childId,
          userId: req.userId,
          date: today,
          updatedAt: new Date().toISOString(),
          autoParserSource: 'coaching',
        };
        if (parsed.feeding) updates.feeding = parsed.feeding;
        if (parsed.sleep) updates.sleep = parsed.sleep;
        if (parsed.diaper) updates.diaper = parsed.diaper;
        if (parsed.condition) updates.condition = parsed.condition;
        if (parsed.temperature !== undefined) updates.temperature = parsed.temperature;

        collections.dailyTracking.doc(docId).set(updates, { merge: true }).catch(() => {});
      }

      success(res, {
        sessionId,
        answer: answerText,
        reason: reasonText,
        solutions: solutionsList,
        source: 'ai',
        category: categoryKo,
        redFlag: redFlag.detected ? redFlag.message : null,
        reasons: aiResponse.reasons,
        medical: aiResponse.medical ?? null,
        followup,
        followups: aiResponse.followupQuestions ?? [],
        trackerAutoSaved,
      });
    } catch (err) {
      logger.error('ask.handler/ask', err);
      error(res, '코칭 응답 중 오류가 발생했습니다', 500);
    }
  });
}
