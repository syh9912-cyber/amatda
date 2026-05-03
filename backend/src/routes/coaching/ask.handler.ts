import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections, genId } from '../../services/firestore';
import { maskChildName } from '../../utils/masking';

import { CoachingAIResponse, UserTier, TIER_CONFIGS, getLevelByStreak } from '../../services/coaching/types';
import { filterUselessQuestion } from '../../services/coaching/useless.filter';
import { detectRedFlags } from '../../services/coaching/red.flag.detector';
import { findTopCoachingEntries, formatCandidatesForPrompt } from '../../services/coaching/db.searcher';
import { buildChildContext, buildTrackingSummary } from '../../services/coaching/context.builder';
import {
  getConversationContext,
  updateConversationSummary,
  formatRecentTurns,
} from '../../services/coaching/conversation.summarizer';
import { buildPrompt } from '../../services/coaching/prompt.builder';
import { callGeminiJSON } from '../../services/coaching/gemini.client';
import { detectParentEmotion } from '../../services/coaching/emotion.detector';
import { getTimeContext } from '../../services/coaching/time.awareness';
import { getMilestoneContext } from '../../services/coaching/milestone.detector';
import { parseTrackingFromMessage, ParsedTracking } from '../../services/coaching/tracker.parser';

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
    console.error('[ask.handler] getUserTier failed, defaulting to free:', err instanceof Error ? err.message : String(err));
    return 'free';
  }
}

async function getTodaySessionCount(userId: string): Promise<number> {
  // ⚠️ 'Today' = KST 자정 기준 (사용자가 한국 거주 가정).
  // 서버가 UTC 라서 setHours(0,0,0,0) 만 쓰면 UTC 자정 = KST 9시 → 새벽 1~9시 사용자가 잘못 분류됨.
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNowDateStr = new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10); // YYYY-MM-DD in KST
  const kstMidnight = new Date(kstNowDateStr + 'T00:00:00+09:00'); // KST 자정 (UTC 로 보면 전날 15시)
  try {
    const snap = await collections.coachingSessions
      .where('userId', '==', userId)
      .where('createdAt', '>=', kstMidnight.toISOString())
      .get();
    // filter/limit 소스는 AI 비용 없으므로 제외
    return snap.docs.filter((d) => {
      const src = (d.data() as Record<string, unknown>).source as string;
      return src !== 'filter' && src !== 'limit';
    }).length;
  } catch (err) {
    console.error('[ask.handler] getTodaySessionCount failed, defaulting to 0:', err instanceof Error ? err.message : String(err));
    return 0;
  }
}

async function getUserStreak(userId: string): Promise<number> {
  try {
    const snap = await collections.dailyTracking
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .limit(90)
      .get();

    if (snap.empty) return 0;

    const dates = snap.docs
      .map((d) => (d.data() as Record<string, unknown>).date as string)
      .filter(Boolean)
      .sort()
      .reverse();

    const uniqueDates = [...new Set(dates)];
    const today = new Date().toISOString().slice(0, 10);

    let streak = 0;
    let checkDate = today;

    for (const d of uniqueDates) {
      if (d === checkDate) {
        streak++;
        const prev = new Date(checkDate);
        prev.setDate(prev.getDate() - 1);
        checkDate = prev.toISOString().slice(0, 10);
      } else if (d < checkDate) {
        break;
      }
    }

    return streak;
  } catch (err) {
    console.error('[ask.handler] getUserStreak failed, defaulting to 0:', err instanceof Error ? err.message : String(err));
    return 0;
  }
}

// ─── Gemini AI 호출 (callGeminiJSON 래퍼) ───

async function callGemini(
  systemPrompt: string,
  runtimePrompt: string,
  maxTokens: number
): Promise<CoachingAIResponse> {
  const parsed = await callGeminiJSON<Record<string, unknown>>(runtimePrompt, {
    systemPrompt,
    temperature: 0.4,
    maxTokens,
  });

  return {
    judgement: (parsed.judgement as string) || '아이 상황을 확인해보겠습니다.',
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons as string[] : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions as string[] : [],
    medical: (parsed.medical as string) || undefined,
    personalNote: (parsed.personalNote as string) || '',
    followupQuestion: (parsed.followupQuestion as string) || undefined,
  };
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

  return {
    judgement: `${intro} 이런 모습을 보일 수 있어요. 걱정되시겠지만, 충분히 대처 가능한 상황이에요.`,
    reasons: [tips.reason, '아이마다 시기와 표현 방식이 달라요.'],
    actions: tips.actions,
    personalNote: `${intro} 부모님의 따뜻한 관심이 가장 큰 도움이 됩니다.`,
    followupQuestion: '내일 상태가 어떤지 알려주세요.',
  };
}

// ─── POST /api/coaching/ask -- 10단계 파이프라인 ───

export function registerAskHandler(router: Router): void {
  router.post('/ask', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId, message, category, photoUrl, audioUrl } = req.body as {
        childId: string;
        message: string;
        category?: string;
        photoUrl?: string;
        audioUrl?: string;
      };

      if (!childId || !message) {
        error(res, 'childId와 message는 필수입니다');
        return;
      }

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
      const redFlag = detectRedFlags(message);

      // ─── Step 5: 사용자 티어 확인 ───
      const tier = await getUserTier(req.userId!);
      const config = TIER_CONFIGS[tier];

      // ─── Step 6: 하루 상담 횟수 체크 (무료, 레드플래그는 제외) ───
      if (tier === 'free' && !redFlag.detected) {
        const [todayCount, userStreak] = await Promise.all([
          getTodaySessionCount(req.userId!),
          getUserStreak(req.userId!),
        ]);
        const userLevel = getLevelByStreak(userStreak);
        const dailyLimit = userLevel.dailyLimit;

        if (todayCount >= dailyLimit) {
          success(res, {
            sessionId: null,
            answer: `오늘 상담 횟수(${dailyLimit}회)를 모두 사용했어요. 꾸준히 기록하면 레벨이 올라 더 많이 상담할 수 있어요! 지금은 ${userLevel.name} (Lv.${userLevel.level})이에요.`,
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
        childName: child.name,
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
      });

      // ─── Step 9: AI 호출 ───
      let aiResponse: CoachingAIResponse;
      try {
        aiResponse = await callGemini(systemPrompt, runtimePrompt, config.maxOutputTokens);
      } catch (err) {
        console.error('Gemini call failed:', err instanceof Error ? err.message : err);
        aiResponse = getMockResponse(child.temperament, categoryKo);
      }

      // 레드플래그가 있으면 AI 응답에 추가
      if (redFlag.detected && redFlag.message) {
        aiResponse.medical = redFlag.message;
      }

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
        trackerAutoSaved,
      });
    } catch (err) {
      console.error('[ask.handler] coaching ask failed:', err instanceof Error ? err.message : String(err));
      error(res, '코칭 응답 중 오류가 발생했습니다', 500);
    }
  });
}
