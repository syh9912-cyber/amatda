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
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';

const PRESETS = [
  { label: '5분', seconds: 5 * 60 },
  { label: '10분', seconds: 10 * 60 },
  { label: '15분', seconds: 15 * 60 },
  { label: '20분', seconds: 20 * 60 },
];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerScreen() {
  const [duration, setDuration] = useState(15 * 60);
  const [remaining, setRemaining] = useState(15 * 60);
  const [running, setRunning] = useState(false);
  const [selectedChild, setSelectedChildIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const children = useChildStore((s) => s.children);

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
          Alert.alert(
            'Quality Time 완료!',
            `${children[selectedChild]?.name ?? '아이'}와의 소중한 시간이었어요 💕`
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
      <Stack.Screen options={{ title: 'Quality Time', headerShown: true, headerLeft: () => <BackButton /> }} />

      <Text style={styles.subtitle}>
        형제자매와 1:1 시간을 보내세요
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
        <View style={[styles.progressRing, { opacity: progress }]} />
        <Text style={styles.timerText}>{formatTime(remaining)}</Text>
        <Text style={styles.timerLabel}>
          {running ? '진행 중...' : remaining === 0 ? '완료!' : '준비'}
        </Text>
      </View>

      {/* 컨트롤 */}
      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetText}>초기화</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainBtn, running && styles.pauseBtn]}
          onPress={running ? pause : start}
        >
          <Text style={styles.mainBtnText}>
            {running ? '일시정지' : remaining === 0 ? '다시 시작' : '시작'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 팁 */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Quality Time 팁</Text>
        <Text style={styles.tipText}>
          • 핸드폰을 내려놓고 아이에게 온전히 집중하세요{'\n'}
          • 아이가 주도하는 놀이를 따라가 주세요{'\n'}
          • 하루 15분이면 충분합니다{'\n'}
          • 형제가 있다면 각각 1:1 시간을 만들어주세요
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
  progressRing: {
    position: 'absolute', width: '100%', height: '100%', borderRadius: 100,
    backgroundColor: COLORS.primaryLight,
  },
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
