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
import type { TrackerRecord } from '../../features/baby-tracker/types';
import { useTrackerStore } from '../../stores/trackerStore';
import { getDailyReference } from '../../constants/dailyReference';
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
// "탭해서 기록" 가이드 캡션 — 사용자가 3회 이상 기록하면 자동 숨김 (학습됐다고 판단)
const TAP_HINT_COUNTER_KEY = (cid: string) => `amatda_tap_hint_count_${cid}`;
const TAP_HINT_HIDE_THRESHOLD = 3;

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

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayYMD(): string {
  return ymd(new Date());
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
  const [sleep, setSleep] = useState<{ totalH: number; naps: number; nights: number }>({ totalH: 0, naps: 0, nights: 0 });
  const [diaper, setDiaper] = useState<{ poop: number }>({ poop: 0 });
  // baby-tracker에서 기록 추가/수정 시 bump → 자동 재fetch
  const trackerVer = useTrackerStore((s) => s.version);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // baby-tracker와 동일한 로컬 storage에서 오늘자 records 로드
        const today = new Date();
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        const recs = await loadRecords(child.id, ymd(today));
        // 어제 시작 → 오늘 새벽 기상한 cross-day 수면 → 가상 '기상' 엔트리
        // (baby-tracker와 동일 로직. 누락 시 새벽 수면이 홈에서 0h로 빠짐)
        const yRecs = await loadRecords(child.id, ymd(yest));
        if (cancelled) return;
        const todayPrefix = `${today.getMonth() + 1}/${today.getDate()} `;
        const crossDayWakes: TrackerRecord[] = [];
        for (const r of yRecs) {
          const o = r as unknown as Record<string, unknown>;
          if (o.type === 'sleep' && typeof o.endTime === 'string' && o.endTime.startsWith(todayPrefix)) {
            crossDayWakes.push({
              ...r,
              id: `${r.id}__crosswake`,
              subType: 'sleep_end',
              time: o.endTime.slice(todayPrefix.length),
              endTime: undefined,
            } as TrackerRecord);
          }
        }
        const ageMonths = child.ageInfo?.months ?? 6;
        const sum = computeSummary(recs, crossDayWakes, ageMonths);
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
        const nightCount = recs.filter((r) => {
          const obj = r as unknown as Record<string, unknown>;
          return obj.type === 'sleep' && obj.subType === 'night';
        }).length;
        if (!cancelled) {
          setFeeding({ count: feedCount, ml: feedMl });
          setSleep({ totalH: sleepMin / 60, naps: napCount, nights: nightCount });
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

  // 개월수·몸무게 기준 권장량 (사용자 피드백 — 부족/충분/많음 메시지 표시)
  const ageMonths = child.ageInfo?.months ?? 0;
  const ref = getDailyReference(ageMonths, child.weight);

  // 분유 비교 메시지
  const formulaSub = (() => {
    if (feeding.ml <= 0) return '기록 없음';
    if (ref.formulaMlMax === 0) return `${feeding.ml}ml`; // 일반식 (24개월+)
    if (feeding.ml < ref.formulaMlMin) return `${ref.formulaMlMin - feeding.ml}ml 부족`;
    if (feeding.ml > ref.formulaMlMax) return `${feeding.ml - ref.formulaMlMax}ml 초과`;
    return '충분';
  })();

  // 수면 비교 메시지
  const sleepSub = (() => {
    if (sleep.totalH <= 0) return '기록 없음';
    if (sleep.totalH < ref.sleepHrMin) {
      const gap = ref.sleepHrMin - sleep.totalH;
      return `${gap.toFixed(1)}h 부족`;
    }
    if (sleep.totalH > ref.sleepHrMax) {
      const over = sleep.totalH - ref.sleepHrMax;
      return `${over.toFixed(1)}h 초과`;
    }
    return '충분';
  })();

  // 대변 메시지 — 개월수와 무관한 일반 가이드:
  //   0회 = 변비 주의 (24h 미배변), 1-3회 정상, 4+회 묽은 변 주의
  //   세부 가이드는 baby-tracker 메인 진입 시 확인 가능
  const poopSub = (() => {
    if (diaper.poop === 0) return '변비 주의';
    if (diaper.poop >= 4) return '묽은 변';
    return '정상';
  })();

  return (
    <View style={styles.row}>
      <StatCard
        icon={ASSETS.bottle}
        valueBig={feeding.count > 0 ? `${feeding.count}회` : '0회'}
        valueSub={formulaSub}
      />
      <View style={styles.divider} />
      <StatCard
        icon={ASSETS.sleep}
        valueBig={sleep.totalH > 0 ? `${sleep.totalH.toFixed(0)}h` : '0h'}
        valueSub={sleepSub}
      />
      <View style={styles.divider} />
      <StatCard
        icon={ASSETS.poop}
        valueBig={`${diaper.poop}회`}
        valueSub={poopSub}
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

  // 안내문 자동 숨김은 2026-05-08 제거 — 사용자가 학습 전에 사라진다는 피드백.
  // 관련 state/카운터/임계값은 dead code 화 됨 (storage 키는 유지: 잔존 데이터 영향 없음).

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

  /** 사용자 카드 인터랙션 카운터 — 자동 숨김 제거됐지만 다른 분석/학습용도에 활용 가능 */
  const bumpTapHint = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(TAP_HINT_COUNTER_KEY(child.id));
      const next = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
      await AsyncStorage.setItem(TAP_HINT_COUNTER_KEY(child.id), String(next));
    } catch { /* ignore */ }
  }, [child.id]);

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
    bumpTapHint();
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
    bumpTapHint();
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
      bumpTapHint();
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
      {/* 안내문 — 항상 표시 (자동 숨김 제거 2026-05-08: 너무 빨리 사라져서 사용자가
          길게 누르는 동작을 발견하지 못한다는 피드백) */}
      <Text style={styles.tapHint}>
        {'탭하면 카운트 · '}
        <Text style={styles.tapHintAccent}>길게 누르면 설명</Text>
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
    color: COLOR.textSub,
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 10,
    color: COLOR.textSub,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 2,
    opacity: 0.75,
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
