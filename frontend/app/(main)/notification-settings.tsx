import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { retentionApi } from '../../services/api';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  syncScheduledNotifications,
  syncReengagementNotifications,
  type NotificationPreferences,
} from '../../services/pushNotifications';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';

interface ToggleItem {
  key: keyof NotificationPreferences;
  emoji: string;
  label: string;
  description: string;
  time: string;
}

const DAILY_ITEMS: ToggleItem[] = [
  {
    key: 'morning',
    emoji: '🌅',
    label: '아침 인사 알림',
    description: '어젯밤 아이 수면 체크',
    time: '매일 오전 8:00',
  },
  {
    key: 'afternoon',
    emoji: '🎨',
    label: '오후 활동 추천',
    description: '아이와 함께하는 15분 놀이',
    time: '매일 오후 3:00',
  },
  {
    key: 'evening',
    emoji: '📝',
    label: '저녁 일기 알림',
    description: '오늘의 육아일기 작성 알림',
    time: '매일 오후 9:00',
  },
  {
    key: 'weekly',
    emoji: '📊',
    label: '주간 리포트',
    description: '이번 주 육아 리포트 도착',
    time: '매주 월요일 오전 9:00',
  },
];

const SMART_ITEMS: ToggleItem[] = [
  {
    key: 'coachingFollowup',
    emoji: '💬',
    label: 'AI 상담 팔로업',
    description: '상담 다음날 "어제는 잘 지나갔나요?" 체크',
    time: '상담 다음날 오전 10:00',
  },
  {
    key: 'reengagement',
    emoji: '💌',
    label: '보고싶어요 알림',
    description: '접속이 뜸할 때 아이 근황 리마인더',
    time: '3일/7일/10일/14일 미접속 시',
  },
];

export default function NotificationSettingsScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    morning: true,
    afternoon: true,
    evening: true,
    weekly: true,
    coachingFollowup: true,
    reengagement: true,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadNotificationPrefs()
      .then((saved) => {
        setPrefs(saved);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleToggle = useCallback(
    async (key: keyof NotificationPreferences) => {
      const updated: NotificationPreferences = { ...prefs, [key]: !prefs[key] };
      setPrefs(updated);

      await saveNotificationPrefs(updated);

      if (selectedChild) {
        await syncScheduledNotifications(updated, selectedChild.name);

        // Handle re-engagement sync separately
        if (key === 'reengagement') {
          await syncReengagementNotifications(selectedChild.name);
        }

        // Sync preference to backend
        retentionApi.pushSchedule({
          childId: selectedChild.id,
          morning: updated.morning,
          afternoon: updated.afternoon,
          evening: updated.evening,
          weekly: updated.weekly,
        }).catch(() => {
          // silent fail for backend sync
        });
      }
    },
    [prefs, selectedChild],
  );

  const renderSection = (title: string, items: ToggleItem[]) => (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <View key={item.key} style={[styles.row, !isLast && styles.rowBorder]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <View style={styles.labelCol}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.desc}>{item.description}</Text>
                <Text style={styles.time}>{item.time}</Text>
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
    </>
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림 설정</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Description */}
      <View style={styles.descCard}>
        <Text style={styles.descEmoji}>{'🔔'}</Text>
        <Text style={styles.descTitle}>
          {selectedChild
            ? `${selectedChild.name} 맞춤 알림을 설정해보세요`
            : '맞춤 알림을 설정해보세요'}
        </Text>
        <Text style={styles.descSub}>
          원하는 시간에 육아 팁과 리마인더를 받을 수 있어요
        </Text>
      </View>

      {/* Daily notifications */}
      {renderSection('일상 알림', DAILY_ITEMS)}

      {/* Smart notifications */}
      {renderSection('스마트 알림', SMART_ITEMS)}

      {/* Info note */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          알림은 기기에서 직접 전송되며 무료입니다. 진동 모드에서는 진동으로 알림됩니다. 커스텀 알림음은 다음 앱 업데이트에서 적용됩니다.
        </Text>
      </View>
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
    marginTop: 2,
    fontWeight: '500',
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
