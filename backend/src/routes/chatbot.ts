import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

/** DB에서 FAQ 검색 — 키워드 매칭 */
async function findFaqAnswer(message: string): Promise<string | null> {
  const faqs = await prisma.fAQ.findMany();
  // 질문 텍스트와 유사도 체크 (키워드 포함)
  for (const faq of faqs) {
    // 카테고리 키워드 매칭
    const keywords = extractKeywords(faq.question);
    const matchCount = keywords.filter((k) => message.includes(k)).length;
    if (matchCount >= 2) return faq.answer;
  }
  // 카테고리 단일 키워드 매칭
  const categoryKeywords: Record<string, string[]> = {
    '배송': ['배송', '택배', '도착', '수령', '분실'],
    '구독': ['구독', '플랜', '결제', '정지', '해지'],
    '환불': ['환불', '반품', '교환', '취소'],
    '기질': ['기질', '성향', '분석', '유형', '날씨', '궁합', '일기', '관찰', '리포트'],
    '앱': ['회원', '가입', '로그인', '비밀번호', '설정', '알림', '업데이트', '탈퇴'],
    '영양': ['영양', '이유식', '음식', '간식', '식단', '알레르기', '편식'],
    '교육': ['학원', '교육', '추천', '온라인', '학습'],
    '개인정보': ['개인정보', '보안', '데이터', '삭제', '위치'],
  };

  for (const [category, kws] of Object.entries(categoryKeywords)) {
    if (kws.some((k) => message.includes(k))) {
      const matched = faqs.find((f) => f.category === category);
      if (matched) return matched.answer;
    }
  }

  return null;
}

function extractKeywords(text: string): string[] {
  return text
    .replace(/[?？은는이가을를에서도의]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

async function getAiResponse(message: string): Promise<string> {
  if (env.MOCK_AI || !process.env.OPENAI_API_KEY) {
    return '육아 관련 질문이시군요! 아이의 기질에 맞는 활동을 추천해드릴 수 있어요. 더 구체적으로 알려주시면 맞춤 조언을 드릴게요.';
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '당신은 아맞다 앱의 육아 상담 AI입니다. 한국어로 친절하게 답변하세요. 의학적 진단은 하지 마세요.',
          },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '죄송합니다. 잠시 후 다시 시도해주세요.';
  } catch {
    return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
}

// POST /api/chatbot
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) {
      error(res, '메시지를 입력해주세요');
      return;
    }

    // 유저 메시지 저장
    await prisma.aICSChatLog.create({
      data: { userId: req.userId!, message, isUser: true },
    });

    // FAQ DB 먼저 확인
    const faqAnswer = await findFaqAnswer(message);
    const reply = faqAnswer ?? await getAiResponse(message);

    // 봇 응답 저장
    await prisma.aICSChatLog.create({
      data: { userId: req.userId!, message: reply, isUser: false },
    });

    success(res, { reply, source: faqAnswer ? 'faq' : 'ai' });
  } catch (e) {
    error(res, '챗봇 응답 중 오류가 발생했습니다', 500);
  }
});

// GET /api/chatbot/history
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.aICSChatLog.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    success(res, logs.reverse().map((l) => ({
      id: l.id,
      message: l.message,
      isUser: l.isUser,
      createdAt: l.createdAt.toISOString(),
    })));
  } catch (e) {
    error(res, '채팅 기록 조회 중 오류가 발생했습니다', 500);
  }
});

export default router;
