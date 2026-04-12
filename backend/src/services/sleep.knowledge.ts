/**
 * 수면 지식 DB — 월령별 수면 패턴 + 예측 기준 데이터
 * AI 호출 없이 이 데이터로 기본 예측 수행, 부족할 때만 AI 보조
 */

export interface SleepPattern {
  ageLabel: string;
  totalSleep: string;          // 총 권장 수면
  nightSleep: string;          // 야간 수면
  napCount: string;            // 낮잠 횟수
  napDuration: string;         // 낮잠 길이
  wakeWindow: string;          // 깨어있는 시간 (낮잠 사이)
  bedtime: string;             // 권장 취침 시간
  wakeTime: string;            // 권장 기상 시간
  napTimes: string[];          // 권장 낮잠 시간대
  tips: string[];              // 수면 팁
  commonIssues: string[];      // 흔한 수면 문제
}

/** 월령별 수면 패턴 (0~36개월 세분화) */
export const SLEEP_PATTERNS: Record<string, SleepPattern> = {
  '0': {
    ageLabel: '신생아 (0개월)',
    totalSleep: '16~18시간', nightSleep: '8~9���간', napCount: '5~6회',
    napDuration: '30분~2시간', wakeWindow: '30분~1시간', bedtime: '19:00~20:00',
    wakeTime: '06:00~07:00', napTimes: ['수유 후 수시로'],
    tips: ['배고프면 바로 수유하세요', '밤낮 구분을 위해 낮에는 밝게, 밤에는 어둡게', '안전한 수면 환경(딱딱한 매트, 이불 없이)'],
    commonIssues: ['밤낮 구분 없음', '자주 깨서 수유', '젖병/모유 없이 못 잠'],
  },
  '1': {
    ageLabel: '1개월',
    totalSleep: '15~17시간', nightSleep: '8~9시간', napCount: '4~5회',
    napDuration: '30분~2시간', wakeWindow: '45분~1시간', bedtime: '19:00~20:00',
    wakeTime: '06:00~07:00', napTimes: ['수유 후 수시���'],
    tips: ['수유 후 트림시키고 눕히기', '백색소음이 안정감을 줍니다', '쌈싸기(스와들링)가 도움됩니다'],
    commonIssues: ['밤낮 구분 어려움', '배앓이로 잠 못 잠', '안아야만 잠듦'],
  },
  '2': {
    ageLabel: '2개월',
    totalSleep: '15~16시간', nightSleep: '8~10시간', napCount: '4~5회',
    napDuration: '30분~2시간', wakeWindow: '1시간~1시간 15분', bedtime: '19:00~20:00',
    wakeTime: '06:00~07:00', napTimes: ['08:00', '10:30', '13:00', '15:30'],
    tips: ['수면 의식을 시작하세요 (목욕→수유→자장가)', '졸린 신호를 관찰하세요 (하품, 눈 비비기)', '수면 환경 일정하게 유지'],
    commonIssues: ['짧은 낮잠 (30분 미만)', '저녁 보챔', '안고 재우기 습관'],
  },
  '3': {
    ageLabel: '3개월',
    totalSleep: '14~16시간', nightSleep: '9~10시간', napCount: '3~4회',
    napDuration: '30분~2시간', wakeWindow: '1시간 15분~1시간 30분', bedtime: '19:00~20:00',
    wakeTime: '06:00~07:00', napTimes: ['08:30', '11:00', '14:00', '16:30'],
    tips: ['수면 루틴 정착 시기입니다', '스스로 잠드는 연습을 시작해보세요', '배부르게 먹이고 재우기'],
    commonIssues: ['수면 퇴행 시작 가능', '낮잠 거부', '밤중 수유 2~3회'],
  },
  '4': {
    ageLabel: '4개월',
    totalSleep: '14~15시간', nightSleep: '10~11시간', napCount: '3~4회',
    napDuration: '30분~2시간', wakeWindow: '1시간 30분~2시간', bedtime: '18:30~19:30',
    wakeTime: '06:00~07:00', napTimes: ['08:30', '11:00', '14:00', '16:00'],
    tips: ['4개월 수면 퇴행은 정상입니다', '잠자리에 눕혀서 재우는 연습', '낮잠 환경도 어둡게'],
    commonIssues: ['4개월 수면 퇴행', '잦은 야간 기상', '낮잠 30분에 깨기'],
  },
  '5': {
    ageLabel: '5개월',
    totalSleep: '14~15시간', nightSleep: '10~11시간', napCount: '3회',
    napDuration: '30분~1시간 30분', wakeWindow: '1시간 45분~2시간 15분', bedtime: '18:30~19:30',
    wakeTime: '06:00~07:00', napTimes: ['09:00', '12:00', '15:00'],
    tips: ['낮잠 3회로 안정되는 시기', '밤중 수유를 줄여보세요', '수면 의식을 매일 같은 시간에'],
    commonIssues: ['세번째 낮잠 거부', '이른 기상 (5시)', '잠투정'],
  },
  '6': {
    ageLabel: '6개월',
    totalSleep: '13~15시간', nightSleep: '10~11시간', napCount: '2~3회',
    napDuration: '30분~1시간 30분', wakeWindow: '2시간~2시간 30분', bedtime: '18:30~19:30',
    wakeTime: '06:00~07:00', napTimes: ['09:00', '13:00', '(15:30)'],
    tips: ['이유식이 수면에 영향을 줄 수 있어요', '밤중 수유 1~2회로 줄이기', '분리불안이 시작될 수 있어요'],
    commonIssues: ['이유식 후 소화 문제', '분리불안 시작', '이빨 나면서 잠 못 잠'],
  },
  '7': {
    ageLabel: '7개월',
    totalSleep: '13~14시간', nightSleep: '10~11시간', napCount: '2~3회',
    napDuration: '30분~1시간 30분', wakeWindow: '2시간 15분~2시간 45분', bedtime: '18:30~19:30',
    wakeTime: '06:00~07:00', napTimes: ['09:30', '13:30'],
    tips: ['낮잠을 2회로 줄이는 시기', '기어가기 시작하면 에너지 소모가 늘어요', '이앓이 시 쿨링 치발기 도움'],
    commonIssues: ['낮잠 전환기 혼란', '기어가기 연습으로 잠 못 잠', '이앓이'],
  },
  '8': {
    ageLabel: '8개월',
    totalSleep: '13~14시간', nightSleep: '10~11시간', napCount: '2회',
    napDuration: '1시간~1시간 30분', wakeWindow: '2시간 30분~3시간', bedtime: '19:00~19:30',
    wakeTime: '06:00~07:00', napTimes: ['09:30', '14:00'],
    tips: ['8개월 수면 퇴행 주의', '분리불안이 강해지는 시기', '잠자리 루틴을 더 풍부하게 (책 읽기 등)'],
    commonIssues: ['8개월 수면 퇴행', '분리불안으로 울며 깨기', '서기 연습으로 침대에서 기상'],
  },
  '9': {
    ageLabel: '9개월',
    totalSleep: '13~14시간', nightSleep: '10~11시간', napCount: '2회',
    napDuration: '1시간~1시간 30분', wakeWindow: '2시간 45분~3시간 15분', bedtime: '19:00~19:30',
    wakeTime: '06:00~07:00', napTimes: ['09:30', '14:00'],
    tips: ['서기/잡고 걷기 시작하면 낮에 충분히 활동시키세요', '야간 수유 없이 밤새 잘 수 있는 시기', '안전한 수면 환경 재점검'],
    commonIssues: ['서기/잡기 연습으로 수면 방해', '낮잠 거부 시작', '밤중 놀기'],
  },
  '10': {
    ageLabel: '10개월',
    totalSleep: '12~14시간', nightSleep: '10~12시간', napCount: '2회',
    napDuration: '1시간~1시간 30분', wakeWindow: '3시간~3시간 30분', bedtime: '19:00~19:30',
    wakeTime: '06:00~07:00', napTimes: ['09:30', '14:00'],
    tips: ['걷기 시작하면 낮에 운동량 늘려주세요', '취침 전 과도한 자극 피하기', '규칙적인 식사 시간이 수면에 도움'],
    commonIssues: ['오전 낮잠 거부', '취침 시간 저항', '이른 기상'],
  },
  '11': {
    ageLabel: '11개월',
    totalSleep: '12~14시간', nightSleep: '10~12시간', napCount: '2회',
    napDuration: '1시간~1시간 30분', wakeWindow: '3시간~3시간 30분', bedtime: '19:00~19:30',
    wakeTime: '06:00~07:00', napTimes: ['10:00', '14:00'],
    tips: ['12개월 수면 퇴행 대비', '낮잠 2회 패턴 유지가 중요', '잠자리 루틴 15~20분 유지'],
    commonIssues: ['낮잠 전환 혼란', '밤에 일어나서 울기', '분리불안 재발'],
  },
  '12': {
    ageLabel: '12개월 (돌)',
    totalSleep: '12~14시간', nightSleep: '10~12시간', napCount: '2회',
    napDuration: '1시간~1시간 30분', wakeWindow: '3시간~3시간 45분', bedtime: '19:00~19:30',
    wakeTime: '06:00~07:00', napTimes: ['10:00', '14:30'],
    tips: ['12개월 수면 퇴행은 2~4주 지속', '걷기 시작으로 에너지 소모 큼', '우유병 물고 자는 습관 끊기'],
    commonIssues: ['12개월 수면 퇴행', '낮잠 1회로 줄이려는 시도', '우유병 의존'],
  },
  '13-15': {
    ageLabel: '13~15개월',
    totalSleep: '12~14시간', nightSleep: '10~12시간', napCount: '1~2회',
    napDuration: '1시간~2시간 30분', wakeWindow: '3시간 30분~4시간 30분', bedtime: '19:00~19:30',
    wakeTime: '06:00~07:00', napTimes: ['12:00~12:30 (1회 시)', '10:00, 14:30 (2회 시)'],
    tips: ['낮잠 2회→1회 전환기 (천천히 진행)', '전환기에는 취침 시간을 앞당기세요', '낮잠 1회 시 점심 후가 최적'],
    commonIssues: ['낮잠 전환 혼란 (2→1)', '취침 저항', '과도한 피로로 야간 기상'],
  },
  '16-18': {
    ageLabel: '16~18개월',
    totalSleep: '12~13시간', nightSleep: '10~11시간', napCount: '1회',
    napDuration: '1시간 30분~2시간 30분', wakeWindow: '4시간 30분~5시간 30분', bedtime: '19:00~19:30',
    wakeTime: '06:00~07:00', napTimes: ['12:30~13:00'],
    tips: ['18개월 수면 퇴행 주의 (분리불안+자아 형성)', '낮잠 1회 패턴 정착시키기', '잠자리 독립성 키워주기'],
    commonIssues: ['18개월 수면 퇴행', '취침 시 떼쓰기', '악몽 시작'],
  },
  '19-21': {
    ageLabel: '19~21개월',
    totalSleep: '11~13시간', nightSleep: '10~11시간', napCount: '1회',
    napDuration: '1시간 30분~2시간 30분', wakeWindow: '5시간~5시간 30분', bedtime: '19:00~19:30',
    wakeTime: '06:00~07:00', napTimes: ['12:30~13:00'],
    tips: ['오후 3시 이전에 낮잠을 끝내세요', '일관된 취침 루틴 유지가 핵심', '낮에 충분한 신체 활동', '감정 발달로 잠자리 저항이 늘 수 있어요'],
    commonIssues: ['취침 거부/떼쓰기', '낮잠 거부하는 날 발생', '이빨(어금니) 나면서 통증'],
  },
  '22-24': {
    ageLabel: '22~24개월',
    totalSleep: '11~13시간', nightSleep: '10~11시간', napCount: '1회',
    napDuration: '1시간 30분~2시간', wakeWindow: '5시간~6시간', bedtime: '19:00~20:00',
    wakeTime: '06:00~07:00', napTimes: ['13:00'],
    tips: ['2세 수면 퇴행 대비 (자아 폭발기)', '선택지를 주세요 (이 잠옷 vs 저 잠옷)', '취침 전 화면 시청 최소 1시간 전 중단', '낮잠을 너무 늦게 자면 밤잠에 영향'],
    commonIssues: ['2세 수면 퇴행', '침대 탈출 시도', '악몽/야경증', '요구사항 끝없이 늘어남 (물, 화장실, 책)'],
  },
  '25-30': {
    ageLabel: '25~30개월',
    totalSleep: '11~12시간', nightSleep: '10~11시간', napCount: '1회',
    napDuration: '1시간~2시간', wakeWindow: '5시간 30분~6시간', bedtime: '19:30~20:00',
    wakeTime: '06:30~07:00', napTimes: ['13:00'],
    tips: ['일관성이 가장 중요한 시기', '수면 규칙을 그림으로 만들어 보여주기', '낮잠 거부해도 조용한 시간은 유지'],
    commonIssues: ['낮잠 거부 빈도 증가', '혼자 자기 싫어함', '형제 관련 수면 문제'],
  },
  '31-36': {
    ageLabel: '31~36개월',
    totalSleep: '11~12시간', nightSleep: '10~11시간', napCount: '0~1회',
    napDuration: '0~1시간 30분', wakeWindow: '6시간+', bedtime: '19:30~20:00',
    wakeTime: '06:30~07:00', napTimes: ['낮잠 없거나 13:00'],
    tips: ['낮잠을 안 자는 날이 늘어나는 게 정상', '낮잠 없는 날은 취침을 30분 앞당기세요', '화장실 훈련이 수면에 영향 줄 수 있어요'],
    commonIssues: ['낮잠 완전 거부', '야경증/악몽', '화장실 때문에 깨기'],
  },
  '37-48': {
    ageLabel: '3~4세',
    totalSleep: '10~12시간', nightSleep: '10~12시간', napCount: '0회',
    napDuration: '낮잠 불필요', wakeWindow: '종일', bedtime: '19:30~20:30',
    wakeTime: '06:30~07:30', napTimes: [],
    tips: ['규칙적인 취침 시간 유지', '잠자리 공포(어둠, 괴물)에 공감해주기', '수면 보상 스티커 차트 활용'],
    commonIssues: ['어둠 공포', '잠자리 회피', '형제와 방 공유 문제'],
  },
  '49-72': {
    ageLabel: '5~6세',
    totalSleep: '10~11시간', nightSleep: '10~11시간', napCount: '0회',
    napDuration: '낮잠 불필요', wakeWindow: '종일', bedtime: '20:00~21:00',
    wakeTime: '06:30~07:30', napTimes: [],
    tips: ['학교/유치원 준비를 위한 일찍 자기 습관', '전자기기 취침 2시간 전 차단', '운동은 오후에, 취침 직전은 피하기'],
    commonIssues: ['늦게 자려는 습관', '학교 스트레스로 잠 못 잠', '수면 중 이갈이'],
  },
};

/** 월령으로 패턴 찾기 */
export function getPatternForMonth(months: number): SleepPattern {
  const key = String(months);
  if (SLEEP_PATTERNS[key]) return SLEEP_PATTERNS[key];

  // 범위 매칭
  if (months >= 13 && months <= 15) return SLEEP_PATTERNS['13-15'];
  if (months >= 16 && months <= 18) return SLEEP_PATTERNS['16-18'];
  if (months >= 19 && months <= 21) return SLEEP_PATTERNS['19-21'];
  if (months >= 22 && months <= 24) return SLEEP_PATTERNS['22-24'];
  if (months >= 25 && months <= 30) return SLEEP_PATTERNS['25-30'];
  if (months >= 31 && months <= 36) return SLEEP_PATTERNS['31-36'];
  if (months >= 37 && months <= 48) return SLEEP_PATTERNS['37-48'];
  if (months >= 49) return SLEEP_PATTERNS['49-72'];

  return SLEEP_PATTERNS['0'];
}

/** 사용자 수면 데이터 기반 예측 생성 (AI 없이) */
export function generateDbPrediction(
  months: number,
  trackingData: { avgSleepHours?: number; avgBedtime?: string; avgWakeTime?: string; dataCount: number },
) {
  const pattern = getPatternForMonth(months);
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? '오전' : hour < 18 ? '오후' : '저녁';

  let nextNapTime = '없음';
  let nextNapConfidence: 'high' | 'medium' | 'low' = 'medium';
  let nextNapReason = '';

  if (pattern.napTimes.length > 0) {
    // 현재 시간 이후의 가장 가까운 낮잠 찾기
    for (const napTime of pattern.napTimes) {
      const match = napTime.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        const napHour = parseInt(match[1], 10);
        if (napHour > hour) {
          nextNapTime = napTime;
          nextNapConfidence = trackingData.dataCount >= 7 ? 'high' : trackingData.dataCount >= 3 ? 'medium' : 'low';
          nextNapReason = trackingData.dataCount >= 3
            ? `최근 ${trackingData.dataCount}일 수면 기록과 ${pattern.ageLabel} 표준 패턴 기반`
            : `${pattern.ageLabel} 표준 수면 패턴 기반 권장 시간`;
          break;
        }
      }
    }
    if (nextNapTime === '없음' && timeOfDay === '오전') {
      nextNapTime = pattern.napTimes[0];
      nextNapReason = `${pattern.ageLabel} 표준 낮잠 시간`;
    }
  }

  const bedtimeConfidence: 'high' | 'medium' | 'low' = trackingData.dataCount >= 7 ? 'high' : trackingData.dataCount >= 3 ? 'medium' : 'low';

  return {
    pattern,
    prediction: {
      nextNap: pattern.napCount !== '0회' ? {
        label: '다음 낮잠',
        time: nextNapTime,
        confidence: nextNapConfidence,
        reason: nextNapReason || `${pattern.ageLabel} 표준 패턴`,
      } : null,
      bedtime: {
        label: '취침 시간',
        time: trackingData.avgBedtime ?? pattern.bedtime,
        confidence: bedtimeConfidence,
        reason: trackingData.dataCount >= 3
          ? `최근 ${trackingData.dataCount}일 취침 기록 평균`
          : `${pattern.ageLabel} 권장 취침 시간`,
      },
      tips: pattern.tips,
      avgSleepHours: trackingData.avgSleepHours
        ? `약 ${trackingData.avgSleepHours.toFixed(1)}시간`
        : pattern.totalSleep,
      sleepPattern: pattern,
      source: 'db' as const,
    },
  };
}
