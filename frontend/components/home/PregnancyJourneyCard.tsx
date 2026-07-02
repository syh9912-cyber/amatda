/**
 * PregnancyJourneyCard — 임신 여정 5단계 progress bar (임신부 mode 전용)
 *
 * 단계: 초기 (1-12주) / 12주 / 안정 (13-24주) / 후기 (25-37주) / 출산 (38주+)
 *
 * 우상단: D-{출산 D-day} · {N}주차
 * 5단계 노드: 일러스트 + 라벨, 현재 단계 강조 + 진행 중 표시
 */

import React from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface Child {
  id: string;
  isPregnant?: boolean;
  pregnancyWeeks?: number;
  dueDate?: string;
}

interface Props {
  child: Child;
}

// pregnancy-journey-detail.tsx 의 stage 키와 매핑
const STAGE_KEYS: ('early' | 'wk12' | 'stable' | 'late' | 'birth')[] =
  ['early', 'wk12', 'stable', 'late', 'birth'];

const COLOR = {
  card: '#FFFFFF',
  border: '#E5E5EA',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  pink: '#E91E63',
  pinkBg: '#FCE4EC',
  trackBg: '#F2F2F7',
};

interface Stage {
  label: string;
  src: ImageSourcePropType;
  weeksMin: number;
  weeksMax: number;
}

function getStages(t: TFunction): Stage[] {
  return [
    { label: t('components.pregnancyJourneyCard.stage.early'),  src: require('../../assets/preg-test.png'),        weeksMin: 1,  weeksMax: 11 },
    { label: t('components.pregnancyJourneyCard.stage.wk12'),   src: require('../../assets/preg-stethoscope.png'), weeksMin: 12, weeksMax: 12 },
    { label: t('components.pregnancyJourneyCard.stage.stable'), src: require('../../assets/preg-leaf.png'),        weeksMin: 13, weeksMax: 24 },
    { label: t('components.pregnancyJourneyCard.stage.late'),   src: require('../../assets/preg-bag.png'),         weeksMin: 25, weeksMax: 37 },
    { label: t('components.pregnancyJourneyCard.stage.birth'),  src: require('../../assets/quick-baby.png'),       weeksMin: 38, weeksMax: 99 },
  ];
}

function getCurrentStageIdx(stages: Stage[], weeks: number): number {
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    if (weeks >= s.weeksMin && weeks <= s.weeksMax) return i;
  }
  return 0;
}

function daysUntilDue(dueIso: string): number | null {
  if (!dueIso) return null;
  const d = new Date(dueIso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function PregnancyJourneyCard({ child }: Props) {
  const { t } = useTranslation();
  const stages = getStages(t);
  if (!child.isPregnant) return null;
  const weeks = child.pregnancyWeeks ?? 0;
  const stageIdx = getCurrentStageIdx(stages, weeks);
  const dueDays = child.dueDate ? daysUntilDue(child.dueDate) : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t('components.pregnancyJourneyCard.headerTitle')}</Text>
        <Text style={styles.headerSub}>
          {dueDays != null ? <Text style={styles.headerDday}>{`D-${dueDays}`}</Text> : null}
          {dueDays != null ? <Text style={{ color: COLOR.textLight }}>{` · `}</Text> : null}
          <Text style={{ color: COLOR.text, fontWeight: '800' }}>{t('components.pregnancyJourneyCard.weekSuffix', { week: weeks })}</Text>
        </Text>
      </View>

      <View style={styles.stagesRow}>
        {stages.map((s, idx) => {
          const isCurrent = idx === stageIdx;
          const isPast = idx < stageIdx;
          const stageKey = STAGE_KEYS[idx];
          return (
            <React.Fragment key={s.label}>
              <TouchableOpacity
                style={styles.stageCol}
                onPress={() => router.push(`/(main)/pregnancy-journey-detail?stage=${stageKey}` as never)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.stageImgWrap,
                    isCurrent && styles.stageImgWrapCurrent,
                    isPast && styles.stageImgWrapPast,
                  ]}
                >
                  <Image
                    source={s.src}
                    style={[styles.stageImg, !isCurrent && !isPast && { opacity: 0.4 }]}
                    resizeMode="contain"
                  />
                </View>
                <Text
                  style={[
                    styles.stageLabel,
                    isCurrent && styles.stageLabelCurrent,
                    !isCurrent && !isPast && styles.stageLabelDim,
                  ]}
                >
                  {s.label}
                </Text>
                {isCurrent && <Text style={styles.stageStatus}>{t('components.pregnancyJourneyCard.inProgress')}</Text>}
                {isPast && <Text style={styles.stagePast}>—</Text>}
              </TouchableOpacity>

              {/* 단계 사이 connector (마지막 제외) */}
              {idx < stages.length - 1 && (
                <View
                  style={[
                    styles.connector,
                    idx < stageIdx && styles.connectorDone,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.card,
    borderRadius: 12,
    padding: 10,
    marginTop: 0,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLOR.text,
  },
  headerSub: {
    fontSize: 11,
  },
  headerDday: {
    color: COLOR.pink,
    fontWeight: '900',
  },
  stagesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stageCol: {
    alignItems: 'center',
    width: 44,
  },
  stageImgWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLOR.trackBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  stageImgWrapCurrent: {
    backgroundColor: COLOR.pinkBg,
    borderWidth: 2,
    borderColor: COLOR.pink,
  },
  stageImgWrapPast: {
    backgroundColor: '#FFF4ED',
  },
  stageImg: {
    width: 24,
    height: 24,
  },
  stageLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLOR.text,
  },
  stageLabelCurrent: {
    color: COLOR.pink,
    fontWeight: '900',
  },
  stageLabelDim: {
    color: COLOR.textLight,
  },
  stageStatus: {
    fontSize: 8,
    fontWeight: '800',
    color: COLOR.pink,
    marginTop: 1,
  },
  stagePast: {
    fontSize: 8,
    color: COLOR.textLight,
    marginTop: 1,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: COLOR.trackBg,
    marginTop: 18, // 이미지 가운데와 정렬
    marginHorizontal: 1,
  },
  connectorDone: {
    backgroundColor: COLOR.pink,
  },
});
