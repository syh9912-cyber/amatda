/**
 * 접종 현황 도넛 차트 + 완료/다가오는/놓친 배지
 *
 * - SVG 기반 (react-native-svg)
 * - 가운데에 % 또는 ⚠️ 표시
 * - 터치 시 onPress (미완료 필터 호출 등)
 */

import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  completed: number;
  upcoming: number;
  overdue: number;
  total: number;
  childName: string;
  onPressDonut?: () => void;
}

const SIZE = 140;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function VaccinationDonut({
  completed,
  upcoming,
  overdue,
  total,
  childName,
  onPressDonut,
}: Props) {
  const { t } = useTranslation();
  const ratio = total > 0 ? completed / total : 0;
  const percent = Math.round(ratio * 100);
  const offset = useMemo(() => CIRCUMFERENCE * (1 - ratio), [ratio]);
  const hasOverdue = overdue > 0;
  const ringColor = hasOverdue ? '#FF6B6B' : '#FF8C5A';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('components.vaccinationDonut.title', { name: childName })}</Text>

      <View style={styles.row}>
        {/* 도넛 차트 */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPressDonut}
          hitSlop={6}
          style={styles.donutWrap}
        >
          <Svg width={SIZE} height={SIZE}>
            {/* 배경 링 */}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke="#F0F0F0"
              strokeWidth={STROKE}
              fill="none"
            />
            {/* 진행 링 */}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={ringColor}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
          {/* 가운데 라벨 */}
          <View style={styles.donutCenter} pointerEvents="none">
            {hasOverdue ? (
              <>
                <Text style={styles.warningEmoji}>⚠️</Text>
                <Text style={styles.warningText}>{t('vaccination.filterOverdue')}</Text>
                <Text style={styles.warningCount}>{t('components.vaccinationDonut.countUnit', { count: overdue })}</Text>
              </>
            ) : (
              <>
                <Text style={styles.percent}>{t('components.vaccinationDonut.percent', { percent })}</Text>
                <Text style={styles.percentLabel}>{t('common.complete')}</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* 우측 배지 3종 */}
        <View style={styles.badgeCol}>
          <Badge label={t('common.complete')} count={completed} color="#4CAF50" bg="#E8F5E9" />
          <Badge label={t('vaccination.filterUpcoming')} count={upcoming} color="#FF8C5A" bg="#FFF3EC" />
          <Badge
            label={t('vaccination.filterOverdue')}
            count={overdue}
            color={hasOverdue ? '#D32F2F' : '#9E9E9E'}
            bg={hasOverdue ? '#FFEBEE' : '#F5F5F5'}
            highlight={hasOverdue}
          />
        </View>
      </View>

      {/* 터치 안내 */}
      {(upcoming + overdue) > 0 && (
        <Text style={styles.hint}>{t('components.vaccinationDonut.hint')}</Text>
      )}
    </View>
  );
}

function Badge({
  label,
  count,
  color,
  bg,
  highlight,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, highlight && styles.badgeHighlight]}>
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
      <Text style={[styles.badgeCount, { color }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  donutWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: { fontSize: 32, fontWeight: '900', color: '#1A1A1A' },
  percentLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  warningEmoji: { fontSize: 28, marginBottom: 2 },
  warningText: { fontSize: 12, fontWeight: '700', color: '#D32F2F' },
  warningCount: { fontSize: 18, fontWeight: '900', color: '#D32F2F' },

  badgeCol: { flex: 1, gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  badgeHighlight: {
    borderWidth: 1.5,
    borderColor: '#EF9A9A',
  },
  badgeLabel: { fontSize: 14, fontWeight: '700' },
  badgeCount: { fontSize: 17, fontWeight: '900' },

  hint: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 12,
  },
});
