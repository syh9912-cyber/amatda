import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { maskChildName } from '../utils/masking';

// ─── 새 코칭 서비스 ───
import { CoachingAIResponse, UserTier, TIER_CONFIGS, getLevelByStreak, getNextLevel } from '../services/coaching/types';
import { filterUselessQuestion } from '../services/coaching/useless.filter';
import { detectRedFlags } from '../services/coaching/red.flag.detector';
import { findTopCoachingEntries, formatCandidatesForPrompt } from '../services/coaching/db.searcher';
import { buildChildContext, buildTrackingSummary } from '../services/coaching/context.builder';
import {
  getConversationContext,
  updateConversationSummary,
  formatRecentTurns,
} from '../services/coaching/conversation.summarizer';
import { buildPrompt } from '../services/coaching/prompt.builder';
import { detectParentEmotion } from '../services/coaching/emotion.detector';
import { getTimeContext } from '../services/coaching/time.awareness';
import { getMilestoneContext } from '../services/coaching/milestone.detector';
import { generateDailyInsights } from '../services/coaching/proactive.insight';
import { generateAutoDiary, AutoDiary } from '../services/coaching/auto.diary';
import { createTimeCapsule, getOpenableCapsules, openTimeCapsule, listTimeCapsules } from '../services/coaching/time.capsule';
import { generatePeerComparison } from '../services/coaching/peer.comparison';
import { parseTrackingFromMessage, ParsedTracking } from '../services/coaching/tracker.parser';

const router = Router();

// ─── 카테고리 매핑 ───

const CATEGORY_KO: Record<string, string> = {
  crying: '울음', sleep: '수면', eating: '식사', poop: '대변',
  social: '사회성', growth: '성장', behavior: '행동', etc: '기타',
};

// ─── POST /api/coaching/ask — 10단계 파이프라인 ───

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

    // EMERGENCY 레벨: AI 호출 없이 즉시 응급 안내 반환
    if (redFlag.urgency === 'emergency') {
      const emergencySessionId = genId();
      const emergencyResponse: CoachingAIResponse = {
        redFlag: redFlag.message,
        judgement: '응급 상황이 의심됩니다. 아이의 상태를 먼저 확인해주세요.',
        reasons: redFlag.flags,
        actions: [
          '119에 전화하거나 가까운 응급실을 방문하세요',
          '아이의 의식, 호흡, 체온을 확인하세요',
          '증상 시작 시간과 경과를 메모해두세요',
        ],
        medical: redFlag.message ?? '즉시 병원 방문을 권합니다.',
        personalNote: '지금 많이 놀라셨을 거예요. 침착하게 아이 상태를 확인하시고, 조금이라도 이상하면 바로 병원에 가주세요.',
        followupQuestion: '병원 방문 후 결과가 어떠셨나요?',
      };

      await collections.coachingSessions.doc(emergencySessionId).set({
        userId: req.userId,
        childId,
        message,
        category: categoryKo,
        answer: emergencyResponse.judgement,
        reason: emergencyResponse.personalNote,
        solutions: emergencyResponse.actions,
        redFlag: redFlag.message,
        source: 'emergency',
        createdAt: FieldValue.serverTimestamp(),
      });

      success(res, {
        sessionId: emergencySessionId,
        answer: emergencyResponse.judgement,
        reason: emergencyResponse.personalNote,
        solutions: emergencyResponse.actions,
        source: 'emergency',
        category: categoryKo,
        redFlag: redFlag.message,
        reasons: emergencyResponse.reasons,
        medical: emergencyResponse.medical,
        followup: { days: 1, question: emergencyResponse.followupQuestion },
      });
      return;
    }

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

    // 레드플래그가 있으면 AI 응답에 병원 안내 보강
    if (redFlag.detected && redFlag.message) {
      // AI가 medical을 비워두거나 약하게 쓴 경우 레드플래그 메시지로 보강
      if (!aiResponse.medical || aiResponse.medical === 'null') {
        aiResponse.medical = redFlag.message;
      } else {
        aiResponse.medical = `${redFlag.message} ${aiResponse.medical}`;
      }
      aiResponse.redFlag = redFlag.message;
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
  } catch {
    error(res, '코칭 응답 중 오류가 발생했습니다', 500);
  }
});

// ─── Gemini AI 호출 ───

async function callGemini(
  systemPrompt: string,
  runtimePrompt: string,
  maxTokens: number
): Promise<CoachingAIResponse> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || env.MOCK_AI) {
    throw new Error('MOCK_MODE');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: runtimePrompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );

  const rawBody = await response.text();
  let data: { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    console.error('Gemini raw response not JSON:', rawBody.substring(0, 200));
    throw new Error('Gemini response not JSON');
  }

  if (data.error) {
    console.error('Gemini API error:', data.error.message);
    throw new Error('Gemini API error: ' + data.error.message);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) {
    console.error('Gemini empty response, full:', JSON.stringify(data).substring(0, 300));
    throw new Error('Gemini empty response');
  }

  // markdown 코드펜스 제거
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // 잘린 JSON 복구 시도: 마지막 { 이후를 닫아줌
    const openIdx = cleaned.indexOf('{');
    if (openIdx >= 0) {
      let truncated = cleaned.substring(openIdx);
      // 열린 괄호 수만큼 닫기
      const opens = (truncated.match(/\{/g) || []).length;
      const closes = (truncated.match(/\}/g) || []).length;
      for (let i = 0; i < opens - closes; i++) truncated += '}';
      // 잘린 문자열/배열 닫기
      truncated = truncated.replace(/,\s*$/, '');
      truncated = truncated.replace(/"[^"]*$/, '"');
      truncated = truncated.replace(/\[\s*("[^"]*",?\s*)*$/, (m) => m.endsWith(']') ? m : m.replace(/,\s*$/, '') + ']');
      jsonMatch = truncated.match(/\{[\s\S]*\}/);
    }
    if (!jsonMatch) {
      console.error('Gemini no JSON in response:', text.substring(0, 300));
      throw new Error('JSON parse failed');
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    console.error('Gemini JSON parse error, raw:', jsonMatch[0].substring(0, 300));
    throw new Error('JSON parse failed');
  }

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
  } catch {
    return 'free';
  }
}

async function getTodaySessionCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  try {
    const snap = await collections.coachingSessions
      .where('userId', '==', userId)
      .where('createdAt', '>=', today.toISOString())
      .get();
    // filter/limit 소스는 AI 비용 없으므로 제외
    return snap.docs.filter((d) => {
      const src = (d.data() as Record<string, unknown>).source as string;
      return src !== 'filter' && src !== 'limit';
    }).length;
  } catch {
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
  } catch {
    return 0;
  }
}

// ─── GET /api/coaching/history/:childId ───

router.get('/history/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.params;
    const snap = await collections.coachingSessions
      .where('userId', '==', req.userId)
      .where('childId', '==', childId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const sessions = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    }));

    success(res, sessions);
  } catch (err) {
    console.error('History error:', err);
    error(res, '코칭 기록 조회 중 오류가 발생했습니다', 500);
  }
});

// ─── GET /api/coaching/followups/:childId ───

router.get('/followups/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.params;
    const now = new Date().toISOString();

    const snap = await collections.followups
      .where('userId', '==', req.userId)
      .where('childId', '==', childId)
      .where('status', '==', 'pending')
      .orderBy('dueDate', 'asc')
      .get();

    const allFollowups: Array<Record<string, unknown>> = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return { id: d.id, ...data };
    });
    const dueFollowups = allFollowups.filter((f) => {
      const due = f.dueDate as string | undefined;
      return due ? due <= now : false;
    });

    success(res, dueFollowups);
  } catch (err) {
    console.error('Followups error:', err);
    error(res, '팔로업 조회 중 오류가 발생했습니다', 500);
  }
});

// ─── POST /api/coaching/followup/:id/respond ───

router.post('/followup/:id/respond', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { answer } = req.body as { answer: string };

    if (!answer) {
      error(res, '답변을 입력해주세요');
      return;
    }

    const doc = await collections.followups.doc(id).get();
    if (!doc.exists) {
      error(res, '팔로업을 찾을 수 없습니다', 404);
      return;
    }

    const followupData = doc.data() as Record<string, unknown>;
    if (followupData.userId !== req.userId) {
      error(res, '권한이 없습니다', 403);
      return;
    }

    // 팔로업 응답 → 새 코칭 세션으로 처리
    const child = await buildChildContext(
      followupData.childId as string,
      req.userId!
    );
    const temperament = child?.temperament ?? '조화형';

    const positive = answer.includes('좋아') || answer.includes('나아') || answer.includes('줄었');
    const coachingReply = positive
      ? `다행이에요! ${temperament} 기질의 아이에게 잘 맞는 방법을 찾으신 것 같아요. 꾸준히 유지해주세요.`
      : `아직 어려우시군요. ${temperament} 기질의 아이에게는 시간이 좀 더 필요할 수 있어요. 다른 방법을 시도해보시거나, 궁금한 점이 있으면 더 질문해주세요.`;

    await collections.followups.doc(id).update({
      response: answer,
      respondedAt: new Date().toISOString(),
      coachingReply,
      status: 'completed',
    });

    success(res, { coachingReply });
  } catch {
    error(res, '팔로업 응답 중 오류가 발생했습니다', 500);
  }
});

// ─── POST /api/coaching/first-talk — 온보딩 후 AI가 먼저 말 걸기 ───

const TOP_CONCERNS: Record<string, Record<string, string>> = {
  infant: {
    '활동형': '밤에 자주 깨서 울어요',
    '탐구형': '낯선 환경에서 예민하게 반응해요',
    '조화형': '분리불안이 심해요',
    '분석형': '새로운 음식을 거부해요',
    '감성형': '쉽게 칭얼거리고 보채요',
  },
  toddler: {
    '활동형': '가만히 앉아 있질 못해요',
    '탐구형': '왜? 질문이 끝이 없어요',
    '조화형': '어린이집 갈 때 너무 울어요',
    '분석형': '편식이 심해졌어요',
    '감성형': '사소한 것에도 많이 울어요',
  },
  preschool: {
    '활동형': '친구를 때리거나 밀어요',
    '탐구형': '집중력이 너무 짧아요',
    '조화형': '혼자 놀지 못하고 항상 엄마를 찾아요',
    '분석형': '실수하면 크게 좌절해요',
    '감성형': '감정 기복이 심해요',
  },
};

router.post('/first-talk', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.body as { childId: string };
    if (!childId) {
      error(res, 'childId는 필수입니다');
      return;
    }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) {
      error(res, '자녀 정보를 찾을 수 없습니다', 404);
      return;
    }

    // 연령 구간 결정
    let ageGroup = 'infant';
    if (child.ageMonths >= 25 && child.ageMonths <= 72) ageGroup = 'toddler';
    else if (child.ageMonths > 72) ageGroup = 'preschool';

    // 기질별 대표 고민
    const concerns = TOP_CONCERNS[ageGroup] ?? TOP_CONCERNS.toddler;
    const topConcern = concerns[child.temperament] ?? concerns['조화형'];

    // AI에게 첫 인사 생성 요청
    const apiKey = env.GEMINI_API_KEY;
    let greeting: {
      intro: string;
      traitSummary: string;
      suggestedQuestion: string;
      quickOptions: string[];
    };

    if (apiKey && !env.MOCK_AI) {
      try {
        const prompt = `너는 영유아 육아 코치야. 아이가 방금 등록되었어. 부모에게 처음 인사하면서 아이 기질을 설명하고 첫 질문을 유도해.

아이 정보:
- 이름: ${child.name}
- 나이: ${child.ageInfo}
- 성별: ${child.gender}
- 기질: ${child.temperament}
- 기질 특성: ${child.temperamentDetail}

반드시 아래 JSON만 출력해:
{
  "intro": "반갑다는 인사 + 아이 이름 호명 (1문장)",
  "traitSummary": "이 아이의 기질을 부모가 이해하기 쉽게 2~3문장으로 설명. '사주/오행' 용어 절대 금지. 기질/성향/에너지로만 표현",
  "suggestedQuestion": "이 기질과 월령에서 가장 흔한 고민을 자연스럽게 물어보는 1문장",
  "quickOptions": ["네, 아이가 그래요! 도움이 필요해요", "아이에 대해 다른 고민이 있어요", "아이 수면 습관이 궁금해요"]
}`;

        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
            }),
          }
        );

        const raw = await resp.text();
        const parsed = JSON.parse(raw) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const aiText = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const cleaned = aiText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          greeting = JSON.parse(jsonMatch[0]) as typeof greeting;
        } else {
          throw new Error('parse failed');
        }
      } catch {
        greeting = getDefaultGreeting(child.name, child.ageInfo, child.temperament, topConcern);
      }
    } else {
      greeting = getDefaultGreeting(child.name, child.ageInfo, child.temperament, topConcern);
    }

    success(res, {
      childId,
      childName: child.name,
      ageInfo: child.ageInfo,
      temperament: child.temperament,
      ...greeting,
    });
  } catch {
    error(res, '첫 대화 생성 중 오류가 발생했습니다', 500);
  }
});

function getDefaultGreeting(
  name: string, ageInfo: string, temperament: string, topConcern: string
): { intro: string; traitSummary: string; suggestedQuestion: string; quickOptions: string[] } {
  const traitDesc: Record<string, string> = {
    '활동형': `${name}이는 에너지가 넘치고 활발한 활동형 기질이에요. 새로운 것에 도전하는 걸 좋아하지만, 에너지 발산이 안 되면 짜증이 늘 수 있어요. 충분한 신체 활동과 함께 차분한 시간을 균형 있게 가져주는 게 중요해요.`,
    '탐구형': `${name}이는 호기심이 강하고 관찰력이 뛰어난 탐구형 기질이에요. "왜?"라는 질문으로 세상을 이해하려 하고, 새로운 것을 발견하면 집중력이 높아져요. 충분한 탐색 시간을 주시면 좋아요.`,
    '조화형': `${name}이는 따뜻하고 안정적인 조화형 기질이에요. 규칙적인 생활을 좋아하고, 친숙한 환경에서 편안함을 느껴요. 갑작스러운 변화보다는 미리 알려주고 준비 시간을 주시면 좋아요.`,
    '분석형': `${name}이는 꼼꼼하고 논리적인 분석형 기질이에요. 규칙과 패턴을 좋아하고, 이유를 알면 더 잘 따라와요. 명확한 설명과 예측 가능한 루틴이 아이에게 안정감을 줄 거예요.`,
    '감성형': `${name}이는 감정이 풍부하고 공감 능력이 뛰어난 감성형 기질이에요. 주변 분위기에 민감하게 반응하고, 감정 표현이 다양해요. 아이의 감정을 먼저 읽어주고 공감해주시면 큰 힘이 돼요.`,
  };

  return {
    intro: `${name}이를 만나게 되어 반가워요!`,
    traitSummary: traitDesc[temperament] ?? `${name}이는 고유한 기질을 가진 아이에요. 아이의 성향을 이해하면 육아가 한결 수월해질 거예요.`,
    suggestedQuestion: `${ageInfo} ${temperament} 아이에게 가장 많은 고민이 "${topConcern}"인데, 혹시 ${name}이도 비슷한가요?`,
    quickOptions: ['네, 아이가 그래요! 도움이 필요해요', '아이에 대해 다른 고민이 있어요', '아이 수면 습관이 궁금해요'],
  };
}

// ─── POST /api/coaching/weekly-report — 주간 AI 리포트 ───

router.post('/weekly-report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.body as { childId: string };
    if (!childId) { error(res, 'childId 필수'); return; }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    // 이번 주 상담 내역 조회
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const sessionsSnap = await collections.coachingSessions
      .where('userId', '==', req.userId)
      .where('childId', '==', childId)
      .where('createdAt', '>=', weekAgo.toISOString())
      .orderBy('createdAt', 'desc')
      .get();

    const sessions = sessionsSnap.docs.map((d) => d.data() as Record<string, unknown>);
    const totalCount = sessions.filter((s) => s.source !== 'filter' && s.source !== 'limit').length;
    const categories = sessions.map((s) => s.category as string).filter(Boolean);
    const topCategory = getMostFrequent(categories) || '없음';

    // 요약 텍스트
    const sessionSummary = sessions
      .filter((s) => s.source !== 'filter')
      .slice(0, 5)
      .map((s) => `- ${s.category}: ${(s.message as string)?.slice(0, 30)}`)
      .join('\n') || '이번 주 상담 내역이 없습니다.';

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || env.MOCK_AI || totalCount === 0) {
      success(res, {
        childName: child.name,
        ageInfo: child.ageInfo,
        period: `${weekAgo.toISOString().slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`,
        totalSessions: totalCount,
        topCategory,
        report: totalCount === 0
          ? `이번 주에는 ${child.name}이에 대한 상담이 없었어요. 궁금한 점이 있으면 언제든 물어봐주세요!`
          : `이번 주 ${child.name}이에 대해 ${totalCount}건의 상담을 하셨어요. 주로 ${topCategory} 관련 고민이 많으셨네요. 꾸준히 아이를 관찰하고 계신 모습이 훌륭합니다!`,
        tip: `${child.temperament} 기질의 ${child.ageInfo} 아이에게는 일관된 루틴과 따뜻한 반응이 가장 중요해요.`,
      });
      return;
    }

    // AI 주간 리포트
    try {
      const prompt = `아래 육아 상담 내역을 보고 부모님께 주간 리포트를 작성해줘.

아이: ${child.name} (${child.ageInfo}, ${child.gender}, ${child.temperament})
이번 주 상담 ${totalCount}건, 주요 카테고리: ${topCategory}

상담 내역:
${sessionSummary}

JSON만 출력해:
{
  "report": "이번 주 상담을 종합한 2~3문장 요약",
  "improvement": "좋아진 점이나 칭찬할 점 1문장",
  "nextWeekTip": "다음 주에 시도해볼 한 가지 1문장"
}`;

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
          }),
        }
      );

      const raw = await resp.text();
      const data = JSON.parse(raw) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = aiText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      const report = match ? JSON.parse(match[0]) as Record<string, string> : null;

      success(res, {
        childName: child.name,
        ageInfo: child.ageInfo,
        period: `${weekAgo.toISOString().slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`,
        totalSessions: totalCount,
        topCategory,
        report: report?.report ?? `이번 주 ${totalCount}건 상담하셨어요.`,
        improvement: report?.improvement ?? '',
        nextWeekTip: report?.nextWeekTip ?? '',
      });
    } catch {
      success(res, {
        childName: child.name,
        period: `${weekAgo.toISOString().slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`,
        totalSessions: totalCount,
        topCategory,
        report: `이번 주 ${child.name}이에 대해 ${totalCount}건 상담하셨어요.`,
      });
    }
  } catch (err) {
    console.error('Weekly report error:', err);
    error(res, '주간 리포트 생성 중 오류', 500);
  }
});

function getMostFrequent(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const item of arr) counts[item] = (counts[item] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── GET /api/coaching/milestones/:childId — 성장 마일스톤 체크 ───

interface MilestoneItemDef {
  id: string;
  label: string;
  domain: string;       // 대근육 | 소근육 | 언어 | 인지 | 사회성 | 정서 | 자조
  description: string;  // 부모에게 보여줄 구체적 설명
}

const MILESTONES: Array<{ months: number; label: string; items: MilestoneItemDef[] }> = [
  { months: 6, label: '6개월', items: [
    { id: 'm6_1', label: '뒤집기를 해요', domain: '대근육', description: '엎드린 자세에서 등으로, 또는 반대로 뒤집기를 시도하는지 관찰하세요.' },
    { id: 'm6_2', label: '손에 쥔 물건을 옮겨 쥐어요', domain: '소근육', description: '한 손에서 다른 손으로 장난감을 옮기는지 확인하세요.' },
    { id: 'm6_3', label: '옹알이를 해요', domain: '언어', description: '"바바", "마마" 같은 반복 소리를 내는지 들어보세요.' },
    { id: 'm6_4', label: '거울 속 자신에게 반응해요', domain: '인지', description: '거울을 보고 웃거나 손을 뻗는지 관찰하세요.' },
    { id: 'm6_5', label: '낯선 사람을 경계해요', domain: '사회성', description: '낯선 사람과 익숙한 사람을 구별하여 반응하는지 보세요.' },
    { id: 'm6_6', label: '소리나는 방향으로 고개를 돌려요', domain: '인지', description: '이름을 부르거나 소리가 나면 그 방향을 보는지 확인하세요.' },
  ]},
  { months: 12, label: '12개월', items: [
    { id: 'm12_1', label: '잡고 서 있을 수 있어요', domain: '대근육', description: '가구나 손을 잡고 스스로 서는지 확인하세요.' },
    { id: 'm12_2', label: '"엄마", "아빠"를 말해요', domain: '언어', description: '의미를 가진 첫 단어를 말하는지 들어보세요.' },
    { id: 'm12_3', label: '손가락으로 가리키며 원하는 것을 표현해요', domain: '인지', description: '원하는 물건이나 흥미로운 것을 손가락으로 가리키는지 보세요.' },
    { id: 'm12_4', label: '엄지와 검지로 작은 물건을 집어요', domain: '소근육', description: '작은 과자 등을 두 손가락으로 정교하게 집는지 확인하세요.' },
    { id: 'm12_5', label: '까꿍 놀이에 반응해요', domain: '사회성', description: '까꿍 놀이를 하면 웃거나 스스로 시도하는지 보세요.' },
    { id: 'm12_6', label: '"안 돼"라고 하면 멈추거나 반응해요', domain: '정서', description: '간단한 금지 표현에 반응하는지 관찰하세요.' },
    { id: 'm12_7', label: '컵으로 마시기를 시도해요', domain: '자조', description: '도움을 받아 컵으로 물을 마시려 하는지 확인하세요.' },
  ]},
  { months: 18, label: '18개월', items: [
    { id: 'm18_1', label: '혼자 걸을 수 있어요', domain: '대근육', description: '잡지 않고 여러 걸음을 걷는지 확인하세요.' },
    { id: 'm18_2', label: '단어를 5~10개 말해요', domain: '언어', description: '"맘마", "물", "이거" 등 의미 있는 단어를 5개 이상 쓰는지 세어보세요.' },
    { id: 'm18_3', label: '크레파스로 끄적거려요', domain: '소근육', description: '크레파스나 연필을 쥐고 종이에 흔적을 남기는지 확인하세요.' },
    { id: 'm18_4', label: '숟가락 사용을 시도해요', domain: '자조', description: '음식을 숟가락에 담아 입으로 가져가려 하는지 보세요.' },
    { id: 'm18_5', label: '간단한 지시를 이해해요', domain: '인지', description: '"공 가져와", "신발 가져와" 같은 지시에 반응하는지 관찰하세요.' },
    { id: 'm18_6', label: '다른 아이에게 관심을 보여요', domain: '사회성', description: '또래 아이를 바라보거나 다가가는지 확인하세요.' },
    { id: 'm18_7', label: '좋아하는 것을 표현해요', domain: '정서', description: '좋으면 웃고, 싫으면 고개를 젓는 등 감정 표현을 하는지 보세요.' },
  ]},
  { months: 24, label: '24개월', items: [
    { id: 'm24_1', label: '두 단어를 조합해 말해요', domain: '언어', description: '"엄마 물", "아빠 가" 같은 두 단어 문장을 만드는지 확인하세요.' },
    { id: 'm24_2', label: '계단을 오를 수 있어요', domain: '대근육', description: '난간을 잡고 한 발씩 계단을 오르는지 보세요.' },
    { id: 'm24_3', label: '블록을 4개 이상 쌓아요', domain: '소근육', description: '블록이나 컵을 4개 이상 쌓을 수 있는지 시도해보세요.' },
    { id: 'm24_4', label: '신체 부위를 가리킬 수 있어요', domain: '인지', description: '"코 어디야?", "눈 어디야?" 하면 정확히 가리키는지 확인하세요.' },
    { id: 'm24_5', label: '또래와 나란히 놀아요', domain: '사회성', description: '같은 공간에서 또래와 각자 놀이를 하는 병행 놀이를 하는지 보세요.' },
    { id: 'm24_6', label: '물건의 용도를 알아요', domain: '인지', description: '전화기를 귀에 대거나 빗으로 머리를 빗는 등 흉내를 내는지 확인하세요.' },
    { id: 'm24_7', label: '혼자 신발을 벗을 수 있어요', domain: '자조', description: '벨크로 신발 등을 스스로 벗으려 시도하는지 보세요.' },
  ]},
  { months: 36, label: '36개월', items: [
    { id: 'm36_1', label: '세 단어 이상 문장을 말해요', domain: '언어', description: '"엄마 나 배고파" 같은 문장을 말하는지 들어보세요.' },
    { id: 'm36_2', label: '세발자전거 페달을 밟아요', domain: '대근육', description: '세발자전거를 타고 페달을 돌려 이동하는지 확인하세요.' },
    { id: 'm36_3', label: '가위를 사용해봐요', domain: '소근육', description: '안전가위로 종이를 자르려 시도하는지 보세요.' },
    { id: 'm36_4', label: '"왜?"라고 질문해요', domain: '인지', description: '궁금한 것에 대해 질문을 하기 시작하는지 관찰하세요.' },
    { id: 'm36_5', label: '친구와 함께 놀아요', domain: '사회성', description: '또래와 역할을 나누거나 함께 놀이하는지 보세요.' },
    { id: 'm36_6', label: '자기 이름을 말할 수 있어요', domain: '인지', description: '"이름이 뭐야?" 하면 대답하는지 확인하세요.' },
    { id: 'm36_7', label: '혼자 손을 씻을 수 있어요', domain: '자조', description: '물을 틀고 비누칠 후 헹구는 과정을 시도하는지 보세요.' },
    { id: 'm36_8', label: '감정을 말로 표현해요', domain: '정서', description: '"화났어", "슬퍼" 같은 감정 단어를 사용하는지 들어보세요.' },
  ]},
  { months: 48, label: '48개월', items: [
    { id: 'm48_1', label: '한 발로 잠깐 서 있을 수 있어요', domain: '대근육', description: '한 발로 2~3초 이상 균형을 잡는지 확인하세요.' },
    { id: 'm48_2', label: '긴 문장으로 이야기해요', domain: '언어', description: '오늘 있었던 일을 4~5단어 이상 문장으로 설명하는지 들어보세요.' },
    { id: 'm48_3', label: '가위로 직선을 따라 자를 수 있어요', domain: '소근육', description: '선을 따라 종이를 자르는 것이 가능한지 시도해보세요.' },
    { id: 'm48_4', label: '색깔 이름을 4가지 이상 알아요', domain: '인지', description: '"이건 무슨 색이야?" 하면 빨강, 파랑, 노랑, 초록 등을 맞추는지 확인하세요.' },
    { id: 'm48_5', label: '혼자 옷을 입을 수 있어요', domain: '자조', description: '단추나 지퍼 없는 옷을 스스로 입고 벗는지 보세요.' },
    { id: 'm48_6', label: '차례를 기다릴 수 있어요', domain: '사회성', description: '놀이나 식사에서 자기 차례를 기다리는지 관찰하세요.' },
    { id: 'm48_7', label: '상상 놀이를 해요', domain: '정서', description: '인형에게 밥 주기 등 상상 속 역할놀이를 하는지 보세요.' },
  ]},
  { months: 60, label: '60개월', items: [
    { id: 'm60_1', label: '10까지 숫자를 세요', domain: '인지', description: '물건을 짚어가며 1~10까지 정확히 세는지 확인하세요.' },
    { id: 'm60_2', label: '사람 그림에 팔다리가 있어요', domain: '소근육', description: '사람을 그릴 때 머리, 몸통, 팔, 다리가 구분되는지 보세요.' },
    { id: 'm60_3', label: '규칙이 있는 게임에 참여해요', domain: '사회성', description: '간단한 보드게임이나 술래잡기 규칙을 이해하고 따르는지 확인하세요.' },
    { id: 'm60_4', label: '한 발로 깡충 뛸 수 있어요', domain: '대근육', description: '한 발로 여러 번 연속 점프가 가능한지 시도해보세요.' },
    { id: 'm60_5', label: '이야기의 순서를 이해해요', domain: '언어', description: '동화를 듣고 "그 다음에?" 하면 이어서 말하는지 확인하세요.' },
    { id: 'm60_6', label: '자기 감정의 이유를 설명해요', domain: '정서', description: '"왜 화났어?" 하면 "OO가 나를 때렸어" 같이 이유를 말하는지 들어보세요.' },
    { id: 'm60_7', label: '혼자 화장실에 가요', domain: '자조', description: '화장실 사용과 뒤처리를 스스로 하는지 확인하세요.' },
  ]},
  { months: 72, label: '72개월 (초등 입학)', items: [
    { id: 'm72_1', label: '자기 이름을 쓸 수 있어요', domain: '소근육', description: '한글로 자신의 이름을 쓸 수 있는지 확인하세요.' },
    { id: 'm72_2', label: '간단한 덧뺄셈을 해요', domain: '인지', description: '5 이내의 덧셈 뺄셈을 손가락으로 할 수 있는지 보세요.' },
    { id: 'm72_3', label: '줄넘기를 할 수 있어요', domain: '대근육', description: '줄넘기를 연속으로 3회 이상 뛸 수 있는지 시도해보세요.' },
    { id: 'm72_4', label: '하루 일과를 설명할 수 있어요', domain: '언어', description: '"오늘 뭐 했어?" 하면 순서대로 이야기하는지 확인하세요.' },
    { id: 'm72_5', label: '규칙을 지키려 노력해요', domain: '사회성', description: '게임이나 생활 규칙을 이해하고 지키려 하는지 관찰하세요.' },
    { id: 'm72_6', label: '다른 사람 감정에 공감해요', domain: '정서', description: '친구가 울면 위로하거나 걱정하는 모습을 보이는지 확인하세요.' },
  ]},
  { months: 96, label: '96개월 (초등 저학년)', items: [
    { id: 'm96_1', label: '긴 글을 읽고 이해해요', domain: '인지', description: '짧은 동화책을 혼자 읽고 내용을 설명할 수 있는지 확인하세요.' },
    { id: 'm96_2', label: '공을 정확히 던지고 받아요', domain: '대근육', description: '2~3m 거리에서 공을 주고받을 수 있는지 해보세요.' },
    { id: 'm96_3', label: '자기 생각을 글로 써요', domain: '소근육', description: '일기나 편지를 3~4문장 이상 쓸 수 있는지 확인하세요.' },
    { id: 'm96_4', label: '시간 개념을 이해해요', domain: '인지', description: '시계를 보고 "지금 3시야" 같이 말할 수 있는지 확인하세요.' },
    { id: 'm96_5', label: '그룹 활동에서 협력해요', domain: '사회성', description: '모둠 활동에서 역할을 나누고 협동하는지 관찰하세요.' },
    { id: 'm96_6', label: '실수했을 때 사과할 수 있어요', domain: '정서', description: '자신의 잘못을 인정하고 "미안해"라고 말하는지 보세요.' },
  ]},
  { months: 120, label: '120개월 (초등 고학년)', items: [
    { id: 'm120_1', label: '스스로 학습 계획을 세워요', domain: '인지', description: '할 일 목록을 만들거나 시간을 나누어 공부하는지 확인하세요.' },
    { id: 'm120_2', label: '복잡한 규칙의 운동/게임을 해요', domain: '대근육', description: '축구, 농구 등 규칙 있는 팀 운동에 참여하는지 보세요.' },
    { id: 'm120_3', label: '자기 의견을 논리적으로 말해요', domain: '언어', description: '"왜 그렇게 생각해?" 하면 이유를 들어 설명하는지 확인하세요.' },
    { id: 'm120_4', label: '용돈을 계획적으로 사용해요', domain: '인지', description: '용돈을 받으면 저축과 소비를 나누려 하는지 관찰하세요.' },
    { id: 'm120_5', label: '갈등을 스스로 해결하려 해요', domain: '사회성', description: '친구와 다툰 후 대화로 해결하려 시도하는지 보세요.' },
    { id: 'm120_6', label: '감정을 조절하려 노력해요', domain: '정서', description: '화가 나도 심호흡 등으로 스스로 진정하려 하는지 관찰하세요.' },
  ]},
];

router.get('/milestones/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    // 현재 월령에 해당하는 마일스톤 + 다음 마일스톤
    const current = MILESTONES.filter((m) => m.months <= child.ageMonths).pop();
    const next = MILESTONES.find((m) => m.months > child.ageMonths);

    // Firestore에서 저장된 체크 상태 불러오기
    const docId = `${req.userId}_${childId}`;
    const savedDoc = await collections.milestoneChecks.doc(docId).get();
    const savedChecks: Record<string, boolean> = savedDoc.exists
      ? (savedDoc.data()?.checks as Record<string, boolean>) ?? {}
      : {};

    // 현재 마일스톤 items에 saved 상태 병합
    const currentItems = current?.items.map((item) => ({
      ...item,
      completed: savedChecks[item.id] ?? false,
    })) ?? [];

    success(res, {
      ageLabel: current?.label ?? '',
      items: currentItems,
      nextMilestone: next ? `${next.label} 발달 목표` : '모든 발달 단계를 완료했어요!',
      daysUntilNext: next ? Math.max(0, (next.months - child.ageMonths) * 30) : 0,
    });
  } catch {
    error(res, '마일스톤 조회 중 오류', 500);
  }
});

// ─── POST /api/coaching/milestones/:childId/check — 체크 상태 저장 ───

router.post('/milestones/:childId/check', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const { checks } = req.body as { checks: Record<string, boolean> };
    if (!checks || typeof checks !== 'object') {
      error(res, 'checks 객체가 필요합니다');
      return;
    }

    const docId = `${req.userId}_${childId}`;
    await collections.milestoneChecks.doc(docId).set(
      { checks, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    success(res, { saved: true });
  } catch {
    error(res, '체크 저장 중 오류', 500);
  }
});

// ─── POST /api/coaching/daily-diary — AI 육아일기 자동 생성 ───

router.post('/daily-diary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.body as { childId: string };
    if (!childId) { error(res, 'childId 필수'); return; }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    // 오늘 상담 내역 조회
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const sessionsSnap = await collections.coachingSessions
      .where('userId', '==', req.userId)
      .where('childId', '==', childId)
      .where('createdAt', '>=', todayISO)
      .orderBy('createdAt', 'asc')
      .get();

    const sessions = sessionsSnap.docs
      .map((d) => d.data() as Record<string, unknown>)
      .filter((s) => s.source !== 'filter' && s.source !== 'limit');

    // 오늘 추적 데이터 조회
    const todayStr = new Date().toISOString().slice(0, 10);
    const trackingSnap = await collections.dailyTracking
      .where('childId', '==', childId)
      .where('date', '==', todayStr)
      .limit(1)
      .get();
    const trackingData = trackingSnap.docs[0]?.data() as Record<string, unknown> | undefined;

    if (sessions.length === 0 && !trackingData) {
      success(res, {
        childName: child.name,
        date: todayStr,
        diary: '오늘은 아직 기록이 없어요. 아이와의 하루를 기록하면 AI가 따뜻한 일기를 만들어드려요!',
      });
      return;
    }

    // 세션 요약 텍스트
    const sessionTexts = sessions.slice(0, 8).map((s) =>
      `[${s.category}] Q: ${(s.message as string)?.slice(0, 40)} / A: ${(s.answer as string)?.slice(0, 60)}`
    ).join('\n');

    // 추적 데이터 요약
    const trackingSummaryText = trackingData
      ? buildTrackingText(trackingData)
      : '추적 데이터 없음';

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || env.MOCK_AI) {
      success(res, {
        childName: child.name,
        date: todayStr,
        diary: buildMockDiary(child.name, child.temperament, sessions.length),
      });
      return;
    }

    try {
      const prompt = `너는 따뜻한 육아일기 작가야. 오늘 하루 부모가 아이와 보낸 기록을 바탕으로 감성적이고 개인적인 육아일기를 한국어로 2~3문단 작성해.

아이: ${child.name} (${child.ageInfo}, ${child.gender}, ${child.temperament})
날짜: ${todayStr}

오늘 상담 내역:
${sessionTexts || '없음'}

오늘 추적 기록:
${trackingSummaryText}

규칙:
- 부모 시점(1인칭)으로 작성
- 사주/오행 용어 절대 금지
- 따뜻하고 일상적인 톤으로
- 아이 이름을 자연스럽게 포함
- JSON 없이 일기 텍스트만 출력`;

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
          }),
        }
      );

      const raw = await resp.text();
      const data = JSON.parse(raw) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      success(res, {
        childName: child.name,
        date: todayStr,
        diary: aiText.trim() || buildMockDiary(child.name, child.temperament, sessions.length),
      });
    } catch {
      success(res, {
        childName: child.name,
        date: todayStr,
        diary: buildMockDiary(child.name, child.temperament, sessions.length),
      });
    }
  } catch (err: unknown) {
    console.error('daily-diary error:', err);
    error(res, '육아일기 생성 중 오류', 500);
  }
});

function buildTrackingText(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.sleepHours) parts.push(`수면 ${data.sleepHours}시간`);
  if (data.meals) parts.push(`식사 ${data.meals}회`);
  if (data.poopCount) parts.push(`대변 ${data.poopCount}회`);
  if (data.mood) parts.push(`기분: ${data.mood}`);
  if (data.note) parts.push(`메모: ${(data.note as string).slice(0, 50)}`);
  return parts.length > 0 ? parts.join(', ') : '기록 없음';
}

function buildMockDiary(name: string, temperament: string, sessionCount: number): string {
  if (sessionCount === 0) {
    return `오늘 ${name}이와 조용한 하루를 보냈다. ${temperament} 기질답게 자기만의 방식으로 세상을 탐색하는 모습이 대견했다. 내일은 어떤 모습을 보여줄지 기대된다.`;
  }
  return `오늘 ${name}이에 대해 ${sessionCount}가지를 고민했다. ${temperament} 기질의 아이를 키우면서 매일 새로운 것을 배운다. 걱정도 되지만, ${name}이가 건강하게 자라는 모습을 보면 모든 고민이 사라진다. 내일도 함께 성장하자.`;
}

// ─── POST /api/coaching/parent-mental — 부모 멘탈 감지 ───

router.post('/parent-mental', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.body as { childId: string };
    if (!childId) { error(res, 'childId 필수'); return; }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    // 최근 7일 상담 내역
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const sessionsSnap = await collections.coachingSessions
      .where('userId', '==', req.userId)
      .where('childId', '==', childId)
      .where('createdAt', '>=', weekAgo.toISOString())
      .orderBy('createdAt', 'desc')
      .get();

    const sessions = sessionsSnap.docs
      .map((d) => d.data() as Record<string, unknown>)
      .filter((s) => s.source !== 'filter' && s.source !== 'limit');

    // 스트레스 패턴 분석
    const stressSignals = analyzeStressPatterns(sessions);

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || env.MOCK_AI) {
      success(res, buildMockMentalResult(child.name, child.temperament, stressSignals));
      return;
    }

    try {
      const sessionTexts = sessions.slice(0, 10).map((s) =>
        `[${s.category}] ${(s.message as string)?.slice(0, 50)} (${(s.createdAt as string)?.slice(11, 16)})`
      ).join('\n');

      const prompt = `너는 부모 멘탈 케어 전문가야. 최근 7일 상담 내역을 분석해서 부모의 스트레스 수준을 판단하고 응원 메시지를 작성해.

부모 상담 패턴:
- 총 상담 횟수: ${sessions.length}건
- 야간 상담(22시~6시): ${stressSignals.lateNightCount}건
- 부정 키워드 감지: ${stressSignals.negativeWords}개
- 같은 카테고리 반복: ${stressSignals.repeatedCategory || '없음'}

상담 내역:
${sessionTexts || '없음'}

아이: ${child.name} (${child.ageInfo}, ${child.temperament})

반드시 아래 JSON만 출력해:
{
  "stressLevel": "low" 또는 "medium" 또는 "high",
  "message": "현재 부모 상태에 대한 공감 + 분석 2~3문장",
  "encouragement": "진심 어린 응원 메시지 1~2문장"
}`;

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 400 },
          }),
        }
      );

      const raw = await resp.text();
      const data = JSON.parse(raw) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = aiText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);

      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, string>;
        success(res, {
          stressLevel: parsed.stressLevel || stressSignals.level,
          message: parsed.message || '',
          encouragement: parsed.encouragement || '',
          analysisData: {
            totalSessions: sessions.length,
            lateNightCount: stressSignals.lateNightCount,
            negativeWords: stressSignals.negativeWords,
          },
        });
      } else {
        success(res, buildMockMentalResult(child.name, child.temperament, stressSignals));
      }
    } catch {
      success(res, buildMockMentalResult(child.name, child.temperament, stressSignals));
    }
  } catch {
    error(res, '부모 멘탈 분석 중 오류', 500);
  }
});

interface StressSignals {
  level: 'low' | 'medium' | 'high';
  lateNightCount: number;
  negativeWords: number;
  repeatedCategory: string | null;
}

function analyzeStressPatterns(sessions: Array<Record<string, unknown>>): StressSignals {
  let lateNightCount = 0;
  let negativeWords = 0;
  const negativeKeywords = ['힘들', '지치', '못', '안', '울', '짜증', '화', '포기', '한계', '미치', '죽겠'];
  const categoryCounts: Record<string, number> = {};

  for (const s of sessions) {
    // 야간 사용 체크
    const createdAt = s.createdAt as string | undefined;
    if (createdAt) {
      const hour = parseInt(createdAt.slice(11, 13), 10);
      if (hour >= 22 || hour < 6) lateNightCount++;
    }

    // 부정 키워드
    const msg = (s.message as string) || '';
    for (const kw of negativeKeywords) {
      if (msg.includes(kw)) negativeWords++;
    }

    // 카테고리 반복
    const cat = s.category as string;
    if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const repeatedEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const repeatedCategory = repeatedEntry && repeatedEntry[1] >= 3 ? repeatedEntry[0] : null;

  let level: 'low' | 'medium' | 'high' = 'low';
  const score = lateNightCount * 2 + negativeWords + (repeatedCategory ? 3 : 0);
  if (score >= 8) level = 'high';
  else if (score >= 4) level = 'medium';

  return { level, lateNightCount, negativeWords, repeatedCategory };
}

function buildMockMentalResult(
  childName: string, temperament: string, signals: StressSignals
): { stressLevel: string; message: string; encouragement: string; analysisData: Record<string, unknown> } {
  const messages: Record<string, string> = {
    low: `${childName}이 육아를 잘 해내고 계시네요! 상담 패턴이 안정적이에요.`,
    medium: `${childName}이 때문에 고민이 좀 있으셨군요. ${temperament} 기질의 아이를 키우다 보면 당연한 거예요.`,
    high: `최근 많이 힘드셨을 것 같아요. ${childName}이를 위해 이렇게 노력하는 모습 자체가 훌륭한 부모의 증거에요.`,
  };
  const encouragements: Record<string, string> = {
    low: '이 페이스 그대로 유지하시면 돼요. 부모님도 충분히 쉬어가세요!',
    medium: '잠깐 쉬어가도 괜찮아요. 완벽한 부모보다 행복한 부모가 아이에게 더 좋답니다.',
    high: '오늘 하루, 딱 한 가지만 잘하면 돼요. 그리고 그건 이미 하고 계세요 - 아이를 사랑하는 것.',
  };

  return {
    stressLevel: signals.level,
    message: messages[signals.level],
    encouragement: encouragements[signals.level],
    analysisData: {
      totalSessions: 0,
      lateNightCount: signals.lateNightCount,
      negativeWords: signals.negativeWords,
    },
  };
}

// ─── POST /api/coaching/future-predict — 기질 기반 미래 예측 ───

router.post('/future-predict', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.body as { childId: string };
    if (!childId) { error(res, 'childId 필수'); return; }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    const predictedAgeMonths = child.ageMonths + 3;
    const predictedAgeInfo = formatAgeMonths(predictedAgeMonths);

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || env.MOCK_AI) {
      success(res, buildMockPrediction(child.name, child.temperament, child.ageMonths, predictedAgeMonths, predictedAgeInfo));
      return;
    }

    try {
      const prompt = `너는 영유아 발달 전문가야. 아이의 현재 정보를 바탕으로 3개월 후 어떤 변화가 예상되는지 예측하고 준비 팁을 알려줘.

아이: ${child.name} (${child.ageInfo}, ${child.gender}, ${child.temperament})
기질 특성: ${child.temperamentDetail}
3개월 후 예상 월령: ${predictedAgeInfo}

규칙:
- 사주/오행 용어 절대 금지, 기질/성향/에너지로만 표현
- 발달 단계와 기질을 결합한 현실적 예측

반드시 아래 JSON만 출력해:
{
  "predictions": ["3개월 후 예상 변화 1", "예상 변화 2", "예상 변화 3"],
  "prepTips": ["미리 준비할 것 1", "준비할 것 2", "준비할 것 3"]
}`;

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 400 },
          }),
        }
      );

      const raw = await resp.text();
      const data = JSON.parse(raw) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = aiText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);

      if (match) {
        const parsed = JSON.parse(match[0]) as {
          predictions?: string[];
          prepTips?: string[];
        };
        success(res, {
          childName: child.name,
          currentAge: child.ageInfo,
          currentAgeMonths: child.ageMonths,
          predictedAge: predictedAgeInfo,
          predictedAgeMonths,
          temperament: child.temperament,
          predictions: Array.isArray(parsed.predictions) ? parsed.predictions : [],
          prepTips: Array.isArray(parsed.prepTips) ? parsed.prepTips : [],
        });
      } else {
        success(res, buildMockPrediction(child.name, child.temperament, child.ageMonths, predictedAgeMonths, predictedAgeInfo));
      }
    } catch {
      success(res, buildMockPrediction(child.name, child.temperament, child.ageMonths, predictedAgeMonths, predictedAgeInfo));
    }
  } catch {
    error(res, '미래 예측 중 오류', 500);
  }
});

function formatAgeMonths(months: number): string {
  if (months < 24) return `${months}개월`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}세 ${rem}개월` : `${years}세`;
}

function buildMockPrediction(
  name: string, temperament: string, currentMonths: number, predictedMonths: number, predictedAge: string
): Record<string, unknown> {
  const predictionMap: Record<string, string[]> = {
    '활동형': ['에너지 발산 욕구가 더 커질 수 있어요', '새로운 신체 활동에 도전하려 할 거예요', '규칙 이해가 시작될 시기예요'],
    '탐구형': ['질문이 더 구체적으로 변할 거예요', '스스로 해보겠다는 의지가 강해져요', '집중 시간이 조금씩 늘어날 거예요'],
    '조화형': ['사회성이 발달하면서 친구를 찾기 시작해요', '분리불안이 줄어들 수 있어요', '자기 의견 표현이 늘어나요'],
    '분석형': ['규칙과 패턴에 대한 관심이 높아져요', '실수에 대한 두려움이 나타날 수 있어요', '논리적 사고의 기초가 잡혀요'],
    '감성형': ['감정 표현이 더 다양해져요', '공감 능력이 눈에 띄게 발달해요', '예술적 관심이 생길 수 있어요'],
  };
  const tipMap: Record<string, string[]> = {
    '활동형': ['안전한 활동 공간을 미리 확보해주세요', '새로운 스포츠나 놀이를 찾아보세요', '에너지 발산 후 차분한 시간을 계획해주세요'],
    '탐구형': ['다양한 탐구 재료를 준비해주세요', '아이 질문에 함께 답을 찾아보세요', '실험하고 실패해도 괜찮다는 분위기를 만들어주세요'],
    '조화형': ['소규모 또래 모임을 시작해보세요', '변화를 미리 예고해주세요', '아이의 선택을 존중해주세요'],
    '분석형': ['시각적 스케줄표를 만들어보세요', '실수해도 괜찮다는 경험을 많이 주세요', '단계별 설명을 해주세요'],
    '감성형': ['감정 카드나 감정 그림책을 준비해주세요', '아이 감정을 이름 붙여주는 연습을 해보세요', '차분한 환경을 유지해주세요'],
  };

  return {
    childName: name,
    currentAge: formatAgeMonths(currentMonths),
    currentAgeMonths: currentMonths,
    predictedAge,
    predictedAgeMonths: predictedMonths,
    temperament,
    predictions: predictionMap[temperament] ?? predictionMap['조화형'],
    prepTips: tipMap[temperament] ?? tipMap['조화형'],
  };
}

// ─── POST /api/coaching/now-activity — 실시간 활동 추천 ───

router.post('/now-activity', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.body as { childId: string };
    if (!childId) { error(res, 'childId 필수'); return; }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    // 현재 시간대 판단
    const hour = new Date().getHours();
    let timeOfDay = '오전';
    if (hour >= 12 && hour < 17) timeOfDay = '오후';
    else if (hour >= 17) timeOfDay = '저녁';

    // 최근 고민 조회 (최근 3개 세션)
    const recentSnap = await collections.coachingSessions
      .where('userId', '==', req.userId)
      .where('childId', '==', childId)
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    const recentConcerns = recentSnap.docs
      .map((d) => (d.data() as Record<string, unknown>).category as string)
      .filter(Boolean)
      .join(', ') || '없음';

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || env.MOCK_AI) {
      success(res, buildMockActivity(child.name, child.temperament, child.ageInfo, timeOfDay));
      return;
    }

    try {
      const prompt = `너는 영유아 활동 전문가야. 지금 이 순간 아이와 할 수 있는 구체적인 활동 1가지를 추천해.

아이: ${child.name} (${child.ageInfo}, ${child.gender}, ${child.temperament})
현재 시간대: ${timeOfDay}
최근 고민 카테고리: ${recentConcerns}

규칙:
- 기질과 시간대에 맞는 현실적 활동
- 사주/오행 용어 금지

반드시 아래 JSON만 출력해:
{
  "activity": "구체적 활동명과 방법 1~2문장",
  "duration": "예상 소요 시간 (예: 15~20분)",
  "reason": "이 활동이 이 기질의 아이에게 좋은 이유 1문장"
}`;

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 300 },
          }),
        }
      );

      const raw = await resp.text();
      const data = JSON.parse(raw) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = aiText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);

      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, string>;
        success(res, {
          childName: child.name,
          timeOfDay,
          activity: parsed.activity || '',
          duration: parsed.duration || '',
          reason: parsed.reason || '',
        });
      } else {
        success(res, buildMockActivity(child.name, child.temperament, child.ageInfo, timeOfDay));
      }
    } catch {
      success(res, buildMockActivity(child.name, child.temperament, child.ageInfo, timeOfDay));
    }
  } catch {
    error(res, '활동 추천 중 오류', 500);
  }
});

function buildMockActivity(
  name: string, temperament: string, ageInfo: string, timeOfDay: string
): Record<string, string> {
  const activities: Record<string, Record<string, { activity: string; duration: string; reason: string }>> = {
    '활동형': {
      '오전': { activity: `${name}이와 함께 음악에 맞춰 신체 놀이를 해보세요. 점프, 스트레칭, 동물 흉내 내기 등을 섞으면 좋아요.`, duration: '15~20분', reason: '활동형 기질의 아이는 오전에 에너지 발산이 중요해요.' },
      '오후': { activity: `${name}이와 블록이나 퍼즐로 조용한 집중 놀이를 해보세요.`, duration: '10~15분', reason: '오후에는 차분한 활동으로 균형을 잡아주면 좋아요.' },
      '저녁': { activity: `${name}이와 오늘 하루 있었던 일을 그림으로 그려보세요.`, duration: '10분', reason: '저녁에는 하루를 정리하는 차분한 활동이 수면에 도움돼요.' },
    },
    '탐구형': {
      '오전': { activity: `${name}이와 물 놀이 실험을 해보세요. 어떤 물건이 뜨고 가라앉는지 관찰해보세요.`, duration: '15~20분', reason: '탐구형 아이는 실험과 관찰을 통해 가장 잘 배워요.' },
      '오후': { activity: `${name}이와 집에 있는 재료로 간단한 요리를 함께 해보세요.`, duration: '20분', reason: '요리는 탐구형 아이의 오감을 자극하는 훌륭한 활동이에요.' },
      '저녁': { activity: `${name}이에게 오늘 가장 궁금했던 것을 물어보고 함께 이야기해보세요.`, duration: '10분', reason: '하루의 호기심을 나누면 탐구형 아이의 사고력이 자라요.' },
    },
  };

  const temperamentActivities = activities[temperament] ?? activities['활동형'];
  const timeActivity = temperamentActivities[timeOfDay] ?? temperamentActivities['오전'];

  return {
    childName: name,
    timeOfDay,
    activity: timeActivity.activity,
    duration: timeActivity.duration,
    reason: timeActivity.reason,
  };
}

// ─── POST /api/coaching/analyze-media — 울음/대변 AI 분석 ───

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

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || env.MOCK_AI) {
      success(res, type === 'cry'
        ? buildMockCryAnalysis(child.name, description)
        : buildMockPoopAnalysis(child.name, description));
      return;
    }

    try {
      const prompt = type === 'cry'
        ? buildCryPrompt(child, description)
        : buildPoopPrompt(child, description);

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
          }),
        }
      );

      const raw = await resp.text();
      const data = JSON.parse(raw) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = aiText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);

      if (match) {
        const parsed = JSON.parse(match[0]) as {
          analysis?: string;
          possibilities?: Array<{ label: string; likelihood: string }>;
          recommendations?: string[];
          needsDoctor?: boolean;
        };
        success(res, {
          childName: child.name,
          type,
          analysis: parsed.analysis || '',
          possibilities: Array.isArray(parsed.possibilities) ? parsed.possibilities : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          needsDoctor: parsed.needsDoctor ?? false,
        });
      } else {
        success(res, type === 'cry'
          ? buildMockCryAnalysis(child.name, description)
          : buildMockPoopAnalysis(child.name, description));
      }
    } catch {
      success(res, type === 'cry'
        ? buildMockCryAnalysis(child.name, description)
        : buildMockPoopAnalysis(child.name, description));
    }
  } catch {
    error(res, '미디어 분석 중 오류', 500);
  }
});

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

// ─── 프로액티브 인사이트 API ───

router.get('/daily-insight', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const childId = req.query.childId as string;
    if (!childId) {
      error(res, 'childId가 필요합니다', 400);
      return;
    }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) {
      error(res, '자녀 정보를 찾을 수 없습니다', 404);
      return;
    }

    const insights = await generateDailyInsights(childId, {
      id: childId,
      name: child.name,
      ageMonths: child.ageMonths,
      temperament: child.temperament,
      temperamentDetail: child.temperamentDetail,
      gender: child.gender,
    });

    success(res, { insights });
  } catch (err) {
    console.error('Daily insight error:', err);
    error(res, '인사이트 생성에 실패했습니다', 500);
  }
});

// ─── 첫 상담 환영 메시지 API (아이 등록 직후 호출) ───

router.get('/welcome', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const childId = req.query.childId as string;
    if (!childId) {
      error(res, 'childId가 필요합니다', 400);
      return;
    }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) {
      error(res, '자녀 정보를 찾을 수 없습니다', 404);
      return;
    }

    const milestones = getMilestoneContext(child.ageMonths);
    const currentMilestone = milestones.current[0] || '';

    // 기질별 맞춤 환영 메시지
    const traitMessages: Record<string, string> = {
      '활동형': `${child.name}는 활동형 기질이라 호기심이 넘치고 새로운 경험을 좋아해요. 에너지를 잘 발산시켜주는 게 포인트예요.`,
      '탐구형': `${child.name}는 탐구형 기질이라 관찰력이 뛰어나고 깊이 파고드는 걸 좋아해요. 질문에 성의있게 답해주시면 쑥쑥 자라요.`,
      '조화형': `${child.name}는 조화형 기질이라 사람들과 잘 어울리고 눈치가 빨라요. 혼자만의 시간도 가끔 필요할 수 있어요.`,
      '분석형': `${child.name}는 분석형 기질이라 꼼꼼하고 규칙적인 걸 좋아해요. 갑작스러운 변화보다는 예고를 해주시면 좋아요.`,
      '감성형': `${child.name}는 감성형 기질이라 감정이 풍부하고 공감 능력이 뛰어나요. 감정을 말로 표현하는 연습이 중요해요.`,
    };

    const traitMsg = traitMessages[child.temperament] ||
      `${child.name}의 기질에 맞는 맞춤 육아 조언을 준비했어요.`;

    const welcomeMessage = {
      greeting: `${child.name} 부모님, 반가워요! 아맞다 AI 코치입니다.`,
      traitInsight: traitMsg,
      milestone: currentMilestone
        ? `${child.ageInfo}인 지금, ${currentMilestone.replace(/^\[.*?\]\s*/, '')}`
        : `${child.ageInfo}인 지금 시기에 맞는 육아 팁을 매일 알려드릴게요.`,
      cta: '궁금한 게 있으면 언제든 물어보세요. 급할 때도, 사소한 것도 다 괜찮아요!',
    };

    success(res, { welcome: welcomeMessage });
  } catch (err) {
    console.error('Welcome message error:', err);
    error(res, '환영 메시지 생성에 실패했습니다', 500);
  }
});

// ─── AI 자동 육아일기 API ───

router.get('/auto-diary', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const childId = req.query.childId as string;
    if (!childId) { error(res, 'childId 필요', 400); return; }

    // VIP 전용 기능
    const tier = await getUserTier(req.userId!);
    if (tier !== 'paid') {
      error(res, 'VIP 전용 기능입니다. 프리미엄 구독 후 이용해주세요.', 403);
      return;
    }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    const diary = await generateAutoDiary(childId, child.name, child.ageInfo, child.temperament);
    success(res, { diary });
  } catch (err) {
    console.error('Auto diary error:', err);
    error(res, '일기 생성 실패', 500);
  }
});

// ─── 성장 타임캡슐 API ───

router.post('/time-capsule', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { childId, message, months } = req.body as { childId: string; message: string; months: 3 | 6 | 12 };
    if (!childId || !message || !months) { error(res, '필수 항목 누락', 400); return; }

    // VIP 전용 기능
    const tier = await getUserTier(req.userId!);
    if (tier !== 'paid') {
      error(res, 'VIP 전용 기능입니다. 프리미엄 구독 후 이용해주세요.', 403);
      return;
    }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    const capsule = await createTimeCapsule(
      req.userId!, childId, child.name, child.ageInfo, child.temperament, message, months,
    );
    success(res, { capsule });
  } catch (err) {
    console.error('Time capsule error:', err);
    error(res, '타임캡슐 생성 실패', 500);
  }
});

router.get('/time-capsules', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const childId = req.query.childId as string;
    if (!childId) { error(res, 'childId 필요', 400); return; }

    const [all, openable] = await Promise.all([
      listTimeCapsules(req.userId!, childId),
      getOpenableCapsules(req.userId!),
    ]);

    success(res, { capsules: all, openable: openable.filter((c) => c.childId === childId) });
  } catch (err) {
    console.error('List capsules error:', err);
    error(res, '타임캡슐 조회 실패', 500);
  }
});

router.post('/time-capsule/:id/open', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const capsuleId = typeof req.params.id === 'string' ? req.params.id : String(req.params.id);
    const capsule = await openTimeCapsule(capsuleId, req.userId!);
    if (!capsule) { error(res, '열 수 없는 캡슐', 404); return; }
    success(res, { capsule });
  } catch (err) {
    console.error('Open capsule error:', err);
    error(res, '캡슐 열기 실패', 500);
  }
});

// ─── 또래 비교 API ───

router.get('/peer-comparison', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const childId = req.query.childId as string;
    if (!childId) { error(res, 'childId 필요', 400); return; }

    // VIP 전용 기능
    const tier = await getUserTier(req.userId!);
    if (tier !== 'paid') {
      error(res, 'VIP 전용 기능입니다. 프리미엄 구독 후 이용해주세요.', 403);
      return;
    }

    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    // 최근 7일 트래킹 데이터로 평균 계산
    const tracking = await buildTrackingSummary(childId, 7);

    // 수면 평균 추출
    const sleepMatch = tracking.sleepSummary.match(/평균\s*([\d.]+)시간/);
    const avgSleepHours = sleepMatch ? parseFloat(sleepMatch[1]) : undefined;

    // 배변 평균 추출
    const poopMatch = tracking.poopSummary.match(/평균\s*([\d.]+)회/);
    const avgPoop = poopMatch ? parseFloat(poopMatch[1]) : undefined;

    const comparison = generatePeerComparison(child.ageMonths, {
      avgSleepHours,
      avgPoop,
    });

    success(res, { comparison });
  } catch (err) {
    console.error('Peer comparison error:', err);
    error(res, '또래 비교 실패', 500);
  }
});

// ─── 사용자 레벨/구독 상태 API ───

router.get('/my-tier', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const tier = await getUserTier(req.userId!);
    const streak = await getUserStreak(req.userId!);
    const level = getLevelByStreak(streak);
    const nextLvl = getNextLevel(level);

    success(res, {
      tier,
      level: level.level,
      levelName: level.name,
      badge: level.badge,
      streak,
      dailyLimit: tier === 'paid' ? 999 : level.dailyLimit,
      nextLevel: nextLvl ? {
        name: nextLvl.name,
        daysNeeded: nextLvl.minDays - streak,
        dailyLimit: nextLvl.dailyLimit,
      } : null,
    });
  } catch (err) {
    console.error('My tier error:', err);
    error(res, '티어 조회 실패', 500);
  }
});

// ─── 캡슐 제안 API (자동일기 ↔ 타임캡슐 연결) ───

router.get('/capsule-suggestion', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const childId = req.query.childId as string;
    if (!childId) { error(res, 'childId 필요', 400); return; }

    // 최근 7일 자동일기 중 감정 점수 높은 것 탐색
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().slice(0, 10);

    const snap = await collections.autoDiaries
      .where('childId', '==', childId)
      .where('date', '>=', cutoffDate)
      .orderBy('date', 'desc')
      .limit(7)
      .get();

    if (snap.empty) {
      success(res, { hasSuggestion: false });
      return;
    }

    // emotionScore >= 5인 일기 중 가장 높은 것 찾기
    interface DiaryDoc {
      date: string;
      diary: string;
      emotionScore: number;
      emotionKeywords: string[];
      childId: string;
    }

    let bestDiary: DiaryDoc | null = null;
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const emotionScore = (data.emotionScore as number) ?? 0;
      if (emotionScore >= 5) {
        if (!bestDiary || emotionScore > bestDiary.emotionScore) {
          bestDiary = {
            date: data.date as string,
            diary: data.diary as string,
            emotionScore,
            emotionKeywords: (data.emotionKeywords as string[]) ?? [],
            childId: data.childId as string,
          };
        }
      }
    }

    if (!bestDiary) {
      success(res, { hasSuggestion: false });
      return;
    }

    // 자녀 이름 가져오기
    const child = await buildChildContext(childId, req.userId!);
    const childName = child?.name ?? '우리 아이';
    const keywordsText = bestDiary.emotionKeywords.slice(0, 3).join(', ');

    success(res, {
      hasSuggestion: true,
      diary: {
        date: bestDiary.date,
        content: bestDiary.diary,
        emotionScore: bestDiary.emotionScore,
        emotionKeywords: bestDiary.emotionKeywords,
      },
      capsuleMessage: bestDiary.diary,
      promptText: `${bestDiary.date}에 ${childName}의 특별한 순간이 있었어요! (${keywordsText}) 이 감동을 1년 뒤 타임캡슐로 보관할까요?`,
    });
  } catch (err) {
    console.error('Capsule suggestion error:', err);
    error(res, '캡슐 제안 조회 실패', 500);
  }
});

router.post('/capsule-suggestion/accept', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { childId, diaryDate } = req.body as { childId: string; diaryDate: string };
    if (!childId || !diaryDate) { error(res, 'childId와 diaryDate 필요', 400); return; }

    // 해당 날짜의 일기 조회
    const docId = `${childId}_${diaryDate}`;
    const diaryDoc = await collections.autoDiaries.doc(docId).get();
    if (!diaryDoc.exists) {
      error(res, '해당 날짜의 일기가 없습니다', 404);
      return;
    }

    const diaryData = diaryDoc.data() as Record<string, unknown>;
    const diaryContent = diaryData.diary as string;

    // 자녀 정보 가져오기
    const child = await buildChildContext(childId, req.userId!);
    if (!child) { error(res, '자녀 정보 없음', 404); return; }

    // 타임캡슐 생성 (12개월 뒤 오픈)
    const capsule = await createTimeCapsule(
      req.userId!,
      childId,
      child.name,
      child.ageInfo,
      child.temperament,
      diaryContent,
      12,
    );

    success(res, { capsule });
  } catch (err) {
    console.error('Accept capsule suggestion error:', err);
    error(res, '타임캡슐 생성 실패', 500);
  }
});

export default router;
