import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio, AVPlaybackSource } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdSlot } from '../../components/ads/AdSlot';

/* ------------------------------------------------------------------ */
/* Sound definitions                                                   */
/* ------------------------------------------------------------------ */

type SoundCategory = 'white' | 'nature' | 'lullaby' | 'myvoice';
type PrenatalCategory = 'myvoice' | 'classic' | 'womb' | 'nature' | 'meditation';

interface SoundItem {
  id: string;
  label: string;
  icon: string;
  category: SoundCategory;
  desc: string;
  source: AVPlaybackSource | null;
  uri?: string;
}

interface PrenatalSoundItem {
  id: string;
  label: string;
  icon: string;
  category: PrenatalCategory;
  desc: string;
  source: AVPlaybackSource | null;
  /** 파일이 아직 없으면 안내용. 파일 넣고 source require 주석 풀면 자동 활성 */
  pendingFile?: string;
}

const BUILT_IN_SOUNDS: SoundItem[] = [
  { id: 'womb', label: '자궁 소리', icon: '👶', category: 'white', desc: '엄마 뱃속 소리', source: require('../../assets/sounds/womb.wav') },
  { id: 'vacuum', label: '청소기', icon: '🧹', category: 'white', desc: '일정한 백색소음', source: require('../../assets/sounds/vacuum.wav') },
  { id: 'hairdryer', label: '드라이기', icon: '💨', category: 'white', desc: '부드러운 바람소리', source: require('../../assets/sounds/hairdryer.wav') },
  { id: 'fan', label: '선풍기', icon: '🌬', category: 'white', desc: '시원한 바람소리', source: require('../../assets/sounds/fan.wav') },
  { id: 'rain', label: '빗소리', icon: '🌧', category: 'nature', desc: '잔잔한 빗소리', source: require('../../assets/sounds/rain.wav') },
  { id: 'wave', label: '파도소리', icon: '🌊', category: 'nature', desc: '해변의 파도', source: require('../../assets/sounds/wave.wav') },
  { id: 'forest', label: '숲속', icon: '🌳', category: 'nature', desc: '새소리와 바람', source: require('../../assets/sounds/forest.wav') },
  { id: 'stream', label: '시냇물', icon: '💧', category: 'nature', desc: '졸졸 흐르는 물', source: require('../../assets/sounds/stream.wav') },
  { id: 'twinkle', label: '반짝반짝', icon: '⭐', category: 'lullaby', desc: '작은별 멜로디', source: require('../../assets/sounds/twinkle.wav') },
  { id: 'brahms', label: '브람스', icon: '🎵', category: 'lullaby', desc: '브람스 자장가', source: require('../../assets/sounds/brahms.wav') },
  { id: 'mozart', label: '모차르트', icon: '🎶', category: 'lullaby', desc: '아이네클라이네', source: require('../../assets/sounds/mozart.wav') },
  { id: 'orgel', label: '오르골', icon: '🎼', category: 'lullaby', desc: '오르골 멜로디', source: require('../../assets/sounds/orgel.wav') },
];

/**
 * 태교음악 전용 목록.
 * 음원 파일을 `frontend/assets/sounds/prenatal/` 폴더에 같은 이름(mp3 또는 wav)으로 넣은 뒤,
 * 해당 항목의 `source: null`을 `source: require('../../assets/sounds/prenatal/파일명.mp3')` 로 교체하면 바로 재생됩니다.
 *
 * ※ 저작권 안내: 클래식 "작곡"은 퍼블릭 도메인이지만 "녹음(연주 음원)"은 저작인접권 있음.
 *   Musopen/IMSLP에서 Public Domain 표기 음원을 받거나, Pixabay/Freesound의 CC0 음원 사용.
 */
const PRENATAL_SOUNDS: PrenatalSoundItem[] = [
  // 🎻 클래식 (태교 검증곡) — 작곡 자체는 전부 퍼블릭 도메인
  { id: 'p_mozart_k448', label: '모차르트 K.448', icon: '🎼', category: 'classic', desc: '두 대의 피아노를 위한 소나타', source: null, pendingFile: 'mozart-sonata.mp3' },
  { id: 'p_vivaldi_spring', label: '비발디 봄', icon: '🌸', category: 'classic', desc: '사계 중 봄', source: null, pendingFile: 'vivaldi-spring.mp3' },
  { id: 'p_bach_air', label: '바흐 G선상의 아리아', icon: '🎻', category: 'classic', desc: '관현악 모음곡 3번', source: null, pendingFile: 'bach-air.mp3' },
  { id: 'p_pachelbel_canon', label: '파헬벨 캐논', icon: '🎵', category: 'classic', desc: 'D장조 캐논', source: null, pendingFile: 'pachelbel-canon.mp3' },
  { id: 'p_debussy_clair', label: '드뷔시 달빛', icon: '🌙', category: 'classic', desc: '베르가마스크 모음곡', source: null, pendingFile: 'debussy-clair.mp3' },

  // 💓 자궁·심장박동 (안정감)
  { id: 'p_womb_heart', label: '자궁 속 심장박동', icon: '💗', category: 'womb', desc: '60~80bpm, 자궁 내 환경', source: null, pendingFile: 'womb-heartbeat.mp3' },
  { id: 'p_mom_heart', label: '엄마 심장소리', icon: '❤️', category: 'womb', desc: '아기에게 가장 익숙한 소리', source: null, pendingFile: 'mom-heartbeat.mp3' },

  // 🌊 자연소리 (저주파 이완)
  { id: 'p_ocean', label: '잔잔한 파도', icon: '🌊', category: 'nature', desc: '해변의 부드러운 파도', source: null, pendingFile: 'ocean-calm.mp3' },
  { id: 'p_rain_soft', label: '부드러운 빗소리', icon: '🌧', category: 'nature', desc: '창가의 빗소리', source: null, pendingFile: 'rain-soft.mp3' },
  { id: 'p_forest_birds', label: '숲속 새소리', icon: '🌳', category: 'nature', desc: '평화로운 아침 숲', source: null, pendingFile: 'forest-birds.mp3' },

  // 🧘 명상·힐링
  { id: 'p_432hz', label: '432Hz 힐링', icon: '🧘', category: 'meditation', desc: '자연 주파수 명상', source: null, pendingFile: 'meditation-432hz.mp3' },
  { id: 'p_singing_bowl', label: '싱잉볼', icon: '🔔', category: 'meditation', desc: '티베트 명상 볼', source: null, pendingFile: 'singing-bowl.mp3' },
];

const TIMER_OPTIONS = [
  { label: '끄기', minutes: 0 },
  { label: '15분', minutes: 15 },
  { label: '30분', minutes: 30 },
  { label: '1시간', minutes: 60 },
  { label: '2시간', minutes: 120 },
];

const CATEGORIES = [
  { key: 'myvoice' as const, label: '내 목소리' },
  { key: 'white' as const, label: '백색소음' },
  { key: 'nature' as const, label: '자연의 소리' },
  { key: 'lullaby' as const, label: '자장가' },
];

const PRENATAL_CATEGORIES = [
  { key: 'myvoice' as const, label: '엄마 목소리' },
  { key: 'classic' as const, label: '🎻 클래식 태교곡' },
  { key: 'womb' as const, label: '💓 자궁·심장박동' },
  { key: 'nature' as const, label: '🌊 자연의 소리' },
  { key: 'meditation' as const, label: '🧘 명상·힐링' },
];

const MY_RECORDINGS_KEY = 'amatda_my_recordings';

const COLOR = {
  bg: '#1A1230',
  card: '#251D42',
  cardActive: '#3D2E6B',
  accent: '#B18AFF',
  accentSoft: '#7C5CBF',
  text: '#FFFFFF',
  textSub: '#A099B8',
  timer: '#FFD76E',
  cryOn: '#FF6B6B',
  cryOff: '#4A4060',
  record: '#FF6B6B',
  recordBg: '#3D1A1A',
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
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isPrenatal = params.mode === 'prenatal';
  const headerTitle = isPrenatal ? '태교음악' : '자장가';
  const headerSub = isPrenatal
    ? '엄마와 아기의 편안한 시간'
    : '아이의 편안한 잠을 위해';
  const idleLabel = isPrenatal ? '태교음악을 선택하세요' : '소리를 선택하세요';
  const cryRowLabel = isPrenatal
    ? '🤰 엄마 목소리 녹음'
    : '👂 울음 감지 자동 재생';
  const [playing, setPlaying] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [cryDetect, setCryDetect] = useState(false);
  const [lastCrySound, setLastCrySound] = useState<string>('twinkle');
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
      } else if (prenatal && !prenatal.source) {
        Alert.alert('음원 준비 중', `'${prenatal.label}' 음원은 곧 추가될 예정이에요.`);
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
  }, [myRecordings]);

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
        Alert.alert('권한 필요', '녹음을 위해 마이크 권한이 필요합니다.');
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
      Alert.alert('오류', '녹음을 시작할 수 없습니다.');
    }
  }, [playing, stopSound]);

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
    const label = recordLabel.trim() || `녹음 ${myRecordings.length + 1}`;
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
  }, [pendingRecordUri, recordLabel, myRecordings]);

  const deleteRecording = useCallback(async (id: string) => {
    Alert.alert('삭제', '이 녹음을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          if (playing === id) await stopSound();
          const updated = myRecordings.filter((r) => r.id !== id);
          setMyRecordings(updated);
          await AsyncStorage.setItem(MY_RECORDINGS_KEY, JSON.stringify(updated));
        },
      },
    ]);
  }, [myRecordings, playing, stopSound]);

  // -- Cry Detection --
  const startCryDetection = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('권한 필요', '울음 감지를 위해 마이크 권한이 필요합니다.'); setCryDetect(false); return; }
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
  }, [lastCrySound, playSound]);

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

  const currentSound = (isPrenatal
    ? PRENATAL_SOUNDS.find((s) => s.id === playing)
    : BUILT_IN_SOUNDS.find((s) => s.id === playing)) ?? (
    myRecordings.find((r) => r.id === playing) ? {
      id: playing!, label: myRecordings.find((r) => r.id === playing)!.label,
      icon: '🎤', desc: '내 목소리 녹음', category: 'myvoice' as const, source: null,
    } : null
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <Text style={styles.headerSub}>{headerSub}</Text>
      </View>

      {/* Now Playing */}
      {currentSound ? (
        <View style={styles.nowPlaying}>
          <Animated.View style={[styles.nowPlayingCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.nowPlayingIcon}>{currentSound.icon}</Text>
          </Animated.View>
          <Text style={styles.nowPlayingLabel}>{currentSound.label}</Text>
          <Text style={styles.nowPlayingDesc}>{currentSound.desc}</Text>
          {remaining > 0 && <Text style={styles.timerDisplay}>{formatTime(remaining)}</Text>}
          <TouchableOpacity style={styles.stopBtn} onPress={stopSound}>
            <Text style={styles.stopBtnText}>정지</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.nowPlaying}>
          <View style={styles.nowPlayingCircleIdle}>
            <Text style={styles.nowPlayingIcon}>{'🎵'}</Text>
          </View>
          <Text style={styles.nowPlayingLabel}>{idleLabel}</Text>
          <Text style={styles.nowPlayingDesc}>아래에서 원하는 소리를 탭하세요</Text>
        </View>
      )}

      {/* Cry detection toggle (영유아 전용) */}
      {!isPrenatal && (
        <View style={styles.cryRow}>
          <View style={styles.cryInfo}>
            <Text style={styles.cryLabel}>{cryRowLabel}</Text>
            <Text style={styles.cryDesc}>
              {isListening ? '마이크 모니터링 중...' : '아이가 울면 자동으로 자장가를 틀어줘요'}
            </Text>
          </View>
          <Switch value={cryDetect} onValueChange={toggleCryDetect} trackColor={{ false: COLOR.cryOff, true: COLOR.cryOn }} thumbColor="#FFF" />
        </View>
      )}

      {/* Timer */}
      <View style={styles.timerRow}>
        <Text style={styles.timerLabel}>타이머</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timerChips}>
          {TIMER_OPTIONS.map((opt) => (
            <TouchableOpacity key={opt.minutes} style={[styles.timerChip, timer === opt.minutes && styles.timerChipActive]} onPress={() => handleTimer(opt.minutes)}>
              <Text style={[styles.timerChipText, timer === opt.minutes && styles.timerChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recording name input modal */}
      {showNameInput && (
        <View style={styles.nameInputWrap}>
          <Text style={styles.nameInputTitle}>{'🎤'} 녹음 저장</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="녹음 이름 (예: 엄마 자장가)"
            placeholderTextColor={COLOR.textSub}
            value={recordLabel}
            onChangeText={setRecordLabel}
            autoFocus
          />
          <View style={styles.nameInputBtns}>
            <TouchableOpacity style={styles.nameInputCancel} onPress={() => { setShowNameInput(false); setPendingRecordUri(null); }}>
              <Text style={styles.nameInputCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nameInputSave} onPress={saveRecording}>
              <Text style={styles.nameInputSaveText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sound Grid */}
      <ScrollView style={styles.soundList} showsVerticalScrollIndicator={false}>
        {(isPrenatal ? PRENATAL_CATEGORIES : CATEGORIES).map((cat) => (
          <View key={cat.key} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{cat.label}</Text>

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
                    {isRecording ? `녹음 중 ${formatTime(recordSecs)} (탭하여 중지)` : '엄마/아빠 목소리 녹음하기'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.recordHint}>최대 2분, 자장가를 불러주세요</Text>

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
                        <Text style={styles.soundIcon}>{'🎤'}</Text>
                        <Text style={[styles.soundLabel, isActive && styles.soundLabelActive]} numberOfLines={1}>
                          {rec.label}
                        </Text>
                        {isActive && <View style={styles.playingDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {myRecordings.length > 0 && (
                  <Text style={styles.recordDeleteHint}>길게 눌러 삭제</Text>
                )}
                {myRecordings.length === 0 && !isRecording && (
                  <Text style={styles.recordEmpty}>아직 녹음이 없어요</Text>
                )}
              </View>
            )}

            {/* Built-in sounds (lullaby mode) */}
            {!isPrenatal && cat.key !== 'myvoice' && (
              <View style={styles.soundGrid}>
                {BUILT_IN_SOUNDS.filter((s) => s.category === cat.key).map((sound) => {
                  const isActive = playing === sound.id;
                  return (
                    <TouchableOpacity
                      key={sound.id}
                      style={[styles.soundCard, isActive && styles.soundCardActive]}
                      onPress={() => handlePlay(sound.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.soundIcon}>{sound.icon}</Text>
                      <Text style={[styles.soundLabel, isActive && styles.soundLabelActive]}>{sound.label}</Text>
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
                      <Text style={styles.soundIcon}>{sound.icon}</Text>
                      <Text
                        style={[
                          styles.soundLabel,
                          isActive && styles.soundLabelActive,
                          isPending && styles.soundLabelPending,
                        ]}
                        numberOfLines={1}
                      >
                        {sound.label}
                      </Text>
                      {isPending && <Text style={styles.pendingBadge}>준비 중</Text>}
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
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLOR.text },
  headerSub: { fontSize: 14, color: COLOR.textSub, marginTop: 4 },

  nowPlaying: { alignItems: 'center', paddingVertical: 16 },
  nowPlayingCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLOR.cardActive, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLOR.accent,
    ...Platform.select({
      ios: { shadowColor: COLOR.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20 },
      android: { elevation: 10 },
    }),
  },
  nowPlayingCircleIdle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLOR.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLOR.accentSoft,
  },
  nowPlayingIcon: { fontSize: 38 },
  nowPlayingLabel: { fontSize: 17, fontWeight: '700', color: COLOR.text, marginTop: 10 },
  nowPlayingDesc: { fontSize: 13, color: COLOR.textSub, marginTop: 2 },
  timerDisplay: { fontSize: 22, fontWeight: '700', color: COLOR.timer, marginTop: 6, fontVariant: ['tabular-nums'] },
  stopBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FF6B6B' },
  stopBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  cryRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 24, marginBottom: 12,
    backgroundColor: COLOR.card, borderRadius: 14, padding: 14,
  },
  cryInfo: { flex: 1 },
  cryLabel: { fontSize: 14, fontWeight: '700', color: COLOR.text },
  cryDesc: { fontSize: 11, color: COLOR.textSub, marginTop: 2 },

  timerRow: { paddingHorizontal: 24, marginBottom: 12 },
  timerLabel: { fontSize: 13, fontWeight: '600', color: COLOR.textSub, marginBottom: 6 },
  timerChips: { gap: 8 },
  timerChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLOR.card, borderWidth: 1, borderColor: 'transparent',
  },
  timerChipActive: { backgroundColor: COLOR.cardActive, borderColor: COLOR.accent },
  timerChipText: { fontSize: 13, fontWeight: '600', color: COLOR.textSub },
  timerChipTextActive: { color: COLOR.accent },

  /* Recording name input */
  nameInputWrap: {
    marginHorizontal: 24, marginBottom: 12, backgroundColor: COLOR.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLOR.accent,
  },
  nameInputTitle: { fontSize: 15, fontWeight: '700', color: COLOR.text, marginBottom: 10 },
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
  soundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  soundCard: {
    width: '22%', aspectRatio: 1,
    backgroundColor: COLOR.card, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  soundCardActive: { backgroundColor: COLOR.cardActive, borderColor: COLOR.accent },
  soundIcon: { fontSize: 26, marginBottom: 2 },
  soundLabel: { fontSize: 10, fontWeight: '600', color: COLOR.textSub },
  soundLabelActive: { color: COLOR.accent },
  soundCardPending: { opacity: 0.55, borderStyle: 'dashed', borderColor: COLOR.textSub },
  soundLabelPending: { color: COLOR.textSub },
  pendingBadge: {
    position: 'absolute', top: 4, right: 4,
    fontSize: 8, fontWeight: '700', color: COLOR.textSub,
    backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 4, overflow: 'hidden',
  },
  playingDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLOR.accent, position: 'absolute', top: 6, right: 6,
  },

  /* My Voice */
  myVoiceSection: { marginBottom: 8 },
  recordBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLOR.card, borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: COLOR.accentSoft,
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
