/**
 * 임산부 데일리 미션 배지 — 물 마시기 / 영양제 챙기기
 *
 * 홈 화면 상단에 작게 배치. 터치하면 카운트 증가/토글.
 * 완료 시 색상 변화 + 작은 펄스 애니메이션.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { pregnancyApi } from '../../services/api';
import {
  getDailyMissionReminderEnabled,
  scheduleDailyMissionReminder,
} from '../../services/pushNotifications';

const WATER_GOAL = 8; // 하루 8잔 (2L 권장)

interface Props {
  childId: string;
}

interface MissionState {
  water: number;
  supplements: boolean;
}

export function DailyMissionBadges({ childId }: Props) {
  const [state, setState] = useState<MissionState>({ water: 0, supplements: false });
  const [loading, setLoading] = useState(false);
  const waterPulse = useRef(new Animated.Value(1)).current;
  const supPulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    if (!childId) return;
    try {
      const res = await pregnancyApi.getDailyMission(childId);
      const data = res.data?.data as MissionState | undefined;
      if (data) setState({ water: data.water ?? 0, supplements: data.supplements === true });
    } catch {
      // 무시 (네트워크 에러 시 기본값 유지)
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  // 매일 9시 알림 자동 등록 (사용자가 명시적으로 끄지 않은 경우)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const enabled = await getDailyMissionReminderEnabled();
        if (!enabled || cancelled) return;
        await scheduleDailyMissionReminder();
      } catch {
        // 권한 거부 등 — 무시
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function pulse(anim: Animated.Value) {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.2, duration: 120, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  const onWater = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    pulse(waterPulse);
    try {
      const res = await pregnancyApi.addWater(childId, 1);
      const data = res.data?.data as { water?: number } | undefined;
      if (typeof data?.water === 'number') {
        setState((s) => ({ ...s, water: data.water as number }));
      }
    } catch {
      // 실패 시 낙관적 업데이트만 (이미 pulse는 됨)
      setState((s) => ({ ...s, water: Math.min(WATER_GOAL + 5, s.water + 1) }));
    } finally {
      setLoading(false);
    }
  }, [loading, childId, waterPulse]);

  const onSupplements = useCallback(async () => {
    if (loading) return;
    const next = !state.supplements;
    setState((s) => ({ ...s, supplements: next })); // optimistic
    pulse(supPulse);
    setLoading(true);
    try {
      await pregnancyApi.toggleSupplements(childId, next);
    } catch {
      // 실패 시 롤백
      setState((s) => ({ ...s, supplements: !next }));
    } finally {
      setLoading(false);
    }
  }, [loading, childId, state.supplements, supPulse]);

  const waterDone = state.water >= WATER_GOAL;
  const waterRatio = Math.min(1, state.water / WATER_GOAL);

  return (
    <View style={styles.row}>
      {/* 물 */}
      <Animated.View style={{ transform: [{ scale: waterPulse }] }}>
        <TouchableOpacity
          style={[styles.badge, waterDone && styles.badgeDoneWater]}
          onPress={onWater}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <Text style={styles.emoji}>💧</Text>
          <View style={styles.badgeBody}>
            <Text style={[styles.badgeLabel, waterDone && styles.badgeLabelDone]}>물</Text>
            <Text style={[styles.badgeValue, waterDone && styles.badgeLabelDone]}>
              {state.water}/{WATER_GOAL}잔
            </Text>
          </View>
          {/* 진행도 막대 */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${waterRatio * 100}%`, backgroundColor: waterDone ? '#1976D2' : '#64B5F6' },
              ]}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* 영양제 */}
      <Animated.View style={{ transform: [{ scale: supPulse }] }}>
        <TouchableOpacity
          style={[styles.badge, state.supplements && styles.badgeDoneSup]}
          onPress={onSupplements}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <Text style={styles.emoji}>{state.supplements ? '✨💊' : '💊'}</Text>
          <View style={styles.badgeBody}>
            <Text style={[styles.badgeLabel, state.supplements && styles.badgeLabelDone]}>영양제</Text>
            <Text style={[styles.badgeValue, state.supplements && styles.badgeLabelDone]}>
              {state.supplements ? '완료' : '아직'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EEE',
    minWidth: 130,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  badgeDoneWater: { backgroundColor: '#E3F2FD', borderColor: '#90CAF9' },
  badgeDoneSup: { backgroundColor: '#F3E5F5', borderColor: '#CE93D8' },
  emoji: { fontSize: 20 },
  badgeBody: { flex: 1 },
  badgeLabel: { fontSize: 11, color: '#888', fontWeight: '600' },
  badgeLabelDone: { color: '#1A1A1A' },
  badgeValue: { fontSize: 13, color: '#333', fontWeight: '700' },
  progressTrack: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    right: 8,
    height: 3,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
});
