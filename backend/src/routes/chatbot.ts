import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

// 간단한 FAQ DB
const FAQ: Record<string, string> = {
  '배송': '교구 배송은 매월 1일에 출발하며 2~3일 내 도착합니다.',
  '구독': '구독은 프로필 > 교구 구독에서 관리할 수 있습니다.',
  '해지': '구독 해지는 다음 결제일 3일 전까지 가능합니다.',
  '환불': '미개봉 교구는 수령 후 7일 이내 환불 가능합니다.',
  '기질': '기질 분석은 아이의 생년월일시를 기반으로 합니다. 관찰 일기를 작성하면 더 정확해져요.',
  '일기': '관찰 일기는 탭 바의 일기 메뉴에서 작성할 수 있습니다.',
};

function findFaqAnswer(message: string): string | null {
  for (const [keyword, answer] of Object.entries(FAQ)) {
    if (message.includes(keyword)) return answer;
  }
  return null;
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

    // FAQ 먼저 확인
    const faqAnswer = findFaqAnswer(message);
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
