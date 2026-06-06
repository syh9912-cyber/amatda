/**
 * DayClock — 하루 24시간 원형 패턴 차트 (베이비빌리 스타일).
 *
 * - 0시 정상(12시 방향), 시계방향. 0~22시 2시간 간격 눈금/라벨(원 바깥, 여백 넉넉).
 * - 각 기록을 가운데 구멍 ~ 바깥 테두리까지 뻗는 가는 색 '광선(wedge)' 으로 표시.
 *   · 수면: 지속시간만큼 넓은 광선. 수유·배변·투약: 가는 광선.
 * - 상단 카테고리 필터 칩(전체/수면/수유/배변/투약) — 한 종류만 골라 보면 깔끔.
 * - 가운데 구멍: 요약(수유/수면). 날짜는 상단 네비.
 *
 * react-native-svg 기반.
 */
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { TrackerRecord } from '../../features/baby-tracker/types';

type Cat = 'sleep' | 'feeding' | 'diaper' | 'medication';

/* 부드러운 파스텔 (베이비빌리 톤) */
const C = {
  diaper: '#74C7D6', diaperLeg: '#5FB3C4',
  feeding: '#FFCB5C', feedingLeg: '#E8B14A',
  sleep: '#B6A3DE', sleepLeg: '#9784C9',
  medication: '#86C764', medicationLeg: '#6BAE4E',
  track: '#F6F5FA', tick: '#E4E3EC', tickStrong: '#C6C5D1',
  text: '#1C1C1E', textSub: '#8A8A90',
};

const SIZE = 250;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUT = 96;        // 광선 끝(바깥)
const R_IN = 56;         // 가운데 구멍 (여백 ↑)
const R_LABEL = R_OUT + 16;

const MIN_EVENT_SWEEP = 19; // 단발 기록 광선 굵기 (~4.8°) — 또렷하게
const MIN_SLEEP_SWEEP = 12;

function catColor(cat: Cat): string {
  return cat === 'diaper' ? C.diaper : cat === 'feeding' ? C.feeding : cat === 'medication' ? C.medication : C.sleep;
}

function minutesOfDay(t?: string): number | null {
  if (!t) return null;
  const hhmm = t.includes(' ') ? t.split(' ').pop() ?? t : t;
  const m = /(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return (Number(m[1]) % 24) * 60 + Number(m[2]);
}

/** 분(0~1440) → 각도(도). 0분=12시 방향(-90°), 시계방향. */
function angleDeg(min: number): number {
  return (min / 1440) * 360 - 90;
}
function polarDeg(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

/** 도넛 부채꼴(annular sector) path. */
function wedgePath(startMin: number, sweepMin: number, rIn: number, rOut: number): string {
  const sweep = Math.max(2, Math.min(1439, sweepMin));
  const a0 = angleDeg(startMin);
  const a1 = angleDeg(startMin + sweep);
  const [ox0, oy0] = polarDeg(a0, rOut);
  const [ox1, oy1] = polarDeg(a1, rOut);
  const [ix1, iy1] = polarDeg(a1, rIn);
  const [ix0, iy0] = polarDeg(a0, rIn);
  const large = sweep > 720 ? 1 : 0;
  return (
    `M ${ox0.toFixed(2)} ${oy0.toFixed(2)} ` +
    `A ${rOut} ${rOut} 0 ${large} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)} ` +
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)} ` +
    `A ${rIn} ${rIn} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)} Z`
  );
}

interface Wedge { start: number; sweep: number; cat: Cat; }

function buildWedges(records: TrackerRecord[]): Wedge[] {
  const wedges: Wedge[] = [];
  for (const r of records) {
    const start = minutesOfDay(r.time);
    if (start == null) continue;
    if (r.type === 'sleep') {
      // 자정 넘긴 수면의 '오늘 새벽' 부분(가상 sleep_end): 0:00 ~ 기상시각
      if (r.subType === 'sleep_end') {
        if (start > 0) wedges.push({ start: 0, sweep: start, cat: 'sleep' });
        continue;
      }
      let sweep = MIN_SLEEP_SWEEP;
      if (typeof r.duration === 'number' && r.duration > 0) sweep = r.duration;
      else {
        const end = minutesOfDay(r.endTime);
        if (end != null) sweep = (end - start + 1440) % 1440 || MIN_SLEEP_SWEEP;
      }
      sweep = Math.min(sweep, 1440 - start);
      if (sweep <= 0) sweep = MIN_SLEEP_SWEEP;
      wedges.push({ start, sweep, cat: 'sleep' });
    } else {
      const cat: Cat = r.type === 'diaper' ? 'diaper' : r.type === 'feeding' ? 'feeding' : r.type === 'medication' ? 'medication' : 'feeding';
      wedges.push({ start, sweep: MIN_EVENT_SWEEP, cat });
    }
  }
  // 수면(넓음) 먼저 → 단발 기록을 위에
  return wedges.sort((a, b) => (a.cat === 'sleep' ? 0 : 1) - (b.cat === 'sleep' ? 0 : 1));
}

const FILTERS: { key: Cat | 'all'; label: string; color: string }[] = [
  { key: 'all', label: '전체', color: C.sleepLeg },
  { key: 'sleep', label: '수면', color: C.sleepLeg },
  { key: 'feeding', label: '수유', color: C.feedingLeg },
  { key: 'diaper', label: '배변', color: C.diaperLeg },
  { key: 'medication', label: '투약', color: C.medicationLeg },
];

interface Props {
  records: TrackerRecord[];
  dateLabel: string;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  canGoNext?: boolean;
}

export function DayClock({ records, dateLabel, onPrevDay, onNextDay, canGoNext = true }: Props) {
  const showNav = !!(onPrevDay && onNextDay);
  const [filter, setFilter] = useState<Cat | 'all'>('all');
  const wedges = useMemo(() => buildWedges(records), [records]);
  const hasData = wedges.length > 0;
  const shown = filter === 'all' ? wedges : wedges.filter((w) => w.cat === filter);

  const { feedingCount, sleepHours } = useMemo(() => {
    let fc = 0;
    let sleepMin = 0;
    for (const r of records) {
      if (r.type === 'feeding') { fc += 1; continue; }
      if (r.type !== 'sleep') continue;
      const start = minutesOfDay(r.time);
      if (start == null) continue;
      if (r.subType === 'sleep_end') { sleepMin += start; continue; }
      let sweep = 0;
      if (typeof r.duration === 'number' && r.duration > 0) sweep = r.duration;
      else {
        const end = minutesOfDay(r.endTime);
        if (end != null) sweep = (end - start + 1440) % 1440;
      }
      sleepMin += Math.max(0, Math.min(sweep, 1440 - start));
    }
    return { feedingCount: fc, sleepHours: sleepMin / 60 };
  }, [records]);

  const hours = Array.from({ length: 24 }, (_, i) => i); // 0,1,...,23 (1시간 간격)

  return (
    <View style={s.card}>
      <Text style={s.title}>하루 패턴 · 24시간</Text>

      {showNav && (
        <View style={s.dateNav}>
          <TouchableOpacity onPress={onPrevDay} style={s.dateNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.dateNavArrow}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={s.dateNavLabel}>{dateLabel}</Text>
          <TouchableOpacity onPress={onNextDay} disabled={!canGoNext} style={s.dateNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[s.dateNavArrow, !canGoNext && s.dateNavArrowOff]}>{'›'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 카테고리 필터 칩 */}
      <View style={s.chips}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} activeOpacity={0.7}>
              <Text style={[s.chip, on && { backgroundColor: f.color, borderColor: f.color, color: '#FFFFFF' }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.clockWrap}>
        <Svg width={SIZE} height={SIZE}>
          {/* 배경 도넛 띠 */}
          <Circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2} stroke={C.track} strokeWidth={R_OUT - R_IN} fill="none" />

          {/* 기록 광선 (수면 먼저, 단발 위에). stroke+round join 으로 모서리를 둥글려 세련되게. */}
          {shown.map((w, i) => {
            const col = catColor(w.cat);
            return (
              <Path
                key={`w${i}`}
                d={wedgePath(w.start, w.sweep, R_IN, R_OUT)}
                fill={col}
                stroke={col}
                strokeWidth={3}
                strokeLinejoin="round"
                opacity={w.cat === 'sleep' ? 0.82 : 1}
              />
            );
          })}

          {/* 시간 눈금 (1시간 간격 24개, 바깥) — 0/6/12/18 강조 */}
          {hours.map((h) => {
            const deg = angleDeg(h * 60);
            const major = h % 6 === 0;
            const len = major ? 7 : 4;
            const [ix, iy] = polarDeg(deg, R_OUT + 1);
            const [ox, oy] = polarDeg(deg, R_OUT + 1 + len);
            return <Line key={`t${h}`} x1={ix} y1={iy} x2={ox} y2={oy} stroke={major ? C.tickStrong : C.tick} strokeWidth={major ? 2 : 1} />;
          })}
          {/* 시각 라벨 (1시간 간격, 원 바깥) — 0/6/12/18 크게, 나머지는 작고 옅게 */}
          {hours.map((h) => {
            const [lx, ly] = polarDeg(angleDeg(h * 60), R_LABEL);
            const major = h % 6 === 0;
            return (
              <SvgText
                key={`l${h}`}
                x={lx} y={ly + (major ? 3.6 : 3)}
                fontSize={major ? 10.5 : 7.5}
                fontWeight={major ? '800' : '600'}
                fill={major ? C.text : C.textSub}
                textAnchor="middle"
              >
                {h}
              </SvgText>
            );
          })}
        </Svg>

        {/* 가운데 구멍 */}
        <View style={s.center} pointerEvents="none">
          {!showNav && <Text style={s.centerDate}>{dateLabel}</Text>}
          {hasData ? (
            <Text style={s.centerSub}>
              {feedingCount > 0 ? `수유 ${feedingCount}` : ''}
              {feedingCount > 0 && sleepHours > 0 ? '\n' : ''}
              {sleepHours > 0 ? `수면 ${sleepHours >= 10 ? Math.round(sleepHours) : sleepHours.toFixed(1)}h` : ''}
            </Text>
          ) : (
            <Text style={s.centerEmpty}>아직 기록 없음</Text>
          )}
        </View>
      </View>

      {/* 범례 */}
      <View style={s.legend}>
        <Legend color={C.feeding} label="수유·식사" />
        <Legend color={C.diaper} label="배변" />
        <Legend color={C.sleep} label="수면" />
        <Legend color={C.medication} label="투약" />
      </View>

      {!hasData && <Text style={s.hint}>기록을 남기면 하루 흐름이 시계처럼 채워져요</Text>}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 12,
    marginBottom: 8, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  title: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6, marginLeft: 2 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 6 },
  dateNavBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dateNavArrow: { fontSize: 24, fontWeight: '800', color: C.sleepLeg },
  dateNavArrowOff: { color: '#D9D9E0' },
  dateNavLabel: { fontSize: 15, fontWeight: '800', color: C.text, minWidth: 120, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 8 },
  chip: {
    fontSize: 12, fontWeight: '700', color: C.textSub,
    borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 14,
    paddingHorizontal: 11, paddingVertical: 4, overflow: 'hidden',
  },
  clockWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerDate: { fontSize: 17, fontWeight: '800', color: C.text },
  centerSub: { fontSize: 12, fontWeight: '700', color: C.textSub, textAlign: 'center', marginTop: 2, lineHeight: 17 },
  centerEmpty: { fontSize: 11, fontWeight: '600', color: C.textSub, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11, fontWeight: '600', color: C.textSub },
  hint: { fontSize: 11.5, color: C.textSub, textAlign: 'center', marginTop: 10, fontWeight: '600' },
});
