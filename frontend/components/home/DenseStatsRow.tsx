/**
 * DenseStatsRow — 홈 화면 상단 4-stat 그리드 (모드 자동 분기)
 *
 * 영아 mode:  수유 / 수면 / 대변 / 키체중 percentile
 * 임신부 mode: 물(클릭 +1) / 영양제(토글) / 다음검진 D-day / 오늘 컨디션
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadRecords, saveRecords, loadSleepSession, saveSleepSession } from '../../features/baby-tracker/storage';
import { computeSummary, estimateBreastMl } from '../../features/baby-tracker/utils/summary';
import { resolveAuthorMeta, stampAuthor } from '../../features/baby-tracker/author';
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
function getMoodOptions(t: TFunction): { key: MoodKey; label: string; src: ImageSourcePropType }[] {
  return [
    { key: 'good',       label: t('components.denseStatsRow.mood.good'),       src: ASSETS.moodGood },
    { key: 'tired',      label: t('components.denseStatsRow.mood.tired'),      src: ASSETS.moodTired },
    { key: 'nausea',     label: t('components.denseStatsRow.mood.nausea'),     src: ASSETS.moodNausea },
    { key: 'discomfort', label: t('components.denseStatsRow.mood.discomfort'), src: ASSETS.moodNausea },
    { key: 'pain',       label: t('components.denseStatsRow.mood.pain'),       src: ASSETS.moodPain },
  ];
}

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
   홈 원탭 빠른 기록 줄 (열자마자 기록 — PiyoLog 스타일)
   ════════════════════════════════════════════════════════════ */
function pad2(n: number): string { return String(n).padStart(2, '0'); }

function QuickLogRow({ child }: { child: Child }) {
  const { t } = useTranslation();
  const ageMonths = child.ageInfo?.months ?? 6;
  const trackerVer = useTrackerStore((s) => s.version);
  const [busy, setBusy] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultsRef = useRef<Record<string, string>>({});

  // 사용자 기본값(분유량·모유시간) 로드
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('voice_defaults');
        if (raw) defaultsRef.current = JSON.parse(raw) as Record<string, string>;
      } catch { /* no defaults */ }
    })();
  }, []);

  // 진행 중 수면 세션 여부 (기록 변동 시 재확인)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { const s = await loadSleepSession(child.id); if (!cancelled) setSleeping(!!s); } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [child.id, trackerVer]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2000);
  }, []);

  // 단일 기록 저장 (baby-tracker/voice 와 동일 포맷 — saveRecords 가 홈 자동 갱신)
  const saveOne = useCallback(async (
    rec: Partial<TrackerRecord> & { type: TrackerRecord['type']; subType: string },
    label: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const now = new Date();
      const dateStr = ymd(now);
      const authorMeta = await resolveAuthorMeta(child.id);
      const stamped = stampAuthor({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
        createdAt: now.toISOString(),
        ...rec,
      } as TrackerRecord, authorMeta);
      const existing = await loadRecords(child.id, dateStr);
      await saveRecords(child.id, dateStr, [...existing, stamped]);
      showToast(label);
    } catch {
      showToast(t('components.quickLog.saveFail', { defaultValue: '기록 실패' }));
    } finally {
      setBusy(false);
    }
  }, [busy, child.id, showToast, t]);

  const logFormula = useCallback(() => {
    const ml = Number(defaultsRef.current.formulaAmount) || 0;
    saveOne(
      { type: 'feeding', subType: 'formula', ...(ml > 0 ? { amount: ml } : {}) },
      ml > 0 ? t('components.quickLog.formulaMl', { ml, defaultValue: `분유 ${ml}ml 기록됨` }) : t('components.quickLog.formula', { defaultValue: '분유 기록됨' }),
    );
  }, [saveOne, t]);

  const logBreast = useCallback((side: 'left' | 'right') => {
    const sideLabel = side === 'left' ? t('babyTracker.side.left', { defaultValue: '왼쪽' }) : t('babyTracker.side.right', { defaultValue: '오른쪽' });
    const dur = Number(defaultsRef.current.breastDuration) || 15;
    const ml = estimateBreastMl(dur, ageMonths);
    saveOne(
      { type: 'feeding', subType: 'breast', note: sideLabel, duration: dur },
      t('components.quickLog.breast', { side: sideLabel, ml, defaultValue: `모유 ${sideLabel} · 예상 ${ml}ml` }),
    );
  }, [saveOne, t, ageMonths]);

  const logPee = useCallback(() => saveOne({ type: 'diaper', subType: 'pee' }, t('components.quickLog.pee', { defaultValue: '소변 기록됨' })), [saveOne, t]);
  const logPoop = useCallback(() => saveOne({ type: 'diaper', subType: 'poop' }, t('components.quickLog.poop', { defaultValue: '대변 기록됨' })), [saveOne, t]);

  // 수면: 세션 토글 (baby-tracker/voice 기상 로직 미러)
  const toggleSleep = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const now = new Date();
      const sess = await loadSleepSession(child.id);
      if (!sess) {
        await saveSleepSession(child.id, { startTime: now.toISOString(), startDate: ymd(now) });
        setSleeping(true);
        showToast(t('components.quickLog.sleepStart', { defaultValue: '수면 시작 💤' }));
      } else {
        const start = new Date(sess.startTime);
        let duration = Math.round((now.getTime() - start.getTime()) / 60000);
        if (duration < 1) duration = 1;
        if (duration > 14 * 60) duration = 14 * 60;
        const startHHMM = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
        const nowHHMM = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
        const crossed = sess.startDate !== ymd(now);
        const endLabel = crossed ? `${now.getMonth() + 1}/${now.getDate()} ${nowHHMM}` : nowHHMM;
        const authorMeta = await resolveAuthorMeta(child.id);
        const wakeRecord = stampAuthor({
          id: `${Date.now()}_wake_${Math.random().toString(36).slice(2, 7)}`,
          type: 'sleep',
          subType: 'sleep_start',
          time: startHHMM,
          endTime: endLabel,
          duration,
          createdAt: sess.startTime,
          ...(sess.note ? { note: sess.note } : {}),
        } as TrackerRecord, authorMeta);
        const existing = await loadRecords(child.id, sess.startDate);
        await saveRecords(child.id, sess.startDate, [...existing, wakeRecord]);
        await saveSleepSession(child.id, null);
        setSleeping(false);
        showToast(t('components.quickLog.sleepEnd', { min: duration, defaultValue: `기상 · ${duration}분 수면` }));
      }
    } catch {
      showToast(t('components.quickLog.saveFail', { defaultValue: '기록 실패' }));
    } finally {
      setBusy(false);
    }
  }, [busy, child.id, showToast, t]);

  return (
    <View style={qs.wrap}>
      <View style={qs.rowBtns}>
        <QuickBtn label={t('components.quickLog.btnFormula', { defaultValue: '분유' })} color="#FF8C5A" onPress={logFormula} disabled={busy} />
        <QuickBtn label={t('components.quickLog.btnBreastL', { defaultValue: '모유 왼' })} color="#F0976C" onPress={() => logBreast('left')} disabled={busy} />
        <QuickBtn label={t('components.quickLog.btnBreastR', { defaultValue: '모유 오' })} color="#F0976C" onPress={() => logBreast('right')} disabled={busy} />
        <QuickBtn label={t('components.quickLog.btnPee', { defaultValue: '소변' })} color="#FDB44B" onPress={logPee} disabled={busy} />
        <QuickBtn label={t('components.quickLog.btnPoop', { defaultValue: '대변' })} color="#B98B5E" onPress={logPoop} disabled={busy} />
        <QuickBtn label={sleeping ? t('components.quickLog.btnSleepStop', { defaultValue: '수면종료' }) : t('components.quickLog.btnSleep', { defaultValue: '수면' })} color={sleeping ? '#6C5CE7' : '#9B8CF0'} active={sleeping} onPress={toggleSleep} disabled={busy} />
      </View>
      {toast ? <Text style={qs.toast}>{toast}</Text> : null}
    </View>
  );
}

function QuickBtn({ label, color, onPress, disabled, active }: { label: string; color: string; onPress: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <TouchableOpacity
      style={[qs.btn, { backgroundColor: color }, active ? qs.btnActive : null, disabled ? { opacity: 0.55 } : null]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={qs.btnText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const qs = StyleSheet.create({
  wrap: { marginBottom: 10 },
  rowBtns: { flexDirection: 'row', gap: 5 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnActive: { borderWidth: 2, borderColor: '#4B3FA8' },
  btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  toast: { marginTop: 7, textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#2BA89E' },
});

/* ════════════════════════════════════════════════════════════
   영아 stats
   ════════════════════════════════════════════════════════════ */
function BabyStats({ child }: { child: Child }) {
  const { t } = useTranslation();
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
    if (feeding.ml <= 0) return t('components.denseStatsRow.noRecord');
    if (ref.formulaMlMax === 0) return `${feeding.ml}ml`; // 일반식 (24개월+)
    if (feeding.ml < ref.formulaMlMin) return t('components.denseStatsRow.mlShort', { value: ref.formulaMlMin - feeding.ml });
    if (feeding.ml > ref.formulaMlMax) return t('components.denseStatsRow.mlOver', { value: feeding.ml - ref.formulaMlMax });
    return t('components.denseStatsRow.sufficient');
  })();

  // 수면 비교 메시지
  const sleepSub = (() => {
    if (sleep.totalH <= 0) return t('components.denseStatsRow.noRecord');
    if (sleep.totalH < ref.sleepHrMin) {
      const gap = ref.sleepHrMin - sleep.totalH;
      return t('components.denseStatsRow.hourShort', { value: gap.toFixed(1) });
    }
    if (sleep.totalH > ref.sleepHrMax) {
      const over = sleep.totalH - ref.sleepHrMax;
      return t('components.denseStatsRow.hourOver', { value: over.toFixed(1) });
    }
    return t('components.denseStatsRow.sufficient');
  })();

  // 대변 메시지 — 개월수와 무관한 일반 가이드:
  //   0회 = 변비 주의 (24h 미배변), 1-3회 정상, 4+회 묽은 변 주의
  //   세부 가이드는 baby-tracker 메인 진입 시 확인 가능
  const poopSub = (() => {
    if (diaper.poop === 0) return t('components.denseStatsRow.constipationCaution');
    if (diaper.poop >= 4) return t('components.denseStatsRow.looseStool');
    return t('components.denseStatsRow.normal');
  })();

  return (
    <View>
      <QuickLogRow child={child} />
      <View style={styles.row}>
      <StatCard
        icon={ASSETS.bottle}
        valueBig={feeding.count > 0 ? t('components.denseStatsRow.countTimes', { count: feeding.count }) : t('components.denseStatsRow.countTimes', { count: 0 })}
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
        valueBig={t('components.denseStatsRow.countTimes', { count: diaper.poop })}
        valueSub={poopSub}
      />
      <View style={styles.divider} />
      <StatCard
        icon={ASSETS.sprout}
        valueBig={percentile ? t('components.denseStatsRow.topPercent', { pct: percentile.pct }) : '—'}
        valueSub={t('components.denseStatsRow.heightWeight')}
      />
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   임신부 stats
   ════════════════════════════════════════════════════════════ */
function PregnancyStats({ child, onTapCheckup }: { child: Child; onTapCheckup: () => void }) {
  const { t } = useTranslation();
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
      case 3:   return t('components.denseStatsRow.streak.d3');
      case 7:   return t('components.denseStatsRow.streak.d7');
      case 14:  return t('components.denseStatsRow.streak.d14');
      case 30:  return t('components.denseStatsRow.streak.d30');
      case 60:  return t('components.denseStatsRow.streak.d60');
      case 100: return t('components.denseStatsRow.streak.d100');
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
        setCelebrateMsg(t('components.denseStatsRow.todayMissionComplete'));
        setCelebrateVip(false);
      }
    } catch {
      setCelebrateMsg(t('components.denseStatsRow.todayMissionComplete'));
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
      setToastMsg(justHitGoal ? t('components.denseStatsRow.toast.waterGoalClear') : t('components.denseStatsRow.toast.waterAdded'));
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
        setToastMsg(t('components.denseStatsRow.toast.supplementDone'));
      }
    }
  };

  const pickMood = async (key: MoodKey) => {
    setMood(key);
    closeMoodPicker();
    if (key) {
      await AsyncStorage.setItem(MOOD_KEY(child.id, todayYMD()), key).catch(() => {});
      bumpTapHint();
      setToastMsg(t('components.denseStatsRow.toast.moodRecorded'));
    }
  };

  const moodOptions = getMoodOptions(t);
  const moodSrc = moodOptions.find((m) => m.key === mood)?.src ?? ASSETS.moodGood;
  const moodLabel = moodOptions.find((m) => m.key === mood)?.label ?? t('components.denseStatsRow.today');

  // 다음 검진 D-day
  const dday = checkupDate ? formatDday(daysUntil(checkupDate)) : null;

  return (
    <>
      <View style={styles.row}>
        <StatCard
          icon={ASSETS.water}
          valueBig={`${waterCount}/${WATER_GOAL}`}
          valueSub={t('components.denseStatsRow.waterGlass')}
          onPress={incWater}
          onLongPress={() => setInfoOpen('water')}
          tappable
        />
        <View style={styles.divider} />
        <StatCard
          icon={ASSETS.pill}
          valueBig={supplementDone ? t('common.complete') : t('components.denseStatsRow.notYet')}
          valueSub={t('components.denseStatsRow.supplement')}
          onPress={toggleSupplement}
          onLongPress={() => setInfoOpen('supplements')}
          highlighted={supplementDone}
          tappable
        />
        <View style={styles.divider} />
        <StatCard
          icon={ASSETS.stethoscope}
          valueBig={dday ?? t('components.denseStatsRow.input')}
          valueSub={t('pregnancy.nextCheckupLabel')}
          onPress={onTapCheckup}
          dim={!dday}
          tappable
        />
        <View style={styles.divider} />
        <StatCard
          icon={moodSrc}
          valueBig={mood ? moodLabel : t('components.denseStatsRow.record')}
          valueSub={t('components.denseStatsRow.condition')}
          onPress={openMoodPicker}
          dim={!mood}
          tappable
        />
      </View>
      {/* 안내문 — 항상 표시 (자동 숨김 제거 2026-05-08: 너무 빨리 사라져서 사용자가
          길게 누르는 동작을 발견하지 못한다는 피드백) */}
      <Text style={styles.tapHint}>
        {t('components.denseStatsRow.tapHintPrefix')}
        <Text style={styles.tapHintAccent}>{t('components.denseStatsRow.tapHintAccent')}</Text>
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
            <Text style={styles.moodTitle}>{t('components.denseStatsRow.moodPickerTitle')}</Text>
            <View style={styles.moodRow}>
              {moodOptions.map((m) => (
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
                <Text style={styles.moodClearText}>{t('components.denseStatsRow.clearMood')}</Text>
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
