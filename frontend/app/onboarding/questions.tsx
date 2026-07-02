import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, ScrollView, Image, StyleSheet,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { childApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS } from '../../constants/theme';
import { styles } from '../../constants/onboardingStyles';
import {
  type SurveyQuestion,
  getAgeGroup,
  getSurveyQuestions,
  LIKERT_OPTIONS,
} from '../../constants/onboardingHelpers';
import { calculateTemperament } from '../../constants/onboardingQuestions';
import { AnalyzingScreen } from '../../components/onboarding/AnalyzingScreen';
import { captureError } from '../../services/sentry';
import type { TFunction } from 'i18next';

/**
 * 5 기질 옵션 — 사용자가 질문에 가장 가까운 기질 1개를 선택.
 * 선택한 기질이 question.temperamentTarget 과 일치하면 Likert 5,
 * 다르면 Likert 1로 변환되어 기존 백엔드 점수 계산과 호환된다.
 */
type TraitKey = 'explorer' | 'active' | 'harmony' | 'analyst' | 'sensitive';

const getTraitMeta = (
  t: TFunction,
): Record<TraitKey, { main: string; sub: string; icon: ImageSourcePropType }> => ({
  analyst:   { main: t('onboardingQuestions.trait.analyst.main'), sub: t('onboardingQuestions.trait.analyst.sub'), icon: require('../../assets/quick-report.png') },
  explorer:  { main: t('onboardingQuestions.trait.explorer.main'), sub: t('onboardingQuestions.trait.explorer.sub'), icon: require('../../assets/quick-sprout.png') },
  harmony:   { main: t('onboardingQuestions.trait.harmony.main'), sub: t('onboardingQuestions.trait.harmony.sub'), icon: require('../../assets/icon-heart.png') },
  active:    { main: t('onboardingQuestions.trait.active.main'), sub: t('onboardingQuestions.trait.active.sub'), icon: require('../../assets/academy-sports.png') },
  sensitive: { main: t('onboardingQuestions.trait.sensitive.main'), sub: t('onboardingQuestions.trait.sensitive.sub'), icon: require('../../assets/preg-leaf.png') },
});

/** 기본 옵션 순서 — question.options 가 없을 때 fallback */
const DEFAULT_TRAIT_ORDER: TraitKey[] = ['analyst', 'explorer', 'harmony', 'active', 'sensitive'];

// LIKERT_OPTIONS는 기존 백엔드/계산 로직과의 호환을 위해 import만 유지
void LIKERT_OPTIONS;

export default function QuestionsScreen() {
  const { t } = useTranslation();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const updateChild = useChildStore((s) => s.updateChild);
  const child = children.find((c) => c.id === childId);

  const ageGroup = child ? getAgeGroup(child.ageInfo.months) : 'toddler';
  const questions: SurveyQuestion[] = getSurveyQuestions(t, ageGroup);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  // 사용자가 각 질문에서 선택한 기질 (UI 복원용)
  const [pickedTraits, setPickedTraits] = useState<Record<string, TraitKey>>({});
  const [analyzing, setAnalyzing] = useState(false);

  const total = questions.length;
  const current = questions[currentIdx];
  const progress = total > 0 ? (currentIdx + 1) / total : 0;
  const currentPicked = current ? pickedTraits[current.id] : undefined;

  // 6개월 미만: 행동 설문은 답하기 어려움 → 안내 화면을 보여주고,
  // 버튼을 누르면 생년월일·시간 기반(빈 답변)으로만 분석. (기질은 등록 시 이미 계산됨)
  const isInfantSkip = !!child && child.ageInfo.months < 6;

  const runInfantAnalyze = async () => {
    if (analyzing || !childId) return;
    setAnalyzing(true);
    try {
      const res = await childApi.analyze(childId, []); // 빈 답변 → 생년월일 기반
      const updated = res.data?.data;
      if (updated) {
        updateChild(updated);
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (e) {
      captureError(e, { ctx: 'onboarding/questions/infant-skip', childId });
    }
    router.replace({ pathname: '/onboarding/analysis-report', params: { childId } });
  };

  const handleBack = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const handleSelect = (pickedTrait: TraitKey) => {
    if (!current) return;
    // 선택한 기질이 question.temperamentTarget과 일치하면 5 (강한 동의), 아니면 1
    const likertValue = pickedTrait === current.temperamentTarget ? 5 : 1;
    const newAnswers = { ...answers, [current.id]: likertValue };
    const newPicked = { ...pickedTraits, [current.id]: pickedTrait };
    setAnswers(newAnswers);
    setPickedTraits(newPicked);

    // 짧은 딜레이로 선택 피드백 보여주고 다음 문항으로 이동 (마지막이면 제출)
    if (currentIdx < total - 1) {
      setTimeout(() => setCurrentIdx((prev) => prev + 1), 220);
    } else {
      setTimeout(() => submitAnswers(newAnswers), 220);
    }
  };

  const apiDoneRef = useRef(false);

  const submitAnswers = async (finalAnswers: Record<string, number>) => {
    setAnalyzing(true);
    apiDoneRef.current = false;

    // Calculate temperament locally for UI display
    calculateTemperament(finalAnswers);

    // Fire API call immediately (runs during loading animation)
    const apiCall = (async () => {
      try {
        const answerList = questions.map((q) => ({
          questionId: q.id,
          answer: finalAnswers[q.id] ?? 0,
        }));
        const res = await childApi.analyze(childId!, answerList);
        const updatedChild = res.data?.data;
        if (updatedChild) {
          updateChild(updatedChild);
          // 스토어 전파 보장
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (e) {
        // 분석 실패 시에도 타이머 후 이동하되, 실패를 조용히 삼키지 않고 기록.
        // (analysis-report 화면이 서버에서 재조회/재시도·다시분석 경로 제공)
        captureError(e, { ctx: 'onboarding/questions/analyze', childId });
      } finally {
        apiDoneRef.current = true;
      }
    })();

    // Wait minimum 15 seconds for premium feel, then navigate
    const timer = new Promise((r) => setTimeout(r, 15000));
    await Promise.all([apiCall, timer]);

    router.replace({
      pathname: '/onboarding/analysis-report',
      params: { childId },
    });
  };

  if (questions.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: t('onboardingQuestions.preparingTitle'), headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{t('onboardingQuestions.preparingQuestions')}</Text>
      </View>
    );
  }

  if (analyzing) {
    return <AnalyzingScreen childName={child?.name ?? ''} />;
  }

  // 6개월 미만: 행동 설문 대신 생년월일·시간 기반 분석임을 안내 → 버튼 누르면 분석.
  if (isInfantSkip) {
    return (
      <View style={es.wrap}>
        <Stack.Screen options={{ title: t('onboardingQuestions.temperamentAnalysisTitle'), headerShown: false }} />
        <View style={es.card}>
          <Text style={es.emoji}>👶</Text>
          <Text style={es.title}>{t('onboardingQuestions.infantSkip.title')}</Text>
          <Text style={es.body}>
            {t('onboardingQuestions.infantSkip.bodyBefore')}{'\n'}
            {t('onboardingQuestions.infantSkip.bodyMiddlePrefix')}
            <Text style={es.em}>{t('onboardingQuestions.infantSkip.bodyEmphasis')}</Text>
            {t('onboardingQuestions.infantSkip.bodyMiddleSuffix')}{'\n'}
            {t('onboardingQuestions.infantSkip.bodyAfter')}
          </Text>
          <Text style={es.sub}>
            {t('onboardingQuestions.infantSkip.subBefore')}{'\n'}{t('onboardingQuestions.infantSkip.subAfter')}
          </Text>
          <TouchableOpacity style={es.btn} onPress={runInfantAnalyze} activeOpacity={0.85}>
            <Text style={es.btnText}>{t('onboardingQuestions.infantSkip.button')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!current) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('onboardingQuestions.screenTitle'), headerShown: false }} />

      {/* Top row: back arrow + progress */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[styles.topBackBtn, currentIdx === 0 && styles.topBackBtnHidden]}
          onPress={handleBack}
          disabled={currentIdx === 0}
          activeOpacity={0.7}
        >
          <Text style={styles.topBackArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{currentIdx + 1} / {total}</Text>
        </View>
      </View>

      {/* Question */}
      <View style={styles.questionArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.questionScroll}
        >
          {current.category ? (
            <Text style={styles.categoryLabel}>{current.category}</Text>
          ) : null}
          <Text style={styles.qText}>{current.question}</Text>

          <View style={styles.optionsWrap}>
            {(current.options
              ? current.options.map((o) => ({ trait: o.trait as TraitKey, behavior: o.text }))
              : DEFAULT_TRAIT_ORDER.map((trait) => ({ trait, behavior: '' }))
            ).map((opt) => {
              const meta = getTraitMeta(t)[opt.trait];
              const selected = currentPicked === opt.trait;
              // 시나리오 행동 텍스트만 표시 — 기질 라벨(관찰형/신중함 등)은 사용자 혼란 유발해 제거 (2026-05-08)
              const mainText = opt.behavior || meta.main;
              return (
                <TouchableOpacity
                  key={opt.trait}
                  style={[styles.optionCard, selected && styles.optionCardSelected]}
                  onPress={() => handleSelect(opt.trait)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.optionEmojiWrap, selected && styles.optionEmojiWrapSelected]}>
                    <Image source={meta.icon} style={styles.optionIcon} resizeMode="contain" />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionMain} numberOfLines={3}>{mainText}</Text>
                  </View>
                  <View style={[styles.optionCheck, selected && styles.optionCheckSelected]}>
                    {selected ? <Text style={styles.optionCheckMark}>{'✓'}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* 건너뛰기 (단, 다음으로 버튼 없음 — 선택 시 자동 이동) */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={styles.skipLink}
          onPress={() => router.replace('/(main)/home')}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>{t('onboardingQuestions.skipToHome')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 6개월 미만 안내 화면 스타일
const es = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FAFAF8', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 420, alignItems: 'center' },
  emoji: { fontSize: 52, marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 16 },
  body: { fontSize: 15, lineHeight: 24, color: '#444', textAlign: 'center', marginBottom: 14 },
  em: { fontWeight: '800', color: '#FF8C5A' },
  sub: { fontSize: 13, lineHeight: 20, color: '#9CA3AF', textAlign: 'center', marginBottom: 30 },
  btn: { backgroundColor: '#FF8C5A', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 40, alignItems: 'center', alignSelf: 'stretch' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
