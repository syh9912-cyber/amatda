import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, Platform } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Stack, router } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useChildStore } from '../../stores/childStore';
import { retentionApi } from '../../services/api';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  syncScheduledNotifications,
  type NotificationPreferences,
} from '../../services/pushNotifications';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';

type BoolKey = 'morning' | 'afternoon' | 'evening' | 'weekly';
type TimeKey = 'morningTime' | 'afternoonTime' | 'eveningTime';

interface ToggleItem {
  key: BoolKey;
  timeKey?: TimeKey;
  emoji: string;
  label: string;
  description: string;
  fixedTimeLabel?: string;
}

const DAILY_ITEMS: ToggleItem[] = [
  {
    key: 'morning',
    timeKey: 'morningTime',
    emoji: '🌅',
    label: '아침 인사 알림',
    description: '어젯밤 아이 수면 체크',
  },
  {
    key: 'afternoon',
    timeKey: 'afternoonTime',
    emoji: '🎨',
    label: '오후 활동 추천',
    description: '아이와 함께하는 15분 놀이',
  },
  {
    key: 'evening',
    timeKey: 'eveningTime',
    emoji: '📝',
    label: '저녁 일기 알림',
    description: '오늘의 육아일기 작성 알림',
  },
  {
    key: 'weekly',
    emoji: '📊',
    label: '주간 리포트',
    description: '이번 주 육아 리포트 도착',
    fixedTimeLabel: '매주 월요일 오전 9:00',
  },
];

function formatTimeLabel(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const period = h < 12 ? '오전' : '오후';
  const h12 = ((h + 11) % 12) + 1;
  return `매일 ${period} ${h12}:${String(m).padStart(2, '0')}`;
}

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function dateToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function NotificationSettingsScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    morning: true,
    afternoon: true,
    evening: true,
    weekly: true,
    coachingFollowup: true,
    reengagement: true,
    morningTime: '08:00',
    afternoonTime: '15:00',
    eveningTime: '21:00',
  });
  const [loaded, setLoaded] = useState(false);
  const [pickerKey, setPickerKey] = useState<TimeKey | null>(null);

  useEffect(() => {
    loadNotificationPrefs()
      .then((saved) => {
        setPrefs(saved);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const persist = useCallback(
    async (updated: NotificationPreferences) => {
      setPrefs(updated);
      await saveNotificationPrefs(updated);
      if (selectedChild) {
        await syncScheduledNotifications(updated, selectedChild.name);
        retentionApi.pushSchedule({
          childId: selectedChild.id,
          morning: updated.morning,
          afternoon: updated.afternoon,
          evening: updated.evening,
          weekly: updated.weekly,
        }).catch(() => { /* silent */ });
      }
    },
    [selectedChild],
  );

  const handleToggle = useCallback(
    (key: BoolKey) => {
      const updated: NotificationPreferences = { ...prefs, [key]: !prefs[key] };
      persist(updated);
    },
    [prefs, persist],
  );

  const handleTimeChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (!pickerKey) return;
      if (Platform.OS !== 'ios') {
        setPickerKey(null);
      }
      if (event.type === 'dismissed' || !date) return;
      const next = dateToHHMM(date);
      const updated: NotificationPreferences = { ...prefs, [pickerKey]: next };
      persist(updated);
    },
    [pickerKey, prefs, persist],
  );

  if (!loaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.loadingText}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림 설정</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.descCard}>
        <Text style={styles.descEmoji}>{'🔔'}</Text>
        <Text style={styles.descTitle}>
          {selectedChild
            ? `${selectedChild.name} 맞춤 알림을 설정해보세요`
            : '맞춤 알림을 설정해보세요'}
        </Text>
        <Text style={styles.descSub}>
          알림 시간을 탭하면 원하는 시간으로 바꿀 수 있어요
        </Text>
      </View>

      <Text style={styles.sectionTitle}>일상 알림</Text>
      <View style={styles.card}>
        {DAILY_ITEMS.map((item, idx) => {
          const isLast = idx === DAILY_ITEMS.length - 1;
          const timeValue = item.timeKey ? prefs[item.timeKey] : null;
          const timeLabel = item.fixedTimeLabel ?? (timeValue ? formatTimeLabel(timeValue) : '');
          return (
            <View key={item.key} style={[styles.row, !isLast && styles.rowBorder]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <View style={styles.labelCol}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.desc}>{item.description}</Text>
                {item.timeKey ? (
                  <TouchableOpacity
                    onPress={() => setPickerKey(item.timeKey!)}
                    disabled={!prefs[item.key]}
                  >
                    <Text style={[styles.time, !prefs[item.key] && styles.timeDisabled]}>
                      {timeLabel}  ▸
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.time}>{timeLabel}</Text>
                )}
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={() => handleToggle(item.key)}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={prefs[item.key] ? COLORS.primary : '#f4f3f4'}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          알림은 기기에서 직접 전송되며 무료입니다. 진동 모드에서는 진동으로 알림됩니다.
        </Text>
      </View>

      {pickerKey && (
        <DateTimePicker
          value={hhmmToDate(prefs[pickerKey])}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
    paddingRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  descCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  descEmoji: {
    fontSize: 36,
    marginBottom: SPACING.sm,
  },
  descTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  descSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5EDE4',
  },
  emoji: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  labelCol: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '600',
  },
  desc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  time: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  timeDisabled: {
    color: COLORS.textLight,
  },
  infoCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 16,
    padding: SPACING.md,
  },
  infoText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    lineHeight: 18,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
});
