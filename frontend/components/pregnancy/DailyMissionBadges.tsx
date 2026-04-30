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
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { pregnancyApi } from '../../services/api';
import {
  getDailyMissionReminderEnabled,
  scheduleDailyMissionReminder,
} from '../../services/pushNotifications';
import { CelebrationOverlay } from '../common/CelebrationOverlay';
import { premiumApi } from '../../services/api';

const WATER_GOAL = 8; // 하루 8잔 (2L 권장)

interface Props {
  childId: string;
}

interface MissionState {
  water: number;
  supplements: boolean;
}

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

const RING_SIZE = 56;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function DailyMissionBadges({ childId }: Props) {
  const [state, setState] = useState<MissionState>({ water: 0, supplements: false });
  const [loading, setLoading] = useState(false);
  const [celebration, setCelebration] = useState<{ message: string; vip: boolean } | null>(null);
  const [infoOpen, setInfoOpen] = useState<'water' | 'supplements' | null>(null);
  const waterPulse = useRef(new Animated.Value(1)).current;
  const supPulse = useRef(new Animated.Value(1)).current;
  const [isVip, setIsVip] = useState(false);

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
    setState((s) => ({ ...s, supplements: next }));
    pulse(supPulse);
    setLoading(true);
    try {
      await pregnancyApi.toggleSupplements(childId, next);
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
  const waterOffset = RING_CIRCUMFERENCE * (1 - waterRatio);
  const supplementOffset = state.supplements ? 0 : RING_CIRCUMFERENCE;

  return (
    <View style={styles.row}>
      {/* 물 카드 */}
      <Animated.View style={[styles.cardWrap, { transform: [{ scale: waterPulse }] }]}>
        <TouchableOpacity
          style={[styles.card, styles.cardWater, waterDone && styles.cardWaterDone]}
          onPress={onWater}
          onLongPress={() => setInfoOpen('water')}
          activeOpacity={0.85}
          delayLongPress={400}
          hitSlop={6}
        >
          {/* 정보 (i) 버튼 */}
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => setInfoOpen('water')}
            hitSlop={10}
          >
            <Text style={styles.infoBtnText}>i</Text>
          </TouchableOpacity>

          {/* 진행률 링 + 가운데 이모지 */}
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
            <Text style={styles.ringEmoji}>💧</Text>
          </View>

          {/* 라벨 + 카운트 */}
          <Text style={styles.cardLabel}>물 마시기</Text>
          <Text style={styles.cardCount}>
            <Text style={[styles.cardCountBig, waterDone && { color: '#1976D2' }]}>{state.water}</Text>
            <Text style={styles.cardCountSub}> / {WATER_GOAL}잔</Text>
          </Text>
          <Text style={styles.cardHint}>
            {waterDone ? '✓ 오늘 목표 완료!' : '터치하면 +1잔'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* 영양제 카드 */}
      <Animated.View style={[styles.cardWrap, { transform: [{ scale: supPulse }] }]}>
        <TouchableOpacity
          style={[styles.card, styles.cardSup, state.supplements && styles.cardSupDone]}
          onPress={onSupplements}
          onLongPress={() => setInfoOpen('supplements')}
          activeOpacity={0.85}
          delayLongPress={400}
          hitSlop={6}
        >
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => setInfoOpen('supplements')}
            hitSlop={10}
          >
            <Text style={styles.infoBtnText}>i</Text>
          </TouchableOpacity>

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
            <Text style={styles.ringEmoji}>💊</Text>
          </View>

          <Text style={styles.cardLabel}>영양제</Text>
          <Text style={styles.cardCount}>
            <Text style={[styles.cardCountBig, state.supplements && { color: '#7B1FA2' }]}>
              {state.supplements ? '완료' : '아직'}
            </Text>
          </Text>
          <Text style={styles.cardHint}>
            {state.supplements ? '✓ 오늘 챙기셨어요!' : '터치해서 체크'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* 정보 모달 */}
      <InfoModal
        kind={infoOpen}
        water={state.water}
        supplements={state.supplements}
        onClose={() => setInfoOpen(null)}
      />

      {/* 축하 폭죽 */}
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
              <Text style={infoStyles.iconEmoji}>{isWater ? '💧' : '💊'}</Text>
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
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
  },
  cardWrap: { flex: 1 },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
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
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#888',
    fontStyle: 'italic',
  },

  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  ringEmoji: {
    position: 'absolute',
    fontSize: 26,
  },

  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    marginTop: 6,
  },
  cardCount: { marginTop: 2 },
  cardCountBig: { fontSize: 22, fontWeight: '900', color: '#1A1A1A' },
  cardCountSub: { fontSize: 13, fontWeight: '600', color: '#888' },
  cardHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
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
