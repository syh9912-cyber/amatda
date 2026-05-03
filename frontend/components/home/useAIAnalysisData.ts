/**
 * useAIAnalysisData — AI 분석 3-카드의 status 텍스트를 데이터 기반으로 생성
 *
 * 영아: dailyTracking 오늘 데이터 분석
 *  - 육아 패턴: 어제 대비 수유량 변화
 *  - 대변 분석: 오늘 횟수 평가
 *  - 컨디션: 오늘 수면+수유 종합
 *
 * 임신부 (옵션 1):
 *  - 영양제 7일 챙김율 ("5/7일")
 *  - 컨디션 7일 추세 ("주로 안정" / "피로 잦음" / "입덧 추세" 등)
 *  - 이번 주 핵심 (정적 주차별 안내 — "엽산 시작" / "임당 검사" 등)
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { childApi } from '../../services/api';

interface Child {
  id: string;
  isPregnant?: boolean;
  pregnancyWeeks?: number;
}

export interface AIStatus {
  /** "수유 +1회" 등 status 텍스트 (각 카드별) */
  cards: [string, string, string];
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yesterdayYMD(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SUPPLEMENT_KEY = (cid: string, ymd: string) => `amatda_supplement_${cid}_${ymd}`;
const MOOD_KEY = (cid: string, ymd: string) => `amatda_mood_${cid}_${ymd}`;

// (예전: 단일 mood 라벨 매핑 — 7일 추세로 교체되어 미사용)

export function useAIAnalysisData(child: Child | null): AIStatus {
  const [status, setStatus] = useState<AIStatus>({ cards: ['—', '—', '—'] });

  useEffect(() => {
    if (!child) {
      setStatus({ cards: ['—', '—', '—'] });
      return;
    }
    let cancelled = false;
    (async () => {
      if (child.isPregnant) {
        const result = await loadPregnantData(child);
        if (!cancelled) setStatus(result);
      } else {
        const result = await loadBabyData(child);
        if (!cancelled) setStatus(result);
      }
    })();
    return () => { cancelled = true; };
  }, [child?.id, child?.isPregnant, child?.pregnancyWeeks]);

  return status;
}

async function loadBabyData(child: Child): Promise<AIStatus> {
  try {
    const res = await childApi.getDailyTracking(child.id, 2);
    const list = ((res.data as { data?: unknown })?.data ?? []) as Array<Record<string, unknown>>;
    const arr = Array.isArray(list) ? list : [];
    const today = arr.find((d) => d.date === todayYMD()) ?? null;
    const yest  = arr.find((d) => d.date === yesterdayYMD()) ?? null;

    // 1) 육아 패턴 — 수유량 변화
    const tFeedMl = ((today?.feeding as { amount?: number } | undefined)?.amount) ?? 0;
    const yFeedMl = ((yest?.feeding as { amount?: number } | undefined)?.amount) ?? 0;
    let card1: string;
    if (!today) card1 = '기록 없음';
    else {
      const diff = tFeedMl - yFeedMl;
      if (!yest) card1 = `${tFeedMl}ml`;
      else if (Math.abs(diff) < 30) card1 = '비슷';
      else card1 = diff > 0 ? `+${diff}ml` : `${diff}ml`;
    }

    // 2) 대변 분석 — 오늘 횟수 평가
    const tPoop = ((today?.diaper as { poop?: number } | undefined)?.poop) ?? 0;
    let card2: string;
    if (!today) card2 = '기록 없음';
    else if (tPoop === 0) card2 = '없음';
    else if (tPoop >= 1 && tPoop <= 3) card2 = '정상 ✓';
    else card2 = `${tPoop}회 ↑`;

    // 3) 컨디션 — 수면 시간으로 평가
    const tSleep = ((today?.sleep as { totalHours?: number } | undefined)?.totalHours) ?? 0;
    let card3: string;
    if (!today) card3 = '기록 없음';
    else if (tSleep === 0) card3 = '미입력';
    else if (tSleep >= 12) card3 = '충분 ✓';
    else if (tSleep >= 8) card3 = '안정';
    else card3 = '부족 ↓';

    return { cards: [card1, card2, card3] };
  } catch {
    return { cards: ['—', '—', '—'] };
  }
}

async function loadPregnantData(child: Child): Promise<AIStatus> {
  try {
    // 1) 영양제 7일 챙김율
    const sCount = await count7DaysSupplement(child.id);
    const card1 = `${sCount}/7일`;

    // 2) 컨디션 7일 추세
    const card2 = await mood7DaysTrend(child.id);

    // 3) 이번 주 핵심 (주차별 정적 안내)
    const card3 = weeklyHighlight(child.pregnancyWeeks ?? 0);

    return { cards: [card1, card2, card3] };
  } catch {
    return { cards: ['—', '—', '—'] };
  }
}

/** 최근 7일 (오늘 포함) 영양제 토글 카운트 */
async function count7DaysSupplement(childId: string): Promise<number> {
  let count = 0;
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const v = await AsyncStorage.getItem(SUPPLEMENT_KEY(childId, ymd)).catch(() => null);
    if (v === '1') count += 1;
  }
  return count;
}

/** 최근 7일 mood 분포 → 한 줄 추세 라벨 */
async function mood7DaysTrend(childId: string): Promise<string> {
  const counts: Record<string, number> = { good: 0, tired: 0, nausea: 0, pain: 0 };
  let total = 0;
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const v = await AsyncStorage.getItem(MOOD_KEY(childId, ymd)).catch(() => null);
    if (v && counts[v] != null) {
      counts[v] += 1;
      total += 1;
    }
  }
  if (total === 0) return '기록 없음';

  // 가장 많은 mood 기준
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topKey, topCount] = sorted[0];
  const ratio = topCount / total;

  if (topKey === 'good' && ratio >= 0.5) return '주로 안정';
  if (topKey === 'tired' && ratio >= 0.4) return '피로 잦음';
  if (topKey === 'nausea' && ratio >= 0.3) return '입덧 추세';
  if (topKey === 'pain' && ratio >= 0.3) return '통증 주의';
  return '변동 있음';
}

/** 임신 주차별 핵심 1줄 안내 (정적) */
function weeklyHighlight(week: number): string {
  if (week <= 0) return '주차 확인';
  if (week <= 4)  return '엽산 시작';
  if (week <= 8)  return '입덧 시기';
  if (week <= 12) return '초음파 시기';
  if (week <= 16) return '안정기 진입';
  if (week <= 20) return '태동 가능';
  if (week <= 24) return '정밀 초음파';
  if (week <= 28) return '임당 검사';
  if (week <= 32) return '부종 주의';
  if (week <= 36) return '출산 준비';
  if (week <= 40) return 'D-day 임박';
  return '예정일 초과';
}
