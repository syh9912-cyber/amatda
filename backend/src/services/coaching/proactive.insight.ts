/**
 * 프로액티브 인사이트 엔진
 * - AI가 먼저 말을 거는 기능
 * - 트래킹 데이터에서 패턴을 감지하고 맞춤 인사이트 생성
 * - 홈 화면에 매일 다른 카드로 표시
 */

import { collections } from '../firestore';
import { logger } from '../../utils/logger';
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
  isPregnant?: boolean;
  pregnancyWeeks?: number;
}

/** 아이 데이터 기반으로 오늘의 인사이트 생성 */
export async function generateDailyInsights(
  childId: string,
  child: ChildProfile,
): Promise<ProactiveInsight[]> {
  // 임산부는 별도 인사이트
  if (child.isPregnant) {
    return generatePregnancyInsights(child);
  }

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
      actionLabel: '상담이모에게 물어보기',
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

/** 임산부 전용 인사이트 생성 */
async function generatePregnancyInsights(child: ChildProfile): Promise<ProactiveInsight[]> {
  try {
    const week = child.pregnancyWeeks ?? 0;
    console.log(`[PregnancyInsights] week=${week}, name=${child.name}`);
    const insights: ProactiveInsight[] = [];

    // 1. 주수별 맞춤 팁
    const weeklyTip = getPregnancyWeeklyTip(week);
    if (weeklyTip) {
      insights.push(weeklyTip);
    }

    // 2. 오늘의 산모 추천 활동
    const activity = getPregnancyActivity(week);
    insights.push(activity);

    // 3. 격려 메시지 (AI 생성 시도, 실패 시 폴백)
    const encouragement = await generatePregnancyEncouragement(child, week);
    insights.push(encouragement);

    console.log(`[PregnancyInsights] generated ${insights.length} insights`);
    insights.sort((a, b) => b.priority - a.priority);
    return insights.slice(0, 3);
  } catch (err) {
    logger.error('PregnancyInsights', err);
    // 에러 시에도 최소 폴백 인사이트 1개 반환
    return [{
      type: 'encouragement',
      title: '오늘의 한마디',
      message: '오늘도 아가와 함께 건강한 하루 보내세요. 엄마의 긍정적인 마음이 아가에게 전해져요.',
      priority: 2,
    }];
  }
}

/** 주수별 임산부 팁 */
function getPregnancyWeeklyTip(week: number): ProactiveInsight | null {
  const tips: Array<{ minWeek: number; maxWeek: number; title: string; msg: string }> = [
    { minWeek: 1, maxWeek: 8, title: '초기 영양 관리', msg: '엽산을 꾸준히 복용하고, 입덧이 심하면 소량씩 자주 드세요. 수분 섭취도 잊지 마세요.' },
    { minWeek: 9, maxWeek: 12, title: '첫 번째 검진 시기', msg: '초음파로 태아의 심박수를 확인할 수 있어요. 궁금한 점을 미리 메모해 가세요.' },
    { minWeek: 13, maxWeek: 16, title: '안정기 진입', msg: '입덧이 줄어드는 시기예요. 가벼운 산책이나 스트레칭을 시작해보세요.' },
    { minWeek: 17, maxWeek: 20, title: '태동 시작', msg: '곧 태동을 느낄 수 있어요. 조용한 시간에 배에 손을 대고 느껴보세요.' },
    { minWeek: 21, maxWeek: 24, title: '정밀 초음파 시기', msg: '태아의 장기 발달을 확인하는 정밀 초음파 시기예요. 성별도 확인할 수 있어요.' },
    { minWeek: 25, maxWeek: 28, title: '임신성 당뇨 검사', msg: '임신성 당뇨 선별검사를 받는 시기예요. 균형 잡힌 식사가 중요해요.' },
    { minWeek: 29, maxWeek: 32, title: '출산 준비 시작', msg: '출산 가방을 준비하고 산후조리원도 알아보세요. 라마즈 호흡법 연습도 도움이 돼요.' },
    { minWeek: 33, maxWeek: 36, title: '막달 준비', msg: '태아가 빠르게 자라는 시기예요. 편안한 자세로 충분히 쉬시고 분만 계획을 세워보세요.' },
    { minWeek: 37, maxWeek: 42, title: '만삭이에요!', msg: '언제든 출산 신호가 올 수 있어요. 이슬, 규칙적 진통, 양수 파수 신호를 알아두세요.' },
  ];

  const match = tips.find((t) => week >= t.minWeek && week <= t.maxWeek);
  if (!match) return null;

  return {
    type: 'milestone_tip',
    title: match.title,
    message: match.msg,
    actionLabel: '상담이모에게 물어보기',
    actionRoute: '/(main)/chatbot',
    priority: 5,
  };
}

/** 오늘의 산모 추천 활동 (날짜 기반 로테이션) */
function getPregnancyActivity(week: number): ProactiveInsight {
  const earlyActivities = [
    { title: '산모 스트레칭', msg: '목과 어깨를 부드럽게 돌려주세요. 하루 10분이면 충분해요.' },
    { title: '태교 음악 듣기', msg: '편안한 클래식이나 자연 소리를 들으며 아가와 교감해보세요.' },
    { title: '엽산 챙기기', msg: '매일 엽산을 꾸준히 복용하세요. 태아의 신경관 발달에 중요해요.' },
    { title: '충분한 수분 섭취', msg: '하루 8잔 이상의 물을 마시면 양수량 유지와 변비 예방에 좋아요.' },
    { title: '산모 요가', msg: '골반과 허리 근육을 풀어주는 산모 요가로 몸의 긴장을 풀어보세요.' },
    { title: '태담 나누기', msg: '배를 쓰다듬으며 아가에게 오늘 하루 이야기를 들려주세요.' },
    { title: '파트너 마사지', msg: '발목과 종아리를 가볍게 마사지 받으면 부종이 완화돼요.' },
  ];
  const lateActivities = [
    { title: '라마즈 호흡법 연습', msg: '출산 시 통증을 줄여주는 호흡법을 미리 연습해보세요.' },
    { title: '가벼운 산책', msg: '하루 20~30분 산책은 체력 유지와 기분 전환에 좋아요.' },
    { title: '회음부 마사지', msg: '출산 준비를 위한 회음부 마사지를 시작해보세요.' },
    { title: '출산 가방 점검', msg: '입원 가방에 산모패드, 수유브라, 신생아 옷이 준비되어 있나요?' },
    { title: '파트너와 분만 계획 상의', msg: '자연분만, 무통분만 등 분만 방법에 대해 이야기해보세요.' },
    { title: '산모 스트레칭', msg: '허리와 골반 스트레칭으로 출산 체력을 준비하세요.' },
    { title: '수유 자세 연습', msg: '쿠션을 이용해 편안한 수유 자세를 미리 연습해보세요.' },
  ];

  const activities = week >= 28 ? lateActivities : earlyActivities;
  const dayIdx = new Date().getDay();
  const pick = activities[dayIdx % activities.length];

  return {
    type: 'smart_question',
    title: pick.title,
    message: pick.msg,
    actionLabel: '자세히 물어보기',
    actionRoute: '/(main)/chatbot',
    priority: 4,
  };
}

/** 임산부 격려 메시지 */
async function generatePregnancyEncouragement(child: ChildProfile, week: number): Promise<ProactiveInsight> {
  if (isGeminiAvailable()) {
    try {
      const prompt = `너는 10년차 산부인과 간호사 겸 임산부 상담사다. 임신 ${week}주차 산모에게 보내는 오늘의 한마디를 1~2문장으로 써라.
조건:
- 임신 주수에 맞는 구체적인 격려 (일반적 "화이팅"류 금지)
- 산모의 노력과 몸 변화를 인정하는 말 포함
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

  const fallbacks = getPregnancyFallbackEncouragement(week);
  const dayIdx = new Date().getDate() % fallbacks.length;
  return {
    type: 'encouragement',
    title: '오늘의 한마디',
    message: fallbacks[dayIdx],
    priority: 2,
  };
}

function getPregnancyFallbackEncouragement(week: number): string[] {
  if (week <= 12) {
    return [
      '입덧이 힘드시죠. 이 시기가 지나면 훨씬 나아져요. 오늘도 수고하셨어요.',
      '아직 작지만 아가의 심장이 벌써 뛰고 있어요. 엄마도 힘내세요.',
      '입덧엔 레몬수나 생강차가 도움이 될 수 있어요. 소량씩 자주 드세요.',
    ];
  }
  if (week <= 27) {
    return [
      '안정기에 접어들었어요. 가벼운 산책으로 기분 전환해보세요.',
      '태동을 느끼셨나요? 아가가 엄마에게 인사하는 거예요.',
      '이 시기 엄마의 영양이 아가 두뇌 발달에 중요해요. 잘 챙겨 드시고 있죠?',
    ];
  }
  return [
    '출산이 가까워지고 있어요. 편안한 마음으로 아가를 맞이할 준비를 해보세요.',
    '막달 산모님, 몸이 무거우시죠. 충분히 쉬시는 것도 아가를 위한 거예요.',
    '곧 아가를 만날 수 있어요. 그동안 정말 잘 버텨오셨어요. 조금만 더 힘내세요.',
  ];
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
