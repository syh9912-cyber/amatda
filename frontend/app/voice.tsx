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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { trackerApi, childApi } from '../services/api';
import { loadRecords, saveRecords, loadSleepSession, saveSleepSession } from '../features/baby-tracker/storage';
import { resolveAuthorMeta, stampAuthor } from '../features/baby-tracker/author';
import type { TrackerRecord } from '../features/baby-tracker/types';
import { AdSlot } from '../components/ads/AdSlot';

const IC_MASCOT = require('../assets/mascot-happy.png') as number;
const IC_MIC = require('../assets/icon-mic.png') as number;

interface ParsedRecord {
  type: 'diaper' | 'feeding' | 'sleep' | 'medication';
  subType: string;
  date?: string;
  time?: string;
  endTime?: string;
  amount?: number;
  duration?: number;
  note?: string;
  childName?: string;
}

interface ParsedMulti {
  records: ParsedRecord[];
}

const SUBTYPE_LABEL_KEYS: Record<string, string> = {
  pee: 'voice.subtypePee', poop: 'voice.subtypePoop', both: 'voice.subtypeBoth',
  breast: 'voice.subtypeBreast', formula: 'voice.subtypeFormula', baby_food: 'voice.subtypeBabyFood', snack: 'voice.subtypeSnack',
  nap: 'voice.subtypeNap', night: 'voice.subtypeNight', sleep: 'voice.subtypeSleep',
  fever: 'voice.subtypeFever', antibiotic: 'voice.subtypeAntibiotic', vitamin: 'voice.subtypeVitamin', other: 'voice.subtypeOther',
};

function getSubtypeLabel(t: TFunction, subType: string): string {
  const key = SUBTYPE_LABEL_KEYS[subType];
  return key ? t(key) : subType;
}

/* ================================================================== */
/*  Speech Recognition wrapper (dynamic import, graceful fallback)     */
/* ================================================================== */

interface SpeechSubscription {
  remove: () => void;
}

interface SpeechModule {
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: () => Promise<{ granted: boolean }>;
    start: (opts: { lang: string; interimResults: boolean }) => void;
    stop: () => void;
    isRecognitionAvailable: () => boolean;
    // EventEmitter API (React hook이 아닌 일반 이벤트 리스너 — callback 내부에서 사용 가능)
    addListener: (event: string, callback: (ev: unknown) => void) => SpeechSubscription;
  };
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
  const { t } = useTranslation();
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
  // 음성 모듈이 로드됐는지(Case 1 포함) — 에러 화면 '다시 말하기' 노출 기준.
  const [speechReady, setSpeechReady] = useState(false);
  // 직전 기록 정보 — 연속 기록 시 화면에 표시
  const [lastRecord, setLastRecord] = useState('');

  const speechModuleRef = useRef<SpeechModule | null>(null);
  const hasProcessed = useRef(false);
  // 최신 recognizedText 를 이벤트 핸들러 클로저에서 접근하기 위한 ref
  const recognizedTextRef = useRef('');
  // 디바운스 타이머 — 말 중간 무음에서 자동 종료 방지
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // EventEmitter 구독 — unmount 시 정리
  const subscriptionsRef = useRef<SpeechSubscription[]>([]);
  // 첫 입력 전 빈 재시작 횟수 — Siri 핸드오프 직후 오디오 충돌/무음 조기종료 시 자동 종료 대신 재시도
  const restartCountRef = useRef(0);

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

  // recognizedText 가 바뀔 때마다 ref 동기화 (이벤트 핸들러 클로저에서 최신값 접근)
  useEffect(() => {
    recognizedTextRef.current = recognizedText;
  }, [recognizedText]);

  const startListening = useCallback((mod: SpeechModule) => {
    try {
      mod.ExpoSpeechRecognitionModule.start({
        lang: 'ko-KR',
        interimResults: true,
        continuous: true, // 무음 후에도 계속 듣기 (디바운스 + end 이벤트로 종료)
        // Android: 무음 종료 threshold 늘림 — 말 중간 숨고르기 도중 자동 종료 방지
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 3000, // 완전 무음 3초까지 기다림
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2500, // 약한 무음 2.5초
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 5000, // 최소 5초 발화 허용
        },
      } as Parameters<typeof mod.ExpoSpeechRecognitionModule.start>[0]);
      setPhase('listening');
      setStatus(t('voice.statusSpeak'));
      setRecognizedText('');
    } catch {
      setError(t('voice.errorCannotStart'));
      setPhase('error');
    }
  }, [t]);

  // ── Main flow ──
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }

    let mounted = true;

    // Case 1: text provided (from Siri Shortcuts deep link)
    // → 즉시 처리 후, 완료되면 연속 기록을 위해 음성 인식 시작
    if (text && text.trim().length >= 2) {
      setPhase('processing');
      setStatus(t('voice.statusAnalyzing'));
      setRecognizedText(text.trim());
      processVoice(text.trim());
      // speechModuleRef 초기화 (processVoice 완료 후 연속 모드 시작 시 필요)
      loadSpeechModule().then((mod) => {
        if (mod && mounted) { speechModuleRef.current = mod; setSpeechReady(true); }
      }).catch(() => { /* ignore */ });
      return () => { mounted = false; };
    }

    // Case 2: no text → try speech recognition (App Shortcut / Google Assistant)
    initSpeechRecognition();

    // unmount 시 EventEmitter 구독 + 디바운스 타이머 정리
    return () => {
      mounted = false;
      subscriptionsRef.current.forEach((sub) => { try { sub.remove(); } catch { /* ignore */ } });
      subscriptionsRef.current = [];
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isAuthenticated]);

  async function initSpeechRecognition() {
    const mod = await loadSpeechModule();
    if (!mod) {
      setError(t('voice.errorUnavailable'));
      setPhase('error');
      setTimeout(() => router.replace('/(main)/baby-tracker'), 2000);
      return;
    }

    speechModuleRef.current = mod;
    setSpeechReady(true);

    // 가용성 확인
    try {
      const available = mod.ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        setError(t('voice.errorDeviceUnsupported'));
        setPhase('error');
        setTimeout(() => router.replace('/(main)/baby-tracker'), 2000);
        return;
      }
    } catch {
      // 일부 버전에서 없을 수 있음 — 계속 진행
    }

    // 권한 요청 (5초 타임아웃 — requestPermissionsAsync 무한 대기 방지)
    setStatus(t('voice.statusCheckingMic'));
    try {
      const perm = await Promise.race<{ granted: boolean }>([
        mod.ExpoSpeechRecognitionModule.requestPermissionsAsync(),
        new Promise<{ granted: boolean }>((_, reject) =>
          setTimeout(() => reject(new Error('permission-timeout')), 5000),
        ),
      ]);
      if (!perm.granted) {
        setError(t('voice.errorMicPermission'));
        setPhase('error');
        setTimeout(() => router.replace('/(main)/baby-tracker'), 2000);
        return;
      }
    } catch {
      // 타임아웃이거나 권한 확인 실패 — 일단 진행 시도
    }

    setStatus('');

    // ── 이벤트 리스너 등록 (EventEmitter addListener — React hook 이 아님) ──
    // useSpeechRecognitionEvent(React hook)는 useCallback 콜백 내에서 호출 불가.
    // addListener 는 일반 EventEmitter API 로 어디서든 호출 가능.
    //
    // ★ 디바운스 — 말 중간 숨고르기로 isFinal 가 떨어져도 즉시 process X.
    // 2초 안에 새 result 안 들어오면 그때 process. 새 result 들어오면 timer reset.
    const SILENCE_DEBOUNCE_MS = 2000;
    const resultSub = mod.ExpoSpeechRecognitionModule.addListener('result', (ev: unknown) => {
      const event = ev as { results?: { transcript: string; isFinal: boolean }[] };
      if (event.results && event.results.length > 0) {
        const result = event.results[0];
        setRecognizedText(result.transcript);
        if (result.transcript.trim().length >= 2) {
          restartCountRef.current = 0; // 실제 입력 들어옴 — 빈 재시작 카운터 리셋
          setStatus(t('voice.statusListening'));
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            if (!hasProcessed.current) {
              hasProcessed.current = true;
              setPhase('processing');
              setStatus(t('voice.statusAnalyzing'));
              processVoice(result.transcript.trim());
              try { mod.ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
            }
          }, SILENCE_DEBOUNCE_MS);
        }
      }
    });

    const MAX_EMPTY_RESTARTS = 15;
    const errorSub = mod.ExpoSpeechRecognitionModule.addListener('error', (ev: unknown) => {
      if (hasProcessed.current) return;
      const event = ev as { error?: string; message?: string };
      const errorMsg = event.message || event.error || '';
      const hasText = recognizedTextRef.current.trim().length >= 2;
      // 첫 입력 전(텍스트 없음)에는 자동 종료 금지 — Siri 핸드오프 직후 오디오 충돌/무음 등을 재시작으로 흡수.
      // 사용자는 상단 "완료" 버튼으로만 화면을 빠져나간다.
      if (!hasText && restartCountRef.current < MAX_EMPTY_RESTARTS) {
        restartCountRef.current += 1;
        setStatus(t('voice.statusSpeak'));
        setTimeout(() => { if (!hasProcessed.current) startListening(mod); }, 500);
        return;
      }
      if (errorMsg.includes('no-speech') || errorMsg.includes('No speech')) {
        startListening(mod);
        return;
      }
      // 재시도 소진 — 에러 화면(재시도/완료 버튼). 자동 이탈하지 않음.
      setError(t('voice.errorRestartFailed'));
      setPhase('error');
    });

    const endSub = mod.ExpoSpeechRecognitionModule.addListener('end', () => {
      // 디바운스 진행 중이면 우선권 줘서 그 timer 가 처리 — end 는 백업
      if (debounceTimerRef.current) return;
      // recognizedTextRef 로 최신 텍스트 접근 (stale closure 방지)
      const currentText = recognizedTextRef.current;
      if (!hasProcessed.current && currentText.trim().length >= 2) {
        hasProcessed.current = true;
        setPhase('processing');
        setStatus(t('voice.statusAnalyzing'));
        processVoice(currentText.trim());
        return;
      }
      // 텍스트 없이 인식이 끝남(첫 입력 전 무음 종료) → 자동 종료 대신 계속 듣기.
      // 사용자가 상단 "완료" 버튼을 누르기 전까지 대기한다.
      if (!hasProcessed.current && restartCountRef.current < MAX_EMPTY_RESTARTS) {
        restartCountRef.current += 1;
        setTimeout(() => { if (!hasProcessed.current) startListening(mod); }, 400);
      }
    });

    subscriptionsRef.current = [resultSub, errorSub, endSub];

    setSpeechAvailable(true);
    // Siri 핸드오프 직후 오디오 세션이 풀릴 시간 확보 — 즉시 시작하면 오디오 충돌로 조기 종료됨.
    restartCountRef.current = 0;
    setTimeout(() => { if (!hasProcessed.current) startListening(mod); }, 800);
  }

  // ── Process voice text ──
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
      const parsedData = res.data?.data as ParsedMulti | ParsedRecord | undefined;
      // 백워드 호환 — 옛 응답(단일 객체) / 새 응답({records:[]}) 모두 처리
      const records: ParsedRecord[] = Array.isArray((parsedData as ParsedMulti)?.records)
        ? (parsedData as ParsedMulti).records
        : (parsedData && (parsedData as ParsedRecord).type
          ? [parsedData as ParsedRecord]
          : []);

      if (records.length === 0) {
        setError(t('voice.errorNoRecordParsed'));
        setPhase('error');
        setTimeout(() => router.replace('/(main)/baby-tracker'), 1500);
        return;
      }
      // 단일 사건 처리는 기존 로직, 다중 사건은 첫 record 기준으로 child 매칭 후 일괄 저장
      const parsed = records[0];

      // ── 아이 이름 매칭 ──
      // 클로저 stale 방지: useChildStore.getState()로 항상 최신 store 직접 조회
      // (이벤트 핸들러/비동기 함수 내 Zustand 표준 패턴 — 컴포넌트 렌더 시점 클로저와 무관)
      const { children: storeChildren, selectedChild: storeSelectedChild, selectChild: storeSelectChild } = useChildStore.getState();

      // 1순위: 음성 텍스트에 등록된 이름이 직접 포함되는지 (아이 수 무관)
      // 2순위: AI 추출 childName 으로 정규화 비교
      // 3순위: 현재 선택된 아이(selectedChild) 유지
      let targetChildId = storeSelectedChild?.id;

      const nameMatchByText = storeChildren.find((c) => voiceText.includes(c.name.trim()));
      if (nameMatchByText) {
        targetChildId = nameMatchByText.id;
        storeSelectChild(nameMatchByText.id);
      } else if (parsed.childName) {
        const normalizedParsed = parsed.childName.trim();
        const nameMatchByAI = storeChildren.find((c) => c.name.trim() === normalizedParsed);
        if (nameMatchByAI) {
          targetChildId = nameMatchByAI.id;
          storeSelectChild(nameMatchByAI.id);
        }
      }

      // 최종 fallback 1: store children 비어있으면 서버 fetch (단축 아이콘으로 home 안 거치고 진입한 케이스)
      let availableChildren = storeChildren;
      if (availableChildren.length === 0) {
        try {
          const res = await childApi.list();
          const fetched = (res.data?.data ?? []) as typeof storeChildren;
          if (fetched.length > 0) {
            useChildStore.getState().setChildren(fetched);
            availableChildren = useChildStore.getState().children;
          }
        } catch (e) {
          console.error('voice: childApi.list failed', e);
        }
      }

      // 최종 fallback 2: 등록된 아이가 1명이라도 있으면 첫 번째 자동 선택
      if (!targetChildId && availableChildren.length > 0) {
        targetChildId = availableChildren[0].id;
        storeSelectChild(availableChildren[0].id);
      }

      if (!targetChildId) {
        setError(availableChildren.length === 0 ? t('voice.errorRegisterChildFirst') : t('voice.errorSelectChild'));
        setPhase('error');
        setTimeout(() => router.replace('/(main)/home'), 1500);
        return;
      }

      // 다중 사건 일괄 처리: 날짜별로 묶어 한 번씩 저장
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const recordsByDate: Record<string, TrackerRecord[]> = {};
      let lastBreastNote: '왼쪽' | '오른쪽' | null = null;
      // 공동육아: 초대받은 가족이 음성으로 기록하면 작성자 라벨 주입 (소유자는 no-op)
      const authorMeta = await resolveAuthorMeta(targetChildId);

      // 진행 중(종료 미정) 수면 발화 감지 — "자고있어/자는중/취침 중/지금 자/아직 자" 이면서
      // 기상('일어났/깼/기상')·범위 종료('까지')가 없을 때. 마지막 sleep record 를 라이브 대상으로.
      const isOngoingSleepUtter =
        /자고\s*있|자는\s*중|취침\s*중|지금\s*자|아직\s*자/.test(voiceText) &&
        !/일어났|깼|기상|까지/.test(voiceText);
      const sleepIdxs = records.map((rec, idx) => (rec.type === 'sleep' ? idx : -1)).filter((idx) => idx >= 0);
      const ongoingSleepIdx = isOngoingSleepUtter && sleepIdxs.length > 0 ? sleepIdxs[sleepIdxs.length - 1] : -1;

      for (let i = 0; i < records.length; i++) {
        const r = records[i];

        // 옛 nap/night → sleep
        if (r.type === 'sleep' && (r.subType === 'nap' || r.subType === 'night')) {
          r.subType = 'sleep';
        }
        // 기본값 적용
        if (r.amount == null && r.subType === 'formula' && voiceDefaults.formulaAmount) {
          r.amount = Number(voiceDefaults.formulaAmount);
        }
        if (r.duration == null) {
          if (r.subType === 'breast' && voiceDefaults.breastDuration) {
            r.duration = Number(voiceDefaults.breastDuration);
          } else if (r.type === 'sleep') {
            const napD = Number(voiceDefaults.napDuration) || 0;
            const nightD = Number(voiceDefaults.nightDuration) || 0;
            const sleepD = napD > 0 ? napD : nightD;
            if (sleepD > 0) r.duration = sleepD;
          }
        }

        // 진행 중(종료 미정) 수면이면 종료시각·지속시간을 비워, 아래 활성 수면 세션 등록 로직이 라이브로 잡도록 한다.
        if (i === ongoingSleepIdx) {
          r.endTime = undefined;
          r.duration = undefined;
        }

        const dateStr = r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : todayStr;
        const timeStr = r.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const recordId = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;

        // cross-day sleep endTime 정규화 — "M/D HH:MM" 형식 필요
        // baby-tracker 가 endTime.startsWith("{todayMonth}/{todayDay} ") 로 cross-day 감지
        // 음성 파서가 HH:MM 만 주면 today 가 표시 안 됨 → 자정 넘었을 때 prefix 추가
        let endTimeStr = r.endTime;
        if (r.type === 'sleep' && endTimeStr && /^\d{1,2}:\d{2}$/.test(endTimeStr)) {
          const [sh, sm] = timeStr.split(':').map((v) => parseInt(v, 10));
          const [eh, em] = endTimeStr.split(':').map((v) => parseInt(v, 10));
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;
          // 종료가 시작보다 빠르면 자정 넘음 → 다음날 prefix 추가
          if (!isNaN(startMin) && !isNaN(endMin) && endMin < startMin) {
            const [yy, mm, dd] = dateStr.split('-').map((v) => parseInt(v, 10));
            const nextDay = new Date(Date.UTC(yy, mm - 1, dd + 1));
            const nm = nextDay.getUTCMonth() + 1;
            const nd = nextDay.getUTCDate();
            endTimeStr = `${nm}/${nd} ${endTimeStr}`;
          }
        }

        // 모유 좌/우 자동 추천 — note 없으면 직전 모유의 반대쪽
        let autoNote = r.note;
        if (r.type === 'feeding' && r.subType === 'breast' && !autoNote) {
          if (lastBreastNote === null) {
            try {
              const existingForSide = await loadRecords(targetChildId, dateStr);
              const lastBreast = [...existingForSide]
                .reverse()
                .find((rec) => rec.type === 'feeding' && rec.subType === 'breast' && (rec.note === '왼쪽' || rec.note === '오른쪽'));
              if (lastBreast?.note === '왼쪽' || lastBreast?.note === '오른쪽') lastBreastNote = lastBreast.note;
            } catch { /* ignore */ }
          }
          if (lastBreastNote === '왼쪽') autoNote = '오른쪽';
          else if (lastBreastNote === '오른쪽') autoNote = '왼쪽';
          if (autoNote === '왼쪽') lastBreastNote = '왼쪽';
          else if (autoNote === '오른쪽') lastBreastNote = '오른쪽';
        } else if (r.type === 'feeding' && r.subType === 'breast' && (r.note === '왼쪽' || r.note === '오른쪽')) {
          lastBreastNote = r.note;
        }

        const record: TrackerRecord = stampAuthor({
          id: recordId,
          type: r.type as TrackerRecord['type'],
          subType: r.subType,
          time: timeStr,
          createdAt: new Date(Date.now() + i).toISOString(),
          ...(endTimeStr ? { endTime: endTimeStr } : {}),
          ...(r.amount != null ? { amount: r.amount } : {}),
          ...(r.duration != null ? { duration: r.duration } : {}),
          ...(autoNote ? { note: autoNote } : {}),
        }, authorMeta);

        if (!recordsByDate[dateStr]) recordsByDate[dateStr] = [];
        recordsByDate[dateStr].push(record);
      }

      // 날짜별로 한 번씩 saveRecords (로컬 + 서버 putDay + home bump)
      try {
        for (const [dateStr, dayRecords] of Object.entries(recordsByDate)) {
          const existing = await loadRecords(targetChildId, dateStr);
          await saveRecords(targetChildId, dateStr, [...existing, ...dayRecords]);
        }
      } catch {
        // 로컬 저장 실패 — "완료" 로 위장하지 않고 에러 화면(재시도 버튼)으로 전환
        setError(t('voice.errorSaveFailed'));
        setPhase('error');
        return;
      }

      // 진행 중(종료 미정) 수면 → 활성 수면 세션으로 등록 (오늘 + 기존 진행중 세션 없을 때)
      // → 진행중(LIVE) 표시 + 나중에 '기상' 탭으로 마감. 정적 record 에서는 제거(중복 방지).
      try {
        const existingSession = await loadSleepSession(targetChildId);
        const todayRecs = recordsByDate[todayStr];
        if (todayRecs) {
          const opens = todayRecs.filter((rec) => rec.type === 'sleep' && !rec.endTime);
          // 등록 조건: open 수면이 있고, (기존 활성 세션 없음) 또는 (사용자가 '자고있어' 명시 → 기존 세션 덮어쓰기)
          if (opens.length > 0 && (!existingSession || ongoingSleepIdx >= 0)) {
            const latest = opens.reduce((a, b) => (b.time > a.time ? b : a));
            const remaining = (await loadRecords(targetChildId, todayStr)).filter((rec) => rec.id !== latest.id);
            await saveRecords(targetChildId, todayStr, remaining);
            const [hh, mi] = latest.time.split(':').map((v) => parseInt(v, 10));
            const [yy, mo, dd] = todayStr.split('-').map((v) => parseInt(v, 10));
            const startTime = new Date(yy, mo - 1, dd, hh || 0, mi || 0).toISOString();
            await saveSleepSession(targetChildId, { startTime, startDate: todayStr, note: latest.note });
          }
        }
      } catch { /* best-effort */ }

      const totalCount = records.length;
      const firstLabel = getSubtypeLabel(t, records[0].subType);
      const doneLabel = totalCount === 1
        ? t('voice.doneSingleLabel', { label: firstLabel, time: records[0].time ?? '' })
        : t('voice.doneMultiLabel', { count: totalCount, label: firstLabel });
      setStatus(totalCount === 1 ? t('voice.statusDoneSingle', { label: firstLabel }) : t('voice.statusDoneMulti', { count: totalCount }));
      setLastRecord(doneLabel);
      setPhase('done');

      // 연속 기록 모드: 1.5초 후 자동으로 다시 듣기 시작
      // 사용자가 직접 "완료" 버튼을 눌러야만 화면에서 나감
      setTimeout(() => {
        recognizedTextRef.current = '';
        hasProcessed.current = false;
        setRecognizedText('');
        setStatus('');
        // 리스너(result/error/end) 등록 여부로 분기 — 모듈만 있고 리스너가 없으면
        // (Case 1 Siri 텍스트 경로) startListening만 하면 result 이벤트를 못 받아
        // 무한 듣기 상태가 됨. 리스너 없으면 initSpeechRecognition부터 호출.
        if (speechModuleRef.current && subscriptionsRef.current.length > 0) {
          startListening(speechModuleRef.current);
        } else {
          initSpeechRecognition();
        }
      }, 1500);
    } catch {
      setError(t('voice.errorAnalysisFailed'));
      setPhase('error');
      setTimeout(() => router.replace('/(main)/baby-tracker'), 1500);
    }
  }

  // 다시 말하기 (에러 후 재시도)
  const handleRetry = () => {
    recognizedTextRef.current = '';
    hasProcessed.current = false;
    setError('');
    setRecognizedText('');
    // 리스너가 등록돼 있으면 바로 재청취, 아니면(Case 1 등) 초기화부터 — 리스너 보강
    if (speechModuleRef.current && subscriptionsRef.current.length > 0) {
      startListening(speechModuleRef.current);
    } else {
      initSpeechRecognition();
    }
  };

  // 완료 버튼: 음성 인식 중지 후 baby-tracker 이동
  const handleClose = useCallback(() => {
    if (speechModuleRef.current) {
      try { speechModuleRef.current.ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
    }
    subscriptionsRef.current.forEach((sub) => { try { sub.remove(); } catch { /* ignore */ } });
    subscriptionsRef.current = [];
    router.replace({
      pathname: '/(main)/baby-tracker',
      params: lastRecord ? { voiceToast: lastRecord + '!' } : {},
    });
  }, [lastRecord]);

  return (
    <View style={s.container}>

      {/* ── 완료 버튼 (항상 상단 고정) ── */}
      <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
        <Text style={s.closeBtnText}>{t('common.complete')}</Text>
      </TouchableOpacity>

      {/* ── Listening mode: mic animation ── */}
      {phase === 'listening' && (
        <>
          <Animated.View style={[s.micOuter, { transform: [{ scale: micPulse }] }]}>
            <View style={s.micCircle}>
              <Image source={IC_MIC} style={s.micIcon} resizeMode="contain" />
            </View>
          </Animated.View>

          <Text style={s.listeningTitle}>{t('voice.listeningTitle')}</Text>
          <Text style={s.listeningHint}>
            {t('voice.listeningHint')}
          </Text>

          {recognizedText.length > 0 && (
            <View style={s.bubble}>
              <Text style={s.bubbleText}>{recognizedText}</Text>
            </View>
          )}

          {/* 직전 기록 표시 */}
          {lastRecord.length > 0 && recognizedText.length === 0 && (
            <View style={s.lastRecordBadge}>
              <Text style={s.lastRecordText}>{`✓ ${lastRecord}`}</Text>
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
            <Text style={s.statusText}>{status || t('voice.statusPreparing')}</Text>
          )}

          {recognizedText.length > 0 && (
            <View style={s.bubble}>
              <Text style={s.bubbleText}>{`"${recognizedText}"`}</Text>
            </View>
          )}

          {phase === 'done' && (
            <View style={s.doneBadge}>
              <Text style={s.doneBadgeText}>{t('voice.doneNextPrompt')}</Text>
            </View>
          )}
        </>
      )}

      {/* ── Error mode ── */}
      {phase === 'error' && (
        <>
          <Image source={IC_MASCOT} style={s.mascot} resizeMode="contain" />
          <Text style={s.errorText}>{error}</Text>

          {(speechAvailable || speechReady) && (
            <TouchableOpacity style={s.retryBtn} onPress={handleRetry}>
              <Text style={s.retryBtnText}>{t('voice.retrySpeak')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[s.retryBtn, s.closeBtnAlt]} onPress={handleClose}>
            <Text style={s.retryBtnText}>{t('voice.backToTracker')}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* 하단 광고 — MEDIUM_RECTANGLE (300×250) 무음 배너 */}
      <View style={s.adWrap} pointerEvents="box-none">
        <AdSlot variant="medium" />
      </View>
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
    // 마이크/안내 위로 올려서 하단 광고(300×250) 공간 확보
    justifyContent: 'flex-start',
    paddingTop: 80,
    paddingHorizontal: 32,
    paddingBottom: 0,
  },

  /* MEDIUM_RECTANGLE 광고 wrap — 하단 고정 (300×250) */
  adWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
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

  /* 완료 버튼 (상단 고정) */
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    backgroundColor: '#F0EDE8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: '#8B7D6B' },

  /* 에러 화면 닫기 버튼 */
  closeBtnAlt: { backgroundColor: '#E8E0D8', marginTop: 12 },

  /* 직전 기록 뱃지 */
  lastRecordBadge: {
    marginTop: 24,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lastRecordText: { fontSize: 13, fontWeight: '600', color: '#388E3C' },
});
