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

const IC_MIC = require('../../assets/icon-mic.png') as number;
const IC_MASCOT = require('../../assets/mascot-happy.png') as number;

/* ================================================================== */
/*  Types & Constants                                                  */
/* ================================================================== */

interface VoiceDefaults {
  formulaAmount: string;
  breastDuration: string;
  napDuration: string;
  nightDuration: string;
}

const STORAGE_KEY = 'voice_defaults';

const EXAMPLE_COMMANDS = [
  { text: '윤도 방금 밥먹었어', desc: '이유식 기록' },
  { text: '분유 120ml 먹었어', desc: '분유 + 양 기록' },
  { text: '방금 소변 봤어', desc: '소변 기록' },
  { text: '똥 쌌어', desc: '대변 기록' },
  { text: '30분 전에 낮잠 잤어', desc: '낮잠 기록' },
  { text: '모유 수유했어', desc: '모유 기록' },
  { text: '간식 먹었어', desc: '간식 기록' },
  { text: '밤잠 잤어 2시간', desc: '밤잠 + 시간 기록' },
];

const DEEP_LINK = 'amatda://voice?text=';

/* ─── 가이드 데이터 ─── */

type AssistantKey = 'siri' | 'google' | 'bixby';

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
  trigger: '"시리야, 육아" → "윤도 밥먹었어"',
  urlNote: `${DEEP_LINK}{받아쓰기 텍스트}`,
  openLabel: '단축어 앱 열기',
  open: () => {
    Linking.openURL('shortcuts://').catch(() => {
      Alert.alert('단축어 앱', '설정 > 단축어에서 단축어 앱을 실행해주세요.');
    });
  },
  steps: [
    {
      title: '단축어 앱 열기',
      desc: 'iPhone 홈 화면에서 "단축어" 앱을 찾아 열어주세요. 없으면 App Store에서 "단축어"를 검색해서 다운로드하세요.',
    },
    {
      title: '새 단축어 만들기',
      desc: '오른쪽 상단 "+" 버튼을 눌러주세요. 새로운 빈 단축어가 만들어져요.',
    },
    {
      title: '"받아쓰기 텍스트" 추가',
      desc: '"동작 추가" 버튼을 누르고, 검색창에 "받아쓰기"를 입력하세요. "텍스트 받아쓰기"를 선택하면, 시리가 음성을 텍스트로 변환해줘요.',
    },
    {
      title: '"URL 열기" 추가',
      desc: '다시 하단 검색창에서 "URL"을 검색하고 "URL 열기"를 선택하세요.',
    },
    {
      title: 'URL 입력하기',
      desc: 'URL 칸을 눌러서 아래 URL을 붙여넣기 하세요. 그 다음 키보드 위에 있는 "받아쓰기 텍스트" 변수 버튼을 눌러서 URL 끝에 추가해주세요.',
    },
    {
      title: '이름을 짧게! "육아"로 설정',
      desc: '상단 제목을 눌러 단축어 이름을 "육아"로 바꿔주세요. 이름이 짧을수록 편해요! 완료를 누르면 끝!',
    },
    {
      title: '사용하기',
      desc: '"시리야, 육아" 라고 말하면 시리가 "뭐라고 할까요?" 라고 물어봐요. 그때 "윤도 밥먹었어", "똥 쌌어" 같이 자연스럽게 말하면 아맞다가 자동 기록해요!',
    },
  ],
};

const GOOGLE_GUIDE: AssistantGuide = {
  key: 'google',
  name: 'Google Assistant',
  subtitle: '모든 안드로이드',
  color: '#4285F4',
  trigger: '"OK Google, 육아" → 자동 마이크',
  urlNote: `${DEEP_LINK}{음성 텍스트}`,
  openLabel: 'Google Assistant 열기',
  open: () => {
    Linking.openURL('googleassistant://').catch(() => {
      Linking.openURL('intent://com.google.android.apps.googleassistant#Intent;scheme=launcher;package=com.google.android.apps.googleassistant;end').catch(() => {
        Alert.alert('Google Assistant', 'Google 앱을 열고 설정 > Google 어시스턴트 > 루틴에서 설정해주세요.');
      });
    });
  },
  steps: [
    {
      title: 'Google 앱 열기',
      desc: '"Google" 앱을 열고, 오른쪽 상단 프로필 사진을 눌러주세요. "설정" → "Google 어시스턴트"를 선택하세요.',
    },
    {
      title: '루틴 메뉴 찾기',
      desc: '"루틴" 메뉴를 찾아 눌러주세요. 없으면 상단 검색에서 "루틴"을 검색하세요.',
    },
    {
      title: '새 루틴 만들기',
      desc: '"+" 또는 "새 루틴" 버튼을 눌러주세요.',
    },
    {
      title: '시작 조건 설정',
      desc: '"시작 조건 추가"를 누르고 → "음성으로 말하기"를 선택 → "육아"라고 입력하세요. 짧을수록 편해요!',
    },
    {
      title: '작업 추가',
      desc: '"작업 추가"를 누르고 → "앱 열기"를 선택 → 목록에서 "아맞다"를 찾아 선택하세요. 또는 "웹사이트 열기"를 선택하고 아래 URL을 붙여넣기 하세요.',
    },
    {
      title: '저장하기',
      desc: '우측 상단 "저장" 버튼을 눌러주세요.',
    },
    {
      title: '사용하기',
      desc: '"OK Google, 육아" 라고 말하면 아맞다 앱이 열리면서 자동으로 마이크가 켜져요. "말씀하세요" 화면이 나오면 "윤도 밥먹었어" 처럼 말하면 자동 기록됩니다!',
    },
  ],
};

const BIXBY_GUIDE: AssistantGuide = {
  key: 'bixby',
  name: '빅스비',
  subtitle: '삼성 갤럭시',
  color: '#7B68EE',
  trigger: '"하이 빅스비, 육아" → 자동 마이크',
  urlNote: '',
  openLabel: '모드 및 루틴 열기',
  open: () => {
    Linking.openURL('intent://com.samsung.android.app.routines#Intent;scheme=launcher;package=com.samsung.android.app.routines;end').catch(() => {
      Linking.openURL('package:com.samsung.android.app.routines').catch(() => {
        Alert.alert('빅스비 루틴', '갤럭시 설정 앱을 열어서 "모드 및 루틴"을 검색해주세요.');
      });
    });
  },
  steps: [
    {
      title: '설정 앱 열기',
      desc: '갤럭시 "설정" 앱을 열어주세요.',
    },
    {
      title: '모드 및 루틴 찾기',
      desc: '"모드 및 루틴"을 눌러주세요. 보이지 않으면 설정 상단 검색에서 "루틴"을 검색하세요.',
    },
    {
      title: '루틴 탭 선택',
      desc: '상단에서 "루틴" 탭을 선택하고, "+" 버튼을 눌러 새 루틴을 만들어주세요.',
    },
    {
      title: '조건 설정',
      desc: '"조건 추가"를 누르고 → "직접 실행 버튼"을 선택하세요. 홈 화면에 바로가기 버튼이 생겨요. 또는 "빅스비 음성 명령"을 선택할 수도 있어요.',
    },
    {
      title: '실행 동작 추가',
      desc: '"실행할 동작 추가"를 누르고 → "앱 열기"를 선택 → 앱 목록에서 "아맞다"를 찾아 선택하세요.',
    },
    {
      title: '이름을 짧게! "육아"로 설정',
      desc: '루틴 이름을 "육아"로 바꾸고 "저장"을 눌러주세요. 짧을수록 말하기 편해요!',
    },
    {
      title: '사용하기',
      desc: '"하이 빅스비, 육아" 라고 말하거나 홈 화면 바로가기 버튼을 누르면 아맞다가 열리면서 자동으로 마이크가 켜져요. "말씀하세요" 화면이 나오면 "윤도 밥먹었어" 처럼 말하면 자동 기록됩니다!',
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

  useEffect(() => {
    loadDefaults();
  }, []);

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

  /* 항상 3가지 모두 표시 */
  const guides: AssistantGuide[] = [SIRI_GUIDE, GOOGLE_GUIDE, BIXBY_GUIDE];

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
          <DefaultInput label="낮잠 기본 시간" value={defaults.napDuration} unit="분" placeholder="30" onChange={(v) => updateField('napDuration', v)} />
          <DefaultInput label="밤잠 기본 시간" value={defaults.nightDuration} unit="분" placeholder="480" onChange={(v) => updateField('nightDuration', v)} />

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
                  <Text style={s.assistantName}>{guide.name}</Text>
                  <Text style={s.assistantSub}>{guide.subtitle}</Text>
                </View>
                <View style={s.assistantTriggerBox}>
                  <Text style={s.assistantTrigger}>{guide.trigger}</Text>
                </View>
                <Text style={s.chevron}>{'>'}</Text>
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
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FDFAF7', borderRadius: RADIUS.md,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E5EA',
  },
  assistantDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  assistantInfo: { flex: 1 },
  assistantName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  assistantSub: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 1 },
  assistantTriggerBox: { backgroundColor: '#F5EDE4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  assistantTrigger: { fontSize: 10, fontWeight: '600', color: COLORS.text },
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
