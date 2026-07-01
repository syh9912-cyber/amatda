/**
 * 임신 여정 상세 페이지 — 5단계별 필수 정보 매핑
 *
 * 단계: early(1-12주) / 12wk(12주 검진) / stable(13-24주) / late(25-37주) / birth(38주+)
 *
 * 각 단계별로 영양제 / 운동 / 식단 / 주의사항 / 검사 / 마일스톤 정리.
 *
 * 모든 정보는 일반 안내 — 의료적 결정은 산부인과 권유.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { BackButton } from '../../components/common/BackButton';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { PREGNANCY_JOURNEY_GUIDE } from '../../features/guide/pregnancyJourneyGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';

type Stage = 'early' | 'wk12' | 'stable' | 'late' | 'birth';

interface CategoryItem {
  emoji: string;
  title: string;
  body: string;
}

interface StageContent {
  label: string;
  weeks: string;
  hero: string;        // 섹션 진입 헤드라인
  heroSub: string;
  /** 카테고리별 항목 묶음 */
  sections: { title: string; items: CategoryItem[] }[];
}

const COLOR = {
  bg: '#FCF6F2',
  card: '#FFFFFF',
  border: '#FFE0CC',
  text: '#1C1C1E',
  textSub: '#636366',
  pink: '#E91E63',
  pinkBg: '#FCE4EC',
  accent: '#FF8C5A',
  warmYellow: '#FFF8E1',
};

/* ────────────────────────────────────────────────────────────────────
 * 단계별 콘텐츠 (임신 일반 안내 — 한국 가이드라인 기반)
 * ──────────────────────────────────────────────────────────────────── */
const getStageContent = (t: TFunction): Record<Stage, StageContent> => ({
  early: {
    label: t('pregnancyJourneyDetail.stage.early.label'),
    weeks: t('pregnancyJourneyDetail.stage.early.weeks'),
    hero: t('pregnancyJourneyDetail.stage.early.hero'),
    heroSub: t('pregnancyJourneyDetail.stage.early.heroSub'),
    sections: [
      {
        title: t('pregnancyJourneyDetail.stage.early.sections.supplements.title'),
        items: [
          { emoji: '🌿', title: t('pregnancyJourneyDetail.stage.early.sections.supplements.items.folicAcid.title'), body: t('pregnancyJourneyDetail.stage.early.sections.supplements.items.folicAcid.body') },
          { emoji: '💊', title: t('pregnancyJourneyDetail.stage.early.sections.supplements.items.vitaminD.title'), body: t('pregnancyJourneyDetail.stage.early.sections.supplements.items.vitaminD.body') },
          { emoji: '🐟', title: t('pregnancyJourneyDetail.stage.early.sections.supplements.items.omega3.title'), body: t('pregnancyJourneyDetail.stage.early.sections.supplements.items.omega3.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.early.sections.diet.title'),
        items: [
          { emoji: '🥬', title: t('pregnancyJourneyDetail.stage.early.sections.diet.items.folateFoods.title'), body: t('pregnancyJourneyDetail.stage.early.sections.diet.items.folateFoods.body') },
          { emoji: '🥛', title: t('pregnancyJourneyDetail.stage.early.sections.diet.items.proteinCalcium.title'), body: t('pregnancyJourneyDetail.stage.early.sections.diet.items.proteinCalcium.body') },
          { emoji: '🚫', title: t('pregnancyJourneyDetail.stage.early.sections.diet.items.avoid.title'), body: t('pregnancyJourneyDetail.stage.early.sections.diet.items.avoid.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.early.sections.exercise.title'),
        items: [
          { emoji: '🚶‍♀️', title: t('pregnancyJourneyDetail.stage.early.sections.exercise.items.walking.title'), body: t('pregnancyJourneyDetail.stage.early.sections.exercise.items.walking.body') },
          { emoji: '🧘', title: t('pregnancyJourneyDetail.stage.early.sections.exercise.items.yoga.title'), body: t('pregnancyJourneyDetail.stage.early.sections.exercise.items.yoga.body') },
          { emoji: '⛔', title: t('pregnancyJourneyDetail.stage.early.sections.exercise.items.caution.title'), body: t('pregnancyJourneyDetail.stage.early.sections.exercise.items.caution.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.early.sections.checkups.title'),
        items: [
          { emoji: '📅', title: t('pregnancyJourneyDetail.stage.early.sections.checkups.items.firstVisit.title'), body: t('pregnancyJourneyDetail.stage.early.sections.checkups.items.firstVisit.body') },
          { emoji: '🩸', title: t('pregnancyJourneyDetail.stage.early.sections.checkups.items.bloodTest.title'), body: t('pregnancyJourneyDetail.stage.early.sections.checkups.items.bloodTest.body') },
          { emoji: '📸', title: t('pregnancyJourneyDetail.stage.early.sections.checkups.items.firstUltrasound.title'), body: t('pregnancyJourneyDetail.stage.early.sections.checkups.items.firstUltrasound.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.early.sections.cautions.title'),
        items: [
          { emoji: '🤢', title: t('pregnancyJourneyDetail.stage.early.sections.cautions.items.morningSickness.title'), body: t('pregnancyJourneyDetail.stage.early.sections.cautions.items.morningSickness.body') },
          { emoji: '😴', title: t('pregnancyJourneyDetail.stage.early.sections.cautions.items.fatigue.title'), body: t('pregnancyJourneyDetail.stage.early.sections.cautions.items.fatigue.body') },
          { emoji: '⚠️', title: t('pregnancyJourneyDetail.stage.early.sections.cautions.items.emergency.title'), body: t('pregnancyJourneyDetail.stage.early.sections.cautions.items.emergency.body') },
        ],
      },
    ],
  },

  wk12: {
    label: t('pregnancyJourneyDetail.stage.wk12.label'),
    weeks: t('pregnancyJourneyDetail.stage.wk12.weeks'),
    hero: t('pregnancyJourneyDetail.stage.wk12.hero'),
    heroSub: t('pregnancyJourneyDetail.stage.wk12.heroSub'),
    sections: [
      {
        title: t('pregnancyJourneyDetail.stage.wk12.sections.keyTests.title'),
        items: [
          { emoji: '📸', title: t('pregnancyJourneyDetail.stage.wk12.sections.keyTests.items.nt.title'), body: t('pregnancyJourneyDetail.stage.wk12.sections.keyTests.items.nt.body') },
          { emoji: '🩸', title: t('pregnancyJourneyDetail.stage.wk12.sections.keyTests.items.integratedScreening.title'), body: t('pregnancyJourneyDetail.stage.wk12.sections.keyTests.items.integratedScreening.body') },
          { emoji: '🧬', title: t('pregnancyJourneyDetail.stage.wk12.sections.keyTests.items.nipt.title'), body: t('pregnancyJourneyDetail.stage.wk12.sections.keyTests.items.nipt.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.wk12.sections.changes.title'),
        items: [
          { emoji: '🌅', title: t('pregnancyJourneyDetail.stage.wk12.sections.changes.items.sicknessEasing.title'), body: t('pregnancyJourneyDetail.stage.wk12.sections.changes.items.sicknessEasing.body') },
          { emoji: '⚖️', title: t('pregnancyJourneyDetail.stage.wk12.sections.changes.items.weightGain.title'), body: t('pregnancyJourneyDetail.stage.wk12.sections.changes.items.weightGain.body') },
          { emoji: '🤰', title: t('pregnancyJourneyDetail.stage.wk12.sections.changes.items.uterusPosition.title'), body: t('pregnancyJourneyDetail.stage.wk12.sections.changes.items.uterusPosition.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.wk12.sections.thisPeriodChecklist.title'),
        items: [
          { emoji: '🏥', title: t('pregnancyJourneyDetail.stage.wk12.sections.thisPeriodChecklist.items.regularCheckup.title'), body: t('pregnancyJourneyDetail.stage.wk12.sections.thisPeriodChecklist.items.regularCheckup.body') },
          { emoji: '👔', title: t('pregnancyJourneyDetail.stage.wk12.sections.thisPeriodChecklist.items.workNotice.title'), body: t('pregnancyJourneyDetail.stage.wk12.sections.thisPeriodChecklist.items.workNotice.body') },
          { emoji: '📚', title: t('pregnancyJourneyDetail.stage.wk12.sections.thisPeriodChecklist.items.learning.title'), body: t('pregnancyJourneyDetail.stage.wk12.sections.thisPeriodChecklist.items.learning.body') },
        ],
      },
    ],
  },

  stable: {
    label: t('pregnancyJourneyDetail.stage.stable.label'),
    weeks: t('pregnancyJourneyDetail.stage.stable.weeks'),
    hero: t('pregnancyJourneyDetail.stage.stable.hero'),
    heroSub: t('pregnancyJourneyDetail.stage.stable.heroSub'),
    sections: [
      {
        title: t('pregnancyJourneyDetail.stage.stable.sections.supplements.title'),
        items: [
          { emoji: '🦴', title: t('pregnancyJourneyDetail.stage.stable.sections.supplements.items.calcium.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.supplements.items.calcium.body') },
          { emoji: '🩸', title: t('pregnancyJourneyDetail.stage.stable.sections.supplements.items.iron.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.supplements.items.iron.body') },
          { emoji: '🐟', title: t('pregnancyJourneyDetail.stage.stable.sections.supplements.items.dha.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.supplements.items.dha.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.stable.sections.diet.title'),
        items: [
          { emoji: '🥩', title: t('pregnancyJourneyDetail.stage.stable.sections.diet.items.moreProtein.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.diet.items.moreProtein.body') },
          { emoji: '🥕', title: t('pregnancyJourneyDetail.stage.stable.sections.diet.items.vitaminA.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.diet.items.vitaminA.body') },
          { emoji: '🧂', title: t('pregnancyJourneyDetail.stage.stable.sections.diet.items.sodium.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.diet.items.sodium.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.stable.sections.exercise.title'),
        items: [
          { emoji: '🏊', title: t('pregnancyJourneyDetail.stage.stable.sections.exercise.items.swimming.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.exercise.items.swimming.body') },
          { emoji: '🧘', title: t('pregnancyJourneyDetail.stage.stable.sections.exercise.items.yogaPilates.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.exercise.items.yogaPilates.body') },
          { emoji: '🚶‍♀️', title: t('pregnancyJourneyDetail.stage.stable.sections.exercise.items.moreWalking.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.exercise.items.moreWalking.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.stable.sections.checkups.title'),
        items: [
          { emoji: '🧪', title: t('pregnancyJourneyDetail.stage.stable.sections.checkups.items.quadTest.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.checkups.items.quadTest.body') },
          { emoji: '📸', title: t('pregnancyJourneyDetail.stage.stable.sections.checkups.items.detailedUltrasound.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.checkups.items.detailedUltrasound.body') },
          { emoji: '🩸', title: t('pregnancyJourneyDetail.stage.stable.sections.checkups.items.glucoseTest1.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.checkups.items.glucoseTest1.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.stable.sections.enjoy.title'),
        items: [
          { emoji: '🦶', title: t('pregnancyJourneyDetail.stage.stable.sections.enjoy.items.firstKick.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.enjoy.items.firstKick.body') },
          { emoji: '🎵', title: t('pregnancyJourneyDetail.stage.stable.sections.enjoy.items.prenatalEducation.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.enjoy.items.prenatalEducation.body') },
          { emoji: '📷', title: t('pregnancyJourneyDetail.stage.stable.sections.enjoy.items.maternityPhoto.title'), body: t('pregnancyJourneyDetail.stage.stable.sections.enjoy.items.maternityPhoto.body') },
        ],
      },
    ],
  },

  late: {
    label: t('pregnancyJourneyDetail.stage.late.label'),
    weeks: t('pregnancyJourneyDetail.stage.late.weeks'),
    hero: t('pregnancyJourneyDetail.stage.late.hero'),
    heroSub: t('pregnancyJourneyDetail.stage.late.heroSub'),
    sections: [
      {
        title: t('pregnancyJourneyDetail.stage.late.sections.supplements.title'),
        items: [
          { emoji: '🦴', title: t('pregnancyJourneyDetail.stage.late.sections.supplements.items.calciumVitaminD.title'), body: t('pregnancyJourneyDetail.stage.late.sections.supplements.items.calciumVitaminD.body') },
          { emoji: '🩸', title: t('pregnancyJourneyDetail.stage.late.sections.supplements.items.ironBoost.title'), body: t('pregnancyJourneyDetail.stage.late.sections.supplements.items.ironBoost.body') },
          { emoji: '🥥', title: t('pregnancyJourneyDetail.stage.late.sections.supplements.items.magnesium.title'), body: t('pregnancyJourneyDetail.stage.late.sections.supplements.items.magnesium.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.late.sections.diet.title'),
        items: [
          { emoji: '🍚', title: t('pregnancyJourneyDetail.stage.late.sections.diet.items.smallFrequentMeals.title'), body: t('pregnancyJourneyDetail.stage.late.sections.diet.items.smallFrequentMeals.body') },
          { emoji: '🌾', title: t('pregnancyJourneyDetail.stage.late.sections.diet.items.fiber.title'), body: t('pregnancyJourneyDetail.stage.late.sections.diet.items.fiber.body') },
          { emoji: '💧', title: t('pregnancyJourneyDetail.stage.late.sections.diet.items.hydration.title'), body: t('pregnancyJourneyDetail.stage.late.sections.diet.items.hydration.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.late.sections.exercise.title'),
        items: [
          { emoji: '🤸‍♀️', title: t('pregnancyJourneyDetail.stage.late.sections.exercise.items.kegel.title'), body: t('pregnancyJourneyDetail.stage.late.sections.exercise.items.kegel.body') },
          { emoji: '🧘', title: t('pregnancyJourneyDetail.stage.late.sections.exercise.items.breathingPractice.title'), body: t('pregnancyJourneyDetail.stage.late.sections.exercise.items.breathingPractice.body') },
          { emoji: '🚶‍♀️', title: t('pregnancyJourneyDetail.stage.late.sections.exercise.items.lightWalking.title'), body: t('pregnancyJourneyDetail.stage.late.sections.exercise.items.lightWalking.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.late.sections.checkups.title'),
        items: [
          { emoji: '👶', title: t('pregnancyJourneyDetail.stage.late.sections.checkups.items.growthUltrasound.title'), body: t('pregnancyJourneyDetail.stage.late.sections.checkups.items.growthUltrasound.body') },
          { emoji: '🦠', title: t('pregnancyJourneyDetail.stage.late.sections.checkups.items.gbsTest.title'), body: t('pregnancyJourneyDetail.stage.late.sections.checkups.items.gbsTest.body') },
          { emoji: '💉', title: t('pregnancyJourneyDetail.stage.late.sections.checkups.items.tdap.title'), body: t('pregnancyJourneyDetail.stage.late.sections.checkups.items.tdap.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.late.sections.birthPrep.title'),
        items: [
          { emoji: '🧳', title: t('pregnancyJourneyDetail.stage.late.sections.birthPrep.items.birthBag.title'), body: t('pregnancyJourneyDetail.stage.late.sections.birthPrep.items.birthBag.body') },
          { emoji: '🏥', title: t('pregnancyJourneyDetail.stage.late.sections.birthPrep.items.hospitalRegistration.title'), body: t('pregnancyJourneyDetail.stage.late.sections.birthPrep.items.hospitalRegistration.body') },
          { emoji: '🏠', title: t('pregnancyJourneyDetail.stage.late.sections.birthPrep.items.nurserySetup.title'), body: t('pregnancyJourneyDetail.stage.late.sections.birthPrep.items.nurserySetup.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.late.sections.warningSigns.title'),
        items: [
          { emoji: '🦵', title: t('pregnancyJourneyDetail.stage.late.sections.warningSigns.items.severeSwelling.title'), body: t('pregnancyJourneyDetail.stage.late.sections.warningSigns.items.severeSwelling.body') },
          { emoji: '👶', title: t('pregnancyJourneyDetail.stage.late.sections.warningSigns.items.reducedMovement.title'), body: t('pregnancyJourneyDetail.stage.late.sections.warningSigns.items.reducedMovement.body') },
          { emoji: '💧', title: t('pregnancyJourneyDetail.stage.late.sections.warningSigns.items.fluidLeak.title'), body: t('pregnancyJourneyDetail.stage.late.sections.warningSigns.items.fluidLeak.body') },
        ],
      },
    ],
  },

  birth: {
    label: t('pregnancyJourneyDetail.stage.birth.label'),
    weeks: t('pregnancyJourneyDetail.stage.birth.weeks'),
    hero: t('pregnancyJourneyDetail.stage.birth.hero'),
    heroSub: t('pregnancyJourneyDetail.stage.birth.heroSub'),
    sections: [
      {
        title: t('pregnancyJourneyDetail.stage.birth.sections.contractionSigns.title'),
        items: [
          { emoji: '🌊', title: t('pregnancyJourneyDetail.stage.birth.sections.contractionSigns.items.regularContractions.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.contractionSigns.items.regularContractions.body') },
          { emoji: '🩸', title: t('pregnancyJourneyDetail.stage.birth.sections.contractionSigns.items.showSpotting.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.contractionSigns.items.showSpotting.body') },
          { emoji: '💦', title: t('pregnancyJourneyDetail.stage.birth.sections.contractionSigns.items.waterBreaking.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.contractionSigns.items.waterBreaking.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.birth.sections.finalBagCheck.title'),
        items: [
          { emoji: '📋', title: t('pregnancyJourneyDetail.stage.birth.sections.finalBagCheck.items.documents.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.finalBagCheck.items.documents.body') },
          { emoji: '👕', title: t('pregnancyJourneyDetail.stage.birth.sections.finalBagCheck.items.momItems.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.finalBagCheck.items.momItems.body') },
          { emoji: '👶', title: t('pregnancyJourneyDetail.stage.birth.sections.finalBagCheck.items.babyItems.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.finalBagCheck.items.babyItems.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.birth.sections.breathing.title'),
        items: [
          { emoji: '🌬️', title: t('pregnancyJourneyDetail.stage.birth.sections.breathing.items.earlyLabor.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.breathing.items.earlyLabor.body') },
          { emoji: '😤', title: t('pregnancyJourneyDetail.stage.birth.sections.breathing.items.strongContractions.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.breathing.items.strongContractions.body') },
          { emoji: '💪', title: t('pregnancyJourneyDetail.stage.birth.sections.breathing.items.pushing.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.breathing.items.pushing.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.birth.sections.atHospital.title'),
        items: [
          { emoji: '📝', title: t('pregnancyJourneyDetail.stage.birth.sections.atHospital.items.admission.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.atHospital.items.admission.body') },
          { emoji: '💉', title: t('pregnancyJourneyDetail.stage.birth.sections.atHospital.items.epidural.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.atHospital.items.epidural.body') },
          { emoji: '🤝', title: t('pregnancyJourneyDetail.stage.birth.sections.atHospital.items.support.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.atHospital.items.support.body') },
        ],
      },
      {
        title: t('pregnancyJourneyDetail.stage.birth.sections.rightAfterBirth.title'),
        items: [
          { emoji: '👶', title: t('pregnancyJourneyDetail.stage.birth.sections.rightAfterBirth.items.kangarooCare.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.rightAfterBirth.items.kangarooCare.body') },
          { emoji: '🤱', title: t('pregnancyJourneyDetail.stage.birth.sections.rightAfterBirth.items.colostrum.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.rightAfterBirth.items.colostrum.body') },
          { emoji: '🏥', title: t('pregnancyJourneyDetail.stage.birth.sections.rightAfterBirth.items.postpartumStay.title'), body: t('pregnancyJourneyDetail.stage.birth.sections.rightAfterBirth.items.postpartumStay.body') },
        ],
      },
    ],
  },
});

const getStageLabels = (t: TFunction): Record<Stage, string> => ({
  early: t('pregnancyJourneyDetail.stageLabels.early'),
  wk12: t('pregnancyJourneyDetail.stageLabels.wk12'),
  stable: t('pregnancyJourneyDetail.stageLabels.stable'),
  late: t('pregnancyJourneyDetail.stageLabels.late'),
  birth: t('pregnancyJourneyDetail.stageLabels.birth'),
});

export default function PregnancyJourneyDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const stageParam = (params.stage as string) ?? 'stable';
  const stage: Stage = (['early', 'wk12', 'stable', 'late', 'birth'].includes(stageParam)
    ? stageParam
    : 'stable') as Stage;
  const stageContent = useMemo(() => getStageContent(t), [t]);
  const stageLabels = useMemo(() => getStageLabels(t), [t]);
  const content = stageContent[stage];

  // 사용 가이드 (첫 진입 1회 자동표시 + ? 버튼 재열람)
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    shouldAutoShowGuide('pregnancy_journey').then((sh) => { if (sh) setGuideVisible(true); });
  }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('pregnancy_journey'); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: stageLabels[stage],
          headerStyle: { backgroundColor: COLOR.bg },
          headerTitleStyle: { fontSize: 16, fontWeight: '700', color: COLOR.text },
          headerTintColor: COLOR.pink,
          headerLeft: () => <BackButton />,
          headerRight: () => <GuideButton onPress={() => setGuideVisible(true)} color={COLOR.pink} />,
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{content.weeks}</Text>
          </View>
          <Text style={styles.heroTitle}>{content.hero}</Text>
          <Text style={styles.heroSub}>{content.heroSub}</Text>
        </View>

        {/* 섹션들 */}
        {content.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <View
                  key={item.title}
                  style={[
                    styles.itemRow,
                    idx < section.items.length - 1 && styles.itemRowDivider,
                  ]}
                >
                  <Text style={styles.itemEmoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemBody}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {t('pregnancyJourneyDetail.disclaimer')}
          </Text>
        </View>

        <MedicalCitation
          sources={[
            { label: t('pregnancyJourneyDetail.citationChildcarePortal'), url: 'https://www.childcare.go.kr' },
            { label: t('pregnancyJourneyDetail.citationKsog'), url: 'https://www.ksog.org' },
          ]}
        />
      </ScrollView>
      <GuideCarousel visible={guideVisible} pages={PREGNANCY_JOURNEY_GUIDE} onClose={closeGuide} onComplete={closeGuide} accent={COLOR.pink} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'flex-start',
  },
  heroBadge: {
    backgroundColor: COLOR.pinkBg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLOR.pink,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    color: COLOR.textSub,
    fontWeight: '600',
    lineHeight: 19,
  },

  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: COLOR.card,
    borderRadius: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  itemRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F4ECE6',
  },
  itemEmoji: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
    marginTop: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLOR.text,
    marginBottom: 3,
  },
  itemBody: {
    fontSize: 12,
    color: COLOR.textSub,
    fontWeight: '500',
    lineHeight: 17,
  },

  disclaimer: {
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#7E5400',
    fontWeight: '700',
    lineHeight: 16,
  },
});
