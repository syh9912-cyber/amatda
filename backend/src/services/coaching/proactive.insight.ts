/**
 * 프로액티브 인사이트 엔진
 * - AI가 먼저 말을 거는 기능
 * - 트래킹 데이터에서 패턴을 감지하고 맞춤 인사이트 생성
 * - 홈 화면에 매일 다른 카드로 표시
 */

import { collections } from '../firestore';
import { buildTrackingSummary } from './context.builder';
import { getMilestoneContext } from './milestone.detector';
import { callGeminiText, isGeminiAvailable } from './gemini.client';

export type InsightType =
  | 'pattern_alert'     // 데이터 패턴 경고 (수면 감소 등)
  | 'milestone_tip'     // 발달 마일스톤 팁
  | 'encouragement'     // 부모 격려
  | 'smart_question'    // 오늘 물어볼 만한 질문 추천
  | 'weekly_summary';   // 주간 요약

export interface ProactiveInsight {
  type: InsightType;
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  priority: number; // 높을수록 먼저 노출
}

interface ChildProfile {
  id: string;
  name: string;
  ageMonths: number;
  temperament: string;
  temperamentDetail: string;
  gender: string;
}

/** 아이 데이터 기반으로 오늘의 인사이트 생성 */
export async function generateDailyInsights(
  childId: string,
  child: ChildProfile,
): Promise<ProactiveInsight[]> {
  const insights: ProactiveInsight[] = [];

  // 1. 트래킹 패턴 분석
  const tracking = await buildTrackingSummary(childId, 7);
  const patternInsights = analyzePatterns(tracking, child);
  insights.push(...patternInsights);

  // 2. 발달 마일스톤 팁
  const milestones = getMilestoneContext(child.ageMonths);
  if (milestones.current.length > 0) {
    insights.push({
      type: 'milestone_tip',
      title: '발달 포인트',
      message: milestones.current[0].replace(/^\[.*?\]\s*/, ''),
      actionLabel: 'AI 코치에게 물어보기',
      actionRoute: '/(main)/chatbot',
      priority: 3,
    });
  }

  // 3. 스마트 질문 추천 (아이 월령/기질 기반)
  const smartQ = getSmartQuestion(child);
  if (smartQ) {
    insights.push(smartQ);
  }

  // 4. 격려 메시지 (AI 생성, 실패 시 폴백)
  const encouragement = await generateEncouragement(child, tracking);
  insights.push(encouragement);

  // 우선순위 정렬
  insights.sort((a, b) => b.priority - a.priority);
  return insights.slice(0, 3);
}

/** 트래킹 데이터에서 패턴 경고 감지 */
function analyzePatterns(
  tracking: { sleepSummary: string; mealSummary: string; poopSummary: string; conditionSummary: string; recentChangeSummary: string },
  child: ChildProfile,
): ProactiveInsight[] {
  const alerts: ProactiveInsight[] = [];

  // 수면 감소 추세
  if (tracking.sleepSummary.includes('수면 감소 추세')) {
    alerts.push({
      type: 'pattern_alert',
      title: '수면 패턴 변화 감지',
      message: `${child.name}의 수면 시간이 줄고 있어요. 혹시 낮잠이나 취침 시간에 변화가 있었나요?`,
      actionLabel: '수면 상담받기',
      actionRoute: '/(main)/chatbot',
      priority: 8,
    });
  }

  // 야간 각성 많음
  if (tracking.sleepSummary.includes('야간 각성')) {
    alerts.push({
      type: 'pattern_alert',
      title: '밤중 각성이 잦아요',
      message: `최근 밤에 자주 깨고 있네요. ${child.temperament} 기질 아이에게 맞는 수면 팁을 알려드릴까요?`,
      actionLabel: '맞춤 팁 받기',
      actionRoute: '/(main)/chatbot',
      priority: 7,
    });
  }

  // 식사 거부 패턴
  if (tracking.mealSummary.includes('식사 거부') || tracking.mealSummary.includes('섭취량 감소')) {
    alerts.push({
      type: 'pattern_alert',
      title: '식사 패턴 변화',
      message: `${child.name}가 요즘 밥을 잘 안 먹고 있어요. 이 시기에 흔한 일인지 확인해볼까요?`,
      actionLabel: '식사 상담받기',
      actionRoute: '/(main)/chatbot',
      priority: 7,
    });
  }

  // 변비 의심
  if (tracking.poopSummary.includes('변비 의심')) {
    alerts.push({
      type: 'pattern_alert',
      title: '배변 체크',
      message: `배변이 뜸해지고 있어요. ${child.ageMonths}개월 아이 변비 관리 팁을 알려드릴게요.`,
      actionLabel: '대변 상담받기',
      actionRoute: '/(main)/chatbot',
      priority: 6,
    });
  }

  // 컨디션 하락
  if (tracking.conditionSummary.includes('컨디션 하락')) {
    alerts.push({
      type: 'pattern_alert',
      title: '컨디션 주의',
      message: `${child.name}의 컨디션이 떨어지고 있어요. 체온이나 다른 증상은 없나요?`,
      actionLabel: '상태 체크하기',
      actionRoute: '/(main)/chatbot',
      priority: 8,
    });
  }

  return alerts;
}

/** 월령/기질 기반 스마트 질문 추천 */
function getSmartQuestion(child: ChildProfile): ProactiveInsight | null {
  const questions: Array<{ minAge: number; maxAge: number; traits?: string[]; q: string }> = [
    { minAge: 0, maxAge: 3, q: '아이가 눈을 맞추거나 웃을 때 어떻게 반응하면 좋을까요?' },
    { minAge: 4, maxAge: 6, q: '이유식 시작 시기와 첫 음식 추천해주세요' },
    { minAge: 4, maxAge: 6, q: '뒤집기를 안 하는데 걱정해야 할까요?' },
    { minAge: 7, maxAge: 9, q: '낯가림이 심해졌는데 어떻게 대처하면 좋을까요?' },
    { minAge: 7, maxAge: 12, traits: ['활동형'], q: '활동적인 아이인데 안전하게 탐색하게 하려면?' },
    { minAge: 10, maxAge: 14, q: '첫 단어를 아직 안 하는데 괜찮은 건가요?' },
    { minAge: 13, maxAge: 18, q: '떼를 쓸 때 어떻게 대응하면 좋을까요?' },
    { minAge: 13, maxAge: 18, traits: ['감성형'], q: '감성이 풍부한 아이의 떼쓰기, 어떻게 달래면 좋을까요?' },
    { minAge: 19, maxAge: 24, q: '두 단어 문장을 언제쯤 할 수 있을까요?' },
    { minAge: 25, maxAge: 36, q: '배변 훈련 시작할 때 주의할 점이 있을까요?' },
    { minAge: 25, maxAge: 36, q: '미운 세 살, 반항이 심한데 어떻게 하면 좋을까요?' },
    { minAge: 37, maxAge: 48, q: '또래 친구와 싸우면 어떻게 개입해야 할까요?' },
    { minAge: 49, maxAge: 60, q: '유치원 적응을 잘 시키려면 어떻게 해야 할까요?' },
    { minAge: 61, maxAge: 72, q: '초등 입학 전에 꼭 준비할 것이 있을까요?' },
    { minAge: 73, maxAge: 108, q: '학습 습관은 어떻게 만들어주면 좋을까요?' },
    { minAge: 109, maxAge: 144, q: '사춘기 전조가 보이는데 어떻게 소통하면 좋을까요?' },
  ];

  // 월령 + 기질 매칭
  const matched = questions.filter((q) => {
    if (child.ageMonths < q.minAge || child.ageMonths > q.maxAge) return false;
    if (q.traits && !q.traits.some((t) => child.temperament.includes(t))) return false;
    return true;
  });

  if (matched.length === 0) return null;

  // 날짜 기반 랜덤 (매일 다른 질문, 같은 날은 같은 질문)
  const dayHash = new Date().toISOString().slice(0, 10).split('-').reduce((a, b) => a + parseInt(b, 10), 0);
  const pick = matched[dayHash % matched.length];

  return {
    type: 'smart_question',
    title: '오늘의 추천 질문',
    message: pick.q,
    actionLabel: '이 질문으로 상담하기',
    actionRoute: '/(main)/chatbot',
    priority: 4,
  };
}

/** AI 격려 메시지 생성 */
async function generateEncouragement(
  child: ChildProfile,
  tracking: { sleepSummary: string; mealSummary: string; poopSummary: string; conditionSummary: string; recentChangeSummary: string },
): Promise<ProactiveInsight> {
  // Gemini 호출 가능하면 맞춤 격려, 아니면 폴백
  if (isGeminiAvailable()) {
    try {
      const prompt = `너는 10년차 육아 상담사다. ${child.ageMonths}개월 ${child.gender === '남자아이' ? '남자' : '여자'}아이(${child.temperament} 기질)를 키우는 부모에게 보내는 오늘의 한마디를 1~2문장으로 써라.
조건:
- 아이 특성과 월령에 맞는 구체적인 격려 (일반적 "화이팅"류 금지)
- 부모의 노력을 인정하는 말 포함
- 최근 기록: 수면(${tracking.sleepSummary}), 식사(${tracking.mealSummary})
- 20~50자 사이, 따뜻하고 구체적으로`;

      const msg = await callGeminiText(prompt, { temperature: 0.8, maxTokens: 80 });
      if (msg && msg.length > 5) {
        return {
          type: 'encouragement',
          title: '오늘의 한마디',
          message: msg.replace(/^["']|["']$/g, '').trim(),
          priority: 2,
        };
      }
    } catch {
      // 폴백 사용
    }
  }

  // 폴백 메시지 (월령대별)
  const fallbacks = getFallbackEncouragement(child.ageMonths, child.temperament);
  const dayIdx = new Date().getDate() % fallbacks.length;
  return {
    type: 'encouragement',
    title: '오늘의 한마디',
    message: fallbacks[dayIdx],
    priority: 2,
  };
}

function getFallbackEncouragement(ageMonths: number, temperament: string): string[] {
  if (ageMonths <= 12) {
    return [
      '밤중 수유에 지치셨을 텐데, 아이는 그 시간을 통해 안정감을 쌓고 있어요.',
      '오늘도 아이와 눈 맞추며 웃어주신 거, 그게 최고의 두뇌 발달 자극이에요.',
      '아이가 보채는 건 엄마아빠를 믿기 때문이에요. 충분히 잘하고 계세요.',
    ];
  }
  if (ageMonths <= 24) {
    return [
      '이 시기 아이는 매일 새로운 세상을 발견하고 있어요. 함께 놀아주시는 것만으로 충분해요.',
      `${temperament} 기질 아이에게 맞는 속도로 성장하고 있어요. 다른 아이와 비교 안 하셔도 돼요.`,
      '말이 느리더라도 아이는 지금 수천 개의 단어를 흡수하고 있어요. 많이 말 걸어주세요.',
    ];
  }
  if (ageMonths <= 48) {
    return [
      '떼쓰기에 지치셨죠. 그런데 이건 자기주장이 생겼다는 뜻이에요. 건강하게 크고 있어요.',
      '오늘 아이에게 "잘했어" 한 번만 더 말해주세요. 그 한마디가 자존감을 만들어요.',
      '완벽한 부모는 없어요. 오늘 하루 함께한 것만으로 아이에겐 최고의 하루예요.',
    ];
  }
  return [
    '아이가 클수록 대화가 중요해져요. 오늘 10분만 아이 이야기를 들어주세요.',
    '이 나이 아이들은 부모가 자기를 신뢰한다고 느낄 때 가장 잘 자라요.',
    '숙제, 학원보다 중요한 건 "오늘 하루 어땠어?"라는 질문이에요.',
  ];
}
