/**
 * pushI18n.ts
 *
 * 백엔드에서 발송하는 푸시 알림 문구의 다국어(ko/ja/zh-Hant) 빌더.
 *
 * 배경: 푸시는 백엔드 sweep(예측알람/휴면/체험/또래맘)에서 발송되므로,
 *       각 사용자의 언어를 알아야 한다. 사용자 locale 은 pushSchedules 문서의
 *       `locale` 필드에 저장된다(앱이 토큰 등록 시 함께 전송 → routes/retention.ts).
 *       locale 이 없으면(기존 사용자·구버전 앱) 한국어로 폴백 → 기존 동작 유지.
 *
 * ⚠️ ko 문구는 기존 하드코딩과 byte-identical 유지(추가형). ja/zh 만 신규.
 */

export type PushLocale = 'ko' | 'ja' | 'zh-Hant';

/** 저장값(any)을 안전하게 PushLocale 로 정규화. 미지정/미지원 → 'ko'. */
export function normalizePushLocale(v: unknown): PushLocale {
  return v === 'ja' || v === 'zh-Hant' ? v : 'ko';
}

export interface PushText {
  title: string;
  body: string;
}

// ─────────────────────────────────────────────
// 나이 표기 (또래맘 푸시용) — formatAgeKo 와 동일 규칙의 로케일별 버전
// ─────────────────────────────────────────────
export function formatAgeByLocale(months: number, locale: PushLocale): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (locale === 'ja') {
    if (months < 24) return `${months}か月`;
    return rem === 0 ? `${years}歳` : `${years}歳${rem}か月`;
  }
  if (locale === 'zh-Hant') {
    if (months < 24) return `${months}個月`;
    return rem === 0 ? `${years}歲` : `${years}歲${rem}個月`;
  }
  // ko — services/age.calculator.ts formatAgeKo 와 동일
  if (months < 24) return `${months}개월`;
  return rem === 0 ? `${years}세` : `${years}세 ${rem}개월`;
}

// ─────────────────────────────────────────────
// 1) 예측 알람 (수유/수면/기상 — 아기시간 연동)
// ─────────────────────────────────────────────
type AlarmType = 'feeding' | 'sleep' | 'wake';

const ALARM_LABEL: Record<PushLocale, Record<AlarmType, string>> = {
  ko: { feeding: '수유', sleep: '수면', wake: '기상' },
  ja: { feeding: '授乳', sleep: 'ねんね', wake: '起床' },
  'zh-Hant': { feeding: '餵奶', sleep: '睡覺', wake: '起床' },
};

export function predictiveAlarmPush(
  type: AlarmType,
  hh: string,
  mm: string,
  offsetMin: number,
  childName: string | undefined,
  locale: PushLocale,
): PushText {
  const emoji = type === 'feeding' ? '🍼' : type === 'sleep' ? '😴' : '☀️';
  const who = childName && childName.trim() ? `${childName.trim()} ` : '';
  const label = ALARM_LABEL[locale][type];

  if (locale === 'ja') {
    return {
      title: `${emoji} ${who}まもなく${label}の時間です`,
      body: `${offsetMin}分後（${hh}:${mm}頃）、いつもの${label}の時間です。準備しておきましょう。`,
    };
  }
  if (locale === 'zh-Hant') {
    return {
      title: `${emoji} ${who}快到${label}時間了`,
      body: `${offsetMin}分鐘後（約${hh}:${mm}）是平常${label}的時間，先準備一下吧！`,
    };
  }
  // ko — 기존 alarmPushText 와 byte-identical
  return {
    title: `${emoji} ${who}곧 ${label} 시간이에요`,
    body: `${offsetMin}분 후(${hh}:${mm}쯤) 평소 ${label}하던 시간이에요. 미리 준비해볼까요?`,
  };
}

// ─────────────────────────────────────────────
// 2) 휴면 계정 안내
// ─────────────────────────────────────────────
export function dormantPush(dateStr: string, locale: PushLocale): PushText {
  if (locale === 'ja') {
    return {
      title: 'アマッタ — 休眠アカウントのお知らせ',
      body: `1年間ご利用がなかったため、${dateStr}にアカウントと写真が自動的に削除されます。アプリを開いていただくと保存期間が延長されます。`,
    };
  }
  if (locale === 'zh-Hant') {
    return {
      title: 'Amatda — 休眠帳號通知',
      body: `由於一年未使用，帳號與相片將於 ${dateStr} 自動刪除。開啟 App 即可延長保存期限。`,
    };
  }
  return {
    title: '아맞다 — 휴면 계정 안내',
    body: `1년 동안 미접속하셔서 ${dateStr}에 계정과 사진이 자동 삭제됩니다. 앱을 열어주시면 보관이 연장돼요.`,
  };
}

// ─────────────────────────────────────────────
// 3) 무료 체험 종료 임박
// ─────────────────────────────────────────────
export function trialEndingPush(locale: PushLocale): PushText {
  if (locale === 'ja') {
    return {
      title: '✨ 7日間の無料体験がまもなく終了します',
      body: '明日の深夜ごろ体験が終了します。プレミアムを続けてご利用いただくには、定期購入を開始してください。',
    };
  }
  if (locale === 'zh-Hant') {
    return {
      title: '✨ 7天免費體驗即將結束',
      body: '體驗將於明天午夜前後結束。若要繼續使用進階功能，請開始訂閱。',
    };
  }
  return {
    title: '✨ 7일 무료 체험이 곧 끝나요',
    body: '내일 자정 무렵 체험이 종료돼요. 계속 프리미엄을 이용하려면 구독을 시작해 주세요.',
  };
}

// ─────────────────────────────────────────────
// 4) 동네 또래맘 모임 넛지
// ─────────────────────────────────────────────
export function neighborGroupPush(
  district: string,
  months: number,
  locale: PushLocale,
): PushText {
  const age = formatAgeByLocale(months, locale);
  if (locale === 'ja') {
    return {
      title: `${district} ${age}のママ会 💬`,
      body: '近所で同じくらいの月齢の子を育てるママたちが悩みを話し合っています。一緒にお話ししましょう！',
    };
  }
  if (locale === 'zh-Hant') {
    return {
      title: `${district} ${age}媽媽聚會 💬`,
      body: '附近有正在養育相近月齡孩子的媽媽們在交流育兒煩惱，一起來聊聊吧！',
    };
  }
  return {
    title: `${district} ${age} 또래맘 모임 💬`,
    body: '우리 동네에서 비슷한 시기 아이 키우는 엄마들이 고민 나누고 있어요. 같이 이야기해요!',
  };
}
