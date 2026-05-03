/**
 * DenseStatsRow — 홈 화면 상단 4-stat 그리드 (모드 자동 분기)
 *
 * 영아 mode:  수유 / 수면 / 대변 / 키체중 percentile
 * 임신부 mode: 물(클릭 +1) / 영양제(토글) / 다음검진 D-day / 오늘 컨디션
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadRecords } from '../../features/baby-tracker/storage';
import { computeSummary } from '../../features/baby-tracker/utils/summary';
import { useTrackerStore } from '../../stores/trackerStore';
import {
  getNextCheckup,
  daysUntil,
  formatDday,
  useCheckupStore,
} from '../../services/checkup';
import { CelebrationOverlay } from '../common/CelebrationOverlay';
import { MissionToast } from '../common/MissionToast';
import { recordMissionComplete, type StreakMilestone } from '../../utils/missionStreak';
import { useUiStore } from '../../stores/uiStore';
import { MissionInfoModal, type MissionInfoKind } from '../pregnancy/MissionInfoModal';

interface Child {
  id: string;
  isPregnant?: boolean;
  ageInfo?: { months: number; group: string };
  birthDate?: string;
  height?: number;
  weight?: number;
}

interface Props {
  child: Child;
  onTapCheckup: () => void;
}

const COLOR = {
  card: '#FFFFFF',
  border: '#E5E5EA',
  text: '#1C1C1E',
  textSub: '#636366',
  accent: '#FF8C5A',
  blue: '#42A5F5',
  pink: '#E91E63',
  green: '#43A047',
  purple: '#AB47BC',
};

const ASSETS = {
  bottle: require('../../assets/quick-bottle.png') as ImageSourcePropType,
  sleep: require('../../assets/quick-sleep.png') as ImageSourcePropType,
  poop: require('../../assets/cat-poop.png') as ImageSourcePropType,
  sprout: require('../../assets/quick-sprout.png') as ImageSourcePropType,
  water: require('../../assets/quick-water.png') as ImageSourcePropType,
  pill: require('../../assets/quick-pill.png') as ImageSourcePropType,
  stethoscope: require('../../assets/preg-stethoscope.png') as ImageSourcePropType,
  moodGood: require('../../assets/preg-mood-good.png') as ImageSourcePropType,
  moodTired: require('../../assets/preg-mood-tired.png') as ImageSourcePropType,
  moodNausea: require('../../assets/preg-mood-nausea.png') as ImageSourcePropType,
  moodPain: require('../../assets/preg-mood-pain.png') as ImageSourcePropType,
};

// AsyncStorage 키
const WATER_KEY = (cid: string, ymd: string) => `amatda_water_${cid}_${ymd}`;
const SUPPLEMENT_KEY = (cid: string, ymd: string) => `amatda_supplement_${cid}_${ymd}`;
const MOOD_KEY = (cid: string, ymd: string) => `amatda_mood_${cid}_${ymd}`;

const WATER_GOAL = 8;

type MoodKey = 'good' | 'tired' | 'nausea' | 'discomfort' | 'pain' | null;

// 속불편(discomfort) — 후기에 입덧은 사라지지만 속이 불편한 경우 (역류성·소화불량 등)
const MOOD_OPTIONS: { key: MoodKey; label: string; src: ImageSourcePropType }[] = [
  { key: 'good',       label: '좋음',   src: ASSETS.moodGood },
  { key: 'tired',      label: '피로',   src: ASSETS.moodTired },
  { key: 'nausea',     label: '입덧',   src: ASSETS.moodNausea },
  { key: 'discomfort', label: '속불편', src: ASSETS.moodNausea },
  { key: 'pain',       label: '통증',   src: ASSETS.moodPain },
];

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DenseStatsRow({ child, onTapCheckup }: Props) {
  if (child.isPregnant) {
    return <PregnancyStats child={child} onTapCheckup={onTapCheckup} />;
  }
  return <BabyStats child={child} />;
}

/* ════════════════════════════════════════════════════════════
   영아 stats
   ════════════════════════════════════════════════════════════ */
function BabyStats({ child }: { child: Child }) {
  const [feeding, setFeeding] = useState<{ count: number; ml: number }>({ count: 0, ml: 0 });
  const [sleep, setSleep] = useState<{ totalH: number; naps: number }>({ totalH: 0, naps: 0 });
  const [diaper, setDiaper] = useState<{ poop: number }>({ poop: 0 });
  // baby-tracker에서 기록 추가/수정 시 bump → 자동 재fetch
  const trackerVer = useTrackerStore((s) => s.version);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // baby-tracker와 동일한 로컬 storage에서 오늘자 records 로드
        const recs = await loadRecords(child.id, todayYMD());
        if (cancelled) return;
        const sum = computeSummary(recs);
        // computeSummary 결과 — feedingCount / totalMl / diaperCount(소변+대변) / totalSleepMinutes
        const feedCount = (sum as { feedingCount?: number }).feedingCount ?? 0;
        const feedMl = (sum as { totalMl?: number }).totalMl ?? 0;
        const sleepMin = (sum as { totalSleepMinutes?: number }).totalSleepMinutes ?? 0;
        // 대변 카운트는 records에서 직접 추출 (subType === 'poop' 또는 'both')
        const poopCount = recs.filter((r) => {
          const obj = r as unknown as Record<string, unknown>;
          return obj.type === 'diaper' && (obj.subType === 'poop' || obj.subType === 'both');
        }).length;
        // 낮잠 카운트 (sleep records 중 subType === 'nap')
        const napCount = recs.filter((r) => {
          const obj = r as unknown as Record<string, unknown>;
          return obj.type === 'sleep' && obj.subType === 'nap';
        }).length;
        if (!cancelled) {
          setFeeding({ count: feedCount, ml: feedMl });
          setSleep({ totalH: sleepMin / 60, naps: napCount });
          setDiaper({ poop: poopCount });
        }
      } catch {
        // silent fail — 0 표시
      }
    })();
    return () => { cancelled = true; };
  }, [child.id, trackerVer]);

  // 키·체중 percentile (단순 계산: 실데이터 없으면 placeholder)
  const percentile = computePercentile(child);

  return (
    <View style={styles.row}>
      <StatCard
        icon={ASSETS.bottle}
        valueBig={feeding.count > 0 ? `${feeding.count}회` : '0회'}
        valueSub={feeding.ml > 0 ? `${feeding.ml}ml` : '기록 없음'}
      />
      <View style={styles.divider} />
      <StatCard
        icon={ASSETS.sleep}
        valueBig={sleep.totalH > 0 ? `${sleep.totalH.toFixed(0)}h` : '0h'}
        valueSub={sleep.naps > 0 ? `낮 ${sleep.naps}회` : '기록 없음'}
      />
      <View style={styles.divider} />
      <StatCard
        icon={ASSETS.poop}
        valueBig={`${diaper.poop}회`}
        valueSub={diaper.poop > 0 ? '정상' : '기록 없음'}
      />
      <View style={styles.divider} />
      <StatCard
        icon={ASSETS.sprout}
        valueBig={percentile ? `상위 ${percentile.pct}%` : '—'}
        valueSub="키·체중"
      />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   임신부 stats
   ════════════════════════════════════════════════════════════ */
function PregnancyStats({ child, onTapCheckup }: { child: Child; onTapCheckup: () => void }) {
  const [waterCount, setWaterCount] = useState(0);
  const [supplementDone, setSupplementDone] = useState(false);
  const [mood, setMood] = useState<MoodKey>(null);
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  // 물/영양제 카드 long-press 시 의학적 의미 + 가이드 모달
  const [infoOpen, setInfoOpen] = useState<MissionInfoKind>(null);
  // 모달 활성 시 SOS FAB 등 floating 요소 숨김 — uiStore overlay 카운터 push/pop
  const pushOverlay = useUiStore((s) => s.pushOverlay);
  const popOverlay = useUiStore((s) => s.popOverlay);
  const openMoodPicker = useCallback(() => {
    setMoodPickerOpen(true);
    pushOverlay();
  }, [pushOverlay]);
  const closeMoodPicker = useCallback(() => {
    setMoodPickerOpen(false);
    popOverlay();
  }, [popOverlay]);
  // 컴포넌트 언마운트 시 카운터 누수 방지
  useEffect(() => {
    return () => {
      if (moodPickerOpen) popOverlay();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [celebrateMsg, setCelebrateMsg] = useState<string | null>(null);
  const [celebrateVip, setCelebrateVip] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const streakRecordedRef = useRef(false);

  function streakLine(days: StreakMilestone): string {
    switch (days) {
      case 3:   return '3일 연속 성공! 대단해요 🌟';
      case 7:   return '7일 연속 미션 완료! 일주일 루틴 완성 💛';
      case 14:  return '14일 연속! 정말 잘하고 있어요 🎉';
      case 30:  return '30일 연속 — 이건 진짜 습관이에요 ✨';
      case 60:  return '60일 연속 엄마 루틴 마스터 👑';
      case 100: return '100일 연속! 전설의 엄마 인증 🎊';
    }
  }

  /**
   * @returns true 큰 축하 떴음(토스트 생략) / false 안 뜸(토스트 fallback)
   */
  async function maybeCelebrateAllDone(waterNext: number, suppNext: boolean): Promise<boolean> {
    const allDone = waterNext >= WATER_GOAL && suppNext;
    if (!allDone) return false;
    // 이미 오늘 streak 기록함 → 큰 축하 생략, 호출자가 토스트로 fallback
    if (streakRecordedRef.current) return false;
    streakRecordedRef.current = true;
    try {
      const { reachedMilestone } = await recordMissionComplete(child.id);
      if (reachedMilestone) {
        setCelebrateMsg(streakLine(reachedMilestone));
        setCelebrateVip(true);
      } else {
        setCelebrateMsg('오늘 미션 완료! 엄마도 아기도 잘 챙겼어요 🎉');
        setCelebrateVip(false);
      }
    } catch {
      setCelebrateMsg('오늘 미션 완료! 엄마도 아기도 잘 챙겼어요 🎉');
      setCelebrateVip(false);
    }
    return true;
  }

  const [checkupDate, setCheckupDate] = useState<string | null>(null);
  const checkupVer = useCheckupStore((s) => s.version);

  // 오늘자 AsyncStorage 로드
  const reload = useCallback(async () => {
    const ymd = todayYMD();
    try {
      const w = await AsyncStorage.getItem(WATER_KEY(child.id, ymd));
      const s = await AsyncStorage.getItem(SUPPLEMENT_KEY(child.id, ymd));
      const m = await AsyncStorage.getItem(MOOD_KEY(child.id, ymd));
      setWaterCount(w ? Math.max(0, Math.min(WATER_GOAL, parseInt(w, 10) || 0)) : 0);
      setSupplementDone(s === '1');
      setMood((m as MoodKey) ?? null);
    } catch { /* ignore */ }
  }, [child.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // 다음 검진 로드 (checkupVer 트리거)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const v = await getNextCheckup(child.id);
      if (!cancelled) setCheckupDate(v);
    })();
    return () => { cancelled = true; };
  }, [child.id, checkupVer]);

  const incWater = async () => {
    const prev = waterCount;
    const next = Math.min(WATER_GOAL, waterCount + 1);
    setWaterCount(next);
    await AsyncStorage.setItem(WATER_KEY(child.id, todayYMD()), String(next)).catch(() => {});
    const justHitGoal = prev < WATER_GOAL && next === WATER_GOAL;
    const tryAll = justHitGoal && supplementDone;
    const celebrated = tryAll ? await maybeCelebrateAllDone(next, true) : false;
    if (!celebrated) {
      setToastMsg(justHitGoal ? '물 8잔 미션 클리어! 💧' : '물 한 잔 추가했어요 💧');
    }
  };

  const toggleSupplement = async () => {
    const next = !supplementDone;
    setSupplementDone(next);
    await AsyncStorage.setItem(SUPPLEMENT_KEY(child.id, todayYMD()), next ? '1' : '0').catch(() => {});
    if (!supplementDone && next) {
      const tryAll = waterCount >= WATER_GOAL;
      const celebrated = tryAll ? await maybeCelebrateAllDone(waterCount, true) : false;
      if (!celebrated) {
        setToastMsg('영양제 완료했어요 💛');
      }
    }
  };

  const pickMood = async (key: MoodKey) => {
    setMood(key);
    closeMoodPicker();
    if (key) {
      await AsyncStorage.setItem(MOOD_KEY(child.id, todayYMD()), key).catch(() => {});
      setToastMsg('컨디션 기록했어요 😊');
    }
  };

  const moodSrc = MOOD_OPTIONS.find((m) => m.key === mood)?.src ?? ASSETS.moodGood;
  const moodLabel = MOOD_OPTIONS.find((m) => m.key === mood)?.label ?? '오늘';

  // 다음 검진 D-day
  const dday = checkupDate ? formatDday(daysUntil(checkupDate)) : null;

  return (
    <>
      <View style={styles.row}>
        <StatCard
          icon={ASSETS.water}
          valueBig={`${waterCount}/${WATER_GOAL}`}
          valueSub="물 잔"
          onPress={incWater}
          onLongPress={() => setInfoOpen('water')}
          tappable
        />
        <View style={styles.divider} />
        <StatCard
          icon={ASSETS.pill}
          valueBig={supplementDone ? '완료' : '아직'}
          valueSub="영양제"
          onPress={toggleSupplement}
          onLongPress={() => setInfoOpen('supplements')}
          highlighted={supplementDone}
          tappable
        />
        <View style={styles.divider} />
        <StatCard
          icon={ASSETS.stethoscope}
          valueBig={dday ?? '입력'}
          valueSub="다음 검진"
          onPress={onTapCheckup}
          dim={!dday}
          tappable
        />
        <View style={styles.divider} />
        <StatCard
          icon={moodSrc}
          valueBig={mood ? moodLabel : '기록'}
          valueSub="컨디션"
          onPress={openMoodPicker}
          dim={!mood}
          tappable
        />
      </View>
      <Text style={styles.tapHint}>
        {'탭해서 기록 · '}
        <Text style={styles.tapHintAccent}>길게 누르면 가이드</Text>
      </Text>

      {/* 물/영양제 long-press 시 의학적 의미 + 가이드 */}
      <MissionInfoModal
        kind={infoOpen}
        water={waterCount}
        supplements={supplementDone}
        onClose={() => setInfoOpen(null)}
      />

      {/* 작은 토스트 — 한 번 누를 때마다 */}
      <MissionToast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      {/* 큰 축하 폭죽 — 오늘 미션 모두 완료 시 / 연속 달성 milestone */}
      <CelebrationOverlay
        visible={!!celebrateMsg}
        message={celebrateMsg ?? ''}
        vip={celebrateVip}
        onClose={() => { setCelebrateMsg(null); setCelebrateVip(false); }}
      />

      {/* mood picker — 4-mood 작은 모달 */}
      {moodPickerOpen && (
        <TouchableOpacity
          style={styles.moodBackdrop}
          activeOpacity={1}
          onPress={closeMoodPicker}
        >
          <View style={styles.moodCard}>
            <Text style={styles.moodTitle}>오늘 컨디션은?</Text>
            <View style={styles.moodRow}>
              {MOOD_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.moodBtn, mood === m.key && styles.moodBtnSelected]}
                  onPress={() => pickMood(m.key)}
                  activeOpacity={0.7}
                >
                  <Image source={m.src} style={styles.moodImg} resizeMode="contain" />
                  <Text style={styles.moodLabel}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {mood && (
              <TouchableOpacity onPress={() => pickMood(null)} activeOpacity={0.7}>
                <Text style={styles.moodClearText}>오늘 컨디션 지우기</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   StatCard — 1개 카드
   ════════════════════════════════════════════════════════════ */
function StatCard({
  icon,
  valueBig,
  valueSub,
  onPress,
  onLongPress,
  highlighted,
  dim,
  tappable,
}: {
  icon: ImageSourcePropType;
  valueBig: string;
  valueSub: string;
  onPress?: () => void;
  onLongPress?: () => void;
  highlighted?: boolean;
  dim?: boolean;
  tappable?: boolean;
}) {
  const Wrapper: React.ComponentType<React.ComponentProps<typeof TouchableOpacity>> =
    onPress ? TouchableOpacity : (View as unknown as typeof TouchableOpacity);
  return (
    <Wrapper
      style={[styles.card, highlighted && styles.cardHighlighted, tappable && styles.cardTappable]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.7}
    >
      {tappable && (
        <View style={styles.tapBadge}>
          <Text style={styles.tapBadgeText}>{'+'}</Text>
        </View>
      )}
      <Image source={icon} style={[styles.cardIcon, dim && { opacity: 0.4 }]} resizeMode="contain" />
      <Text style={[styles.cardValueBig, dim && { color: COLOR.textSub }]} numberOfLines={1}>
        {valueBig}
      </Text>
      <Text style={styles.cardValueSub} numberOfLines={1}>{valueSub}</Text>
    </Wrapper>
  );
}

/* ════════════════════════════════════════════════════════════
   percentile 계산 (단순 룰 — 키체중이 있으면 평균 대비 위치 추정)
   실 데이터 없으면 null 반환
   ════════════════════════════════════════════════════════════ */
function computePercentile(child: Child): { pct: number } | null {
  if (!child.height && !child.weight) return null;
  // 출생 후 개월수 기준 평균 키·체중과의 차이로 단순 percentile 계산
  // (정밀한 WHO 차트 대신 보수적 placeholder — 출시 후 정식 차트로 교체)
  const months = child.ageInfo?.months ?? 0;
  const expectedH = 50 + months * 1.5; // 매우 단순한 baseline (cm)
  const expectedW = 3.3 + months * 0.4; // (kg)
  const h = child.height ?? expectedH;
  const w = child.weight ?? expectedW;
  // 키·체중 둘 다의 합산 편차 → 백분위 (대략 30~70 범위로 매핑)
  const hDiff = (h - expectedH) / expectedH;
  const wDiff = (w - expectedW) / expectedW;
  const score = 50 - (hDiff + wDiff) * 50; // 평균 = 50
  const pct = Math.max(5, Math.min(95, Math.round(score)));
  return { pct };
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: COLOR.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginVertical: 2,
  },
  card: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 2,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRightWidth: 0,
  },
  cardHighlighted: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  cardTappable: {
    backgroundColor: '#FFF8FB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD6E7',
    marginHorizontal: 1,
  },
  tapBadge: {
    position: 'absolute',
    top: 2,
    right: 4,
    backgroundColor: '#E91E63',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tapBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 11,
  },
  tapHintAccent: {
    color: '#7B1FA2',
    fontWeight: '700',
  },
  tapHint: {
    fontSize: 11,
    color: '#E91E63',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  cardIcon: {
    width: 22,
    height: 22,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  cardValueBig: {
    fontSize: 13,
    fontWeight: '900',
    color: COLOR.text,
    marginBottom: 0,
  },
  cardValueSub: {
    fontSize: 9,
    color: COLOR.textSub,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    backgroundColor: COLOR.border,
    marginVertical: 4,
  },

  /* mood picker */
  moodBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  moodCard: {
    width: '100%',
    backgroundColor: COLOR.card,
    borderRadius: 18,
    padding: 22,
  },
  moodTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLOR.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  moodBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  moodBtnSelected: {
    borderColor: COLOR.accent,
    backgroundColor: '#FFF4ED',
  },
  moodImg: {
    width: 38,
    height: 38,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.text,
  },
  moodClearText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.textSub,
    paddingVertical: 6,
  },
});
