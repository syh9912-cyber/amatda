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
        return parsed;
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

async function scheduleMorning(childName: string): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '아맞다',
      body: `좋은 아침! 어젯밤 ${childName}는 잘 잤나요?`,
      data: { screen: 'chatbot' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
      channelId: 'default',
    },
  });
}

async function scheduleAfternoon(childName: string): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '아맞다',
      body: `지금 ${childName}와 15분 놀이 시간 어때요?`,
      data: { screen: 'play-learning' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 15,
      minute: 0,
      channelId: 'default',
    },
  });
}

async function scheduleEvening(): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '아맞다',
      body: '오늘의 육아일기가 준비됐어요',
      data: { screen: 'diary' },
      sound: 'amatda_chime.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 21,
      minute: 0,
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
  const reKeys: (keyof ScheduledIds)[] = ['reengagement3d', 'reengagement7d', 'reengagement10d', 'reengagement14d'];
  for (const key of reKeys) {
    if (ids[key]) {
      try { await Notifications.cancelScheduledNotificationAsync(ids[key]); } catch { /* ok */ }
      ids[key] = null;
    }
  }

  // Schedule new re-engagement at 3d, 7d, 10d, 14d from now
  const schedules: { key: keyof ScheduledIds; msgKey: keyof typeof REENGAGEMENT_MESSAGES; days: number; hour: number }[] = [
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
  if (prefs.morning && !ids.morning) {
    ids.morning = await scheduleMorning(childName);
  } else if (!prefs.morning && ids.morning) {
    await Notifications.cancelScheduledNotificationAsync(ids.morning);
    ids.morning = null;
  }

  // Afternoon
  if (prefs.afternoon && !ids.afternoon) {
    ids.afternoon = await scheduleAfternoon(childName);
  } else if (!prefs.afternoon && ids.afternoon) {
    await Notifications.cancelScheduledNotificationAsync(ids.afternoon);
    ids.afternoon = null;
  }

  // Evening
  if (prefs.evening && !ids.evening) {
    ids.evening = await scheduleEvening();
  } else if (!prefs.evening && ids.evening) {
    await Notifications.cancelScheduledNotificationAsync(ids.evening);
    ids.evening = null;
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
    const reKeys: (keyof ScheduledIds)[] = ['reengagement3d', 'reengagement7d', 'reengagement10d', 'reengagement14d'];
    for (const key of reKeys) {
      if (ids[key]) {
        try { await Notifications.cancelScheduledNotificationAsync(ids[key]); } catch { /* ok */ }
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
      body: '궁금한 거 뭐든 물어보세요. AI 코치가 기다리고 있어요!',
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
