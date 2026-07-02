import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FONT_SIZE, SPACING } from '../../constants/theme';

function getMessages(t: TFunction): string[] {
  return [
    '',
    t('components.analyzingScreen.messages.startEngine'),
    t('components.analyzingScreen.messages.analyzeEnergy'),
    t('components.analyzingScreen.messages.collectResponses'),
    t('components.analyzingScreen.messages.crossValidate'),
    t('components.analyzingScreen.messages.classifyType'),
    t('components.analyzingScreen.messages.generatePersonalityProfile'),
    t('components.analyzingScreen.messages.analyzeStudyStyle'),
    t('components.analyzingScreen.messages.exploreBestSubjects'),
    t('components.analyzingScreen.messages.identifyWeakAreas'),
    t('components.analyzingScreen.messages.predictFutureFields'),
    t('components.analyzingScreen.messages.findSportsMatch'),
    t('components.analyzingScreen.messages.matchAcademyStyle'),
    t('components.analyzingScreen.messages.analyzeNutrition'),
    t('components.analyzingScreen.messages.designEducationDirection'),
    t('components.analyzingScreen.messages.discoverTalent'),
    t('components.analyzingScreen.messages.writeParentingTip'),
    t('components.analyzingScreen.messages.completeSocialProfile'),
    t('components.analyzingScreen.messages.finalizeGuide'),
    t('components.analyzingScreen.messages.done'),
  ];
}

const STEP_DURATION = 1000;

interface Props {
  childName: string;
}

export function AnalyzingScreen({ childName }: Props) {
  const { t } = useTranslation();
  const messages = useRef(getMessages(t)).current;
  const [stepIdx, setStepIdx] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const msgFade = useRef(new Animated.Value(0)).current;
  const imgFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(imgFade, {
      toValue: 1, duration: 800, useNativeDriver: true,
    }).start();

    Animated.timing(progressAnim, {
      toValue: 1, duration: STEP_DURATION * messages.length, useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setStepIdx((prev) => {
        if (prev < messages.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, STEP_DURATION);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    msgFade.setValue(0);
    Animated.timing(msgFade, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();
  }, [stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('components.analyzingScreen.screenTitle'), headerShown: false }} />

      <Animated.View style={{ opacity: imgFade }}>
        <Image
          source={require('../../assets/analyzing.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>

      <Text style={styles.title}>{t('components.analyzingScreen.title', { name: childName })}</Text>

      <Animated.Text style={[styles.message, { opacity: msgFade }]}>
        {messages[stepIdx]}
      </Animated.Text>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  image: { width: 180, height: 180, marginBottom: SPACING.lg },
  title: {
    fontSize: FONT_SIZE.xl, fontWeight: '700',
    color: '#333', textAlign: 'center', marginBottom: SPACING.md,
  },
  message: {
    fontSize: FONT_SIZE.md, color: '#888',
    textAlign: 'center', minHeight: 44, lineHeight: 22,
  },
  progressTrack: {
    width: '80%', height: 6, borderRadius: 3,
    backgroundColor: '#EDE4DB', marginTop: SPACING.xl, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: '#6366F1',
  },
});
