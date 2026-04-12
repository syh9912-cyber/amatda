/**
 * 시간 인식 모듈
 * - 한국 시간 기준 상담 시간대 감지
 * - 시간에 따라 AI가 공감 표현을 자연스럽게 조절
 */

export interface TimeContext {
  hourKST: number;
  dayOfWeek: string;
  timeSlot: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'latenight';
  empathyHint: string;
  isWeekend: boolean;
}

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function getTimeContext(): TimeContext {
  // 한국 시간 (UTC+9)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hourKST = kst.getUTCHours();
  const dayIdx = kst.getUTCDay();
  const dayOfWeek = DAY_NAMES[dayIdx];
  const isWeekend = dayIdx === 0 || dayIdx === 6;

  let timeSlot: TimeContext['timeSlot'];
  let empathyHint: string;

  if (hourKST >= 0 && hourKST < 5) {
    timeSlot = 'latenight';
    empathyHint = '이 늦은 시간에 상담하시는 걸 보면 많이 걱정되시는 것 같아요. 부모님도 쉬셔야 하는데, 고생이 많으시네요.';
  } else if (hourKST >= 5 && hourKST < 7) {
    timeSlot = 'dawn';
    empathyHint = '이른 아침부터 아이 때문에 신경쓰시는 거죠. 정말 성실한 부모님이세요.';
  } else if (hourKST >= 7 && hourKST < 12) {
    timeSlot = 'morning';
    empathyHint = isWeekend
      ? '주말 아침에도 아이 걱정이시군요.'
      : '바쁜 아침인데 시간 내서 물어봐주시는 거죠.';
  } else if (hourKST >= 12 && hourKST < 17) {
    timeSlot = 'afternoon';
    empathyHint = '';
  } else if (hourKST >= 17 && hourKST < 21) {
    timeSlot = 'evening';
    empathyHint = '';
  } else {
    timeSlot = 'night';
    empathyHint = '밤늦게까지 아이 때문에 고민하시는 거죠. 내일은 좀 나아질 거예요.';
  }

  return { hourKST, dayOfWeek, timeSlot, empathyHint, isWeekend };
}
