import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Platform,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { isPinShortcutSupported, requestPinVoiceShortcut } from '../../modules/shortcut-pin/src';

const IC_MIC = require('../../assets/icon-mic.png') as number;
const IC_MASCOT = require('../../assets/mascot-happy.png') as number;

/* ================================================================== */
/*  Types & Constants                                                  */
/* ================================================================== */

interface VoiceDefaults {
  formulaAmount: string;
  breastDuration: string;
  /** 통합 수면 기본 시간 — 앱이 낮잠/밤잠 구분 없이 '수면' 으로 기록함 */
  napDuration: string;
  /** 하위 호환용 — 신규 화면에서는 표시 안 함 (있으면 napDuration fallback) */
  nightDuration: string;
}

const STORAGE_KEY = 'voice_defaults';

const EXAMPLE_COMMANDS = [
  { text: '윤도 방금 밥먹었어', desc: '이유식 기록' },
  { text: '분유 120ml 먹었어', desc: '분유 + 양 기록' },
  { text: '방금 소변 봤어', desc: '소변 기록' },
  { text: '똥 쌌어', desc: '대변 기록' },
  { text: '10시부터 11시까지 잤어', desc: '수면 + 시작/종료 시간' },
  { text: '왼쪽 모유 15분', desc: '모유 + 좌/우 + 시간' },
  { text: '모유 수유했어', desc: '모유 (좌/우 자동 추천)' },
  { text: '해열제 먹였어', desc: '투약 기록' },
  { text: '비타민 먹였어', desc: '투약 기록' },
];

const DEEP_LINK = 'amatda://voice?text=';

/* ─── 가이드 데이터 ─── */

type AssistantKey = 'siri' | 'bixby' | 'google';

interface AssistantGuide {
  key: AssistantKey;
  name: string;
  subtitle: string;
  platformLabel?: string;
  color: string;
  trigger: string;
  steps: { title: string; desc: string }[];
  urlNote: string;
  openLabel: string;
  open: () => void;
}

const SIRI_GUIDE: AssistantGuide = {
  key: 'siri',
  name: 'Siri',
  subtitle: 'iPhone / iPad (iOS 전용)',
  platformLabel: 'iPhone 사용자',
  color: '#5856D6',
  trigger: '"시리야, 육아" → 말하면 바로 기록',
  urlNote: `${DEEP_LINK}{받아쓰기 텍스트}`,
  openLabel: '단축어 앱 열기',
  open: () => {
    Linking.openURL('shortcuts://').catch(() => {
      Alert.alert('단축어 앱', 'App Store에서 "단축어"를 검색해 설치하세요.');
    });
  },
  steps: [
    {
      title: '단축어 앱 열기 → 오른쪽 상단 + 탭',
      desc: '아래 버튼으로 단축어 앱을 여세요. 없으면 App Store에서 "단축어"로 설치하세요 (Apple 기본 앱, 무료).\n\n앱이 열리면 화면 오른쪽 상단 ＋ 버튼을 탭하세요. 빈 단축어 편집 화면이 열려요.',
    },
    {
      title: '동작 ① "텍스트 받아쓰기" 추가',
      desc: '편집 화면 하단 검색창(또는 "동작 추가" 버튼)에 "받아쓰기"를 입력하세요.\n검색 결과에서 "텍스트 받아쓰기"를 탭해서 추가하세요.\n\n이 동작이 "시리야, 육아" 실행 후 내 말을 텍스트로 변환해줘요.',
    },
    {
      title: '동작 ② "URL 열기" 추가',
      desc: '화면 하단 검색창에 "URL 열기"를 입력하세요.\n검색 결과에서 "URL 열기"를 탭해서 두 번째 동작으로 추가하세요.',
    },
    {
      title: 'URL 입력 → 변수 연결 ← 이 단계가 핵심',
      desc: '"URL 열기" 동작의 URL 입력란을 탭하세요.\n아래 "URL 복사" 버튼으로 복사 후 붙여넣으세요.\n\n그 다음: 붙여넣은 URL 끝에 커서를 두면 키보드 위에 파란색 변수 바가 나타나요. 거기서 "받아쓰기 텍스트"(파란 알약 모양 토큰)를 탭하면 URL 뒤에 자동으로 연결돼요.\n\n토큰이 안 보이면 화면 하단 "변수 선택"을 탭하세요.',
    },
    {
      title: '단축어 이름을 "육아"로 저장',
      desc: '편집 화면 상단의 "새로운 단축어" 제목을 탭하세요.\n"이름 변경"을 탭 → "육아" 입력 → 완료를 누르세요.\n\n오른쪽 상단 "완료"를 눌러 저장하세요.',
    },
    {
      title: '완성! 이렇게 사용하세요',
      desc: '"시리야, 육아"라고 말하면 → 시리가 "뭐라고 말할까요?" 물어봐요 → "윤도 밥먹었어", "분유 120ml 먹었어" 처럼 말하면 → 아맞다 앱이 열리면서 자동 기록돼요!\n\n※ 처음 실행 시 마이크/앱 권한 허용 팝업이 나와요. 모두 "허용"을 눌러주세요.',
    },
  ],
};

const BIXBY_GUIDE: AssistantGuide = {
  key: 'bixby',
  name: '빅스비 (Bixby) — 갤럭시',
  subtitle: '"하이 빅스비, 아맞다 실행" 직접 명령',
  platformLabel: '갤럭시 사용자',
  color: '#1E88E5',
  trigger: '"하이 빅스비, 아맞다 실행" → 앱 열리며 자동 녹음',
  urlNote: '',
  openLabel: '빅스비 설정 열기',
  open: () => {
    Linking.openURL('intent://#Intent;action=com.samsung.android.app.assistantmenu;package=com.samsung.android.bixby.agent;end')
      .catch(() => {
        Alert.alert('빅스비 설정', '설정 앱 → 검색에 "빅스비" 입력 → 결과 탭. 또는 사이드 키 길게 누름.');
      });
  },
  steps: [
    {
      title: '먼저 알아두세요 (2026년 현재 상태)',
      desc: '· 갤럭시 S25 / One UI 7 이상: 빅스비 "빠른 명령어(Quick Commands)" 기능이 **2024년 12월 삭제**됐어요. 더 이상 "아맞다 음성" 같은 단축 트리거를 등록할 수 없습니다.\n· 갤럭시 S26 / One UI 8.5+: Perplexity 기반 새 빅스비로 교체됨. 단축 명령어 없음.\n· 즉, "하이 빅스비, ___" 부분에 임의 단어를 매핑하는 기능은 더 이상 제공되지 않아요.\n\n[현재 작동하는 방법]\n빅스비에게 직접 "아맞다 실행" 같은 앱 이름 명령을 말하는 방식만 가능합니다. 빅스비는 설치된 앱 이름을 인식해 실행해줘요. 한국어 앱 이름 인식이 매번 잘 되지는 않으므로, **방법 ① 앱 아이콘 길게 누르기**가 가장 확실합니다.',
    },
    {
      title: '방법 ① 앱 아이콘 길게 누르기 (가장 확실, 항상 작동)',
      desc: '1) 홈 화면(또는 앱스 화면)에서 "아맞다" 아이콘을 0.5초 이상 꾹 누르세요.\n2) 위쪽에 작은 단축 메뉴가 떠요. "음성 기록" 항목이 있어요.\n3) "음성 기록" 탭 → 앱이 열리며 음성 인식이 즉시 시작.\n4) 그대로 말씀하시면 됩니다. 예: "윤도 분유 120 먹었어"\n\n[홈 화면에 1탭 아이콘 만들기]\n· "음성 기록" 항목을 손가락으로 끌어 홈 화면 빈 공간에 놓으면 → 별도 아이콘으로 고정.\n· 이제 1탭에 음성 녹음 진입.',
    },
    {
      title: '방법 ② "하이 빅스비, 아맞다 실행" 직접 명령',
      desc: '빅스비는 등록된 앱 이름을 인식해 실행할 수 있어요. 단, "아맞다" 한국어 발음을 매번 잘 인식하지는 않습니다(시도해보고 잘 되면 사용).\n\n[전제]\n· 설정 → 고급 기능 → 빅스비 → "하이 빅스비" ON.\n· 빅스비 처음 사용 시 음성 학습(내 목소리 4회 등록) 진행.\n· 아맞다 앱이 한 번 이상 실행된 적 있어야 빅스비 색인에 잡힘.\n\n[사용]\n· "하이 빅스비" 발화 → 신호음 후 → "아맞다 실행"\n· 또는 "하이 빅스비, 아맞다 열어줘"\n· 빅스비가 "아맞다 앱을 실행할까요?"로 되물으면 "응" 응답.\n\n[잘 안 되면]\n· 발음을 또렷이 "아 맞 다" 끊어서.\n· "amatda 열기"(영문 발음)로 시도.\n· 빅스비 설정 → 언어 → 한국어 음성 모델 재다운로드.\n· 안 되면 방법 ①(아이콘 길게)이 가장 안정적입니다.',
    },
    {
      title: '방법 ③ 모드 및 루틴 — 위젯 트리거 (음성 X)',
      desc: '음성 트리거 자체는 어렵지만, "모드 및 루틴"으로 잠금 화면 위젯이나 특정 조건 발생 시 앱 자동 실행이 가능해요.\n\n예: "수유 시간 알림" 시 자동으로 아맞다 실행.\n1) 설정 → "모드 및 루틴" → 루틴 탭 → ＋.\n2) "이프(조건)" → 시간/장소/배터리 등 선택.\n3) "덴(동작)" → "앱 열기" → 아맞다 선택 → 저장.\n\n· 단, "음성으로 트리거" 조건은 One UI 7+에서 사용 불가(빠른 명령어 삭제 영향).\n· 핸즈프리 음성 호출이 핵심이라면 방법 ①이 답입니다.',
    },
    {
      title: '안 되면 체크리스트',
      desc: '· 빅스비 깨우기 ON / 음성 학습 완료.\n· 아맞다 앱 처음 설치 후 한 번 실행한 적 있음.\n· 빅스비가 잘 인식한 명령어로 시도: "아맞다 실행" / "아맞다 열어줘" / "아맞다 켜줘".\n· 알람/통화/녹음 중에는 "하이 빅스비" 깨움 차단됨.\n· 빅스비 자체가 한국어 발음 "아맞다"를 못 알아들으면 → 방법 ① 사용.\n· (참고) "하이 빅스비, 아맞다 음성기록 켜줘" 같은 긴 자연어 명령은 빅스비가 매핑 불가.',
    },
  ],
};

const GOOGLE_GUIDE: AssistantGuide = {
  key: 'google',
  name: 'Google 어시스턴트 / Gemini',
  subtitle: '"헤이 구글, 아맞다 열어줘" 직접 명령',
  platformLabel: 'Pixel / 일반 안드로이드',
  color: '#4285F4',
  trigger: '"헤이 구글, 아맞다 열어줘" → 앱 열리며 자동 녹음',
  urlNote: '',
  openLabel: 'Google 어시스턴트 설정',
  open: () => {
    Linking.openURL('googlequicksearchbox://').catch(() => {
      Linking.openURL('https://assistant.google.com/').catch(() => {
        Alert.alert('Google 어시스턴트', 'Google/Gemini 앱 → 프로필 → 설정.');
      });
    });
  },
  steps: [
    {
      title: '먼저 알아두세요 (2026년 현재 상태)',
      desc: '· **Google 어시스턴트가 2026년 중 Gemini로 완전 교체** 진행 중. 안드로이드 폰의 기본 어시스턴트는 Gemini로 바뀌었어요.\n· **사용자 정의 단축 트리거(예: "헤이 구글, 육아" → 아맞다 열기)** 는 Gemini Routines에서 **공식 지원이 빠지거나 폰마다 안 보입니다**. 한국어 빌드에서 더 심함.\n· Google 어시스턴트 옛 "루틴"의 "맞춤 작업" 메뉴가 사라진 폰이 많아요. 이게 사용자가 시도해봐도 안 되는 이유.\n· **단, 기본 명령 "헤이 구글, [앱 이름] 열어줘"는 등록 없이 작동**합니다. 어시스턴트/Gemini가 설치된 앱 목록에서 직접 매칭해요.',
    },
    {
      title: '방법 ① 앱 아이콘 길게 누르기 (가장 확실, 항상 작동)',
      desc: '음성 등록 / 루틴 설정 모두 필요 없어요.\n\n1) 홈 화면(또는 앱 서랍)에서 아맞다 아이콘을 꾹 길게 누르세요.\n2) 단축 메뉴에 "음성 기록" 항목 표시.\n3) 탭 → 앱 열리며 즉시 음성 인식 시작.\n4) 바로 발화.\n\n[홈에 1탭 아이콘 고정]\n· "음성 기록"을 끌어 홈 화면 빈 공간에 드롭 → 별도 단축 아이콘 생성.\n· 이제 1탭 = 음성 녹음 진입.',
    },
    {
      title: '방법 ② "헤이 구글(Gemini), 아맞다 열어줘" 직접 명령',
      desc: 'Gemini가 설치된 앱 이름을 인식해 실행할 수 있어요. 등록 절차 없음.\n\n[전제]\n1) Gemini 앱(또는 Google 앱) → 좌상단 프로필 → 설정 → "Google 어시스턴트(또는 Gemini와 핸즈프리)" → "헤이 구글" 또는 "Hey Google" 토글 ON.\n2) Voice Match 음성 학습 (한 번만, 약 1분).\n3) 어시스턴트 언어를 한국어로 설정.\n4) 아맞다 앱이 한 번 이상 실행돼 색인에 들어가 있어야 함.\n\n[사용]\n· "헤이 구글" 발화 → 신호음 후 → "아맞다 열어줘"\n· 또는 "헤이 구글, 아맞다 실행"\n· Gemini가 인식하면 앱이 열리며 음성 인식 자동 시작.\n\n[잘 안 되면]\n· 한국어 발음 "아맞다"가 어려우면: 영문 "amatda"로 시도.\n· 어시스턴트가 다른 앱(검색 결과 등)을 띄우면 → "맞다 앱 열어줘", "아맞다 앱 실행" 식으로 단어 추가.\n· 어시스턴트 언어를 "한국어 + 영어" 동시 사용으로 설정하면 인식률 상승.',
    },
    {
      title: '방법 ③ 잠금 화면에서 호출 (필요 시)',
      desc: '잠금 상태에서 발화하려면:\n\n1) Google/Gemini 앱 → 프로필 → 설정 → "음성"(또는 "Hey Google과 Voice Match").\n2) Voice Match ON → "Hey Google" 토글 ON.\n3) "잠금 화면에서 결과 표시" ON.\n\n· 잠금 상태에서도 발화 인식.\n· 단, 보안 잠금 설정 시 앱 진입 직후 잠금 해제 요구될 수 있음(앱 내부 화면 정책).',
    },
    {
      title: '왜 "헤이 구글, 육아" 같은 단축어 등록이 안 되나요?',
      desc: '많은 분이 시도하시는데 안 되는 이유:\n\n· Google 어시스턴트의 옛 "루틴 → 맞춤 작업" 메뉴가 2024~2026 Gemini 전환 과정에서 한국어 빌드에선 대부분 제거됐어요.\n· Google Home 앱의 "자동화" 탭은 스마트홈 기기 위주로 재편됨. 외부 앱 실행 액션이 한국 사용자 일부에선 노출되지 않습니다.\n· "App Actions" 기능은 영어권 위주 색인이라 한국어 앱 이름 매칭이 약합니다.\n\n[가장 확실한 핸즈프리 대안]\n· **유료 자동화 앱 Tasker + AutoVoice** (Play 스토어, 약 4,500원 + 부가): "헤이 구글, AutoVoice 육아" 식으로 트리거 → 딥링크 amatda://voice 실행 → 앱 열리며 자동 녹음. 설정은 복잡하지만 작동은 가장 확실. (관심 있으면 별도 문의)\n· 그 외엔 방법 ①(아이콘 길게)이 가장 빠르고 확실.',
    },
    {
      title: '안 되면 체크리스트',
      desc: '· "헤이 구글" 토글 + Voice Match 등록 둘 다 완료.\n· 어시스턴트 언어 = 한국어 (또는 한국어 + 영어).\n· 마이크 권한 ON.\n· 발음 또렷이 "아 맞 다 / 열 어 줘"로 끊어 시도.\n· 아맞다가 한 번도 안 열렸으면 우선 일반 실행 한 번.\n· 어시스턴트가 검색만 띄우면 → "아맞다 앱 열어줘"로 "앱" 단어 추가.\n· (참고) 2026년 5월 현재 안드로이드에서 사용자 정의 한 단어 트리거로 외부 앱 여는 공식 경로는 사실상 없음. 방법 ① 권장.',
    },
  ],
};

/* ================================================================== */
/*  AsyncStorage wrapper                                               */
/* ================================================================== */

let _storage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
} | null = null;

async function getStorage() {
  if (_storage) return _storage;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    _storage = mod.default;
    return _storage;
  } catch {
    const mem: Record<string, string> = {};
    _storage = {
      getItem: async (k: string) => mem[k] ?? null,
      setItem: async (k: string, v: string) => { mem[k] = v; },
    };
    return _storage;
  }
}

/* ─── Clipboard wrapper ─── */

async function copyToClipboard(text: string) {
  try {
    const clip = await import('expo-clipboard');
    await clip.setStringAsync(text);
    return true;
  } catch {
    try {
      const { Clipboard: RNClipboard } = await import('react-native') as unknown as {
        Clipboard: { setString: (s: string) => void };
      };
      RNClipboard.setString(text);
      return true;
    } catch {
      return false;
    }
  }
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function VoiceSettingsScreen() {
  const children = useChildStore((s) => s.children);
  const selectedChild = useChildStore((s) => s.selectedChild);

  const [defaults, setDefaults] = useState<VoiceDefaults>({
    formulaAmount: '',
    breastDuration: '',
    napDuration: '',
    nightDuration: '',
  });
  const [saved, setSaved] = useState(false);
  const [openGuide, setOpenGuide] = useState<AssistantGuide | null>(null);
  const [copied, setCopied] = useState(false);
  const [pinSupported, setPinSupported] = useState(false);
  const [pinning, setPinning] = useState(false);

  useEffect(() => {
    loadDefaults();
    // Android 단축 아이콘 고정 지원 여부 확인 (런처별 다름)
    isPinShortcutSupported().then(setPinSupported);
  }, []);

  const handlePinShortcut = useCallback(async () => {
    if (pinning) return;
    setPinning(true);
    try {
      const result = await requestPinVoiceShortcut();
      if (result.ok) {
        // 시스템 다이얼로그가 곧 표시됨. 사용자가 "추가" 누르면 홈에 아이콘 생성.
        Alert.alert(
          '확인 다이얼로그',
          '안드로이드 시스템에서 "바로가기 추가" 확인 창이 떠요. "추가"를 눌러주세요.',
        );
      } else if (result.reason === 'LAUNCHER_UNSUPPORTED') {
        Alert.alert(
          '미지원 런처',
          '현재 사용 중인 홈 런처가 단축 아이콘 고정을 지원하지 않아요. 대신 앱 아이콘을 길게 눌러서 "음성 기록" 항목을 끌어 홈에 놓으세요.',
        );
      } else if (result.reason === 'UNSUPPORTED_ANDROID_VERSION') {
        Alert.alert('미지원', 'Android 8.0 이상에서만 가능해요.');
      } else if (result.reason === 'NATIVE_MODULE_UNAVAILABLE') {
        Alert.alert('빌드 필요', '이 기능은 최신 빌드에서만 작동해요. 앱을 업데이트해주세요.');
      } else {
        Alert.alert('실패', '단축 아이콘 추가에 실패했어요. 다시 시도해주세요.');
      }
    } finally {
      setPinning(false);
    }
  }, [pinning]);

  const loadDefaults = async () => {
    const storage = await getStorage();
    if (!storage) return;
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as VoiceDefaults;
        setDefaults(parsed);
      } catch { /* ignore */ }
    }
  };

  const saveDefaults = useCallback(async () => {
    const storage = await getStorage();
    if (!storage) return;
    await storage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [defaults]);

  const updateField = (key: keyof VoiceDefaults, value: string) => {
    const numbersOnly = value.replace(/[^0-9]/g, '');
    setDefaults((prev) => ({ ...prev, [key]: numbersOnly }));
  };

  const handleCopyUrl = async (url: string) => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      Alert.alert('복사 실패', '직접 URL을 길게 눌러 복사해주세요.');
    }
  };

  /* 항상 모두 표시 — Siri(iOS) / 빅스비(갤럭시) / Google(공통) */
  const guides: AssistantGuide[] = [SIRI_GUIDE, BIXBY_GUIDE, GOOGLE_GUIDE];

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Image source={IC_MIC} style={s.headerIcon} resizeMode="contain" />
          <Text style={s.headerTitle}>{'음성 기록 설정'}</Text>
          <Text style={s.headerSub}>{'목소리로 육아 기록을 바로 남겨보세요'}</Text>
        </View>

        {/* ── Section 1: 기본값 설정 ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{'기본값 설정'}</Text>
          <Text style={s.cardDesc}>{'음성 명령에 양이나 시간을 말하지 않으면 여기 설정한 값이 자동으로 적용돼요'}</Text>

          <DefaultInput label="분유 기본량" value={defaults.formulaAmount} unit="ml" placeholder="120" onChange={(v) => updateField('formulaAmount', v)} />
          <DefaultInput label="모유 수유 시간" value={defaults.breastDuration} unit="분" placeholder="15" onChange={(v) => updateField('breastDuration', v)} />
          {/* 앱이 낮잠/밤잠 구분 없이 통합 '수면' 으로 기록 — 입력 1개로 통합 */}
          <DefaultInput
            label="수면 기본 시간"
            value={defaults.napDuration || defaults.nightDuration}
            unit="분"
            placeholder="60"
            onChange={(v) => {
              updateField('napDuration', v);
              // nightDuration 도 같이 비워두기 — voice.tsx fallback 이 napDuration 우선
              updateField('nightDuration', '');
            }}
          />

          <TouchableOpacity style={s.saveBtn} onPress={saveDefaults}>
            <Text style={s.saveBtnText}>{saved ? '저장 완료!' : '저장'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Section 2: 내 아이 정보 ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{'등록된 아이'}</Text>
          <Text style={s.cardDesc}>{'음성에서 아이 이름을 말하면 자동으로 매칭돼요'}</Text>
          {children.map((child) => (
            <View key={child.id} style={s.childRow}>
              <View style={[s.childDot, child.id === selectedChild?.id && s.childDotActive]} />
              <Text style={s.childName}>{child.name}</Text>
              <Text style={s.childAge}>{child.ageInfo?.label ?? ''}</Text>
              {child.id === selectedChild?.id && (
                <View style={s.defaultBadge}>
                  <Text style={s.defaultBadgeText}>{'기본'}</Text>
                </View>
              )}
            </View>
          ))}
          <Text style={s.childHint}>{'* 이름을 말하지 않으면 "기본" 아이에게 기록돼요'}</Text>
        </View>

        {/* ── Section 3: 음성 명령 예시 ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{'이렇게 말해보세요'}</Text>
          <Text style={s.cardDesc}>{'아래 예시처럼 자연스럽게 말하면 AI가 알아서 분석해요'}</Text>

          {EXAMPLE_COMMANDS.map((cmd, idx) => (
            <View key={idx} style={s.exampleRow}>
              <View style={s.exampleBubble}>
                <Text style={s.exampleQuote}>{`"${cmd.text}"`}</Text>
              </View>
              <Text style={s.exampleArrow}>{'→'}</Text>
              <Text style={s.exampleDesc}>{cmd.desc}</Text>
            </View>
          ))}

          <View style={s.tipBox}>
            <Text style={s.tipTitle}>{'TIP'}</Text>
            <Text style={s.tipText}>
              {'시간: "방금", "30분 전", "1시에"\n양: "120ml"\n시간: "30분", "2시간"\n이름: "윤도", "승하" 등 아이 이름 포함'}
            </Text>
          </View>
        </View>

        {/* ── Section 3.5: 홈 화면 음성 단축 아이콘 (Android only) ── */}
        {Platform.OS === 'android' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{'홈 화면 음성 아이콘'}</Text>
            <Text style={s.cardDesc}>
              {'홈 화면에 별도 "음성 기록" 아이콘을 만들면 1탭으로 즉시 녹음 시작. 음성 비서 설정 없이 가장 빠른 방법이에요.'}
            </Text>

            <TouchableOpacity
              style={[s.saveBtn, !pinSupported && s.disabledBtn]}
              onPress={handlePinShortcut}
              disabled={!pinSupported || pinning}
              accessibilityRole="button"
              accessibilityLabel="홈 화면에 음성 단축 아이콘 추가"
            >
              <Text style={s.saveBtnText}>
                {pinning ? '추가 중...' : '＋ 홈 화면에 추가'}
              </Text>
            </TouchableOpacity>

            {!pinSupported && (
              <Text style={s.childHint}>
                {'* 사용 중인 런처가 미지원이거나 Android 8.0 미만이에요. 앱 아이콘을 길게 누른 뒤 "음성 기록"을 홈으로 끌어 놓으세요.'}
              </Text>
            )}
          </View>
        )}

        {/* ── Section 4: 음성 비서 설정 카드 ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{'음성 비서 연결하기'}</Text>
          <Text style={s.cardDesc}>{'원하는 음성 비서를 선택해서 설정 방법을 확인하세요'}</Text>

          {guides.map((guide) => (
            <View key={guide.key}>
              {guide.platformLabel && (
                <Text style={s.platformLabel}>{guide.platformLabel}</Text>
              )}
              <TouchableOpacity
                style={s.assistantCard}
                onPress={() => { setCopied(false); setOpenGuide(guide); }}
                activeOpacity={0.7}
              >
                <View style={[s.assistantDot, { backgroundColor: guide.color }]} />
                <View style={s.assistantInfo}>
                  <View style={s.assistantNameRow}>
                    <Text style={s.assistantName}>{guide.name}</Text>
                    <Text style={s.chevron}>{'>'}</Text>
                  </View>
                  <Text style={s.assistantSub}>{guide.subtitle}</Text>
                  <View style={s.assistantTriggerBox}>
                    <Text style={s.assistantTrigger}>{guide.trigger}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Mascot footer */}
        <View style={s.footer}>
          <Image source={IC_MASCOT} style={s.footerMascot} resizeMode="contain" />
          <Text style={s.footerText}>{'음성으로 더 빠르게 기록해보세요!'}</Text>
        </View>

      </ScrollView>

      {/* ── 상세 가이드 모달 ── */}
      <Modal
        visible={openGuide !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpenGuide(null)}
      >
        {openGuide && (
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setOpenGuide(null)} style={s.modalClose}>
                <Text style={s.modalCloseText}>{'닫기'}</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>{`${openGuide.name} 설정 방법`}</Text>
              <View style={s.modalClose} />
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false}>
              {/* 트리거 안내 */}
              <View style={[s.triggerBanner, { backgroundColor: openGuide.color + '15' }]}>
                <Text style={[s.triggerBannerLabel, { color: openGuide.color }]}>{'설정 완료 후 이렇게 말하세요'}</Text>
                <Text style={[s.triggerBannerText, { color: openGuide.color }]}>{openGuide.trigger}</Text>
              </View>

              {/* 단계별 가이드 */}
              {openGuide.steps.map((step, idx) => (
                <View key={idx} style={s.modalStep}>
                  <View style={[s.modalStepCircle, { backgroundColor: openGuide.color }]}>
                    <Text style={s.modalStepNum}>{String(idx + 1)}</Text>
                  </View>
                  <View style={s.modalStepContent}>
                    <Text style={s.modalStepTitle}>{step.title}</Text>
                    <Text style={s.modalStepDesc}>{step.desc}</Text>

                    {/* URL 입력 단계에서 URL 복사 박스 표시 */}
                    {openGuide.urlNote && step.title.includes('URL') && (
                      <View style={s.modalUrlBox}>
                        <Text style={s.modalUrlText} selectable numberOfLines={2}>{openGuide.urlNote}</Text>
                        <TouchableOpacity
                          style={[s.copyBtn, copied && s.copyBtnDone]}
                          onPress={() => handleCopyUrl(openGuide.urlNote)}
                        >
                          <Text style={[s.copyBtnText, copied && s.copyBtnTextDone]}>
                            {copied ? '복사됨!' : 'URL 복사'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}

              {/* 하단 버튼들 */}
              <TouchableOpacity
                style={[s.modalOpenBtn, { backgroundColor: openGuide.color }]}
                onPress={() => { openGuide.open(); }}
              >
                <Text style={s.modalOpenBtnText}>{openGuide.openLabel}</Text>
              </TouchableOpacity>

              <View style={s.modalNote}>
                <Text style={s.modalNoteText}>
                  {'* 음성 비서 설정은 각 앱에서 직접 해야 해요. 보안 정책상 외부 앱에서 자동 설정이 불가능합니다.'}
                </Text>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function DefaultInput({
  label, value, unit, placeholder, onChange,
}: {
  label: string; value: string; unit: string; placeholder: string; onChange: (v: string) => void;
}) {
  return (
    <View style={s.inputRow}>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.inputField}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#C4B5A5"
          keyboardType="number-pad"
          maxLength={4}
        />
        <Text style={s.inputUnit}>{unit}</Text>
      </View>
    </View>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 120 },

  /* Header */
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: SPACING.lg },
  headerIcon: { width: 48, height: 48, marginBottom: 12, tintColor: COLORS.primary },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  headerSub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  /* Card */
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md, padding: SPACING.lg, ...SHADOWS.soft,
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.md, lineHeight: 16 },

  /* Default inputs */
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5EDE4' },
  inputLabel: { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '500', flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9F5', borderRadius: RADIUS.sm, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E5EA' },
  inputField: { width: 60, height: 40, fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '600', textAlign: 'center' },
  inputUnit: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginLeft: 4 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.md },
  saveBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#FFFFFF' },
  disabledBtn: { backgroundColor: '#C4B5A5', opacity: 0.6 },

  /* Children list */
  childRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5EDE4' },
  childDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E0D5C8', marginRight: 10 },
  childDotActive: { backgroundColor: COLORS.primary },
  childName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, flex: 1 },
  childAge: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginRight: 8 },
  defaultBadge: { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  defaultBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.primary },
  childHint: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 8, fontStyle: 'italic' },

  /* Examples */
  exampleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  exampleBubble: { backgroundColor: '#FFF0E6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, flex: 1 },
  exampleQuote: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '500' },
  exampleArrow: { marginHorizontal: 8, fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '700' },
  exampleDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '500', width: 80 },

  /* Tip box */
  tipBox: { backgroundColor: '#F0F7FF', borderRadius: RADIUS.sm, padding: 14, marginTop: SPACING.sm },
  tipTitle: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: '#4A90D9', marginBottom: 4 },
  tipText: { fontSize: FONT_SIZE.xs, color: '#5A7A9A', lineHeight: 18 },

  /* ── Assistant cards ── */
  platformLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 4, marginLeft: 2,
  },
  assistantCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FDFAF7', borderRadius: RADIUS.md,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E5EA',
  },
  assistantDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12, marginTop: 4 },
  assistantInfo: { flex: 1 },
  assistantNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  assistantName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  assistantSub: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: 6 },
  assistantTriggerBox: { alignSelf: 'flex-start', backgroundColor: '#F5EDE4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  assistantTrigger: { fontSize: 10, fontWeight: '600', color: COLORS.text, lineHeight: 14 },
  chevron: { fontSize: FONT_SIZE.lg, color: '#C4B5A5', fontWeight: '300' },

  /* ── Modal ── */
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  modalClose: { width: 50 },
  modalCloseText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, textAlign: 'center', flex: 1 },
  modalScroll: { padding: 20, paddingBottom: 60 },

  /* Trigger banner */
  triggerBanner: { borderRadius: RADIUS.md, padding: 16, marginBottom: 24, alignItems: 'center' },
  triggerBannerLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600', marginBottom: 4 },
  triggerBannerText: { fontSize: FONT_SIZE.xl, fontWeight: '800' },

  /* Modal steps */
  modalStep: { flexDirection: 'row', marginBottom: 20 },
  modalStepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  modalStepNum: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  modalStepContent: { flex: 1 },
  modalStepTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  modalStepDesc: { fontSize: FONT_SIZE.sm, color: '#6B5E50', lineHeight: 22 },

  /* Modal URL box */
  modalUrlBox: {
    backgroundColor: '#F8F4F0', borderRadius: RADIUS.sm, padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: '#E8E0D8', borderStyle: 'dashed',
  },
  modalUrlText: {
    fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 8,
  },
  copyBtn: {
    alignSelf: 'flex-start', backgroundColor: COLORS.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  copyBtnDone: { backgroundColor: '#4CAF50' },
  copyBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: '#FFFFFF' },
  copyBtnTextDone: { color: '#FFFFFF' },

  /* Modal open button */
  modalOpenBtn: { borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  modalOpenBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#FFFFFF' },

  /* Modal note */
  modalNote: { marginTop: 16, padding: 12, backgroundColor: '#FFF9F5', borderRadius: RADIUS.sm },
  modalNoteText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 18 },

  /* Footer */
  footer: { alignItems: 'center', paddingVertical: SPACING.xl },
  footerMascot: { width: 60, height: 60, marginBottom: 8 },
  footerText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
});
