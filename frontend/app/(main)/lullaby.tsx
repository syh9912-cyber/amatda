import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Switch,
  Alert,
  Platform,
  TextInput,
 Image } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { getLullabyGuide, getLullabyPrenatalGuide } from '../../features/guide/lullabyGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio, AVPlaybackSource } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImageSourcePropType } from 'react-native';
import { AdSlot } from '../../components/ads/AdSlot';

const IC_LULLABY = require('../../assets/quick-lullaby.png') as ImageSourcePropType;
const IC_MIC     = require('../../assets/icon-mic.png') as ImageSourcePropType;

/* ------------------------------------------------------------------ */
/* Sound definitions                                                   */
/* ------------------------------------------------------------------ */

type SoundCategory = 'white' | 'nature' | 'lullaby' | 'myvoice';
type PrenatalCategory = 'myvoice' | 'classic' | 'womb' | 'nature' | 'meditation';

interface SoundItem {
  id: string;
  labelKey: string;
  iconImg: ImageSourcePropType;
  category: SoundCategory;
  descKey: string;
  source: AVPlaybackSource | null;
  uri?: string;
  /** 파일이 아직 없으면 안내용 — UI 에서 "준비 중" 배지 표시 */
  pendingFile?: string;
}

interface PrenatalSoundItem {
  id: string;
  labelKey: string;
  iconImg: ImageSourcePropType;
  category: PrenatalCategory;
  descKey: string;
  source: AVPlaybackSource | null;
  /** 파일이 아직 없으면 안내용. 파일 넣고 source require 주석 풀면 자동 활성 */
  pendingFile?: string;
}

const BUILT_IN_SOUNDS_ALL: SoundItem[] = [
  { id: 'womb',      labelKey: 'lullaby.sound.womb.label',      iconImg: require('../../assets/sound-womb.png'),      category: 'white',   descKey: 'lullaby.sound.womb.desc',      source: require('../../assets/sounds/womb.mp3') },
  { id: 'vacuum',    labelKey: 'lullaby.sound.vacuum.label',    iconImg: require('../../assets/sound-vacuum.png'),    category: 'white',   descKey: 'lullaby.sound.vacuum.desc',    source: require('../../assets/sounds/vacuum.mp3') },
  { id: 'hairdryer', labelKey: 'lullaby.sound.hairdryer.label', iconImg: require('../../assets/sound-hairdryer.png'), category: 'white',   descKey: 'lullaby.sound.hairdryer.desc', source: null, pendingFile: 'hairdryer.mp3' },
  { id: 'fan',       labelKey: 'lullaby.sound.fan.label',       iconImg: require('../../assets/sound-fan.png'),       category: 'white',   descKey: 'lullaby.sound.fan.desc',       source: require('../../assets/sounds/fan.mp3') },
  { id: 'rain',      labelKey: 'lullaby.sound.rain.label',      iconImg: require('../../assets/sound-rain.png'),      category: 'nature',  descKey: 'lullaby.sound.rain.desc',      source: require('../../assets/sounds/rain.mp3') },
  { id: 'wave',      labelKey: 'lullaby.sound.wave.label',      iconImg: require('../../assets/sound-wave.png'),      category: 'nature',  descKey: 'lullaby.sound.wave.desc',      source: require('../../assets/sounds/wave.mp3') },
  { id: 'forest',    labelKey: 'lullaby.sound.forest.label',    iconImg: require('../../assets/sound-forest.png'),    category: 'nature',  descKey: 'lullaby.sound.forest.desc',    source: require('../../assets/sounds/forest.mp3') },
  { id: 'stream',    labelKey: 'lullaby.sound.stream.label',    iconImg: require('../../assets/sound-stream.png'),   category: 'nature',  descKey: 'lullaby.sound.stream.desc',    source: require('../../assets/sounds/stream.mp3') },
  { id: 'twinkle',   labelKey: 'lullaby.sound.twinkle.label',   iconImg: require('../../assets/sound-twinkle.png'),   category: 'lullaby', descKey: 'lullaby.sound.twinkle.desc',   source: null, pendingFile: 'twinkle.mp3' },
  { id: 'brahms',    labelKey: 'lullaby.sound.brahms.label',    iconImg: require('../../assets/sound-brahms.png'),    category: 'lullaby', descKey: 'lullaby.sound.brahms.desc',    source: require('../../assets/sounds/brahms.mp3') },
  { id: 'mozart',    labelKey: 'lullaby.sound.mozart.label',    iconImg: require('../../assets/sound-mozart.png'),    category: 'lullaby', descKey: 'lullaby.sound.mozart.desc',    source: require('../../assets/sounds/mozart.mp3') },
  { id: 'orgel',     labelKey: 'lullaby.sound.orgel.label',     iconImg: require('../../assets/sound-orgel.png'),     category: 'lullaby', descKey: 'lullaby.sound.orgel.desc',     source: null, pendingFile: 'orgel.mp3' },
];
// 음원 미확보(source: null) 트랙은 스토어 심사 기준상 미완성 기능으로 보여 목록에서 제외.
// 음원 추가 후 source 를 채우면 자동으로 다시 노출된다.
const BUILT_IN_SOUNDS: SoundItem[] = BUILT_IN_SOUNDS_ALL.filter((s) => s.source !== null);
// 울음 감지 자동재생 기본 트랙 — 반드시 음원이 있는(목록에 노출되는) 트랙이어야 무음 실패 방지.
// (기존 기본값 'twinkle'은 source null 이라 목록에서 제외돼 자동재생이 무음이었음)
const DEFAULT_CRY_SOUND_ID =
  BUILT_IN_SOUNDS.find((s) => s.category === 'lullaby')?.id ?? BUILT_IN_SOUNDS[0]?.id ?? '';

/**
 * 태교음악 전용 목록.
 * 음원 파일을 `frontend/assets/sounds/prenatal/` 폴더에 같은 이름(mp3 또는 wav)으로 넣은 뒤,
 * 해당 항목의 `source: null`을 `source: require('../../assets/sounds/prenatal/파일명.mp3')` 로 교체하면 바로 재생됩니다.
 *
 * ※ 저작권 안내: 클래식 "작곡"은 퍼블릭 도메인이지만 "녹음(연주 음원)"은 저작인접권 있음.
 *   Musopen/IMSLP에서 Public Domain 표기 음원을 받거나, Pixabay/Freesound의 CC0 음원 사용.
 */
const PRENATAL_SOUNDS_ALL: PrenatalSoundItem[] = [
  // 클래식 (태교 검증곡) — 작곡 자체는 전부 퍼블릭 도메인. 음원 미확보 → 준비 중 표시.
  { id: 'p_mozart_k448',    labelKey: 'lullaby.prenatalSound.mozartK448.label',    iconImg: require('../../assets/p-mozart.png'),       category: 'classic',    descKey: 'lullaby.prenatalSound.mozartK448.desc', source: null, pendingFile: 'mozart-sonata.mp3' },
  { id: 'p_vivaldi_spring', labelKey: 'lullaby.prenatalSound.vivaldiSpring.label', iconImg: require('../../assets/p-vivaldi.png'),      category: 'classic',    descKey: 'lullaby.prenatalSound.vivaldiSpring.desc', source: null, pendingFile: 'vivaldi-spring.mp3' },
  { id: 'p_bach_air',       labelKey: 'lullaby.prenatalSound.bachAir.label',       iconImg: require('../../assets/p-bach.png'),         category: 'classic',    descKey: 'lullaby.prenatalSound.bachAir.desc', source: null, pendingFile: 'bach-air.mp3' },
  { id: 'p_pachelbel_canon',labelKey: 'lullaby.prenatalSound.pachelbelCanon.label',iconImg: require('../../assets/p-pachelbel.png'),    category: 'classic',    descKey: 'lullaby.prenatalSound.pachelbelCanon.desc', source: null, pendingFile: 'pachelbel-canon.mp3' },

  // 자궁·심장박동 (안정감) — 자장가 womb.mp3 재사용
  { id: 'p_womb_heart', labelKey: 'lullaby.prenatalSound.wombHeart.label', iconImg: require('../../assets/p-womb-heart.png'),  category: 'womb', descKey: 'lullaby.prenatalSound.wombHeart.desc', source: require('../../assets/sounds/womb.mp3') },

  // 자연소리 (저주파 이완) — 자장가 음원 재사용
  { id: 'p_ocean',       labelKey: 'lullaby.prenatalSound.ocean.label',       iconImg: require('../../assets/p-ocean.png'),        category: 'nature', descKey: 'lullaby.prenatalSound.ocean.desc',  source: require('../../assets/sounds/wave.mp3') },
  { id: 'p_rain_soft',   labelKey: 'lullaby.prenatalSound.rainSoft.label',    iconImg: require('../../assets/p-rain.png'),         category: 'nature', descKey: 'lullaby.prenatalSound.rainSoft.desc',         source: require('../../assets/sounds/rain.mp3') },
  { id: 'p_forest_birds',labelKey: 'lullaby.prenatalSound.forestBirds.label', iconImg: require('../../assets/p-forest.png'),       category: 'nature', descKey: 'lullaby.prenatalSound.forestBirds.desc',      source: require('../../assets/sounds/forest.mp3') },

  // 명상·힐링
  { id: 'p_432hz',        labelKey: 'lullaby.prenatalSound.healing432hz.label', iconImg: require('../../assets/p-meditation.png'),   category: 'meditation', descKey: 'lullaby.prenatalSound.healing432hz.desc',     source: require('../../assets/sounds/meditation-432hz.mp3') },
  { id: 'p_sleep_piano',  labelKey: 'lullaby.prenatalSound.sleepPiano.label',   iconImg: require('../../assets/p-meditation.png'),   category: 'meditation', descKey: 'lullaby.prenatalSound.sleepPiano.desc', source: require('../../assets/sounds/sleeppiano.mp3') },
  { id: 'p_harp',         labelKey: 'lullaby.prenatalSound.harp.label',        iconImg: require('../../assets/p-meditation.png'),   category: 'meditation', descKey: 'lullaby.prenatalSound.harp.desc',        source: require('../../assets/sounds/harp.mp3') },
];
// 음원 미확보 트랙(클래식 등)은 목록에서 제외 — 음원 추가 시 자동 노출
const PRENATAL_SOUNDS: PrenatalSoundItem[] = PRENATAL_SOUNDS_ALL.filter((s) => s.source !== null);

const TIMER_OPTIONS = [
  { labelKey: 'lullaby.timer.off', minutes: 0 },
  { labelKey: 'lullaby.timer.min15', minutes: 15 },
  { labelKey: 'lullaby.timer.min30', minutes: 30 },
  { labelKey: 'lullaby.timer.hour1', minutes: 60 },
  { labelKey: 'lullaby.timer.hour2', minutes: 120 },
];

const CATEGORIES = [
  { key: 'myvoice' as const, labelKey: 'lullaby.category.myVoice' },
  { key: 'white' as const, labelKey: 'lullaby.category.whiteNoise' },
  { key: 'nature' as const, labelKey: 'lullaby.category.nature' },
  { key: 'lullaby' as const, labelKey: 'lullaby.category.lullaby' },
];

const PRENATAL_CATEGORIES = [
  { key: 'myvoice' as const, labelKey: 'lullaby.prenatalCategory.momVoice' },
  { key: 'classic' as const, labelKey: 'lullaby.prenatalCategory.classic' },
  { key: 'womb' as const, labelKey: 'lullaby.prenatalCategory.womb' },
  { key: 'nature' as const, labelKey: 'lullaby.prenatalCategory.nature' },
  { key: 'meditation' as const, labelKey: 'lullaby.prenatalCategory.meditation' },
];

const MY_RECORDINGS_KEY = 'amatda_my_recordings';

const COLOR = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  cardActive: '#FFF0E6',
  accent: '#FF8C5A',
  accentSoft: '#FFB48E',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  timer: '#FF8C5A',
  cryOn: '#FF6B6B',
  cryOff: '#E5E5EA',
  record: '#FF6B6B',
  recordBg: '#FFF0F0',
};

interface MyRecording {
  id: string;
  label: string;
  uri: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function LullabyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isPrenatal = params.mode === 'prenatal';
  const headerTitle = isPrenatal ? t('lullaby.prenatalTitle') : t('lullaby.title');
  const headerSub = isPrenatal
    ? t('lullaby.prenatalSubtitle')
    : t('lullaby.subtitle');
  const idleLabel = isPrenatal ? t('lullaby.idlePrenatalLabel') : t('lullaby.idleLabel');
  const cryRowLabel = isPrenatal
    ? t('lullaby.momVoiceRecordLabel')
    : t('lullaby.cryDetectLabel');
  // 사용 가이드 (모드별: 자장가 / 태교음악) — 첫 진입 1회 자동표시 + ? 버튼 재열람
  const guideKey = isPrenatal ? 'lullaby_prenatal' : 'lullaby';
  const guidePages = useMemo(
    () => (isPrenatal ? getLullabyPrenatalGuide(t) : getLullabyGuide(t)),
    [isPrenatal, t]
  );
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    shouldAutoShowGuide(guideKey).then((sh) => { if (sh) setGuideVisible(true); });
  }, [guideKey]);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen(guideKey); };
  const [playing, setPlaying] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [cryDetect, setCryDetect] = useState(false);
  const [lastCrySound, setLastCrySound] = useState<string>(DEFAULT_CRY_SOUND_ID);
  const [isListening, setIsListening] = useState(false);

  // Recording states
  const [myRecordings, setMyRecordings] = useState<MyRecording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [recordLabel, setRecordLabel] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [pendingRecordUri, setPendingRecordUri] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const voiceRecRef = useRef<Audio.Recording | null>(null);
  const cryRecRef = useRef<Audio.Recording | null>(null);
  const cryCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved recordings
  useEffect(() => {
    AsyncStorage.getItem(MY_RECORDINGS_KEY).then((raw) => {
      if (raw) {
        try { setMyRecordings(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      voiceRecRef.current?.stopAndUnloadAsync().catch(() => {});
      cryRecRef.current?.stopAndUnloadAsync().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
      if (cryCheckRef.current) clearInterval(cryCheckRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  // Pulse animation
  useEffect(() => {
    if (playing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [playing, pulseAnim]);

  // Timer countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (remaining <= 0) return;
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { stopSound(); setTimer(0); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [remaining]);

  // -- Playback --
  const playSound = useCallback(async (id: string) => {
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, staysActiveInBackground: true, playsInSilentModeIOS: true });

      // Check if it's a built-in sound, prenatal sound, or user recording
      const builtIn = BUILT_IN_SOUNDS.find((s) => s.id === id);
      const prenatal = PRENATAL_SOUNDS.find((s) => s.id === id);
      const myRec = myRecordings.find((r) => r.id === id);

      let source: AVPlaybackSource;
      if (builtIn?.source) {
        source = builtIn.source;
      } else if (prenatal?.source) {
        source = prenatal.source;
      } else if (myRec) {
        source = { uri: myRec.uri };
      } else if (builtIn && !builtIn.source) {
        // 자장가 음원 미확보 — 태교와 동일한 안내
        Alert.alert(t('lullaby.soundPreparingTitle'), t('lullaby.soundPreparingMessage', { name: t(builtIn.labelKey) }));
        return;
      } else if (prenatal && !prenatal.source) {
        Alert.alert(t('lullaby.soundPreparingTitle'), t('lullaby.soundPreparingMessage', { name: t(prenatal.labelKey) }));
        return;
      } else {
        return;
      }

      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, isLooping: true, volume: 0.8 });
      soundRef.current = sound;
      setPlaying(id);
      setLastCrySound(id);
    } catch (err) {
      console.warn('Sound play error:', err);
    }
  }, [myRecordings, t]);

  const stopSound = useCallback(async () => {
    try {
      if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
    } catch { /* ignore */ }
    setPlaying(null);
  }, []);

  const handlePlay = useCallback(async (id: string) => {
    if (playing === id) { await stopSound(); } else { await playSound(id); }
  }, [playing, playSound, stopSound]);

  const handleTimer = useCallback((minutes: number) => {
    setTimer(minutes);
    setRemaining(minutes * 60);
  }, []);

  // -- Voice Recording --
  const startVoiceRecording = useCallback(async () => {
    try {
      if (playing) await stopSound(); // stop any playing sound

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('lullaby.micPermissionTitle'), t('lullaby.micPermissionRecordMessage'));
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, staysActiveInBackground: true, playsInSilentModeIOS: true });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      voiceRecRef.current = recording;
      setIsRecording(true);
      setRecordSecs(0);

      // Timer for recording duration display
      recordTimerRef.current = setInterval(() => {
        setRecordSecs((p) => {
          if (p >= 120) { // max 2 minutes
            stopVoiceRecording();
            return p;
          }
          return p + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn('Recording start error:', err);
      Alert.alert(t('common.error'), t('lullaby.recordStartErrorMessage'));
    }
  }, [playing, stopSound, t]);

  const stopVoiceRecording = useCallback(async () => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setIsRecording(false);

    try {
      if (!voiceRecRef.current) return;
      await voiceRecRef.current.stopAndUnloadAsync();
      const uri = voiceRecRef.current.getURI();
      voiceRecRef.current = null;

      if (uri) {
        setPendingRecordUri(uri);
        setRecordLabel('');
        setShowNameInput(true);
      }
    } catch (err) {
      console.warn('Recording stop error:', err);
    }
  }, []);

  const saveRecording = useCallback(async () => {
    if (!pendingRecordUri) return;
    const label = recordLabel.trim() || t('lullaby.defaultRecordingLabel', { count: myRecordings.length + 1 });
    const newRec: MyRecording = {
      id: `rec_${Date.now()}`,
      label,
      uri: pendingRecordUri,
      createdAt: new Date().toISOString(),
    };
    const updated = [...myRecordings, newRec];
    setMyRecordings(updated);
    await AsyncStorage.setItem(MY_RECORDINGS_KEY, JSON.stringify(updated));
    setShowNameInput(false);
    setPendingRecordUri(null);
    setRecordLabel('');
  }, [pendingRecordUri, recordLabel, myRecordings, t]);

  const deleteRecording = useCallback(async (id: string) => {
    Alert.alert(t('common.delete'), t('lullaby.deleteRecordingConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          if (playing === id) await stopSound();
          const updated = myRecordings.filter((r) => r.id !== id);
          setMyRecordings(updated);
          await AsyncStorage.setItem(MY_RECORDINGS_KEY, JSON.stringify(updated));
        },
      },
    ]);
  }, [myRecordings, playing, stopSound, t]);

  // -- Cry Detection --
  const startCryDetection = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('lullaby.micPermissionTitle'), t('lullaby.micPermissionCryMessage')); setCryDetect(false); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, staysActiveInBackground: true, playsInSilentModeIOS: true });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.LOW_QUALITY,
        android: { ...Audio.RecordingOptionsPresets.LOW_QUALITY.android, extension: '.3gp' },
        ios: { ...Audio.RecordingOptionsPresets.LOW_QUALITY.ios, extension: '.caf' },
        isMeteringEnabled: true,
      });
      await recording.startAsync();
      cryRecRef.current = recording;
      setIsListening(true);

      cryCheckRef.current = setInterval(async () => {
        try {
          const status = await recording.getStatusAsync();
          if (status.isRecording && status.metering !== undefined && status.metering > -30 && !soundRef.current) {
            await playSound(lastCrySound);
          }
        } catch { /* ignore */ }
      }, 2000);
    } catch (err) {
      console.warn('Cry detection error:', err);
      setCryDetect(false);
    }
  }, [lastCrySound, playSound, t]);

  const stopCryDetection = useCallback(async () => {
    if (cryCheckRef.current) { clearInterval(cryCheckRef.current); cryCheckRef.current = null; }
    try { if (cryRecRef.current) { await cryRecRef.current.stopAndUnloadAsync(); cryRecRef.current = null; } } catch { /* ignore */ }
    setIsListening(false);
  }, []);

  const toggleCryDetect = useCallback(async (value: boolean) => {
    setCryDetect(value);
    if (value) { await startCryDetection(); } else { await stopCryDetection(); }
  }, [startCryDetection, stopCryDetection]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const currentSoundItem = isPrenatal
    ? PRENATAL_SOUNDS.find((s) => s.id === playing)
    : BUILT_IN_SOUNDS.find((s) => s.id === playing);
  const currentRecording = myRecordings.find((r) => r.id === playing);
  const currentSound = currentSoundItem
    ? { iconImg: currentSoundItem.iconImg, label: t(currentSoundItem.labelKey), desc: t(currentSoundItem.descKey) }
    : currentRecording
      ? { iconImg: IC_MIC, label: currentRecording.label, desc: t('lullaby.myVoiceRecordingDesc') }
      : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <ScreenHeader title={headerTitle} right={<GuideButton onPress={() => setGuideVisible(true)} color="#9D8CC6" />} />
      <View style={[styles.header, { alignItems: 'center' }]}>
        <Text style={styles.headerSub}>{headerSub}</Text>
      </View>

      {/* Now Playing */}
      {currentSound ? (
        <View style={styles.nowPlaying}>
          <Animated.View style={[styles.nowPlayingCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Image source={currentSound.iconImg} style={styles.nowPlayingIconImg} resizeMode="contain" />
          </Animated.View>
          <Text style={styles.nowPlayingLabel}>{currentSound.label}</Text>
          <Text style={styles.nowPlayingDesc}>{currentSound.desc}</Text>
          {remaining > 0 && <Text style={styles.timerDisplay}>{formatTime(remaining)}</Text>}
          <TouchableOpacity style={styles.stopBtn} onPress={stopSound}>
            <Text style={styles.stopBtnText}>{t('lullaby.stop')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.nowPlaying}>
          <View style={styles.nowPlayingCircleIdle}>
            <Image source={IC_LULLABY} style={styles.nowPlayingIconImg} resizeMode="contain" />
          </View>
          <Text style={styles.nowPlayingLabel}>{idleLabel}</Text>
          <Text style={styles.nowPlayingDesc}>{t('lullaby.idleDesc')}</Text>
        </View>
      )}

      {/* Cry detection toggle (영유아 전용) */}
      {!isPrenatal && (
        <View style={styles.cryRow}>
          <View style={styles.cryInfo}>
            <Text style={styles.cryLabel}>{cryRowLabel}</Text>
            <Text style={styles.cryDesc}>
              {isListening ? t('lullaby.micMonitoring') : t('lullaby.cryDetectDesc')}
            </Text>
          </View>
          <Switch value={cryDetect} onValueChange={toggleCryDetect} trackColor={{ false: COLOR.cryOff, true: COLOR.cryOn }} thumbColor="#FFF" />
        </View>
      )}

      {/* Timer */}
      <View style={styles.timerRow}>
        <Text style={styles.timerLabel}>{t('lullaby.timerSectionLabel')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timerChips}>
          {TIMER_OPTIONS.map((opt) => (
            <TouchableOpacity key={opt.minutes} style={[styles.timerChip, timer === opt.minutes && styles.timerChipActive]} onPress={() => handleTimer(opt.minutes)}>
              <Text style={[styles.timerChipText, timer === opt.minutes && styles.timerChipTextActive]}>{t(opt.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recording name input modal */}
      {showNameInput && (
        <View style={styles.nameInputWrap}>
          <View style={styles.nameInputTitleRow}>
            <Image source={IC_LULLABY} style={styles.nameInputTitleIconImg} resizeMode="contain" />
            <Text style={styles.nameInputTitle}>{` ${t('lullaby.saveRecordingTitle')}`}</Text>
          </View>
          <TextInput
            style={styles.nameInput}
            placeholder={t('lullaby.recordingNamePlaceholder')}
            placeholderTextColor={COLOR.textSub}
            value={recordLabel}
            onChangeText={setRecordLabel}
            autoFocus
          />
          <View style={styles.nameInputBtns}>
            <TouchableOpacity style={styles.nameInputCancel} onPress={() => { setShowNameInput(false); setPendingRecordUri(null); }}>
              <Text style={styles.nameInputCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nameInputSave} onPress={saveRecording}>
              <Text style={styles.nameInputSaveText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sound Grid */}
      <ScrollView style={styles.soundList} showsVerticalScrollIndicator={false}>
        {(isPrenatal ? PRENATAL_CATEGORIES : CATEGORIES).map((cat) => (
          <View key={cat.key} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{t(cat.labelKey)}</Text>

            {/* My Voice: record button + recordings */}
            {cat.key === 'myvoice' && (
              <View style={styles.myVoiceSection}>
                {/* Record button */}
                <TouchableOpacity
                  style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                  onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
                  activeOpacity={0.7}
                >
                  <View style={[styles.recordDot, isRecording && styles.recordDotActive]} />
                  <Text style={styles.recordBtnText}>
                    {isRecording ? t('lullaby.recordingInProgress', { time: formatTime(recordSecs) }) : t('lullaby.recordVoiceButton')}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.recordHint}>{t('lullaby.recordHint')}</Text>

                {/* Saved recordings */}
                <View style={styles.soundGrid}>
                  {myRecordings.map((rec) => {
                    const isActive = playing === rec.id;
                    return (
                      <TouchableOpacity
                        key={rec.id}
                        style={[styles.soundCard, isActive && styles.soundCardActive]}
                        onPress={() => handlePlay(rec.id)}
                        onLongPress={() => deleteRecording(rec.id)}
                        activeOpacity={0.7}
                      >
                        <Image source={IC_LULLABY} style={styles.soundIconImg} resizeMode="contain" />
                        <Text style={[styles.soundLabel, isActive && styles.soundLabelActive]} numberOfLines={1}>
                          {rec.label}
                        </Text>
                        {isActive && <View style={styles.playingDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {myRecordings.length > 0 && (
                  <Text style={styles.recordDeleteHint}>{t('lullaby.longPressToDelete')}</Text>
                )}
                {myRecordings.length === 0 && !isRecording && (
                  <Text style={styles.recordEmpty}>{t('lullaby.noRecordingsYet')}</Text>
                )}
              </View>
            )}

            {/* Built-in sounds (lullaby mode) */}
            {!isPrenatal && cat.key !== 'myvoice' && (
              <View style={styles.soundGrid}>
                {BUILT_IN_SOUNDS.filter((s) => s.category === cat.key).map((sound) => {
                  const isActive = playing === sound.id;
                  const isPending = !sound.source;
                  return (
                    <TouchableOpacity
                      key={sound.id}
                      style={[
                        styles.soundCard,
                        isActive && styles.soundCardActive,
                        isPending && styles.soundCardPending,
                      ]}
                      onPress={() => handlePlay(sound.id)}
                      activeOpacity={0.7}
                    >
                      <Image source={sound.iconImg} style={styles.soundIconImg} resizeMode="contain" />
                      <Text
                        style={[
                          styles.soundLabel,
                          isActive && styles.soundLabelActive,
                          isPending && styles.soundLabelPending,
                        ]}
                        numberOfLines={1}
                      >
                        {t(sound.labelKey)}
                      </Text>
                      {isPending && <Text style={styles.pendingBadge}>{t('lullaby.pendingBadge')}</Text>}
                      {isActive && <View style={styles.playingDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Prenatal sounds (prenatal mode) */}
            {isPrenatal && cat.key !== 'myvoice' && (
              <View style={styles.soundGrid}>
                {PRENATAL_SOUNDS.filter((s) => s.category === cat.key).map((sound) => {
                  const isActive = playing === sound.id;
                  const isPending = !sound.source;
                  return (
                    <TouchableOpacity
                      key={sound.id}
                      style={[
                        styles.soundCard,
                        isActive && styles.soundCardActive,
                        isPending && styles.soundCardPending,
                      ]}
                      onPress={() => handlePlay(sound.id)}
                      activeOpacity={0.7}
                    >
                      <Image source={sound.iconImg} style={styles.soundIconImg} resizeMode="contain" />
                      <Text
                        style={[
                          styles.soundLabel,
                          isActive && styles.soundLabelActive,
                          isPending && styles.soundLabelPending,
                        ]}
                        numberOfLines={1}
                      >
                        {t(sound.labelKey)}
                      </Text>
                      {isPending && <Text style={styles.pendingBadge}>{t('lullaby.pendingBadge')}</Text>}
                      {isActive && <View style={styles.playingDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ))}
        <View style={{ height: insets.bottom + 30 }} />
      </ScrollView>
      <AdSlot />
      <GuideCarousel visible={guideVisible} pages={guidePages} onClose={closeGuide} onComplete={closeGuide} accent="#9D8CC6" />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '600', color: COLOR.text },
  headerSub: { fontSize: 14, color: COLOR.textSub, marginTop: 4 },

  nowPlaying: { alignItems: 'center', paddingVertical: 16 },
  nowPlayingCircle: {
    width: 90, height: 90, borderRadius: 24,
    backgroundColor: COLOR.cardActive, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLOR.accent,
    ...Platform.select({
      ios: { shadowColor: COLOR.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.30, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  nowPlayingCircleIdle: {
    width: 90, height: 90, borderRadius: 24,
    backgroundColor: COLOR.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  nowPlayingIconImg: { width: 52, height: 52 },
  nowPlayingLabel: { fontSize: 17, fontWeight: '700', color: COLOR.text, marginTop: 10 },
  nowPlayingDesc: { fontSize: 13, color: COLOR.textSub, marginTop: 2 },
  timerDisplay: { fontSize: 22, fontWeight: '700', color: COLOR.timer, marginTop: 6, fontVariant: ['tabular-nums'] },
  stopBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FF6B6B' },
  stopBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  cryRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 24, marginBottom: 12,
    backgroundColor: COLOR.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  cryInfo: { flex: 1 },
  cryLabel: { fontSize: 14, fontWeight: '700', color: COLOR.text },
  cryDesc: { fontSize: 11, color: COLOR.textSub, marginTop: 2 },

  timerRow: { paddingHorizontal: 24, marginBottom: 12 },
  timerLabel: { fontSize: 13, fontWeight: '600', color: COLOR.textSub, marginBottom: 6 },
  timerChips: { gap: 8 },
  timerChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLOR.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  timerChipActive: {
    backgroundColor: COLOR.cardActive, borderColor: COLOR.accent,
    ...Platform.select({
      ios: { shadowColor: COLOR.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 5 },
      android: { elevation: 3 },
    }),
  },
  timerChipText: { fontSize: 13, fontWeight: '600', color: COLOR.textSub },
  timerChipTextActive: { color: COLOR.accent },

  /* Recording name input */
  nameInputWrap: {
    marginHorizontal: 24, marginBottom: 12, backgroundColor: COLOR.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLOR.accent,
  },
  nameInputTitle: { fontSize: 15, fontWeight: '700', color: COLOR.text, marginBottom: 10 },
  nameInputTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  nameInputTitleIconImg: { width: 18, height: 18 },
  nameInput: {
    height: 42, borderRadius: 10, backgroundColor: COLOR.cardActive,
    paddingHorizontal: 14, fontSize: 14, color: COLOR.text, marginBottom: 10,
  },
  nameInputBtns: { flexDirection: 'row', gap: 10 },
  nameInputCancel: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: COLOR.cryOff, alignItems: 'center' },
  nameInputCancelText: { fontSize: 14, fontWeight: '600', color: COLOR.textSub },
  nameInputSave: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: COLOR.accent, alignItems: 'center' },
  nameInputSaveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  /* Sound List */
  soundList: { flex: 1, paddingHorizontal: 24 },
  categorySection: { marginBottom: 16 },
  categoryTitle: { fontSize: 15, fontWeight: '700', color: COLOR.text, marginBottom: 10 },
  soundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  soundCard: {
    width: '22%', aspectRatio: 1,
    backgroundColor: COLOR.card, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.13, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  soundCardActive: {
    backgroundColor: COLOR.cardActive,
    borderColor: COLOR.accent,
    ...Platform.select({
      ios: { shadowColor: COLOR.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 7 },
      android: { elevation: 4 },
    }),
  },
  soundIconImg: { width: 40, height: 40, marginBottom: 2 },
  soundLabel: { fontSize: 10, fontWeight: '600', color: COLOR.textSub },
  soundLabelActive: { color: COLOR.accent },
  soundCardPending: { opacity: 0.5 },
  soundLabelPending: { color: COLOR.textLight },
  pendingBadge: {
    position: 'absolute', top: 4, right: 4,
    fontSize: 8, fontWeight: '700', color: COLOR.textSub,
    backgroundColor: '#E5E5EA', paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 4, overflow: 'hidden',
  },
  playingDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: COLOR.accent, position: 'absolute', top: 6, right: 6,
  },

  /* My Voice */
  myVoiceSection: { marginBottom: 8 },
  recordBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLOR.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  recordBtnActive: { backgroundColor: COLOR.recordBg, borderColor: COLOR.record },
  recordDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLOR.accentSoft, marginRight: 12,
  },
  recordDotActive: { backgroundColor: COLOR.record },
  recordBtnText: { fontSize: 14, fontWeight: '600', color: COLOR.text },
  recordHint: { fontSize: 11, color: COLOR.textSub, marginTop: 6, marginBottom: 10, marginLeft: 4 },
  recordDeleteHint: { fontSize: 10, color: COLOR.textSub, marginTop: 6, textAlign: 'center' },
  recordEmpty: { fontSize: 12, color: COLOR.textSub, marginTop: 10, textAlign: 'center', fontStyle: 'italic' },
});
