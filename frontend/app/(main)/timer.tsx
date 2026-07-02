import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';

function getPresets(t: TFunction) {
  return [
    { label: t('timer.presets.min', { count: 5 }), seconds: 5 * 60 },
    { label: t('timer.presets.min', { count: 10 }), seconds: 10 * 60 },
    { label: t('timer.presets.min', { count: 15 }), seconds: 15 * 60 },
    { label: t('timer.presets.min', { count: 20 }), seconds: 20 * 60 },
  ];
}

// 진행 링(SVG) — 반지름 90, 둘레 기준 strokeDashoffset로 실제 진행 표시
const RING_R = 90;
const RING_CIRC = 2 * Math.PI * RING_R;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerScreen() {
  const { t } = useTranslation();
  const PRESETS = getPresets(t);
  const [duration, setDuration] = useState(15 * 60);
  const [remaining, setRemaining] = useState(15 * 60);
  const [running, setRunning] = useState(false);
  const [selectedChild, setSelectedChildIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const children = useChildStore((s) => s.children);
  // 인터벌 콜백이 start 시점의 selectedChild를 캡처해 stale 되는 문제 방지 — ref로 미러링
  const selectedChildRef = useRef(selectedChild);
  useEffect(() => {
    selectedChildRef.current = selectedChild;
  }, [selectedChild]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = () => {
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          Vibration.vibrate([0, 500, 200, 500]);
          // 최신 선택 아이 이름을 ref+store에서 읽어 stale 방지
          const doneName =
            useChildStore.getState().children[selectedChildRef.current]?.name ?? t('timer.defaultChildName');
          Alert.alert(
            t('timer.completeAlert.title'),
            t('timer.completeAlert.message', { name: doneName })
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  };

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setRemaining(duration);
  };

  const selectPreset = (seconds: number) => {
    if (running) return;
    setDuration(seconds);
    setRemaining(seconds);
  };

  const progress = duration > 0 ? (duration - remaining) / duration : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('timer.headerTitle'), headerShown: true, headerLeft: () => <BackButton /> }} />

      <Text style={styles.subtitle}>
        {t('timer.subtitle')}
      </Text>

      {/* 자녀 선택 */}
      {children.length > 1 && (
        <View style={styles.childRow}>
          {children.map((child, idx) => (
            <TouchableOpacity
              key={child.id}
              style={[styles.childChip, idx === selectedChild && styles.childActive]}
              onPress={() => setSelectedChildIdx(idx)}
            >
              <Text style={[styles.childText, idx === selectedChild && styles.childTextActive]}>
                {child.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 프리셋 */}
      <View style={styles.presetRow}>
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p.seconds}
            style={[styles.presetBtn, duration === p.seconds && styles.presetActive]}
            onPress={() => selectPreset(p.seconds)}
          >
            <Text style={[styles.presetText, duration === p.seconds && styles.presetTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 타이머 원형 표시 */}
      <View style={styles.timerCircle}>
        <Svg width={200} height={200} style={styles.progressSvg}>
          <Circle cx={100} cy={100} r={RING_R} stroke={COLORS.border} strokeWidth={6} fill="none" />
          <Circle
            cx={100}
            cy={100}
            r={RING_R}
            stroke={COLORS.primary}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={RING_CIRC * (1 - progress)}
            transform="rotate(-90 100 100)"
          />
        </Svg>
        <Text style={styles.timerText}>{formatTime(remaining)}</Text>
        <Text style={styles.timerLabel}>
          {running ? t('timer.status.running') : remaining === 0 ? t('timer.status.done') : t('timer.status.ready')}
        </Text>
      </View>

      {/* 컨트롤 */}
      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetText}>{t('timer.resetButton')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainBtn, running && styles.pauseBtn]}
          onPress={running ? pause : start}
        >
          <Text style={styles.mainBtnText}>
            {running ? t('timer.mainButton.pause') : remaining === 0 ? t('timer.mainButton.restart') : t('timer.mainButton.start')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 팁 */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>{t('timer.tipCard.title')}</Text>
        <Text style={styles.tipText}>
          {t('timer.tipCard.tip1')}{'\n'}
          {t('timer.tipCard.tip2')}{'\n'}
          {t('timer.tipCard.tip3')}{'\n'}
          {t('timer.tipCard.tip4')}
        </Text>
      </View>
      <AdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.lg },
  subtitle: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary,
    textAlign: 'center', marginBottom: SPACING.lg,
  },
  childRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: SPACING.sm, marginBottom: SPACING.lg,
  },
  childChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
  },
  childActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  childText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  childTextActive: { color: COLORS.primary, fontWeight: '600' },
  presetRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: SPACING.sm, marginBottom: SPACING.xl,
  },
  presetBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  presetActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  presetTextActive: { color: '#FFF', fontWeight: '600' },
  timerCircle: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: SPACING.xl,
    borderWidth: 4, borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
  },
  progressSvg: { position: 'absolute' },
  timerText: { fontSize: 40, fontWeight: '700', color: COLORS.text },
  timerLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  controlRow: {
    flexDirection: 'row', justifyContent: 'center', gap: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  resetBtn: {
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  resetText: { color: COLORS.textSecondary, fontWeight: '500' },
  mainBtn: {
    paddingHorizontal: SPACING.xl * 1.5, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, backgroundColor: COLORS.primary,
  },
  pauseBtn: { backgroundColor: COLORS.secondary },
  mainBtnText: { color: '#FFF', fontWeight: '600', fontSize: FONT_SIZE.md },
  tipCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md,
  },
  tipTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  tipText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 20 },
});
