import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';

const router = Router();

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '배송': ['배송', '택배', '도착', '수령', '분실'],
  '구독': ['구독', '플랜', '결제', '정지', '해지'],
  '환불': ['환불', '반품', '교환', '취소'],
  '기질': ['기질', '성향', '분석', '유형', '날씨', '궁합', '일기', '관찰', '리포트'],
  '앱': ['회원', '가입', '로그인', '비밀번호', '설정', '알림', '업데이트', '탈퇴'],
  '영양': ['영양', '이유식', '음식', '간식', '식단', '알레르기', '편식'],
  '교육': ['학원', '교육', '추천', '온라인', '학습'],
  '개인정보': ['개인정보', '보안', '데이터', '삭제', '위치'],
};

async function findFaqAnswer(message: string): Promise<string | null> {
  for (const [category, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((k) => message.includes(k))) {
      const snap = await collections.faq.where('category', '==', category).limit(1).get();
      if (!snap.empty) return snap.docs[0].data().answer as string;
    }
  }
  return null;
}

async function getAiResponse(message: string): Promise<string> {
  if (env.MOCK_AI || !process.env.OPENAI_API_KEY) {
    return '육아 관련 질문이시군요! 아이의 기질에 맞는 활동을 추천해드릴 수 있어요.';
  }
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: '당신은 아맞다 앱의 육아 상담 AI입니다. 한국어로 친절하게 답변하세요.' }, { role: 'user', content: message }], temperature: 0.7, max_tokens: 300 }),
    });
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '잠시 후 다시 시도해주세요.';
  } catch { return '일시적인 오류가 발생했습니다.'; }
}

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) { error(res, '메시지를 입력해주세요'); return; }

    await collections.chatLogs.doc(genId()).set({ userId: req.userId!, message, isUser: true, createdAt: new Date().toISOString() });
    const faqAnswer = await findFaqAnswer(message);
    const reply = faqAnswer ?? await getAiResponse(message);
    await collections.chatLogs.doc(genId()).set({ userId: req.userId!, message: reply, isUser: false, createdAt: new Date().toISOString() });

    success(res, { reply, source: faqAnswer ? 'faq' : 'ai' });
  } catch { error(res, '챗봇 응답 중 오류가 발생했습니다', 500); }
});

router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const snap = await collections.chatLogs.where('userId', '==', req.userId).orderBy('createdAt', 'desc').limit(50).get();
    success(res, snap.docs.reverse().map((d) => ({ id: d.id, ...d.data() })));
  } catch { error(res, '채팅 기록 조회 중 오류가 발생했습니다', 500); }
});

export default router;
