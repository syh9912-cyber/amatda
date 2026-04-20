import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useChildStore } from '../../stores/childStore';
import { coachingApi } from '../../services/api';
import { isScreenAvailable } from '../../constants/ageFeatures';

/* ── 색상 ── */
const COLORS = {
  bg: '#F2F2F7',
  white: '#FFFFFF',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  accent: '#FF8C5A',
  border: '#E5E5EA',
  normal: '#7DD3B8',
  normalBg: '#E8FAF8',
  attention: '#FFD76E',
  attentionBg: '#FFF9E6',
  warning: '#FF8C5A',
  warningBg: '#FFF0E8',
  purple: '#7C83EC',
  purpleBg: '#EEEDFC',
};

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
}

interface AnalysisResult {
  analysis: string;
  possibilities: { label: string; likelihood: string }[];
  recommendations: string[];
  needsDoctor: boolean;
  usage?: UsageInfo;
}

const LIKELIHOOD_CONFIG: Record<string, { color: string; bg: string }> = {
  '높음': { color: '#D32F2F', bg: '#FFF0F0' },
  '보통': { color: '#F57C00', bg: '#FFF8E1' },
  '낮음': { color: COLORS.normal, bg: COLORS.normalBg },
};

export default function CryAnalyzerScreen() {
  const router = useRouter();
  const selectedChild = useChildStore((s) => s.selectedChild);

  // 연령 제한: 영아(0-24개월)만 접근 가능
  useEffect(() => {
    const ageGroup = selectedChild?.ageInfo?.group ?? 'infant';
    if (!isScreenAvailable('cry-analyzer', ageGroup)) {
      Alert.alert('안내', '울음 분석은 영아(0~24개월) 전용 기능이에요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    }
  }, [selectedChild, router]);

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string>('audio/m4a');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  /* ── 파일 선택 ── */
  const handlePickFile = useCallback(async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      // 네이티브 모듈 존재 확인 (Expo Go에서는 없음)
      if (!DocumentPicker.getDocumentAsync) {
        Alert.alert('알림', '파일 선택 기능은 빌드된 앱에서만 사용 가능합니다.');
        return;
      }
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!pickerResult.canceled && pickerResult.assets?.[0]) {
        const asset = pickerResult.assets[0];
        setFileUri(asset.uri);
        setFileName(asset.name);
        setFileMime(asset.mimeType ?? 'audio/m4a');
        setResult(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('native module')) {
        Alert.alert(
          '빌드 필요',
          '녹음 파일 선택은 빌드된 앱(APK)에서만 사용 가능합니다.\nExpo Go에서는 지원되지 않아요.',
        );
      } else {
        Alert.alert('파일 선택 오류', `파일을 열 수 없습니다.\n${msg}`);
      }
    }
  }, []);

  /* ── 분석 ── */
  const handleAnalyze = useCallback(async () => {
    if (!fileUri || !selectedChild) return;
    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await coachingApi.analyzeMedia(
        selectedChild.id,
        'cry',
        undefined,
        base64,
        fileMime,
      );
      const data = res.data?.data as AnalysisResult | undefined;
      if (data) setResult(data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; usage?: UsageInfo } } };
      if (axiosErr.response?.status === 429) {
        const usage = axiosErr.response.data?.usage;
        setResult({
          analysis: axiosErr.response.data?.error ?? '이번 달 분석 횟수를 모두 사용했습니다.',
          possibilities: [],
          recommendations: [],
          needsDoctor: false,
          usage,
        });
      } else {
        setResult({
          analysis: '분석에 실패했습니다. 다시 시도해주세요.',
          possibilities: [],
          recommendations: [],
          needsDoctor: false,
        });
      }
    } finally {
      setAnalyzing(false);
    }
  }, [fileUri, fileMime, selectedChild]);

  const handleReset = useCallback(() => {
    setResult(null);
    setFileUri(null);
    setFileName(null);
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtn}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'울음소리 분석기'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {result ? (
          <ResultView result={result} onReset={handleReset} />
        ) : (
          <>
            {/* 안내 카드 */}
            <View style={styles.guideCard}>
              <Image source={require('../../assets/mascot-worried.png')} style={styles.guideImage} resizeMode="contain" />
              <Text style={styles.guideTitle}>{'울음소리를 분석해요'}</Text>
              <Text style={styles.guideDesc}>
                {'아이의 울음소리 녹음 파일을 선택하면\nAI가 울음의 원인을 분석해 드려요.'}
              </Text>
            </View>

            {/* 파일 선택 영역 */}
            <View style={styles.fileSection}>
              {fileUri ? (
                <>
                  <Text style={styles.fileDoneEmoji}>{'🎵'}</Text>
                  <Text style={styles.fileDoneText}>{fileName ?? '녹음 파일 선택됨'}</Text>
                  <View style={styles.fileBtnRow}>
                    <TouchableOpacity
                      style={styles.reSelectBtn}
                      onPress={() => { setFileUri(null); setFileName(null); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.reSelectBtnText}>{'다른 파일 선택'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.selectBtn}
                    onPress={handlePickFile}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectBtnEmoji}>{'📁'}</Text>
                    <Text style={styles.selectBtnText}>{'녹음 파일 선택하기'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.selectHint}>{'mp3, m4a, wav 등 오디오 파일'}</Text>
                </>
              )}
            </View>

            {/* 분석 버튼 */}
            <TouchableOpacity
              style={[styles.analyzeBtn, (!fileUri || analyzing) && styles.analyzeBtnOff]}
              onPress={handleAnalyze}
              disabled={!fileUri || analyzing}
              activeOpacity={0.7}
            >
              {analyzing ? (
                <View style={styles.analyzingRow}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={styles.analyzeBtnText}>{'AI 분석 중...'}</Text>
                </View>
              ) : (
                <Text style={styles.analyzeBtnText}>
                  {fileUri ? '울음소리 분석하기' : '파일을 먼저 선택해주세요'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>{'녹음 팁'}</Text>
              <Text style={styles.tipText}>
                {'- 스마트폰 기본 녹음 앱으로 5~15초 정도 녹음해주세요\n- 아이 가까이에서 녹음하면 정확도가 높아요\n- 주변 소음이 적을수록 좋아요\n- 녹음 후 이 화면에서 파일을 선택하세요'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ── 결과 뷰 ── */
function ResultView({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  return (
    <View style={resultStyles.container}>
      {result.needsDoctor && (
        <View style={resultStyles.warningBanner}>
          <Text style={resultStyles.warningIcon}>{'🏥'}</Text>
          <View style={resultStyles.warningTextWrap}>
            <Text style={resultStyles.warningTitle}>{'병원 확인이 필요해요'}</Text>
            <Text style={resultStyles.warningDesc}>
              {'평소와 다른 울음이 지속된다면 소아과 방문을 권장합니다.'}
            </Text>
          </View>
        </View>
      )}

      <View style={resultStyles.analysisCard}>
        <Text style={resultStyles.analysisTitle}>{'분석 결과'}</Text>
        <Text style={resultStyles.analysisText}>{result.analysis}</Text>
      </View>

      {result.possibilities.length > 0 && (
        <View style={resultStyles.sectionCard}>
          <Text style={resultStyles.sectionTitle}>{'가능성 분석'}</Text>
          {result.possibilities.map((p, i) => {
            const cfg = LIKELIHOOD_CONFIG[p.likelihood] ?? LIKELIHOOD_CONFIG['보통'];
            return (
              <View key={i} style={resultStyles.possibilityRow}>
                <Text style={resultStyles.possibilityLabel}>{p.label}</Text>
                <View style={[resultStyles.likelihoodBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[resultStyles.likelihoodText, { color: cfg.color }]}>{p.likelihood}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {result.recommendations.length > 0 && (
        <View style={[resultStyles.sectionCard, { backgroundColor: COLORS.normalBg }]}>
          <Text style={resultStyles.sectionTitle}>{'달래는 방법'}</Text>
          {result.recommendations.map((rec, i) => (
            <View key={i} style={resultStyles.bulletRow}>
              <Text style={resultStyles.bulletNum}>{`${i + 1}`}</Text>
              <Text style={resultStyles.bulletText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      {result.usage && (
        <View style={resultStyles.usageBox}>
          <Text style={resultStyles.usageText}>
            {'이번 달 분석 '}{result.usage.used}{'/'}{result.usage.limit}{'회 사용 (남은 횟수: '}{result.usage.remaining}{'회)'}
          </Text>
        </View>
      )}

      <View style={resultStyles.disclaimerBox}>
        <Text style={resultStyles.disclaimerText}>
          {'이 분석은 참고용이며 의료 진단을 대체하지 않습니다.'}
        </Text>
      </View>

      <TouchableOpacity style={resultStyles.resetBtn} onPress={onReset} activeOpacity={0.7}>
        <Text style={resultStyles.resetBtnText}>{'다시 분석하기'}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── 스타일 ── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 14, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { fontSize: 22, color: COLORS.text, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  headerSpacer: { width: 22 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },

  guideCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 16, elevation: 1,
  },
  guideEmoji: { fontSize: 48, marginBottom: 12 },
  guideImage: { width: 80, height: 80, marginBottom: 12 },
  guideTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  guideDesc: { fontSize: 13, color: COLORS.textSub, lineHeight: 20, textAlign: 'center' },

  fileSection: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 32,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 16, elevation: 1,
  },
  selectBtn: {
    width: '100%', paddingVertical: 28, alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.purple, borderStyle: 'dashed',
    borderRadius: 16, backgroundColor: COLORS.purpleBg,
  },
  selectBtnEmoji: { fontSize: 36, marginBottom: 10 },
  selectBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.purple },
  selectHint: { fontSize: 12, color: COLORS.textLight, marginTop: 10 },

  fileDoneEmoji: { fontSize: 48, marginBottom: 12 },
  fileDoneText: {
    fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 16,
    textAlign: 'center',
  },
  fileBtnRow: { flexDirection: 'row', gap: 12 },
  reSelectBtn: {
    backgroundColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  reSelectBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSub },

  analyzeBtn: {
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 16,
  },
  analyzeBtnOff: { opacity: 0.5 },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  tipCard: {
    backgroundColor: COLORS.attentionBg, borderRadius: 14, padding: 16,
  },
  tipTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  tipText: { fontSize: 13, color: COLORS.textSub, lineHeight: 20 },
});

const resultStyles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 24 },

  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.warningBg, borderRadius: 14,
    padding: 16, borderWidth: 1.5, borderColor: COLORS.warning,
  },
  warningIcon: { fontSize: 28 },
  warningTextWrap: { flex: 1 },
  warningTitle: { fontSize: 15, fontWeight: '700', color: COLORS.warning, marginBottom: 4 },
  warningDesc: { fontSize: 13, color: COLORS.textSub, lineHeight: 18 },

  analysisCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 16, elevation: 1,
  },
  analysisTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  analysisText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },

  sectionCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  possibilityRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  possibilityLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  likelihoodBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  likelihoodText: { fontSize: 12, fontWeight: '700' },

  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  bulletNum: { fontSize: 12, fontWeight: '700', color: COLORS.accent, width: 16 },
  bulletText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 20 },

  disclaimerBox: { backgroundColor: '#F7F0E8', borderRadius: 12, padding: 14 },
  disclaimerText: { fontSize: 12, color: COLORS.textSub, lineHeight: 18, textAlign: 'center' },

  usageBox: { backgroundColor: '#F7F0E8', borderRadius: 12, padding: 12, alignItems: 'center' },
  usageText: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },

  resetBtn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  resetBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
