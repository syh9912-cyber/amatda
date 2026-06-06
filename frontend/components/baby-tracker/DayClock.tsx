/**
 * DayClock — 하루 24시간 원형 패턴 차트 (베이비빌리 '패턴' 개선판).
 *
 * - 0시 정상(12시 방향), 시계방향. 2시간 간격 눈금 + 0/6/12/18 강조 라벨.
 * - 수면: 시작~종료 구간을 '호(arc)'로 채워 한눈에 보임.
 * - 수유·배변·투약 등 단발 기록: 링 바깥에 색점(dot)으로 표시.
 * - 가운데: 날짜 + 핵심 요약(수유/수면). 범례로 색 의미 안내.
 * - 기록 0건이면 빈 시계 + 안내 문구.
 *
 * react-native-svg 기반(프로젝트에 이미 사용 중: VaccinationDonut).
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { TrackerRecord } from '../../features/baby-tracker/types';

/* 아기시간 표준 색상 (TRACKER_COLORS와 동일 톤) */
const C = {
  diaper: '#A0D2DB', diaperDark: '#6AAFBB',
  feeding: '#FFD76E', feedingDark: '#E6B84D',
  sleep: '#B8A0D2', sleepDark: '#8F73B5',
  medication: '#7CB342', medicationDark: '#558B2F',
  custom: '#9575CD', customDark: '#5E35B1',
  track: '#F0F0F4', tick: '#D9D9E0', tickStrong: '#B9B9C4',
  text: '#1C1C1E', textSub: '#8A8A90',
};

const SIZE = 236;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_RING = 92;      // 수면 호가 그려지는 메인 링
const RING_STROKE = 11;
const R_DOT = 92 + RING_STROKE / 2 + 7; // 단발 기록 점 (링 바깥)
const R_TICK_OUT = 92 - RING_STROKE / 2 - 2;
const R_TICK_IN = R_TICK_OUT - 6;
const R_LABEL = R_TICK_IN - 11;

function minutesOfDay(t?: string): number | null {
  if (!t) return null;
  const m = /(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return (Number(m[1]) % 24) * 60 + Number(m[2]);
}

/** 분(0~1440) → 각도(도). 0분=12시 방향(-90°), 시계방향. */
function angleDeg(min: number): number {
  return (min / 1440) * 360 - 90;
}
function polar(min: number, r: number): [number, number] {
  const a = (angleDeg(min) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
function polarDeg(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

/** 수면 등 구간 호 path (시작분 → 길이분, 시계방향). */
function arcPath(startMin: number, sweepMin: number, r: number): string {
  const sweep = Math.max(2, Math.min(1439, sweepMin)); // 0/한바퀴 방지
  const [x0, y0] = polarDeg(angleDeg(startMin), r);
  const [x1, y1] = polarDeg(angleDeg(startMin + sweep), r);
  const largeArc = sweep > 720 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

interface Mark { kind: 'arc' | 'dot'; start: number; sweep?: number; color: string; }

function buildMarks(records: TrackerRecord[]): Mark[] {
  const marks: Mark[] = [];
  for (const r of records) {
    const start = minutesOfDay(r.time);
    if (start == null) continue;
    if (r.type === 'sleep') {
      let sweep = 0;
      if (typeof r.duration === 'number' && r.duration > 0) sweep = r.duration;
      else {
        const end = minutesOfDay(r.endTime);
        if (end != null) sweep = (end - start + 1440) % 1440;
      }
      if (sweep > 0) marks.push({ kind: 'arc', start, sweep, color: C.sleep });
      else marks.push({ kind: 'dot', start, color: C.sleepDark }); // 진행중(종료 미정)
    } else {
      const color =
        r.type === 'diaper' ? C.diaperDark
          : r.type === 'feeding' ? C.feedingDark
            : r.type === 'medication' ? C.medicationDark
              : C.customDark;
      marks.push({ kind: 'dot', start, color });
    }
  }
  return marks;
}

interface Props {
  records: TrackerRecord[];
  dateLabel: string;
}

export function DayClock({ records, dateLabel }: Props) {
  const marks = useMemo(() => buildMarks(records), [records]);
  const hasData = marks.length > 0;

  // records 기반 핵심 요약 (수유 횟수 / 수면 시간)
  const { feedingCount, sleepHours } = useMemo(() => {
    let fc = 0;
    let sleepMin = 0;
    for (const r of records) {
      if (r.type === 'feeding') fc += 1;
      else if (r.type === 'sleep') {
        if (typeof r.duration === 'number' && r.duration > 0) sleepMin += r.duration;
        else {
          const start = minutesOfDay(r.time);
          const end = minutesOfDay(r.endTime);
          if (start != null && end != null) sleepMin += (end - start + 1440) % 1440;
        }
      }
    }
    return { feedingCount: fc, sleepHours: sleepMin / 60 };
  }, [records]);

  // 2시간 간격 눈금
  const ticks = Array.from({ length: 12 }, (_, i) => i * 2); // 0,2,...,22

  return (
    <View style={s.card}>
      <Text style={s.title}>하루 패턴 · 24시간</Text>

      <View style={s.clockWrap}>
        <Svg width={SIZE} height={SIZE}>
          {/* 배경 링 */}
          <Circle cx={CX} cy={CY} r={R_RING} stroke={C.track} strokeWidth={RING_STROKE} fill="none" />

          {/* 시간 눈금 */}
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
          {/* 0/6/12/18 라벨 */}
          {[0, 6, 12, 18].map((h) => {
            const [lx, ly] = polarDeg(angleDeg(h * 60), R_LABEL);
            return (
              <SvgText
                key={`l${h}`}
                x={lx} y={ly + 3.5}
                fontSize={10.5} fontWeight="700" fill={C.textSub}
                textAnchor="middle"
              >
                {h}
              </SvgText>
            );
          })}

          {/* 수면 호 */}
          {marks.filter((m) => m.kind === 'arc').map((m, i) => (
            <Path
              key={`a${i}`}
              d={arcPath(m.start, m.sweep ?? 0, R_RING)}
              stroke={m.color}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              fill="none"
              opacity={0.92}
            />
          ))}

          {/* 단발 기록 점 (링 바깥) */}
          {marks.filter((m) => m.kind === 'dot').map((m, i) => {
            const [x, y] = polar(m.start, R_DOT);
            return <Circle key={`d${i}`} cx={x} cy={y} r={4.4} fill={m.color} stroke="#FFFFFF" strokeWidth={1.3} />;
          })}
        </Svg>

        {/* 가운데 라벨 */}
        <View style={s.center} pointerEvents="none">
          <Text style={s.centerDate}>{dateLabel}</Text>
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
        <Legend color={C.feedingDark} label="수유·식사" />
        <Legend color={C.diaperDark} label="배변" />
        <Legend color={C.sleep} label="수면" arc />
        <Legend color={C.medicationDark} label="투약" />
      </View>

      {!hasData && (
        <Text style={s.hint}>기록을 남기면 하루 흐름이 시계처럼 채워져요</Text>
      )}
    </View>
  );
}

function Legend({ color, label, arc }: { color: string; label: string; arc?: boolean }) {
  return (
    <View style={s.legendItem}>
      <View style={[arc ? s.legendBar : s.legendDot, { backgroundColor: color }]} />
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
  clockWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerDate: { fontSize: 17, fontWeight: '800', color: C.text },
  centerSub: { fontSize: 11.5, fontWeight: '700', color: C.textSub, textAlign: 'center', marginTop: 2, lineHeight: 16 },
  centerEmpty: { fontSize: 11, fontWeight: '600', color: C.textSub, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendBar: { width: 14, height: 6, borderRadius: 3 },
  legendText: { fontSize: 11, fontWeight: '600', color: C.textSub },
  hint: { fontSize: 11.5, color: C.textSub, textAlign: 'center', marginTop: 10, fontWeight: '600' },
});
