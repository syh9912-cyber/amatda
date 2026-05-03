/**
 * 임산부 데일리 미션 — 물 마시기 / 영양제 챙기기
 *
 * - 단일 탭: 카운트 +1 / 영양제 토글
 * - 길게 누르기(또는 'i'): 의학적 의미 + 주간 통계 표시 모달 → 의무감 부여
 * - 목표 달성 시 폭죽 (CelebrationOverlay)
 * - VIP는 더 화려한 폭죽 효과
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const WATER_ICON = require('../../assets/quick-water.png');
const PILL_ICON = require('../../assets/quick-pill.png');
import { pregnancyApi } from '../../services/api';
import {
  getDailyMissionReminderEnabled,
  scheduleDailyMissionReminder,
} from '../../services/pushNotifications';
import { CelebrationOverlay } from '../common/CelebrationOverlay';
import { MissionToast } from '../common/MissionToast';
import { recordMissionComplete, type StreakMilestone } from '../../utils/missionStreak';
import { premiumApi } from '../../services/api';

const WATER_GOAL = 8; // 하루 8잔 (2L 권장)

interface Props {
  childId: string;
}

interface MissionState {
  water: number;
  supplements: boolean;
}

// (1단계) 작은 토스트 — 매번 한 번 누를 때마다 / 흐름 방해 X
const WATER_TAP_TOASTS = [
  '물 한 잔 추가했어요 💧',
  '시원~ 한 잔 더 마셨어요 💧',
  '꿀꺽! 기록 완료 💧',
];
const WATER_GOAL_TOASTS = [
  '물 8잔 미션 클리어! 💧',
  '오늘 수분 충전 완료! ✨',
];
const SUPPLEMENT_TAP_TOASTS = [
  '영양제 완료했어요 💛',
  '오늘도 영양제 챙겼어요 💊',
  '체크 완료! 잘하셨어요 ✨',
];

// (2단계) 큰 팝업 — 오늘 미션 모두 완료 (물 8잔 + 영양제 둘 다)
const ALL_DONE_MESSAGES = [
  '오늘 미션 완료! 엄마도 아기도 잘 챙겼어요 🎉',
  '오늘도 완벽하게 챙겼어요 💛',
  '아맞다 미션 성공! 작은 습관이 쌓이고 있어요 🌱',
];

// (3단계) 연속 달성 — milestone 별 특별 메시지
function streakMessage(days: StreakMilestone): string {
  switch (days) {
    case 3:   return '3일 연속 성공! 대단해요 🌟';
    case 7:   return '7일 연속 미션 성공! 일주일 루틴 완성 💛';
    case 14:  return '14일 연속 기록 중이에요! 정말 잘하고 있어요 🎉';
    case 30:  return '30일 연속! 이건 진짜 습관이에요 ✨';
    case 60:  return '60일 연속 — 엄마 루틴 마스터 👑';
    case 100: return '100일 연속! 전설의 엄마 인증 🎊';
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const RING_SIZE = 38;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function DailyMissionBadges({ childId }: Props) {
  const [state, setState] = useState<MissionState>({ water: 0, supplements: false });
  const [loading, setLoading] = useState(false);
  const [celebration, setCelebration] = useState<{ message: string; vip: boolean } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState<'water' | 'supplements' | null>(null);
  const waterPulse = useRef(new Animated.Value(1)).current;
  const supPulse = useRef(new Animated.Value(1)).current;
  const [isVip, setIsVip] = useState(false);
  // 오늘 이미 streak 갱신했는지 — 중복 폭죽 방지
  const streakRecordedRef = useRef(false);

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
      // 무시
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  // 매일 9시 알림 자동 등록
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const enabled = await getDailyMissionReminderEnabled();
        if (!enabled || cancelled) return;
        await scheduleDailyMissionReminder();
      } catch {
        // 권한 거부 등 무시
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function pulse(anim: Animated.Value) {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  /**
   * 두 미션 모두 완료 시 — 큰 축하 + streak 검사.
   * @returns true 이면 큰 축하가 떴음 (토스트 생략 신호) / false 이면 안 뜸 (호출자가 토스트로 fallback)
   */
  const handleAllDone = useCallback(async (waterCount: number, suppDone: boolean): Promise<boolean> => {
    const allDone = waterCount >= WATER_GOAL && suppDone;
    if (!allDone) return false;
    // 이미 오늘 streak 기록함 → 큰 축하 생략 (중복 폭죽 방지) → 호출자가 토스트로 fallback
    if (streakRecordedRef.current) return false;
    streakRecordedRef.current = true;
    try {
      const { reachedMilestone } = await recordMissionComplete(childId);
      if (reachedMilestone) {
        setCelebration({ message: streakMessage(reachedMilestone), vip: true });
      } else {
        setCelebration({ message: pickRandom(ALL_DONE_MESSAGES), vip: isVip });
      }
    } catch {
      setCelebration({ message: pickRandom(ALL_DONE_MESSAGES), vip: isVip });
    }
    return true;
  }, [childId, isVip]);

  const onWater = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    pulse(waterPulse);
    const wasUnderGoal = state.water < WATER_GOAL;
    try {
      const res = await pregnancyApi.addWater(childId, 1);
      const data = res.data?.data as { water?: number } | undefined;
      const next = typeof data?.water === 'number' ? data.water : Math.min(WATER_GOAL + 5, state.water + 1);
      setState((s) => ({ ...s, water: next }));
      const justHitGoal = wasUnderGoal && next >= WATER_GOAL;
      const tryAll = justHitGoal && state.supplements;
      // 큰 축하가 떴으면 토스트 생략 / 안 떴으면 토스트로 fallback
      const celebrated = tryAll ? await handleAllDone(next, true) : false;
      if (!celebrated) {
        setToastMessage(justHitGoal ? pickRandom(WATER_GOAL_TOASTS) : pickRandom(WATER_TAP_TOASTS));
      }
    } catch {
      // 백엔드 실패 시 로컬 fallback
      const next = Math.min(WATER_GOAL + 5, state.water + 1);
      setState((s) => ({ ...s, water: next }));
      setToastMessage(pickRandom(WATER_TAP_TOASTS));
    } finally {
      setLoading(false);
    }
  }, [loading, childId, waterPulse, state.water, state.supplements, handleAllDone]);

  const onSupplements = useCallback(async () => {
    if (loading) return;
    const next = !state.supplements;
    setState((s) => ({ ...s, supplements: next }));
    pulse(supPulse);
    setLoading(true);
    try {
      await pregnancyApi.toggleSupplements(childId, next);
      if (next === true) {
        const tryAll = state.water >= WATER_GOAL;
        const celebrated = tryAll ? await handleAllDone(state.water, true) : false;
        if (!celebrated) {
          setToastMessage(pickRandom(SUPPLEMENT_TAP_TOASTS));
        }
      }
    } catch {
      setState((s) => ({ ...s, supplements: !next }));
    } finally {
      setLoading(false);
    }
  }, [loading, childId, state.supplements, state.water, supPulse, handleAllDone]);

  const waterDone = state.water >= WATER_GOAL;
  const waterRatio = Math.min(1, state.water / WATER_GOAL);
  const waterOffset = RING_CIRCUMFERENCE * (1 - waterRatio);
  const supplementOffset = state.supplements ? 0 : RING_CIRCUMFERENCE;

  return (
    <View style={styles.row}>
      {/* 물 카드 — 가로 레이아웃 */}
      <Animated.View style={[styles.cardWrap, { transform: [{ scale: waterPulse }] }]}>
        <TouchableOpacity
          style={[styles.card, styles.cardWater, waterDone && styles.cardWaterDone]}
          onPress={onWater}
          onLongPress={() => setInfoOpen('water')}
          activeOpacity={0.85}
          delayLongPress={400}
          hitSlop={6}
        >
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="#E3F2FD"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={waterDone ? '#1976D2' : '#42A5F5'}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={waterOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <Image source={WATER_ICON} style={styles.ringIcon} resizeMode="contain" />
          </View>

          <View style={styles.textCol}>
            <Text style={styles.cardLabel} numberOfLines={1}>물 마시기</Text>
            <Text style={styles.cardCount} numberOfLines={1}>
              <Text style={[styles.cardCountBig, waterDone && { color: '#1976D2' }]}>{state.water}</Text>
              <Text style={styles.cardCountSub}>/{WATER_GOAL}잔</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => setInfoOpen('water')}
            hitSlop={10}
          >
            <Text style={styles.infoBtnText}>i</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>

      {/* 영양제 카드 — 가로 레이아웃 */}
      <Animated.View style={[styles.cardWrap, { transform: [{ scale: supPulse }] }]}>
        <TouchableOpacity
          style={[styles.card, styles.cardSup, state.supplements && styles.cardSupDone]}
          onPress={onSupplements}
          onLongPress={() => setInfoOpen('supplements')}
          activeOpacity={0.85}
          delayLongPress={400}
          hitSlop={6}
        >
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="#F3E5F5"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="#9C27B0"
                strokeWidth={RING_STROKE}
                fill="none"
                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={supplementOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <Image source={PILL_ICON} style={styles.ringIcon} resizeMode="contain" />
          </View>

          <View style={styles.textCol}>
            <Text style={styles.cardLabel} numberOfLines={1}>영양제</Text>
            <Text style={styles.cardCount} numberOfLines={1}>
              <Text style={[styles.cardCountBig, state.supplements && { color: '#7B1FA2' }]}>
                {state.supplements ? '완료' : '아직'}
              </Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => setInfoOpen('supplements')}
            hitSlop={10}
          >
            <Text style={styles.infoBtnText}>i</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>

      {/* 정보 모달 */}
      <InfoModal
        kind={infoOpen}
        water={state.water}
        supplements={state.supplements}
        onClose={() => setInfoOpen(null)}
      />

      {/* 작은 토스트 — 한 번 누를 때마다 */}
      <MissionToast message={toastMessage} onDismiss={() => setToastMessage(null)} />

      {/* 큰 축하 폭죽 — 오늘 미션 모두 완료 시 / 연속 달성 milestone */}
      <CelebrationOverlay
        visible={celebration !== null}
        message={celebration?.message ?? ''}
        vip={celebration?.vip ?? false}
        onClose={() => setCelebration(null)}
      />
    </View>
  );
}

/** 정보 모달 — 의학적 근거 + 의무감 부여 */
function InfoModal({
  kind,
  water,
  supplements,
  onClose,
}: {
  kind: 'water' | 'supplements' | null;
  water: number;
  supplements: boolean;
  onClose: () => void;
}) {
  if (!kind) return null;
  const isWater = kind === 'water';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={infoStyles.backdrop}>
        <View style={infoStyles.card}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[infoStyles.iconCircle, { backgroundColor: isWater ? '#E3F2FD' : '#F3E5F5' }]}>
              <Image
                source={isWater ? WATER_ICON : PILL_ICON}
                style={infoStyles.iconImage}
                resizeMode="contain"
              />
            </View>

            <Text style={infoStyles.title}>
              {isWater ? '하루 물 8잔이 중요한 이유' : '영양제, 매일 챙겨야 하는 이유'}
            </Text>

            <Text style={infoStyles.subtitle}>
              {isWater
                ? `오늘 ${water} / 8잔 마셨어요`
                : supplements
                  ? '오늘 영양제 ✓ 챙기셨어요'
                  : '오늘 아직 영양제를 안 챙기셨어요'}
            </Text>

            {/* 핵심 효과 */}
            {isWater ? (
              <>
                <ReasonRow emoji="🌊" title="양수량 유지" desc="아기를 둘러싼 양수가 충분해야 자유롭게 움직이고 폐가 발달해요." />
                <ReasonRow emoji="🩸" title="혈류량 증가" desc="임신 중 혈액량이 50% 늘어요. 부족하면 어지럼증과 부종이 심해집니다." />
                <ReasonRow emoji="💆‍♀️" title="부종·변비 예방" desc="수분 부족 시 다리 부종, 변비, 요로감염 위험이 올라가요." />
                <ReasonRow emoji="🍼" title="모유 준비" desc="후기에는 초유 생성을 위한 수분이 더 필요해요." />
                <View style={infoStyles.factBox}>
                  <Text style={infoStyles.factTitle}>💡 알아두세요</Text>
                  <Text style={infoStyles.factText}>
                    임신 중 권장 수분 섭취량은 하루 2L (약 8잔). 한 번에 많이 마시지 말고 30분~1시간 간격으로 나눠 드세요.
                    카페인 음료는 제외하고 계산해야 해요.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <ReasonRow emoji="🧠" title="엽산 (Folate)" desc="신경관 결손(이분척추 등) 발생률을 약 70% 낮춥니다. 임신 12주까지 특히 중요." />
                <ReasonRow emoji="❤️" title="철분" desc="혈액량이 늘면서 철분 수요 2배. 부족 시 빈혈·조산 위험이 증가합니다." />
                <ReasonRow emoji="🦴" title="칼슘" desc="아기 뼈·치아 형성에 필수. 부족하면 엄마 뼈에서 빠져나갑니다." />
                <ReasonRow emoji="🐟" title="DHA / 오메가3" desc="태아의 뇌·시각 발달에 직접 관여. 후기일수록 수요 ↑." />
                <View style={infoStyles.factBox}>
                  <Text style={infoStyles.factTitle}>💡 알아두세요</Text>
                  <Text style={infoStyles.factText}>
                    영양제는 식사와 함께 일정한 시간에 매일 드시는 게 가장 효과적이에요.
                    철분제는 비타민C와 함께 먹으면 흡수율이 올라갑니다.
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity style={infoStyles.closeBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={infoStyles.closeBtnText}>알겠어요 💛</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ReasonRow({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={infoStyles.reasonRow}>
      <Text style={infoStyles.reasonEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={infoStyles.reasonTitle}>{title}</Text>
        <Text style={infoStyles.reasonDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    marginTop: 0,
    marginBottom: 12,
  },
  cardWrap: { flex: 1 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#EEE',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardWater: {},
  cardWaterDone: {
    backgroundColor: '#F0F8FF',
    borderColor: '#90CAF9',
  },
  cardSup: {},
  cardSupDone: {
    backgroundColor: '#FAF4FB',
    borderColor: '#CE93D8',
  },

  infoBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  infoBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#888',
    fontStyle: 'italic',
  },

  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ringEmoji: {
    position: 'absolute',
    fontSize: 18,
  },
  ringIcon: {
    position: 'absolute',
    width: 22,
    height: 22,
  },

  textCol: {
    flex: 1,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  cardCount: { marginTop: 1 },
  cardCountBig: { fontSize: 15, fontWeight: '900', color: '#1A1A1A' },
  cardCountSub: { fontSize: 11, fontWeight: '600', color: '#888' },
  cardHint: {
    fontSize: 10,
    color: '#999',
    marginTop: 1,
  },
});

const infoStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    maxHeight: '88%',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  iconEmoji: { fontSize: 36 },
  iconImage: { width: 56, height: 56 },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    fontWeight: '600',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  reasonEmoji: { fontSize: 24 },
  reasonTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 3 },
  reasonDesc: { fontSize: 12.5, color: '#555', lineHeight: 19 },
  factBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  factTitle: { fontSize: 13, fontWeight: '900', color: '#F57C00', marginBottom: 6 },
  factText: { fontSize: 12.5, color: '#5D4037', lineHeight: 19 },
  closeBtn: {
    backgroundColor: '#FF8C5A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  closeBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});
