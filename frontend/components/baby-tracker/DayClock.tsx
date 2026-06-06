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
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
      let sweep = MIN_SLEEP_SWEEP;
      if (typeof r.duration === 'number' && r.duration > 0) sweep = r.duration;
      else {
        const end = minutesOfDay(r.endTime);
        if (end != null) sweep = (end - start + 1440) % 1440 || MIN_SLEEP_SWEEP;
      }
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
}

export function DayClock({ records, dateLabel }: Props) {
  const wedges = useMemo(() => buildWedges(records), [records]);
  const hasData = wedges.length > 0;

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

  // 2시간 간격 눈금/라벨
  const ticks = Array.from({ length: 12 }, (_, i) => i * 2); // 0,2,...,22

  return (
    <View style={s.card}>
      <Text style={s.title}>하루 패턴 · 24시간</Text>

      <View style={s.clockWrap}>
        <Svg width={SIZE} height={SIZE}>
          {/* 배경 도넛 띠 */}
          <Circle
            cx={CX} cy={CY} r={(R_OUT + R_IN) / 2}
            stroke={C.track} strokeWidth={R_OUT - R_IN} fill="none"
          />

          {/* 기록 wedge */}
          {wedges.map((w, i) => (
            <Path
              key={`w${i}`}
              d={wedgePath(w.start, w.sweep, R_IN, R_OUT)}
              fill={w.color}
              opacity={w.z === 0 ? 0.9 : 1}
            />
          ))}

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
  title: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6, marginLeft: 2 },
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
