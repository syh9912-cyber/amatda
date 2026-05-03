import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { trackerApi } from '../services/api';

const IC_MASCOT = require('../assets/mascot-happy.png') as number;
const IC_MIC = require('../assets/icon-mic.png') as number;

interface ParsedRecord {
  type: 'diaper' | 'feeding' | 'sleep';
  subType: string;
  time?: string;
  amount?: number;
  duration?: number;
  note?: string;
  childName?: string;
}

const SUBTYPE_LABELS: Record<string, string> = {
  pee: '소변', poop: '대변', both: '소변+대변',
  breast: '모유', formula: '분유', baby_food: '이유식', snack: '간식',
  nap: '낮잠', night: '밤잠',
};

/* ================================================================== */
/*  Speech Recognition wrapper (dynamic import, graceful fallback)     */
/* ================================================================== */

interface SpeechModule {
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: () => Promise<{ granted: boolean }>;
    start: (opts: { lang: string; interimResults: boolean }) => void;
    stop: () => void;
    isRecognitionAvailable: () => boolean;
  };
  useSpeechRecognitionEvent: (
    event: string,
    callback: (ev: unknown) => void,
  ) => void;
}

let _speechModule: SpeechModule | null = null;
let _speechLoadAttempted = false;

async function loadSpeechModule(): Promise<SpeechModule | null> {
  if (_speechLoadAttempted) return _speechModule;
  _speechLoadAttempted = true;
  try {
    const mod = await import('expo-speech-recognition');
    _speechModule = mod as unknown as SpeechModule;
    return _speechModule;
  } catch {
    return null;
  }
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

/**
 * Deep link handler: amatda://voice?text=윤도 방금 밥먹었어
 *
 * Case 1 (Siri): text parameter provided → process immediately
 * Case 2 (Google/Bixby): no text → auto-start speech recognition → process
 */
export default function VoiceScreen() {
  const { text } = useLocalSearchParams<{ text?: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const children = useChildStore((s) => s.children);
  const selectedChild = useChildStore((s) => s.selectedChild);
  const selectChild = useChildStore((s) => s.selectChild);

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'init' | 'listening' | 'processing' | 'done' | 'error'>('init');
  const [recognizedText, setRecognizedText] = useState('');
  const [speechAvailable, setSpeechAvailable] = useState(false);

  const speechModuleRef = useRef<SpeechModule | null>(null);
  const hasProcessed = useRef(false);

  // Animations
  const bounce = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const micPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -8, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 8, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    bounceLoop.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    // unmount 시 loop 정리 (background 누수 방지)
    return () => { bounceLoop.stop(); pulseLoop.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mic pulse animation (listening phase)
  useEffect(() => {
    if (phase !== 'listening') {
      micPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Setup speech recognition events ──
  const setupSpeechEvents = useCallback((mod: SpeechModule) => {
    mod.useSpeechRecognitionEvent('result', (ev: unknown) => {
      const event = ev as { results?: { transcript: string; isFinal: boolean }[] };
      if (event.results && event.results.length > 0) {
        const result = event.results[0];
        setRecognizedText(result.transcript);
        if (result.isFinal && result.transcript.trim().length >= 2) {
          setPhase('processing');
          setStatus('AI가 분석 중...');
          if (!hasProcessed.current) {
            hasProcessed.current = true;
            processVoice(result.transcript.trim());
          }
        }
      }
    });

    mod.useSpeechRecognitionEvent('error', (ev: unknown) => {
      const event = ev as { error?: string; message?: string };
      const errorMsg = event.message || event.error || '';
      // "no-speech" is not a real error, just means user didn't speak yet
      if (errorMsg.includes('no-speech') || errorMsg.includes('No speech')) {
        // Retry listening
        startListening(mod);
        return;
      }
      setError('음성 인식에 실패했습니다. 다시 시도해주세요.');
      setPhase('error');
      setTimeout(() => router.replace('/(main)/baby-tracker'), 2000);
    });

    mod.useSpeechRecognitionEvent('end', () => {
      // If we haven't processed yet and have text, process it
      if (!hasProcessed.current && recognizedText.trim().length >= 2) {
        hasProcessed.current = true;
        setPhase('processing');
        setStatus('AI가 분석 중...');
        processVoice(recognizedText.trim());
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognizedText]);

  const startListening = useCallback((mod: SpeechModule) => {
    try {
      mod.ExpoSpeechRecognitionModule.start({
        lang: 'ko-KR',
        interimResults: true,
      });
      setPhase('listening');
      setStatus('말씀하세요...');
      setRecognizedText('');
    } catch {
      setError('음성 인식을 시작할 수 없습니다');
      setPhase('error');
    }
  }, []);

  // ── Main flow ──
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }

    // Case 1: text provided (from Siri Shortcuts deep link)
    if (text && text.trim().length >= 2) {
      setPhase('processing');
      setStatus('AI가 분석 중...');
      setRecognizedText(text.trim());
      processVoice(text.trim());
      return;
    }

    // Case 2: no text → try speech recognition (Google/Bixby opened app)
    initSpeechRecognition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isAuthenticated]);

  async function initSpeechRecognition() {
    const mod = await loadSpeechModule();
    if (!mod) {
      setError('음성 인식을 사용할 수 없습니다');
      setPhase('error');
      setTimeout(() => router.replace('/(main)/baby-tracker'), 2000);
      return;
    }

    speechModuleRef.current = mod;

    // Check availability
    try {
      const available = mod.ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        setError('이 기기에서 음성 인식을 지원하지 않습니다');
        setPhase('error');
        setTimeout(() => router.replace('/(main)/baby-tracker'), 2000);
        return;
      }
    } catch {
      // isRecognitionAvailable might not exist in all versions
    }

    // Request permissions
    try {
      const perm = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError('마이크 권한이 필요합니다');
        setPhase('error');
        setTimeout(() => router.replace('/(main)/baby-tracker'), 2000);
        return;
      }
    } catch {
      // Permission check failed, try anyway
    }

    setSpeechAvailable(true);
    setupSpeechEvents(mod);
    startListening(mod);
  }

  // ── Process voice text (same as before) ──
  async function processVoice(voiceText: string) {
    try {
      // Load user-configured defaults
      let voiceDefaults: Record<string, string> = {};
      try {
        const mod = await import('@react-native-async-storage/async-storage');
        const raw = await mod.default.getItem('voice_defaults');
        if (raw) voiceDefaults = JSON.parse(raw);
      } catch { /* no defaults */ }

      const res = await trackerApi.voiceParse(voiceText);
      const parsed = res.data?.data as ParsedRecord | undefined;

      if (!parsed || !parsed.type) {
        setError('기록을 파악할 수 없습니다');
        setPhase('error');
        setTimeout(() => router.replace('/(main)/baby-tracker'), 1500);
        return;
      }

      // Match child by name if provided
      let targetChildId = selectedChild?.id;
      if (parsed.childName && children.length > 1) {
        const matched = children.find((c) => c.name === parsed.childName);
        if (matched) {
          targetChildId = matched.id;
          selectChild(matched.id);
        }
      }

      if (!targetChildId) {
        setError('아이를 선택해주세요');
        setPhase('error');
        setTimeout(() => router.replace('/(main)/home'), 1500);
        return;
      }

      // Apply user defaults when AI didn't parse amount/duration
      if (parsed.amount == null && parsed.subType === 'formula' && voiceDefaults.formulaAmount) {
        parsed.amount = Number(voiceDefaults.formulaAmount);
      }
      if (parsed.duration == null) {
        if (parsed.subType === 'breast' && voiceDefaults.breastDuration) {
          parsed.duration = Number(voiceDefaults.breastDuration);
        } else if (parsed.subType === 'nap' && voiceDefaults.napDuration) {
          parsed.duration = Number(voiceDefaults.napDuration);
        } else if (parsed.subType === 'night' && voiceDefaults.nightDuration) {
          parsed.duration = Number(voiceDefaults.nightDuration);
        }
      }

      // Build record
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const recordId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const timeStr = parsed.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const record = {
        id: recordId,
        type: parsed.type,
        subType: parsed.subType,
        time: timeStr,
        ...(parsed.amount != null ? { amount: parsed.amount } : {}),
        ...(parsed.duration != null ? { duration: parsed.duration } : {}),
        ...(parsed.note ? { note: parsed.note } : {}),
      };

      // Save to AsyncStorage
      const storageKey = `baby_tracker_${targetChildId}_${dateStr}`;
      try {
        const mod = await import('@react-native-async-storage/async-storage');
        const storage = mod.default;
        const existing = await storage.getItem(storageKey);
        const records = existing ? JSON.parse(existing) : [];
        records.push(record);
        await storage.setItem(storageKey, JSON.stringify(records));
      } catch {
        // Storage fail - continue
      }

      const label = SUBTYPE_LABELS[parsed.subType] ?? parsed.subType;
      setStatus(`${label} 기록 완료!`);
      setPhase('done');

      setTimeout(() => {
        router.replace({
          pathname: '/(main)/baby-tracker',
          params: { voiceToast: `${label} ${timeStr} 기록됨!` },
        });
      }, 1200);
    } catch {
      setError('기록 분석에 실패했습니다');
      setPhase('error');
      setTimeout(() => router.replace('/(main)/baby-tracker'), 1500);
    }
  }

  const handleRetry = () => {
    if (speechModuleRef.current) {
      hasProcessed.current = false;
      setError('');
      startListening(speechModuleRef.current);
    }
  };

  return (
    <View style={s.container}>
      {/* ── Listening mode: mic animation ── */}
      {phase === 'listening' && (
        <>
          <Animated.View style={[s.micOuter, { transform: [{ scale: micPulse }] }]}>
            <View style={s.micCircle}>
              <Image source={IC_MIC} style={s.micIcon} resizeMode="contain" />
            </View>
          </Animated.View>

          <Text style={s.listeningTitle}>{'말씀하세요'}</Text>
          <Text style={s.listeningHint}>
            {'"윤도 밥먹었어", "똥 쌌어", "낮잠 잤어" 처럼 말해보세요'}
          </Text>

          {recognizedText.length > 0 && (
            <View style={s.bubble}>
              <Text style={s.bubbleText}>{recognizedText}</Text>
            </View>
          )}
        </>
      )}

      {/* ── Processing / Done mode: mascot animation ── */}
      {(phase === 'processing' || phase === 'done' || phase === 'init') && (
        <>
          <Animated.View style={{ transform: [{ translateY: bounce }, { scale: pulse }] }}>
            <Image source={IC_MASCOT} style={s.mascot} resizeMode="contain" />
          </Animated.View>

          {error ? (
            <Text style={s.errorText}>{error}</Text>
          ) : (
            <Text style={s.statusText}>{status || '준비 중...'}</Text>
          )}

          {recognizedText.length > 0 && (
            <View style={s.bubble}>
              <Text style={s.bubbleText}>{`"${recognizedText}"`}</Text>
            </View>
          )}

          {phase === 'done' && (
            <View style={s.doneBadge}>
              <Text style={s.doneBadgeText}>{'자동 기록 완료!'}</Text>
            </View>
          )}
        </>
      )}

      {/* ── Error mode ── */}
      {phase === 'error' && (
        <>
          <Image source={IC_MASCOT} style={s.mascot} resizeMode="contain" />
          <Text style={s.errorText}>{error}</Text>

          {speechAvailable && (
            <TouchableOpacity style={s.retryBtn} onPress={handleRetry}>
              <Text style={s.retryBtnText}>{'다시 말하기'}</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },

  /* Mascot */
  mascot: { width: 100, height: 100, marginBottom: 24 },
  statusText: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', textAlign: 'center' },
  errorText: { fontSize: 18, fontWeight: '700', color: '#FF6B6B', textAlign: 'center' },

  /* Mic listening UI */
  micOuter: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255, 140, 90, 0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  micCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FF8C5A',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#FF8C5A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  micIcon: { width: 36, height: 36, tintColor: '#FFFFFF' },
  listeningTitle: {
    fontSize: 22, fontWeight: '800', color: '#1C1C1E',
    marginBottom: 8, textAlign: 'center',
  },
  listeningHint: {
    fontSize: 13, color: '#8B7D6B', textAlign: 'center',
    lineHeight: 20, marginBottom: 20, paddingHorizontal: 20,
  },

  /* Recognized text bubble */
  bubble: {
    marginTop: 20, backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    maxWidth: '90%',
  },
  bubbleText: {
    fontSize: 16, color: '#1C1C1E', fontWeight: '600', textAlign: 'center',
  },

  /* Done badge */
  doneBadge: {
    marginTop: 16, backgroundColor: '#4CAF50', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  doneBadgeText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  /* Retry button */
  retryBtn: {
    marginTop: 20, backgroundColor: '#FF8C5A', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
