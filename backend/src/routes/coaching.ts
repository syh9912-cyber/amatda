import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { maskChildName } from '../utils/masking';
import { findCoachingEntry } from '../services/coaching.knowledge';

const router = Router();

// ─── 타입 정의 ───

interface CoachingSession {
  id: string;
  userId: string;
  childId: string;
  message: string;
  category: string;
  answer: string;
  reason: string;
  solutions: string[];
  source: 'knowledge' | 'ai' | 'learned';
  followupDays: number | null;
  followupQuestion: string | null;
  photoUrl: string | null;
  audioUrl: string | null;
  createdAt: string;
}

interface Followup {
  id: string;
  userId: string;
  childId: string;
  sessionId: string;
  question: string;
  dueDate: string;
  respondedAt: string | null;
  response: string | null;
  coachingReply: string | null;
  status: 'pending' | 'completed';
  createdAt: string;
}

// ─── Gemini AI 폴백 ───

async function getGeminiCoachingResponse(
  message: string,
  childName: string,
  dominantType: string,
  ageMonths: number
): Promise<{
  answer: string;
  reason: string;
  solutions: string[];
}> {
  const maskedMessage = maskChildName(message, childName);
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey || env.MOCK_AI) {
    return getMockCoachingResponse(maskedMessage, dominantType);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `당신은 아동 발달 전문 육아 코치입니다.
부모의 고민에 대해 아이의 기질 유형(${dominantType})과 월령(${ageMonths}개월)을 고려하여 답변하세요.

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이 JSON만):
{"answer":"기질 맞춤 조언","reason":"이런 현상이 발생하는 이유","solutions":["구체적 해결 방법1","구체적 해결 방법2","구체적 해결 방법3"]}

부모 고민:
${maskedMessage}`,
            }],
          }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
        }),
      }
    );

    const data = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        answer: string;
        reason: string;
        solutions: string[];
      };
      return parsed;
    }
    return getMockCoachingResponse(maskedMessage, dominantType);
  } catch {
    return getMockCoachingResponse(maskedMessage, dominantType);
  }
}

function getMockCoachingResponse(
  message: string,
  dominantType: string
): {
  answer: string;
  reason: string;
  solutions: string[];
} {
  const traitTips: Record<string, string> = {
    '탐구형': '탐구형 아이는 호기심이 강하므로 새로운 경험을 통해 문제를 해결할 수 있습니다.',
    '활동형': '활동형 아이는 에너지가 넘치므로 충분한 신체 활동이 도움됩니다.',
    '조화형': '조화형 아이는 관계를 중시하므로 부모의 관심과 스킨십이 효과적입니다.',
    '분석형': '분석형 아이는 논리적 설명을 이해하므로 이유를 설명해주는 것이 좋습니다.',
    '감성형': '감성형 아이는 감정에 민감하므로 공감과 위로가 우선입니다.',
  };

  const tip = traitTips[dominantType] ?? '아이의 기질을 파악하여 맞춤 육아를 실천해보세요.';

  return {
    answer: `${tip} "${message.slice(0, 20)}..."에 대해 전문 상담이 준비되었습니다.`,
    reason: '아이의 발달 과정에서 자연스럽게 나타나는 현상이며, 기질에 따라 표현 방식이 다릅니다.',
    solutions: [
      '1. 아이의 감정을 먼저 인정하고 공감해주세요.',
      '2. 일관된 루틴과 규칙을 만들어주세요.',
      '3. 하루 15분 이상 1:1 놀이 시간을 가져보세요.',
    ],
  };
}

// ─── 자녀 데이터 조회 헬퍼 ───

interface ChildData {
  name: string;
  dominantType: string;
  ageMonths: number;
}

async function getChildData(
  childId: string,
  userId: string
): Promise<ChildData | null> {
  const doc = await collections.children.doc(childId).get();
  if (!doc.exists) return null;
  const data = doc.data() as Record<string, unknown>;
  if (data.userId !== userId) return null;

  const birthDate = data.birthDate as string | undefined;
  let ageMonths = 12;
  if (birthDate) {
    const birth = new Date(birthDate);
    const now = new Date();
    ageMonths = (now.getFullYear() - birth.getFullYear()) * 12
      + (now.getMonth() - birth.getMonth());
  }

  return {
    name: (data.name as string) || '아이',
    dominantType: (data.dominantType as string) || '조화형',
    ageMonths,
  };
}

// ─── POST /api/coaching/ask ───

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

    const child = await getChildData(childId, req.userId!);
    if (!child) {
      error(res, '자녀 정보를 찾을 수 없습니다', 404);
      return;
    }

    // 1. 정적 지식DB에서 매칭
    const entry = findCoachingEntry(message);

    // 1-1. 학습된 데이터에서도 검색
    let learnedMatch: { answer: string; reason: string; solutions: string[] } | null = null;
    if (!entry) {
      const learnedSnap = await collections.learnedKnowledge.get();
      let bestScore = 0;
      for (const doc of learnedSnap.docs) {
        const learned = doc.data();
        const kws = learned.keywords as string[];
        let score = 0;
        for (const kw of kws) {
          if (message.includes(kw)) score += kw.length;
        }
        if (score > bestScore) {
          bestScore = score;
          learnedMatch = {
            answer: learned.answer as string,
            reason: learned.reason as string,
            solutions: learned.solutions as string[],
          };
        }
      }
      // 최소 점수 이상일 때만 사용 (너무 낮으면 잘못된 매칭)
      if (bestScore < 8) learnedMatch = null;
      // 사용 횟수 증가
      if (learnedMatch) {
        const matchDoc = learnedSnap.docs.find((d) => d.data().answer === learnedMatch!.answer);
        if (matchDoc) {
          const current = (matchDoc.data().useCount as number) || 0;
          await collections.learnedKnowledge.doc(matchDoc.id).update({ useCount: current + 1 });
        }
      }
    }

    let answer: string;
    let reason: string;
    let solutions: string[];
    let source: 'knowledge' | 'ai' | 'learned';
    let followupDays: number | null = null;
    let followupQuestion: string | null = null;
    let detectedCategory = category ?? '기타';

    // 카테고리별 상세 질문 (더 정확한 상담을 위해)
    const DETAIL_PROMPTS: Record<string, string> = {
      '울음': '더 정확한 분석을 위해 아이의 울음소리를 녹음해서 들려주시거나, 울 때의 상황을 자세히 알려주세요. (언제, 얼마나 오래, 어떤 상황에서)',
      '대변': '대변 사진을 찍어서 보여주시면 더 정확한 조언을 드릴 수 있어요. 색깔, 묽기, 빈도를 알려주세요.',
      '피부': '아이의 피부 상태를 사진으로 찍어서 보여주세요. 발생 부위와 시작 시기를 알려주시면 도움됩니다.',
      '식사': '아이가 어제 먹은 음식과 양을 알려주세요. 거부하는 음식 종류도 구체적으로 알려주시면 좋아요.',
      '수면': '아이의 취침 시간, 기상 시간, 낮잠 횟수를 알려주세요. 잠들 때 습관도 알려주시면 도움됩니다.',
      '건강': '체온을 재서 알려주세요. 다른 증상(기침, 콧물, 구토 등)이 있는지도 함께 알려주세요.',
      '사회성': '구체적인 상황을 알려주세요. (어린이집에서? 놀이터에서? 어떤 친구와?) 아이의 반응도 자세히 알려주세요.',
      '행동': '이 행동이 언제부터 시작됐는지, 하루에 몇 번 정도 하는지, 어떤 상황에서 하는지 알려주세요.',
      '성장': '현재 키와 몸무게를 알려주세요. 또래와 비교했을 때 어떤 차이가 느껴지는지도 알려주시면 좋아요.',
      '정서': '아이가 이런 감정을 보일 때 구체적인 상황을 알려주세요. 얼마나 자주, 어떤 때에 그러는지 알려주시면 도움됩니다.',
    };

    let detailPrompt: string | null = null;

    if (entry) {
      // 기질별 맞춤 조언 선택
      const traitTip = entry.traitAdvice[child.dominantType] ?? entry.generalAdvice;
      answer = traitTip;
      reason = entry.reason;
      solutions = entry.solution;
      source = 'knowledge';
      followupDays = entry.followupDays;
      followupQuestion = entry.followupQuestion;
      detectedCategory = entry.category;
      detailPrompt = DETAIL_PROMPTS[entry.category] ?? null;
    } else if (learnedMatch) {
      // 1-2. 학습된 데이터 사용
      answer = learnedMatch.answer;
      reason = learnedMatch.reason;
      solutions = learnedMatch.solutions;
      source = 'learned';
    } else {
      // 2. Gemini AI 폴백
      const aiResult = await getGeminiCoachingResponse(
        message,
        child.name,
        child.dominantType,
        child.ageMonths
      );
      answer = aiResult.answer;
      reason = aiResult.reason;
      solutions = aiResult.solutions;
      source = 'ai';

      // AI 응답을 학습 데이터로 자동 저장 (다음에 비슷한 질문 시 AI 없이 응답)
      const keywords = message
        .replace(/[?？!！.。,，]/g, ' ')
        .split(/\s+/)
        .filter((w: string) => w.length >= 2)
        .slice(0, 8);

      if (keywords.length >= 2) {
        const learnedId = genId();
        await collections.learnedKnowledge.doc(learnedId).set({
          keywords,
          category: detectedCategory,
          dominantType: child.dominantType,
          ageMonths: child.ageMonths,
          originalMessage: message,
          answer,
          reason,
          solutions,
          useCount: 0,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // 3. 세션 저장
    const sessionId = genId();
    const session: Omit<CoachingSession, 'id'> = {
      userId: req.userId!,
      childId,
      message,
      category: detectedCategory,
      answer,
      reason,
      solutions,
      source,
      followupDays,
      followupQuestion,
      photoUrl: photoUrl ?? null,
      audioUrl: audioUrl ?? null,
      createdAt: new Date().toISOString(),
    };
    await collections.coachingSessions.doc(sessionId).set(session);

    // 4. 팔로업 스케줄링
    let followup: { days: number; question: string } | null = null;
    if (followupDays && followupQuestion) {
      const followupId = genId();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + followupDays);

      const followupDoc: Omit<Followup, 'id'> = {
        userId: req.userId!,
        childId,
        sessionId,
        question: followupQuestion,
        dueDate: dueDate.toISOString(),
        respondedAt: null,
        response: null,
        coachingReply: null,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      await collections.followups.doc(followupId).set(followupDoc);

      followup = { days: followupDays, question: followupQuestion };
    }

    success(res, {
      sessionId,
      answer,
      reason,
      solutions,
      source,
      category: detectedCategory,
      followup,
      detailPrompt,
    });
  } catch {
    error(res, '코칭 응답 중 오류가 발생했습니다', 500);
  }
});

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
  } catch {
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

    // 기한이 지났거나 오늘까지인 것만 반환
    const allFollowups: Array<Record<string, unknown>> = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return { id: d.id, ...data };
    });
    const dueFollowups = allFollowups.filter((f) => {
      const dueDate = f.dueDate as string | undefined;
      return dueDate ? dueDate <= now : false;
    });

    success(res, dueFollowups);
  } catch {
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

    const followupData = doc.data() as Omit<Followup, 'id'>;
    if (followupData.userId !== req.userId) {
      error(res, '권한이 없습니다', 403);
      return;
    }

    // 팔로업 응답에 대한 코칭 답변 생성
    const child = await getChildData(followupData.childId, req.userId!);
    const dominantType = child?.dominantType ?? '조화형';

    let coachingReply: string;
    if (env.MOCK_AI || !env.GEMINI_API_KEY) {
      coachingReply = generateMockFollowupReply(answer, dominantType);
    } else {
      coachingReply = await generateGeminiFollowupReply(
        followupData.question,
        answer,
        dominantType,
        child?.name ?? '아이'
      );
    }

    // 팔로업 업데이트
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

// ─── 팔로업 응답 생성 헬퍼 ───

function generateMockFollowupReply(answer: string, dominantType: string): string {
  const positive = answer.includes('좋아') || answer.includes('나아') || answer.includes('줄었');
  if (positive) {
    return `잘 하고 계시네요! ${dominantType} 기질의 아이에게 잘 맞는 방법을 찾으신 것 같습니다. 이 방법을 꾸준히 유지하시면 더 좋은 결과를 볼 수 있습니다.`;
  }
  return `아직 어려우시군요. ${dominantType} 기질의 아이에게는 시간이 더 필요할 수 있습니다. 다른 방법을 시도해보시거나, 전문가 상담을 고려해보세요.`;
}

async function generateGeminiFollowupReply(
  question: string,
  answer: string,
  dominantType: string,
  childName: string
): Promise<string> {
  const maskedAnswer = maskChildName(answer, childName);
  const apiKey = env.GEMINI_API_KEY;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `당신은 아동 발달 전문 육아 코치입니다.
이전에 부모에게 "${question}"라고 팔로업 질문을 드렸고, 부모의 답변은 "${maskedAnswer}"입니다.
아이의 기질 유형은 ${dominantType}입니다.

부모의 답변에 대해 격려하며, 기질 맞춤 추가 조언을 한국어 2~3문장으로 해주세요. JSON 없이 텍스트만 답변하세요.`,
            }],
          }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
        }),
      }
    );

    const data = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text
      ?? generateMockFollowupReply(answer, dominantType);
  } catch {
    return generateMockFollowupReply(answer, dominantType);
  }
}

export default router;
