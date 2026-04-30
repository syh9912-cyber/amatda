import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Types ---

export interface NotificationPreferences {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  weekly: boolean;
  coachingFollowup: boolean;
  reengagement: boolean;
  // 사용자가 조절 가능한 알림 시각 (HH:MM, 24시간)
  morningTime: string;
  afternoonTime: string;
  eveningTime: string;
}

function parseHM(s: string, fallbackH: number, fallbackM: number): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? '');
  if (!m) return { hour: fallbackH, minute: fallbackM };
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return { hour: h, minute: mm };
}

interface ScheduledIds {
  morning: string | null;
  afternoon: string | null;
  evening: string | null;
  weekly: string | null;
  coachingFollowup: string | null;
  reengagement3d: string | null;
  reengagement7d: string | null;
  reengagement10d: string | null;
  reengagement14d: string | null;
  morningScheduledAt?: string;
  afternoonScheduledAt?: string;
  eveningScheduledAt?: string;
}

// --- Constants ---

const PREFS_KEY = 'amatda_notification_prefs';
const SCHEDULED_IDS_KEY = 'amatda_notification_ids';
const LAST_ACCESS_KEY = 'amatda_last_access';
const LAST_COACHING_KEY = 'amatda_last_coaching';

const DEFAULT_PREFS: NotificationPreferences = {
  morning: true,
  afternoon: true,
  evening: true,
  weekly: true,
  coachingFollowup: true,
  reengagement: true,
  morningTime: '08:00',
  afternoonTime: '15:00',
  eveningTime: '21:00',
};

const EMPTY_IDS: ScheduledIds = {
  morning: null,
  afternoon: null,
  evening: null,
  weekly: null,
  coachingFollowup: null,
  reengagement3d: null,
  reengagement7d: null,
  reengagement10d: null,
  reengagement14d: null,
};

// --- Re-engagement messages (rotated) ---

const REENGAGEMENT_MESSAGES = {
  '3d': {
    title: '아맞다',
    body: (name: string) => `${name}는 잘 지내고 있나요? 요즘 어떻게 지내는지 궁금해요!`,
    screen: 'home',
  },
  '7d': {
    title: '아맞다',
    body: (name: string) => `${name}의 성장일기가 많이 밀렸어요! 잠깐만 시간 내주시면 소중한 기록이 됩니다`,
    screen: 'diary',
  },
  '10d': {
    title: '아맞다',
    body: () => '육아일지가 많이 밀렸어요! 데이터를 누적해주면 분석해서 부족한 부분을 채울 수 있어요',
    screen: 'diary',
  },
  '14d': {
    title: '아맞다',
    body: (name: string) => `${name}의 성장, 놓치지 마세요! 오늘 잠깐이라도 기록해볼까요?`,
    screen: 'home',
  },
} as const;

// --- Configure notification handler ---

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// --- Push token registration ---

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  if (Platform.OS === 'android') {
    // Main notification channel
    await Notifications.setNotificationChannelAsync('default', {
      name: '아맞다 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF8C5A',
      sound: 'amatda_chime.wav',
    });

    // Engagement notification channel (longer vibration, same sound)
    await Notifications.setNotificationChannelAsync('engagement', {
      name: '아맞다 리마인더',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 200, 300, 200, 400],
      lightColor: '#4338CA',
      sound: 'amatda_chime.wav',
      enableVibrate: true,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.log('Missing EAS projectId in app config');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

// --- Preferences persistence ---

export async function loadNotificationPrefs(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isNotificationPreferences(parsed)) {
        return mergeWithDefaults(parsed as Partial<NotificationPreferences>);
      }
    }
  } catch {
    // fall through to default
  }
  return { ...DEFAULT_PREFS };
}

export async function saveNotificationPrefs(prefs: NotificationPreferences): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

async function loadScheduledIds(): Promise<ScheduledIds> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return { ...EMPTY_IDS, ...(parsed as Partial<ScheduledIds>) };
      }
    }
  } catch {
    // fall through to default
  }
  return { ...EMPTY_IDS };
}

async function saveScheduledIds(ids: ScheduledIds): Promise<void> {
  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
}

// --- Last access tracking ---

export async function trackLastAccess(): Promise<void> {
  await AsyncStorage.setItem(LAST_ACCESS_KEY, new Date().toISOString());
}

export async function getLastAccess(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_ACCESS_KEY);
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

// --- Last coaching tracking ---

export async function trackLastCoaching(): Promise<void> {
  await AsyncStorage.setItem(LAST_COACHING_KEY, new Date().toISOString());
}

// --- Type guards ---

function isNotificationPreferences(value: unknown): value is NotificationPreferences {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.morning === 'boolean' &&
    typeof obj.afternoon === 'boolean' &&
    typeof obj.evening === 'boolean' &&
    typeof obj.weekly === 'boolean'
  );
}

function mergeWithDefaults(partial: Partial<NotificationPreferences>): NotificationPreferences {
  return { ...DEFAULT_PREFS, ...partial };
}

// --- Schedule helpers ---

function getNextTimeAt(hour: number, minute: number, daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  // If the time already passed today and daysFromNow is 0, push to tomorrow
  if (daysFromNow === 0 && d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// --- Schedule individual notifications ---

async function scheduleMorning(childName: string, time: string): Promise<string> {
  const { hour, minute } = parseHM(time, 8, 0);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '아맞다',
      body: `좋은 아침! 어젯밤 ${childName}는 잘 잤나요?`,
      data: { screen: 'chatbot' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'default',
    },
  });
}

async function scheduleAfternoon(childName: string, time: string): Promise<string> {
  const { hour, minute } = parseHM(time, 15, 0);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '아맞다',
      body: `지금 ${childName}와 15분 놀이 시간 어때요?`,
      data: { screen: 'play-learning' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'default',
    },
  });
}

async function scheduleEvening(time: string): Promise<string> {
  const { hour, minute } = parseHM(time, 21, 0);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '아맞다',
      body: '오늘의 육아일기가 준비됐어요',
      data: { screen: 'diary' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'default',
    },
  });
}

async function scheduleWeeklyReport(): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '아맞다',
      body: '이번 주 육아 리포트가 도착했어요',
      data: { screen: 'report' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour: 9,
      minute: 0,
      channelId: 'default',
    },
  });
}

// --- Coaching follow-up (next day 10 AM) ---

export async function scheduleCoachingFollowup(childName: string): Promise<void> {
  const prefs = await loadNotificationPrefs();
  if (!prefs.coachingFollowup) return;

  const ids = await loadScheduledIds();

  // Cancel existing follow-up
  if (ids.coachingFollowup) {
    try { await Notifications.cancelScheduledNotificationAsync(ids.coachingFollowup); } catch { /* ok */ }
  }

  const nextDay = getNextTimeAt(10, 0, 1);

  ids.coachingFollowup = await Notifications.scheduleNotificationAsync({
    content: {
      title: '아맞다',
      body: `어제 ${childName} 상담 후 잘 지나갔나요? 궁금한 점이 있으면 말씀해 주세요`,
      data: { screen: 'chatbot' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextDay,
      channelId: 'engagement',
    },
  });

  await saveScheduledIds(ids);
  await trackLastCoaching();
}

// --- Re-engagement notifications ---

async function scheduleReengagement(childName: string): Promise<ScheduledIds> {
  const ids = await loadScheduledIds();

  // Cancel all existing re-engagement notifications
  type ReKey = 'reengagement3d' | 'reengagement7d' | 'reengagement10d' | 'reengagement14d';
  const reKeys: ReKey[] = ['reengagement3d', 'reengagement7d', 'reengagement10d', 'reengagement14d'];
  for (const key of reKeys) {
    const existing = ids[key];
    if (existing) {
      try { await Notifications.cancelScheduledNotificationAsync(existing); } catch { /* ok */ }
      ids[key] = null;
    }
  }

  // Schedule new re-engagement at 3d, 7d, 10d, 14d from now
  const schedules: { key: ReKey; msgKey: keyof typeof REENGAGEMENT_MESSAGES; days: number; hour: number }[] = [
    { key: 'reengagement3d', msgKey: '3d', days: 3, hour: 10 },
    { key: 'reengagement7d', msgKey: '7d', days: 7, hour: 10 },
    { key: 'reengagement10d', msgKey: '10d', days: 10, hour: 14 },
    { key: 'reengagement14d', msgKey: '14d', days: 14, hour: 10 },
  ];

  for (const s of schedules) {
    const msg = REENGAGEMENT_MESSAGES[s.msgKey];
    const triggerDate = getNextTimeAt(s.hour, 0, s.days);

    ids[s.key] = await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body(childName),
        data: { screen: msg.screen },
        sound: 'amatda_chime.wav',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: 'engagement',
      },
    });
  }

  return ids;
}

// --- Public scheduling API ---

/**
 * Sync scheduled notifications with the given preferences.
 * Call after prefs change or on app startup.
 */
export async function syncScheduledNotifications(
  prefs: NotificationPreferences,
  childName: string,
): Promise<void> {
  const ids = await loadScheduledIds();

  // Morning
  const morningChanged = ids.morningScheduledAt !== prefs.morningTime;
  if (prefs.morning) {
    if (!ids.morning || morningChanged) {
      if (ids.morning) {
        try { await Notifications.cancelScheduledNotificationAsync(ids.morning); } catch { /* ok */ }
      }
      ids.morning = await scheduleMorning(childName, prefs.morningTime);
      ids.morningScheduledAt = prefs.morningTime;
    }
  } else if (ids.morning) {
    await Notifications.cancelScheduledNotificationAsync(ids.morning);
    ids.morning = null;
    ids.morningScheduledAt = undefined;
  }

  // Afternoon
  const afternoonChanged = ids.afternoonScheduledAt !== prefs.afternoonTime;
  if (prefs.afternoon) {
    if (!ids.afternoon || afternoonChanged) {
      if (ids.afternoon) {
        try { await Notifications.cancelScheduledNotificationAsync(ids.afternoon); } catch { /* ok */ }
      }
      ids.afternoon = await scheduleAfternoon(childName, prefs.afternoonTime);
      ids.afternoonScheduledAt = prefs.afternoonTime;
    }
  } else if (ids.afternoon) {
    await Notifications.cancelScheduledNotificationAsync(ids.afternoon);
    ids.afternoon = null;
    ids.afternoonScheduledAt = undefined;
  }

  // Evening
  const eveningChanged = ids.eveningScheduledAt !== prefs.eveningTime;
  if (prefs.evening) {
    if (!ids.evening || eveningChanged) {
      if (ids.evening) {
        try { await Notifications.cancelScheduledNotificationAsync(ids.evening); } catch { /* ok */ }
      }
      ids.evening = await scheduleEvening(prefs.eveningTime);
      ids.eveningScheduledAt = prefs.eveningTime;
    }
  } else if (ids.evening) {
    await Notifications.cancelScheduledNotificationAsync(ids.evening);
    ids.evening = null;
    ids.eveningScheduledAt = undefined;
  }

  // Weekly
  if (prefs.weekly && !ids.weekly) {
    ids.weekly = await scheduleWeeklyReport();
  } else if (!prefs.weekly && ids.weekly) {
    await Notifications.cancelScheduledNotificationAsync(ids.weekly);
    ids.weekly = null;
  }

  await saveScheduledIds(ids);
}

/**
 * Schedule re-engagement notifications (cancel+reschedule from now).
 * Call every time the app is opened.
 */
export async function syncReengagementNotifications(childName: string): Promise<void> {
  const prefs = await loadNotificationPrefs();
  if (!prefs.reengagement) {
    // Cancel all re-engagement
    const ids = await loadScheduledIds();
    type ReKey = 'reengagement3d' | 'reengagement7d' | 'reengagement10d' | 'reengagement14d';
    const reKeys: ReKey[] = ['reengagement3d', 'reengagement7d', 'reengagement10d', 'reengagement14d'];
    for (const key of reKeys) {
      const existing = ids[key];
      if (existing) {
        try { await Notifications.cancelScheduledNotificationAsync(existing); } catch { /* ok */ }
        ids[key] = null;
      }
    }
    await saveScheduledIds(ids);
    return;
  }

  const updatedIds = await scheduleReengagement(childName);
  await saveScheduledIds(updatedIds);
  await trackLastAccess();
}

/**
 * Cancel all scheduled local notifications and clear stored IDs.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await saveScheduledIds({ ...EMPTY_IDS });
}

/**
 * Re-schedule all notifications from scratch (e.g. when child name changes).
 */
export async function rescheduleAllNotifications(
  prefs: NotificationPreferences,
  childName: string,
): Promise<void> {
  await cancelAllNotifications();
  await syncScheduledNotifications(prefs, childName);
  if (prefs.reengagement) {
    await syncReengagementNotifications(childName);
  }
}

// --- 임신 D-Day / 주요 검사 알림 ---

const PREGNANCY_NOTIF_IDS_KEY = 'amatda_pregnancy_notif_ids';

interface PregnancyExamSchedule {
  weekFromLMP: number;
  title: string;
  body: string;
}

const PREGNANCY_EXAMS: PregnancyExamSchedule[] = [
  { weekFromLMP: 12, title: '1차 기형아 검사 (NT)', body: '11~13주 목투명대 검사 시기예요. 병원 예약을 확인해 주세요.' },
  { weekFromLMP: 16, title: '쿼드 검사', body: '15~20주 쿼드 검사 시기예요. 예약했는지 확인해 주세요.' },
  { weekFromLMP: 20, title: '정밀 초음파', body: '20~24주 정밀초음파 시기예요. 아기의 발달을 자세히 볼 수 있어요.' },
  { weekFromLMP: 25, title: '임당 검사 (GCT)', body: '24~28주 임신성 당뇨 검사 시기예요.' },
  { weekFromLMP: 32, title: '태동 검사 (NST)', body: '32주 전후 NST 검사 시기예요.' },
  { weekFromLMP: 36, title: 'GBS 검사', body: '36주 B형 연쇄상구균 검사 시기예요.' },
  { weekFromLMP: 38, title: '출산 가방 준비', body: '출산 가방 체크리스트를 확인해 주세요.' },
];

function dueDateToLMP(dueDate: Date): Date {
  const lmp = new Date(dueDate);
  lmp.setDate(lmp.getDate() - 280);
  return lmp;
}

async function cancelPregnancyNotifs(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PREGNANCY_NOTIF_IDS_KEY);
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    for (const id of ids) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* ok */ }
    }
    await AsyncStorage.removeItem(PREGNANCY_NOTIF_IDS_KEY);
  } catch { /* ok */ }
}

/**
 * 출산예정일 기준 주요 검사 + D-7/D-3/D-Day 알림 스케줄.
 * 이미 지난 시점은 스킵. 중복 방지 위해 기존 예약 전체 취소 후 재스케줄.
 */
export async function schedulePregnancyReminders(dueDateIso: string): Promise<void> {
  await cancelPregnancyNotifs();

  const due = new Date(dueDateIso);
  if (isNaN(due.getTime())) return;
  const lmp = dueDateToLMP(due);
  const now = Date.now();
  const scheduledIds: string[] = [];

  for (const exam of PREGNANCY_EXAMS) {
    const triggerDate = new Date(lmp);
    triggerDate.setDate(triggerDate.getDate() + exam.weekFromLMP * 7);
    triggerDate.setHours(9, 0, 0, 0);
    if (triggerDate.getTime() <= now) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `아맞다 · ${exam.title}`,
        body: exam.body,
        data: { screen: 'pregnancy' },
        sound: 'amatda_chime.wav',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: 'default',
      },
    });
    scheduledIds.push(id);
  }

  const countdownDays: { offset: number; title: string; body: string }[] = [
    { offset: -7, title: '출산 D-7', body: '출산까지 일주일! 가방과 서류를 최종 점검해 주세요.' },
    { offset: -3, title: '출산 D-3', body: '진통 간격 타이머를 미리 확인해 두세요.' },
    { offset: 0, title: '출산예정일 D-Day', body: '예정일이에요. 진통 시작되면 바로 병원에 연락하세요.' },
  ];

  for (const c of countdownDays) {
    const triggerDate = new Date(due);
    triggerDate.setDate(triggerDate.getDate() + c.offset);
    triggerDate.setHours(9, 0, 0, 0);
    if (triggerDate.getTime() <= now) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `아맞다 · ${c.title}`,
        body: c.body,
        data: { screen: 'pregnancy' },
        sound: 'amatda_chime.wav',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: 'engagement',
      },
    });
    scheduledIds.push(id);
  }

  await AsyncStorage.setItem(PREGNANCY_NOTIF_IDS_KEY, JSON.stringify(scheduledIds));
}

// --- 이탈 방지: 첫 AI 상담 유도 푸시 ---

const FIRST_COACHING_KEY = 'amatda_first_coaching_nudge';

/**
 * 아이 등록 직후 호출.
 * 2시간 뒤 "맞춤 육아 팁이 준비됐어요" 푸시 예약.
 * 이미 AI 상담을 했으면 자동 취소됨.
 */
export async function scheduleFirstCoachingNudge(childName: string): Promise<void> {
  // 이미 예약된 게 있으면 스킵
  const existing = await AsyncStorage.getItem(FIRST_COACHING_KEY);
  if (existing) return;

  const triggerDate = new Date();
  triggerDate.setHours(triggerDate.getHours() + 2);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${childName} 맞춤 육아 팁이 준비됐어요`,
      body: '궁금한 거 뭐든 물어보세요. 상담이모가 기다리고 있어요!',
      data: { screen: 'chatbot' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: 'engagement',
    },
  });

  await AsyncStorage.setItem(FIRST_COACHING_KEY, id);
}

/**
 * AI 상담을 처음 시작했을 때 호출.
 * 아직 안 보낸 "첫 상담 유도" 푸시를 취소.
 */
export async function cancelFirstCoachingNudge(): Promise<void> {
  const id = await AsyncStorage.getItem(FIRST_COACHING_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(FIRST_COACHING_KEY);
  }
}

/**
 * 앱 설치 다음날 아침 9시: "어제 써보셨나요?" 넛지.
 */
export async function scheduleNextDayNudge(childName: string): Promise<void> {
  const nudgeKey = 'amatda_nextday_nudge';
  const existing = await AsyncStorage.getItem(nudgeKey);
  if (existing) return;

  const tomorrow9am = getNextTimeAt(9, 0, 1);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '아맞다',
      body: `${childName}에게 딱 맞는 육아 코칭, 한번 써보세요!`,
      data: { screen: 'chatbot' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow9am,
      channelId: 'engagement',
    },
  });

  await AsyncStorage.setItem(nudgeKey, id);
}

/**
 * 임산부 데일리 미션 알림 — 매일 09:00 KST 반복
 *
 * 문구: "똑똑! 👶 엄마, 오늘 영양제 챙기셨나요? 시원한 물 한 잔도 잊지 마세요! ✨"
 * 클릭 시 홈 화면 진입 (홈 상단 미션 배지 노출).
 *
 * 설정 화면에서 ON/OFF 토글 가능.
 *
 * 구현:
 *  - DAILY 트리거 (시스템 스케줄러가 앱 종료 상태에서도 발송)
 *  - 한 번 등록하면 매일 자동 반복
 *  - 중복 방지: 기존 ID 있으면 취소 후 재등록
 */

const DAILY_MISSION_NOTIF_KEY = 'amatda_daily_mission_notif_id';
const DAILY_MISSION_PREF_KEY = 'amatda_daily_mission_pref'; // 'on' | 'off'

export async function scheduleDailyMissionReminder(): Promise<void> {
  // 기존 알림 취소 (재등록)
  const existing = await AsyncStorage.getItem(DAILY_MISSION_NOTIF_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
    await AsyncStorage.removeItem(DAILY_MISSION_NOTIF_KEY);
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '똑똑! 👶 엄마',
      body: '오늘 영양제 챙기셨나요? 시원한 물 한 잔도 잊지 마세요! ✨',
      data: { screen: 'home', source: 'daily_mission' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
      channelId: 'engagement',
    },
  });

  await AsyncStorage.setItem(DAILY_MISSION_NOTIF_KEY, id);
  await AsyncStorage.setItem(DAILY_MISSION_PREF_KEY, 'on');
}

export async function cancelDailyMissionReminder(): Promise<void> {
  const existing = await AsyncStorage.getItem(DAILY_MISSION_NOTIF_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
    await AsyncStorage.removeItem(DAILY_MISSION_NOTIF_KEY);
  }
  await AsyncStorage.setItem(DAILY_MISSION_PREF_KEY, 'off');
}

export async function getDailyMissionReminderEnabled(): Promise<boolean> {
  const pref = await AsyncStorage.getItem(DAILY_MISSION_PREF_KEY);
  // 미설정이면 기본 ON (임신부 모드 첫 진입 시 자동 등록)
  return pref !== 'off';
}

/* ─────────────────────────────────────────────────────────
 * 고열(38°C 이상) 1시간 후 재측정 리마인드
 *
 * - 사용자 입력 체온 ≥ 38°C 일 때만 호출
 * - 정확히 1시간 뒤 로컬 알림 1회
 * - 기존 예약된 재측정 알림이 있으면 취소 후 재등록
 *   (해열제 교차 복용 타이머와는 완전 별개)
 * ───────────────────────────────────────────────────────── */

const FEVER_RECHECK_KEY = (childId: string) => `amatda_fever_recheck_${childId}`;

/** 고열 감지 시 1시간 뒤 재측정 알림 예약. 이전 예약은 자동 취소. */
export async function scheduleFeverRecheckReminder(
  childId: string,
  childName: string,
): Promise<void> {
  if (!childId) return;
  // 기존 예약 취소
  await cancelFeverRecheckReminder(childId);

  const trigger = new Date(Date.now() + 60 * 60 * 1000); // 1시간 뒤
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌡 체온 재측정 알림',
      body: `${childName ? `${childName}의 ` : ''}체온을 측정한 지 1시간이 지났어요! 지금 상태를 다시 한번 체크해 주세요.`,
      data: { screen: 'fever', source: 'fever_recheck' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
      channelId: 'engagement',
    },
  });
  await AsyncStorage.setItem(FEVER_RECHECK_KEY(childId), id);
}

/** 새 체온 기록 시 또는 사용자가 명시적으로 취소할 때 호출 */
export async function cancelFeverRecheckReminder(childId: string): Promise<void> {
  const key = FEVER_RECHECK_KEY(childId);
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
    await AsyncStorage.removeItem(key);
  }
}

/* ─────────────────────────────────────────────────────────
 * 아이 삭제 시 — 해당 아이와 관련된 모든 로컬 알림 일괄 취소
 *
 * 처리:
 *  1. 체온 재측정 알림 (per-child)
 *  2. 임신 일정 알림 (PREGNANCY_NOTIF_IDS_KEY — 전역이지만 임신 아이 1명 기준)
 *  3. 첫 코칭 유도 (FIRST_COACHING_KEY — 전역, 첫 등록 시 1회만 사용)
 *  4. 다음날 넛지 (amatda_nextday_nudge — 전역)
 *  5. 시스템에 예약된 모든 알림 중 data.childId가 일치하는 것 정리 (안전망)
 *
 * 주의: 데일리 미션(매일 9시 알림)은 임신부 모드 기준이라
 *       다른 임신 자녀가 있으면 유지, 임신 자녀 0명이면 별도 정리 권장.
 * ───────────────────────────────────────────────────────── */
export async function cancelAllChildLocalNotifications(childId: string): Promise<void> {
  if (!childId) return;

  // 1. 체온 재측정 (per-child key)
  await cancelFeverRecheckReminder(childId).catch(() => {});

  // 2. 시스템 예약 목록에서 data.childId 일치하는 것 모두 취소 (안전망)
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (n.content as any)?.data as Record<string, unknown> | undefined;
      if (data && data.childId === childId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        } catch { /* ignore */ }
      }
    }
  } catch {
    // getAllScheduled 실패 — 무시
  }
}

/** 임신 자녀(예정일 기반) 삭제 시 — 임신 일정 알림 일괄 취소 */
export async function cancelAllPregnancyLocalNotifications(): Promise<void> {
  try {
    await cancelPregnancyNotifs();
  } catch { /* ignore */ }
}
