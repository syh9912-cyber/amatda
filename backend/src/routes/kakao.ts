/**
 * Kakao i 오픈빌더 챗봇 Skill 서버.
 *
 * 공식 문서:
 *   - 응답 포맷: https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/answer_json_format
 *   - Skill 만들기: https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/make_skill
 *
 * 핵심 제약:
 *   - 5초 timeout (Bot → Skill 서버)
 *   - 공인 IP / 공중망 도메인 필수 (우리는 Cloud Functions URL 사용)
 *   - 응답 JSON: { version: '2.0', template: { outputs: [...], quickReplies: [...] } }
 *   - simpleText 최대 1000자, 500자 초과시 "더 보기" 노출
 *
 * 엔드포인트:
 *   POST /api/kakao/skill/menu       — 메인 메뉴 (시작 블록)
 *   POST /api/kakao/skill/qa         — AI 육아 Q&A (Gemini 응답)
 *   POST /api/kakao/skill/emergency  — 119 / 응급 안내
 *   POST /api/kakao/skill/faq        — 자주 묻는 질문 목록
 *   POST /api/kakao/skill/beta       — 베타 테스터 신청 안내
 *
 * 사용자 입력은 payload.userRequest.utterance 에서 추출.
 * 오픈빌더에서 블록별로 각 endpoint URL 등록.
 */
import { Router, Request, Response } from 'express';
import { callGeminiText, isGeminiAvailable } from '../services/coaching/gemini.client';
import { logger } from '../utils/logger';

const router = Router();

/* ------------------------------------------------------------------ */
/* 카카오 Skill 응답 헬퍼                                              */
/* ------------------------------------------------------------------ */

interface KakaoButton {
  action: 'webLink' | 'message' | 'phone' | 'block' | 'share';
  label: string;
  webLinkUrl?: string;
  messageText?: string;
  phoneNumber?: string;
  blockId?: string;
}

interface KakaoQuickReply {
  action: 'message' | 'block';
  label: string;
  messageText?: string;
  blockId?: string;
}

interface KakaoOutput {
  simpleText?: { text: string };
  basicCard?: {
    title?: string;
    description?: string;
    thumbnail?: { imageUrl: string };
    buttons?: KakaoButton[];
  };
  listCard?: {
    header: { title: string };
    items: Array<{
      title: string;
      description?: string;
      imageUrl?: string;
      link?: { web: string };
    }>;
    buttons?: KakaoButton[];
  };
  textCard?: {
    title?: string;
    description?: string;
    buttons?: KakaoButton[];
  };
}

interface KakaoSkillResponse {
  version: '2.0';
  template: {
    outputs: KakaoOutput[];
    quickReplies?: KakaoQuickReply[];
  };
}

function simpleText(text: string, quickReplies?: KakaoQuickReply[]): KakaoSkillResponse {
  // 카카오 simpleText 1000자 제한 + 안전마진
  const trimmed = text.length > 950 ? text.substring(0, 947) + '...' : text;
  return {
    version: '2.0',
    template: {
      outputs: [{ simpleText: { text: trimmed } }],
      ...(quickReplies && quickReplies.length > 0 ? { quickReplies } : {}),
    },
  };
}

/**
 * 카카오 요청 페이로드에서 사용자 발화 추출.
 * payload.userRequest.utterance 가 표준 위치.
 */
function extractUtterance(req: Request): string {
  const body = req.body as Record<string, unknown> | undefined;
  const userRequest = body?.userRequest as Record<string, unknown> | undefined;
  const raw = userRequest?.utterance;
  return typeof raw === 'string' ? raw.trim() : '';
}

/* ------------------------------------------------------------------ */
/* 공통 quickReplies — 메인 메뉴 단축 버튼                              */
/* ------------------------------------------------------------------ */

const MAIN_QUICK_REPLIES: KakaoQuickReply[] = [
  { action: 'message', label: '🆘 응급', messageText: '응급' },
  { action: 'message', label: '🤖 AI 상담', messageText: 'AI 상담' },
  { action: 'message', label: '🎁 베타 신청', messageText: '베타 신청' },
  { action: 'message', label: '❓ 자주 묻는 질문', messageText: 'FAQ' },
];

/* ------------------------------------------------------------------ */
/* 블록 1 — 메인 메뉴                                                   */
/* ------------------------------------------------------------------ */

router.post('/skill/menu', async (_req: Request, res: Response) => {
  const response: KakaoSkillResponse = {
    version: '2.0',
    template: {
      outputs: [
        {
          textCard: {
            title: '안녕하세요, 아맞다입니다 💛',
            description:
              '임신부터 초등까지, AI 기질분석 육아 코칭 「아맞다」.\n드디어 정식 출시되었어요 🎉\n\n무엇을 도와드릴까요?',
            buttons: [
              { action: 'message', label: '🤖 AI 육아 상담', messageText: 'AI 상담' },
              { action: 'message', label: '🆘 응급 안내', messageText: '응급' },
              { action: 'message', label: '🎁 베타 테스터 신청', messageText: '베타 신청' },
            ],
          },
        },
      ],
      quickReplies: MAIN_QUICK_REPLIES,
    },
  };
  res.json(response);
});

/* ------------------------------------------------------------------ */
/* 블록 2 — AI 육아 Q&A (Gemini)                                        */
/* ------------------------------------------------------------------ */

const QA_SYSTEM_PROMPT = `너는 한국 부모를 위한 AI 육아 코치 "아맞다"의 카카오톡 응답 봇이다.

[톤]
- 따뜻하고 친근한 반말 X / 존댓말 O
- 부모의 불안을 먼저 공감하고 핵심을 짚어준다
- 의학적 진단을 직접 내리지 말고 "병원 방문 권장" 식으로 안내

[길이 규칙 - 매우 중요]
- 카카오톡 메시지 특성상 짧게: 300자 이내
- 불릿/번호 사용 환영 (가독성)
- 마지막에 "더 자세한 상담은 앱에서 받으실 수 있어요 💛" 추가

[안전 우선]
- 39도 이상 발열, 경련, 의식 저하, 호흡 곤란, 대량 출혈 → "지금 즉시 119" 안내
- 임신 관련 출혈/극심한 두통/시야 이상 → "즉시 산부인과"
- 불확실하면 "전문가 상담 권장"

[금지]
- 사주/오행/천간/지지 용어 절대 사용 금지
- 의학적 진단명 단정 금지
- 약물 복용량 직접 안내 금지
`;

router.post('/skill/qa', async (req: Request, res: Response) => {
  const utterance = extractUtterance(req);

  if (!utterance || utterance.length < 2) {
    res.json(simpleText(
      '궁금하신 점을 자유롭게 입력해주세요!\n예: "신생아 황달이 노란데 괜찮나요?"\n예: "이유식 거부하는 7개월 아기"',
      MAIN_QUICK_REPLIES,
    ));
    return;
  }

  if (!isGeminiAvailable()) {
    res.json(simpleText(
      '죄송해요, 지금은 AI 답변을 드릴 수 없어요 😢\n앱에서 더 자세한 상담을 받아보실 수 있어요.\n👉 https://sylabs.kr',
      MAIN_QUICK_REPLIES,
    ));
    return;
  }

  try {
    // 5초 timeout — Kakao 제한. 4.5초에서 abort → fallback 메시지.
    const aiPromise = callGeminiText(utterance, {
      systemPrompt: QA_SYSTEM_PROMPT,
      temperature: 0.5,
      maxTokens: 350,
    });
    const timeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 4500),
    );
    const answer = await Promise.race([aiPromise, timeout]);

    res.json(simpleText(answer, [
      { action: 'message', label: '🔄 다시 묻기', messageText: 'AI 상담' },
      { action: 'message', label: '📲 앱 받기', messageText: '앱 다운로드' },
      ...MAIN_QUICK_REPLIES.slice(0, 2),
    ]));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    logger.warn('kakao/qa', `utterance="${utterance.substring(0, 50)}" err=${msg}`);
    res.json(simpleText(
      '답변을 가져오는 중에 문제가 있었어요 😢\n잠시 후 다시 시도해주세요.\n급한 응급 상황은 119, 일반 상담은 앱에서 받아보실 수 있어요.',
      MAIN_QUICK_REPLIES,
    ));
  }
});

/* ------------------------------------------------------------------ */
/* 블록 3 — 응급 안내                                                   */
/* ------------------------------------------------------------------ */

router.post('/skill/emergency', async (_req: Request, res: Response) => {
  const response: KakaoSkillResponse = {
    version: '2.0',
    template: {
      outputs: [
        {
          textCard: {
            title: '🆘 응급 상황 안내',
            description:
              '아이가 다음 증상을 보이면 즉시 119에 전화하세요.\n\n' +
              '• 39도 이상 고열 + 의식 저하\n' +
              '• 경련 (5분 이상 지속)\n' +
              '• 호흡 곤란 / 청색증\n' +
              '• 대량 출혈\n' +
              '• 의식 잃거나 반응 없음\n\n' +
              '※ 임신 중: 다량 출혈, 극심한 복통, 시야 이상은 즉시 산부인과로!',
            buttons: [
              { action: 'phone', label: '📞 119 전화', phoneNumber: '119' },
              { action: 'phone', label: '🏥 1339 상담', phoneNumber: '1339' },
              { action: 'webLink', label: '🗺️ 응급실 찾기', webLinkUrl: 'https://www.e-gen.or.kr/egen/em_map_main.do' },
            ],
          },
        },
      ],
      quickReplies: [
        { action: 'message', label: '🤖 AI 상담', messageText: 'AI 상담' },
        { action: 'message', label: '🏠 처음으로', messageText: '메뉴' },
      ],
    },
  };
  res.json(response);
});

/* ------------------------------------------------------------------ */
/* 블록 4 — FAQ 리스트                                                  */
/* ------------------------------------------------------------------ */

router.post('/skill/faq', async (_req: Request, res: Response) => {
  const response: KakaoSkillResponse = {
    version: '2.0',
    template: {
      outputs: [
        {
          listCard: {
            header: { title: '❓ 자주 묻는 질문' },
            items: [
              { title: '아맞다는 어떤 앱이에요?', description: '임신부터 초등까지 AI 기질분석 육아 코칭 앱' },
              { title: '비용이 들어요?', description: '기본 기능 무료, 프리미엄은 월 3,900원 / 연 39,900원 (연간 15% 할인)' },
              { title: '어디서 다운받아요?', description: '구글 플레이 / 앱 스토어에서 "아맞다" 검색 후 다운로드' },
              { title: 'AI 답변은 믿을 수 있나요?', description: '응급 상황은 119/병원 우선 안내, 일반 정보는 참고용입니다' },
              { title: '아이폰도 돼요?', description: 'Android / iOS 모두 지원' },
            ],
            buttons: [
              { action: 'webLink', label: '📲 앱 다운로드', webLinkUrl: 'https://sylabs.kr/amatda' },
            ],
          },
        },
      ],
      quickReplies: MAIN_QUICK_REPLIES,
    },
  };
  res.json(response);
});

/* ------------------------------------------------------------------ */
/* 블록 5 — 베타 테스터 신청                                             */
/* ------------------------------------------------------------------ */

router.post('/skill/beta', async (_req: Request, res: Response) => {
  const response: KakaoSkillResponse = {
    version: '2.0',
    template: {
      outputs: [
        {
          textCard: {
            title: '🎁 출시 기념 테스터 50명 모집',
            description:
              '✨ 전원 혜택\n' +
              '• 프리미엄 1년 무료 (39,900원 상당)\n' +
              '• AI 코칭 무제한\n' +
              '• 광고 완전 제거\n\n' +
              '🏆 우수 리뷰어 TOP 5\n' +
              '• 신세계상품권 10만원\n\n' +
              '📝 선정 시 베타 기간 중 스토어 리뷰 1회 이상 필수\n' +
              '⏰ ~6월 13일 자정 마감\n' +
              '📩 선정 6월 14일 개별 연락',
            buttons: [
              { action: 'webLink', label: '📝 신청하기', webLinkUrl: 'https://forms.gle/yRigYK7fSxWeqVke7' },
              { action: 'webLink', label: '📲 앱 다운로드', webLinkUrl: 'https://sylabs.kr/amatda' },
            ],
          },
        },
      ],
      quickReplies: MAIN_QUICK_REPLIES,
    },
  };
  res.json(response);
});

/* ------------------------------------------------------------------ */
/* Fallback — 매칭 안 된 발화                                           */
/* ------------------------------------------------------------------ */

router.post('/skill/fallback', async (_req: Request, res: Response) => {
  res.json(simpleText(
    '죄송해요, 잘 못 알아들었어요 😅\n\n아래 메뉴를 이용해주세요!',
    MAIN_QUICK_REPLIES,
  ));
});

/* ------------------------------------------------------------------ */
/* 헬스체크 — Skill 등록 시 URL 검증용                                  */
/* ------------------------------------------------------------------ */

router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'amatda-kakao-skill' });
});

export default router;
