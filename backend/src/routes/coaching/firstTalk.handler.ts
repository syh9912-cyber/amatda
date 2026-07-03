import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { parseBody } from '../../utils/validate';
import { shouldRejectAIResponse } from '../../services/coaching/forbidden.filter';

const FirstTalkBodySchema = z.object({
  childId: z.string().min(1).max(128),
  locale: z.enum(['ko', 'ja', 'zh-Hant']).optional(),
});

// ─── 연령/기질별 대표 고민 ───
// 비한국어 로케일 폴백(AI 미사용/실패 시)도 한국어가 노출되지 않도록 로케일별로 준비.
// 기존 한국어 값은 절대 수정하지 않음(추가형) — locale 미지정/ko 는 byte-identical 폴백.

// 연령별 자주 묻는 고민 예시 (quickOptions로 노출 — 누르면 그 자체가 자연스러운 질문이 됨)
const STARTER_TOPICS: Record<'ko' | 'ja' | 'zh-Hant', Record<string, string[]>> = {
  ko: {
    infant: ['밤에 자주 깨요', '수유량이 걱정돼요', '낯가림이 심해요'],
    toddler: ['떼를 많이 써요', '편식이 심해요', '잠 들기 힘들어해요'],
    preschool: ['친구랑 잘 못 어울려요', '집중력이 짧아요', '감정 기복이 커요'],
  },
  ja: {
    infant: ['夜よく起きます', '授乳量が心配です', '人見知りが激しいです'],
    toddler: ['よく駄々をこねます', '偏食がひどいです', 'なかなか寝付けません'],
    preschool: ['友達とうまく遊べません', '集中力が続きません', '感情の起伏が激しいです'],
  },
  'zh-Hant': {
    infant: ['晚上常常醒來', '擔心餵奶量不夠', '認生很嚴重'],
    toddler: ['很容易鬧脾氣', '偏食很嚴重', '很難入睡'],
    preschool: ['不太會跟朋友相處', '專注力很短', '情緒起伏很大'],
  },
};

// 모든 답변 가능하도록 열린 초대 문구
const OPEN_INVITATION: Record<'ko' | 'ja' | 'zh-Hant', string> = {
  ko: '지금 육아에서 어려운 점이나 궁금한 게 있으면 무엇이든 편하게 물어봐 주세요!',
  ja: '今、育児で困っていることや気になることがあれば、何でも気軽に聞いてくださいね！',
  'zh-Hant': '現在育兒上有任何困擾或想了解的事情，都可以隨時輕鬆問我喔！',
};

const TRAIT_DESC: Record<'ko' | 'ja' | 'zh-Hant', Record<string, string>> = {
  ko: {
    '활동형': '{{name}}이는 에너지가 넘치는 활동형이에요! 충분히 움직일 수 있는 시간을 주면 더 잘 먹고 잘 자요.',
    '탐구형': '{{name}}이는 호기심 가득한 탐구형이에요! 새로운 걸 발견하면 집중력이 높아지니 탐색 시간을 충분히 주세요.',
    '조화형': '{{name}}이는 따뜻한 조화형이에요! 규칙적인 생활과 미리 알려주기가 아이에게 안정감을 줘요.',
    '분석형': '{{name}}이는 꼼꼼한 분석형이에요! 이유를 설명해주면 더 잘 따라오니 "왜"를 알려주세요.',
    '감성형': '{{name}}이는 감정이 풍부한 감성형이에요! 감정을 먼저 읽어주고 공감해주면 큰 힘이 돼요.',
  },
  ja: {
    '활동형': '{{name}}はエネルギーあふれる活動タイプです！十分に体を動かせる時間を作ってあげると、もっとよく食べてよく眠れます。',
    '탐구형': '{{name}}は好奇心旺盛な探求タイプです！新しいことを発見すると集中力が高まるので、探索の時間を十分に取ってあげてください。',
    '조화형': '{{name}}は優しい調和タイプです！規則正しい生活と事前に伝えてあげることが、お子さんに安心感を与えます。',
    '분석형': '{{name}}は几帳面な分析タイプです！理由を説明してあげるとよく従ってくれるので、「なぜ」を伝えてあげてください。',
    '감성형': '{{name}}は感情豊かな感性タイプです！まず気持ちを読み取って共感してあげると、大きな力になります。',
  },
  'zh-Hant': {
    '활동형': '{{name}}是活力充沛的活動型！給予充分活動身體的時間，會吃得更好、睡得更好。',
    '탐구형': '{{name}}是好奇心旺盛的探索型！發現新事物時專注力會提高，請給予充分的探索時間。',
    '조화형': '{{name}}是溫暖的協調型！規律的生活和事先告知，會讓孩子更有安全感。',
    '분석형': '{{name}}是細心的分析型！說明原因會讓孩子更願意配合，請告訴孩子「為什麼」。',
    '감성형': '{{name}}是情感豐富的感性型！先讀懂並同理孩子的情緒，會給孩子很大的力量。',
  },
};

const DEFAULT_TRAIT_SUMMARY: Record<'ko' | 'ja' | 'zh-Hant', string> = {
  ko: '{{name}}이는 고유한 기질을 가진 아이에요. 아이 성향을 이해하면 육아가 수월해져요.',
  ja: '{{name}}は独自の気質を持つお子さんです。お子さんの個性を理解すると、育児が楽になりますよ。',
  'zh-Hant': '{{name}}是擁有獨特氣質的孩子。了解孩子的個性，育兒會更輕鬆喔。',
};

const INTRO_TEXT: Record<'ko' | 'ja' | 'zh-Hant', string> = {
  ko: '{{name}}이를 만나서 반가워요!',
  ja: '{{name}}に会えて嬉しいです！',
  'zh-Hant': '很高興認識{{name}}！',
};

function getDefaultGreeting(
  name: string, _ageInfo: string, temperament: string, topics: string[], locale?: string
): { intro: string; traitSummary: string; suggestedQuestion: string; quickOptions: string[] } {
  const loc = (locale === 'ja' || locale === 'zh-Hant') ? locale : 'ko';
  const traitDesc = TRAIT_DESC[loc];

  return {
    intro: INTRO_TEXT[loc].replace('{{name}}', name),
    traitSummary: (traitDesc[temperament] ?? DEFAULT_TRAIT_SUMMARY[loc]).replace('{{name}}', name),
    suggestedQuestion: OPEN_INVITATION[loc],
    quickOptions: topics,
  };
}

export function registerFirstTalkHandler(router: Router): void {
  // ─── POST /api/coaching/first-talk ───

  router.post('/first-talk', authMiddleware, async (req: Request, res: Response) => {
    try {
      const body = parseBody(req, res, FirstTalkBodySchema);
      if (!body) return;
      const { childId, locale } = body;
      const loc = (locale === 'ja' || locale === 'zh-Hant') ? locale : 'ko';

      const child = await buildChildContext(childId, req.userId!);
      if (!child) {
        error(res, '자녀 정보를 찾을 수 없습니다', 404);
        return;
      }

      // 연령 구간 결정
      let ageGroup = 'infant';
      if (child.ageMonths >= 25 && child.ageMonths <= 72) ageGroup = 'toddler';
      else if (child.ageMonths > 72) ageGroup = 'preschool';

      // 연령별 시작 고민 토픽
      const topics = STARTER_TOPICS[loc][ageGroup] ?? STARTER_TOPICS[loc].toddler;

      // AI에게 첫 인사 생성 요청
      let greeting: {
        intro: string;
        traitSummary: string;
        suggestedQuestion: string;
        quickOptions: string[];
      };

      if (isGeminiAvailable()) {
        try {
          // 프롬프트 안 "예시 문구"를 로케일별로 — AI가 예시를 그대로 복사하는 경향이 있어
          // 한국어 예시를 남겨두면 비한국어에서도 한국어로 출력되는 회귀가 있었다.
          // (ko 는 기존 리터럴과 byte-identical 유지)
          const inviteEx = loc === 'ko'
            ? '지금 육아에서 어려운 점이나 궁금한 게 있으면 무엇이든 편하게 물어봐 주세요!'
            : OPEN_INVITATION[loc];
          const topicEx = loc === 'ko'
            ? ['밤에 자주 깨요', '편식이 심해요', '떼를 많이 써요']
            : topics;

          // 출력 언어 지시는 프롬프트 "맨 앞"에 강하게 명시 — 짧게 뒤에 붙이면 AI가 무시함.
          const langDirective = loc === 'ja'
            ? '【最優先ルール】intro・traitSummary・suggestedQuestion・quickOptions のすべての値を必ず自然な日本語で書くこと。韓国語で書いてはならない。\n\n'
            : loc === 'zh-Hant'
              ? '【最優先規則】intro、traitSummary、suggestedQuestion、quickOptions 的所有值都必須以自然的繁體中文（台灣／香港用語）書寫，絕對不可使用韓文。\n\n'
              : '';

          const basePrompt = langDirective + `너는 영유아 육아 코치야. 아이가 방금 등록되었어. 부모에게 처음 인사하면서 아이 기질을 짧게 설명하고, 부모가 자유롭게 무엇이든 물어볼 수 있도록 따뜻하게 초대해줘.

아이 정보:
- 나이: ${child.ageInfo}
- 성별: ${child.gender}
- 기질: ${child.temperament}
- 기질 특성: ${child.temperamentDetail}

규칙:
1. suggestedQuestion은 부모가 무엇이든 자유롭게 질문할 수 있도록 초대하는 열린 문구 (예: "${inviteEx}")
2. quickOptions는 3개, 부모가 바로 터치하면 그 자체가 자연스러운 질문/고민이 되는 짧은 표현 (예: "${topicEx[0]}", "${topicEx[1]}", "${topicEx[2]}"). 예/아니오 답변 형태 금지.
3. traitSummary는 2문장 이내, 쉬운 말로
4. '사주/오행/천간/지지' 용어 절대 금지

반드시 아래 JSON만 출력해:
{
  "intro": "반갑다는 인사 1문장",
  "traitSummary": "기질 설명 2문장 이내",
  "suggestedQuestion": "자유 질문 초대 문구 1문장",
  "quickOptions": ["고민예시1", "고민예시2", "고민예시3"]
}`;

          // 끝에도 한 번 더 언어 지시(앞뒤 강조). ko 는 빈 문자열 → 프롬프트 byte-identical.
          const localeHint = loc === 'ja'
            ? '\n\n[重要] 上記のすべての値は必ず日本語で。JSON のキー名は英語のまま維持しろ。'
            : loc === 'zh-Hant'
              ? '\n\n[重要] 以上所有的值務必以繁體中文書寫。JSON 的鍵名請保持英文原樣。'
              : '';
          const prompt = basePrompt + localeHint;

          greeting = await callGeminiJSON<typeof greeting>(prompt, {
            temperature: 0.5,
            maxTokens: 300,
          });
          // 응답 후처리: 사주/오행 등 금지 용어 검출 시 fallback
          if (shouldRejectAIResponse(greeting, 'firstTalk.handler')) {
            greeting = getDefaultGreeting('아이', child.ageInfo, child.temperament, topics, loc);
          }
        } catch {
          greeting = getDefaultGreeting('아이', child.ageInfo, child.temperament, topics, loc);
        }
      } else {
        greeting = getDefaultGreeting('아이', child.ageInfo, child.temperament, topics, loc);
      }

      // NOTE: 첫 질문을 conversationSummaries에 저장하던 로직은 제거.
      // 이유: FirstTalkCard.tsx가 이미 사용자 답변 앞에 '[코치 질문: ...]' 접두사를
      //       넣어 AI에 맥락을 전달함. history에도 같은 질문을 저장하면 AI가
      //       동일 질문을 중복으로 보고 혼란 → 무관한 주제로 hallucination
      //       (예: '떼' 또는 '음식 변화')하는 회귀가 발생.
      //
      // 결과: 원래 흐름(접두사로 컨텍스트 전달, history 비어있음)이 가장 안정적.

      success(res, {
        childId,
        childName: child.name,
        ageInfo: child.ageInfo,
        temperament: child.temperament,
        ...greeting,
      });
    } catch (err: unknown) {
      logger.error('route', err);
      error(res, '첫 대화 생성 중 오류가 발생했습니다', 500);
    }
  });
}
