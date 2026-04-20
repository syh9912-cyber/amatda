import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUIDE_SHOWN_KEY = 'amatda_onboarding_guide_shown';
const { width: SW } = Dimensions.get('window');

 
const MASCOT = require('../../assets/mascot-waving.png') as number;
 

interface Step {
  title: string;
  desc: string;
  icon: string;
}

const STEPS: Step[] = [
  { title: '상담이모', desc: '아이 기질에 맞는 맞춤 상담을\n언제든 받을 수 있어요\n울음 분석, 대변 분석도 상담이모에서!', icon: '💬' },
  { title: '육아 기록', desc: '수유, 수면, 배변을\n간편하게 기록하세요', icon: '📋' },
  { title: '성장 타임라인', desc: '아이의 소중한 순간을\n사진과 함께 남겨보세요', icon: '📸' },
  { title: '가족피드', desc: '가족끼리 소중한 순간을\n공유하고 함께 기록해보세요', icon: '👨‍👩‍👧' },
];

export function OnboardingGuide() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(GUIDE_SHOWN_KEY).then((v) => {
      if (!v) setVisible(true);
    }).catch(() => {});
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = async () => {
    setVisible(false);
    await AsyncStorage.setItem(GUIDE_SHOWN_KEY, '1');
  };

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <TouchableOpacity style={s.skipBtn} onPress={handleClose}>
            <Text style={s.skipText}>건너뛰기</Text>
          </TouchableOpacity>

          {step === 0 && (
            <Image source={MASCOT} style={s.mascot} resizeMode="contain" />
          )}

          <Text style={s.icon}>{current.icon}</Text>
          <Text style={s.title}>{current.title}</Text>
          <Text style={s.desc}>{current.desc}</Text>

          {/* Dots */}
          <View style={s.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[s.dot, i === step && s.dotActive]} />
            ))}
          </View>

          <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.8}>
            <Text style={s.nextText}>{isLast ? '시작하기' : '다음'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: SW - 64,
  },
  skipBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
  },
  skipText: {
    fontSize: 13,
    color: '#ABABAB',
    fontWeight: '500',
  },
  mascot: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: '#636366',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8DDD0',
  },
  dotActive: {
    backgroundColor: '#FF8C5A',
    width: 24,
  },
  nextBtn: {
    backgroundColor: '#FF8C5A',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
