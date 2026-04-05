import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { childApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { FeedingCard } from '../../components/baby-tracker/FeedingCard';
import { DiaperCard } from '../../components/baby-tracker/DiaperCard';
import { SleepCard } from '../../components/baby-tracker/SleepCard';
import { WeeklyAverage } from '../../components/baby-tracker/WeeklyAverage';
import type { DailyTrackingData, TrackingRecord } from '../../components/baby-tracker/types';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export default function BabyTrackerScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<TrackingRecord[]>([]);
  const [data, setData] = useState<DailyTrackingData>({
    feedingType: 'breast',
    feedingCount: 0,
    poopCount: 0,
    peeCount: 0,
    napCount: 0,
    totalSleepHours: 0,
  });

  useEffect(() => {
    if (selectedChild) loadHistory();
  }, [selectedChild?.id]);

  const loadHistory = useCallback(async () => {
    if (!selectedChild) return;
    try {
      const res = await childApi.getDailyTracking(selectedChild.id, 7);
      const records = res.data.data as TrackingRecord[];
      setHistory(records);
      const todayRec = records.find((r) => r.date === todayStr());
      if (todayRec) {
        setData({
          feedingType: todayRec.feeding.type as DailyTrackingData['feedingType'],
          feedingCount: todayRec.feeding.count,
          poopCount: todayRec.diaper.poop,
          peeCount: todayRec.diaper.pee,
          napCount: todayRec.sleep.naps,
          totalSleepHours: todayRec.sleep.totalHours,
        });
      }
    } catch {
      // offline fallback
    }
  }, [selectedChild?.id]);

  const handleSave = async () => {
    if (!selectedChild) return;
    setSaving(true);
    try {
      await childApi.saveDailyTracking(selectedChild.id, {
        date: todayStr(),
        feeding: { type: data.feedingType, count: data.feedingCount },
        diaper: { poop: data.poopCount, pee: data.peeCount, total: data.poopCount + data.peeCount },
        sleep: { naps: data.napCount, totalHours: data.totalSleepHours },
      });
      Alert.alert('저장 완료', '오늘의 기록이 저장되었습니다.');
      await loadHistory();
    } catch {
      Alert.alert('오류', '저장 중 문제가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '아기 기록', headerShown: true }} />

      <Text style={styles.dateLabel}>{todayStr()}</Text>

      <FeedingCard data={data} onChange={setData} />
      <DiaperCard data={data} onChange={setData} />
      <SleepCard data={data} onChange={setData} />
      <WeeklyAverage history={history} today={data} />

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>
          {saving ? '저장 중...' : '오늘 기록 저장'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  dateLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});
