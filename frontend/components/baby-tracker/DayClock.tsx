/**
 * DayClock — 하루 24시간 원형 패턴 차트 (베이비빌리 스타일 방사형 wedge).
 *
 * - 0시 정상(12시 방향), 시계방향. 0~22시 2시간 간격 눈금/라벨(원 바깥).
 * - 도넛 띠(안쪽 구멍 ~ 바깥 림)에 각 기록을 "시각 위치의 방사형 부채꼴(wedge)"로 채움.
 *   · 수면: 지속시간만큼 넓은 wedge.
 *   · 수유·배변·투약 등 단발 기록: 얇은 wedge(시각 표시).
 * - 가운데 구멍: 날짜 + 핵심 요약(수유/수면). 범례로 색 의미 안내.
 * - 기록 0건이면 빈 시계 + 안내 문구.
 *
 * react-native-svg 기반(프로젝트에 이미 사용 중: VaccinationDonut).
 */
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { TrackerRecord } from '../../features/baby-tracker/types';

/* 아기시간 표준 색상 (TRACKER_COLORS와 동일 톤) */
const C = {
  diaper: '#7FC0CC', diaperLeg: '#6AAFBB',
  feeding: '#FFCE5C', feedingLeg: '#E6B84D',
  sleep: '#B8A0D2', sleepLeg: '#8F73B5',
  medication: '#8BC34A', medicationLeg: '#558B2F',
  custom: '#9575CD',
  track: '#F1F1F6', tick: '#DADAE2', tickStrong: '#B9B9C4',
  text: '#1C1C1E', textSub: '#8A8A90',
};

const SIZE = 250;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUT = 95;        // 도넛 바깥 반지름 (wedge 끝)
const R_IN = 55;         // 도넛 안쪽 반지름 (가운데 구멍)
const R_TICK_OUT = R_OUT + 5;
const R_TICK_IN = R_OUT + 1;
const R_LABEL = R_OUT + 15;

/** 단발 기록(수유/배변/투약)이 차지하는 최소 각도(분 환산) — 얇은 wedge 가시성 확보 */
const MIN_EVENT_SWEEP = 14; // ≈ 3.5°
const MIN_SLEEP_SWEEP = 10;

function minutesOfDay(t?: string): number | null {
  if (!t) return null;
  // cross-day prefix("M/D HH:MM") 가 있으면 HH:MM 만 사용
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

/** 도넛 부채꼴(annular sector) path — 시각(startMin)에서 sweepMin 만큼, 안쪽 rIn ~ 바깥 rOut. */
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

interface Wedge { start: number; sweep: number; color: string; z: number; }

function buildWedges(records: TrackerRecord[]): Wedge[] {
  const wedges: Wedge[] = [];
  for (const r of records) {
    const start = minutesOfDay(r.time);
    if (start == null) continue;
    if (r.type === 'sleep') {
      // 자정 넘긴 수면의 '오늘 새벽' 부분 (어제 시작 → 오늘 기상한 가상 sleep_end 엔트리):
      // time=기상시각. 오늘 클럭에서는 0:00 ~ 기상시각 구간이 수면.
      if (r.subType === 'sleep_end') {
        if (start > 0) wedges.push({ start: 0, sweep: start, color: C.sleep, z: 0 });
        continue;
      }
      let sweep = MIN_SLEEP_SWEEP;
      if (typeof r.duration === 'number' && r.duration > 0) sweep = r.duration;
      else {
        const end = minutesOfDay(r.endTime);
        if (end != null) sweep = (end - start + 1440) % 1440 || MIN_SLEEP_SWEEP;
      }
      // 하루 클럭이므로 자정을 넘기는 부분은 오늘 끝(24:00)까지만 그림.
      // (나머지 새벽 부분은 다음날 클럭의 sleep_end 로 표시 — 한 클럭에 한 바퀴 다 채우는 오작동 방지)
      sweep = Math.min(sweep, 1440 - start);
      if (sweep <= 0) sweep = MIN_SLEEP_SWEEP;
      // z=0: 수면은 넓으니 배경 레이어로 먼저
      wedges.push({ start, sweep, color: C.sleep, z: 0 });
    } else {
      const color =
        r.type === 'diaper' ? C.diaper
          : r.type === 'feeding' ? C.feeding
            : r.type === 'medication' ? C.medication
              : C.custom;
      wedges.push({ start, sweep: MIN_EVENT_SWEEP, color, z: 1 });
    }
  }
  // 수면(배경) 먼저, 단발 기록을 위에 그림
  return wedges.sort((a, b) => a.z - b.z);
}

interface Props {
  records: TrackerRecord[];
  dateLabel: string;
  /** 날짜 이동 (이전/다음 날). 둘 다 주면 카드 상단에 날짜 네비 표시 */
  onPrevDay?: () => void;
  onNextDay?: () => void;
  /** 다음 날로 이동 가능 여부 (오늘이면 false → 미래 이동 막음) */
  canGoNext?: boolean;
}

export function DayClock({ records, dateLabel, onPrevDay, onNextDay, canGoNext = true }: Props) {
  const showNav = !!(onPrevDay && onNextDay);
  const [markerStyle, setMarkerStyle] = useState<'dot' | 'bar'>('dot');
  const wedges = useMemo(() => buildWedges(records), [records]);
  const hasData = wedges.length > 0;

  // records 기반 핵심 요약 (수유 횟수 / 수면 시간)
  const { feedingCount, sleepHours } = useMemo(() => {
    let fc = 0;
    let sleepMin = 0;
    for (const r of records) {
      if (r.type === 'feeding') { fc += 1; continue; }
      if (r.type !== 'sleep') continue;
      const start = minutesOfDay(r.time);
      if (start == null) continue;
      // 자정 넘긴 수면의 '오늘 새벽' 부분: 0:00~기상시각
      if (r.subType === 'sleep_end') { sleepMin += start; continue; }
      let sweep = 0;
      if (typeof r.duration === 'number' && r.duration > 0) sweep = r.duration;
      else {
        const end = minutesOfDay(r.endTime);
        if (end != null) sweep = (end - start + 1440) % 1440;
      }
      // 하루 클럭과 동일하게 오늘 몫만 (자정 넘기는 부분 제외)
      sleepMin += Math.max(0, Math.min(sweep, 1440 - start));
    }
    return { feedingCount: fc, sleepHours: sleepMin / 60 };
  }, [records]);

  // 2시간 간격 눈금/라벨
  const ticks = Array.from({ length: 12 }, (_, i) => i * 2); // 0,2,...,22

  return (
    <View style={s.card}>
      <View style={s.titleRow}>
        <Text style={s.title}>하루 패턴 · 24시간</Text>
        <View style={s.styleToggle}>
          <Text
            onPress={() => setMarkerStyle('dot')}
            style={[s.styleChip, markerStyle === 'dot' && s.styleChipOn]}
          >{'● 점'}</Text>
          <Text
            onPress={() => setMarkerStyle('bar')}
            style={[s.styleChip, markerStyle === 'bar' && s.styleChipOn]}
          >{'▎막대'}</Text>
        </View>
      </View>

      {showNav && (
        <View style={s.dateNav}>
          <TouchableOpacity onPress={onPrevDay} style={s.dateNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.dateNavArrow}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={s.dateNavLabel}>{dateLabel}</Text>
          <TouchableOpacity
            onPress={onNextDay}
            disabled={!canGoNext}
            style={s.dateNavBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[s.dateNavArrow, !canGoNext && s.dateNavArrowOff]}>{'›'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.clockWrap}>
        <Svg width={SIZE} height={SIZE}>
          {/* 배경 도넛 띠 */}
          <Circle
            cx={CX} cy={CY} r={(R_OUT + R_IN) / 2}
            stroke={C.track} strokeWidth={R_OUT - R_IN} fill="none"
          />

          {/* 수면 띠 (배경 레이어) */}
          {wedges.filter((w) => w.z === 0).map((w, i) => (
            <Path key={`s${i}`} d={wedgePath(w.start, w.sweep, R_IN, R_OUT)} fill={w.color} opacity={0.9} />
          ))}

          {/* 이벤트 마커 — 점(dot) 또는 굵은 막대(bar) */}
          {wedges.filter((w) => w.z === 1).map((w, i) => {
            if (markerStyle === 'bar') {
              const [x0, y0] = polarDeg(angleDeg(w.start), R_IN + 1);
              const [x1, y1] = polarDeg(angleDeg(w.start), R_OUT - 1);
              return (
                <Line key={`e${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={w.color} strokeWidth={9} strokeLinecap="round" />
              );
            }
            const [cx, cy] = polarDeg(angleDeg(w.start), (R_IN + R_OUT) / 2);
            return <Circle key={`e${i}`} cx={cx} cy={cy} r={7} fill={w.color} stroke="#FFFFFF" strokeWidth={2} />;
          })}

          {/* 시간 눈금 (바깥) */}
          {ticks.map((h) => {
            const deg = angleDeg(h * 60);
            const strong = h % 6 === 0;
            const [ix, iy] = polarDeg(deg, R_TICK_IN);
            const [ox, oy] = polarDeg(deg, R_TICK_OUT);
            return (
              <Line
                key={`t${h}`}
                x1={ix} y1={iy} x2={ox} y2={oy}
                stroke={strong ? C.tickStrong : C.tick}
                strokeWidth={strong ? 2 : 1}
              />
            );
          })}
          {/* 0,2,...,22 라벨 (원 바깥) */}
          {ticks.map((h) => {
            const [lx, ly] = polarDeg(angleDeg(h * 60), R_LABEL);
            const strong = h % 6 === 0;
            return (
              <SvgText
                key={`l${h}`}
                x={lx} y={ly + 3.4}
                fontSize={strong ? 10.5 : 9}
                fontWeight={strong ? '800' : '600'}
                fill={strong ? C.text : C.textSub}
                textAnchor="middle"
              >
                {h}
              </SvgText>
            );
          })}
        </Svg>

        {/* 가운데 라벨 (구멍) */}
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

      {!hasData && (
        <Text style={s.hint}>기록을 남기면 하루 흐름이 시계처럼 채워져요</Text>
      )}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 6 },
  title: { fontSize: 12, fontWeight: '700', color: C.text, marginLeft: 2 },
  styleToggle: { flexDirection: 'row', gap: 4 },
  styleChip: {
    fontSize: 11, fontWeight: '700', color: C.textSub,
    borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden',
  },
  styleChipOn: { color: '#FFFFFF', backgroundColor: C.sleepLeg, borderColor: C.sleepLeg },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 2 },
  dateNavBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dateNavArrow: { fontSize: 24, fontWeight: '800', color: C.sleepLeg },
  dateNavArrowOff: { color: '#D9D9E0' },
  dateNavLabel: { fontSize: 15, fontWeight: '800', color: C.text, minWidth: 120, textAlign: 'center' },
  clockWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerDate: { fontSize: 17, fontWeight: '800', color: C.text },
  centerSub: { fontSize: 11.5, fontWeight: '700', color: C.textSub, textAlign: 'center', marginTop: 2, lineHeight: 16 },
  centerEmpty: { fontSize: 11, fontWeight: '600', color: C.textSub, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11, fontWeight: '600', color: C.textSub },
  hint: { fontSize: 11.5, color: C.textSub, textAlign: 'center', marginTop: 10, fontWeight: '600' },
});
