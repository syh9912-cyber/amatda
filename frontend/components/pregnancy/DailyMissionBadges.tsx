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
import { CelebrationOverlay } from '../common/CelebrationOverlay';
import { premiumApi } from '../../services/api';

const WATER_MESSAGES = [
  '벌써 8잔? 물 마시기 미션 클리어! 엄마의 정성에 아기도 기뻐할 거예요. 💧',
  '오늘 물 8잔 완성! 우리 엄마 정말 부지런하시네요. 👏',
  '물 8잔 미션 끝! 아기에게 깨끗한 영양이 잘 전달되고 있어요. ✨',
];
const SUPPLEMENT_MESSAGES = [
  '오늘의 영양제 완료! 엄마가 건강해야 아기도 건강해요. 최고! 💊',
  '우리 엄마, 오늘도 정말 고생 많았어요. (토닥토닥)',
  '세상에서 가장 성실한 엄마, 오늘도 완벽하게 해냈네요!',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
  const [celebration, setCelebration] = useState<{ message: string; vip: boolean } | null>(null);
  const waterPulse = useRef(new Animated.Value(1)).current;
  const supPulse = useRef(new Animated.Value(1)).current;
  const [isVip, setIsVip] = useState(false);

  // VIP 여부 (premium status) — 1회 조회 후 캐싱
  useEffect(() => {
    let cancelled = false;
    premiumApi
      .status()
      .then((res) => {
        const data = res.data?.data as { tier?: string; premiumActive?: boolean; trialActive?: boolean } | undefined;
        if (cancelled) return;
        const vip = data?.tier === 'PAID' || data?.premiumActive === true || data?.trialActive === true;
        setIsVip(Boolean(vip));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
    const wasNotDone = state.water < WATER_GOAL;
    try {
      const res = await pregnancyApi.addWater(childId, 1);
      const data = res.data?.data as { water?: number } | undefined;
      if (typeof data?.water === 'number') {
        const next = data.water;
        setState((s) => ({ ...s, water: next }));
        // 8잔 첫 달성 시 폭죽
        if (wasNotDone && next >= WATER_GOAL) {
          setCelebration({ message: pickRandom(WATER_MESSAGES), vip: isVip });
        }
      }
    } catch {
      setState((s) => {
        const next = Math.min(WATER_GOAL + 5, s.water + 1);
        if (wasNotDone && next >= WATER_GOAL) {
          setCelebration({ message: pickRandom(WATER_MESSAGES), vip: isVip });
        }
        return { ...s, water: next };
      });
    } finally {
      setLoading(false);
    }
  }, [loading, childId, waterPulse, state.water, isVip]);

  const onSupplements = useCallback(async () => {
    if (loading) return;
    const next = !state.supplements;
    setState((s) => ({ ...s, supplements: next })); // optimistic
    pulse(supPulse);
    setLoading(true);
    try {
      await pregnancyApi.toggleSupplements(childId, next);
      // OFF → ON 전환 시 폭죽
      if (next === true) {
        setCelebration({ message: pickRandom(SUPPLEMENT_MESSAGES), vip: isVip });
      }
    } catch {
      setState((s) => ({ ...s, supplements: !next }));
    } finally {
      setLoading(false);
    }
  }, [loading, childId, state.supplements, supPulse, isVip]);

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

      {/* 축하 폭죽 + 응원 메시지 */}
      <CelebrationOverlay
        visible={celebration !== null}
        message={celebration?.message ?? ''}
        vip={celebration?.vip ?? false}
        onClose={() => setCelebration(null)}
      />
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
