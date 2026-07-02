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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import { useChildStore } from '../../stores/childStore';
import { canDo } from '../../features/coparenting/permissions';
import { coachingApi } from '../../services/api';
import { isScreenAvailable } from '../../constants/ageFeatures';
import { UpsellModal } from '../../components/common/UpsellModal';
import { saveAnalysisHistory } from '../../utils/analysisHistory';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import type { ImageSourcePropType } from 'react-native';

const IC_LULLABY = require('../../assets/quick-lullaby.png') as ImageSourcePropType;
const IC_DIARY = require('../../assets/child-diary.png') as ImageSourcePropType;
const IC_HOSPITAL = require('../../assets/icon-hospital.png') as ImageSourcePropType;

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

// 서버 likelihood 문자열이 enum과 정확히 일치하지 않아도(공백·"매우 높음" 등)
// '높음'(위험 경고색)이 '보통'으로 강등되지 않도록 '높' 우선 포함 매칭.
function resolveLikelihoodConfig(likelihood: string): { color: string; bg: string } {
  const s = likelihood ?? '';
  if (s.includes('높')) return LIKELIHOOD_CONFIG['높음'];
  if (s.includes('낮')) return LIKELIHOOD_CONFIG['낮음'];
  return LIKELIHOOD_CONFIG['보통'];
}

export default function CryAnalyzerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);

  // 연령 제한: 영아(0-24개월)만 접근 가능 (임신부 모드는 조용히 뒤로)
  useEffect(() => {
    if (selectedChild?.isPregnant) {
      Alert.alert(t('common.notice'), t('cryAnalyzer.alert.postpartumOnly'), [
        { text: t('common.confirm'), onPress: () => router.back() },
      ]);
      return;
    }
    const ageGroup = selectedChild?.ageInfo?.group ?? 'infant';
    if (!isScreenAvailable('cry-analyzer', ageGroup)) {
      Alert.alert(t('common.notice'), t('cryAnalyzer.alert.infantOnly'), [
        { text: t('common.confirm'), onPress: () => router.back() },
      ]);
    }
  }, [selectedChild, router, t]);

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string>('audio/m4a');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  /* ── 파일 선택 ── */
  const handlePickFile = useCallback(async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      // 네이티브 모듈 존재 확인 (Expo Go에서는 없음)
      if (!DocumentPicker.getDocumentAsync) {
        Alert.alert(t('common.notice'), t('cryAnalyzer.alert.filePickerUnavailable'));
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
          t('cryAnalyzer.alert.featureUnavailableTitle'),
          t('cryAnalyzer.alert.featureUnavailableMessage'),
        );
      } else {
        Alert.alert(t('cryAnalyzer.alert.filePickErrorTitle'), t('cryAnalyzer.alert.filePickErrorMessage', { message: msg }));
      }
    }
  }, [t]);

  /* ── 분석 ── */
  const handleAnalyze = useCallback(async () => {
    if (!fileUri) {
      Alert.alert(t('common.notice'), t('cryAnalyzer.alert.selectFileFirst'));
      return;
    }
    if (!selectedChild) {
      Alert.alert(t('common.notice'), t('cryAnalyzer.alert.selectChildFirst'));
      return;
    }
    setAnalyzing(true);
    try {
      // 공동육아: AI 분석은 useCoaching 권한 필요 (열람 전용 멤버 차단)
      if (!(await canDo(selectedChild.id, 'useCoaching'))) {
        Alert.alert(t('cryAnalyzer.alert.viewOnlyTitle'), t('cryAnalyzer.alert.viewOnlyMessage'));
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await coachingApi.analyzeMedia(
        selectedChild.id,
        'cry',
        undefined,
        base64,
        fileMime,
        i18n.language,
      );
      const data = res.data?.data as AnalysisResult | undefined;
      if (data) {
        setResult(data);
        void saveAnalysisHistory({
          type: 'cry',
          summary: data.analysis?.slice(0, 80) ?? t('cryAnalyzer.historyDefaultSummary'),
          details: data.recommendations?.join(' · '),
          childId: selectedChild.id,
          childName: selectedChild.name,
          fullText: data.analysis,
          metrics: data.possibilities?.map((p) => ({
            title: p.label,
            value: p.likelihood,
          })),
          recommendations: data.recommendations,
        });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; upsell?: boolean; usage?: UsageInfo } } };
      if (axiosErr.response?.status === 429) {
        if (axiosErr.response.data?.upsell) {
          setShowUpsell(true);
        } else {
          const usage = axiosErr.response.data?.usage;
          setResult({
            analysis: axiosErr.response.data?.error ?? t('cryAnalyzer.alert.monthlyLimitReached'),
            possibilities: [],
            recommendations: [],
            needsDoctor: false,
            usage,
          });
        }
      } else {
        setResult({
          analysis: t('cryAnalyzer.alert.analysisFailed'),
          possibilities: [],
          recommendations: [],
          needsDoctor: false,
        });
      }
    } finally {
      setAnalyzing(false);
    }
  }, [fileUri, fileMime, selectedChild, t, i18n.language]);

  const handleReset = useCallback(() => {
    setResult(null);
    setFileUri(null);
    setFileName(null);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={t('cryAnalyzer.screenTitle')} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {result ? (
          <ResultView result={result} onReset={handleReset} />
        ) : (
          <>
            {/* 안내 카드 */}
            <View style={styles.guideCard}>
              <Image source={require('../../assets/mascot-worried.png')} style={styles.guideImage} resizeMode="contain" />
              <Text style={styles.guideTitle}>{t('cryAnalyzer.guideTitle')}</Text>
              <Text style={styles.guideDesc}>
                {t('cryAnalyzer.guideDesc')}
              </Text>
            </View>

            {/* 파일 선택 영역 */}
            <View style={styles.fileSection}>
              {fileUri ? (
                <>
                  <Image source={IC_LULLABY} style={styles.fileDoneIconImg} resizeMode="contain" />
                  <Text style={styles.fileDoneText}>{fileName ?? t('cryAnalyzer.fileSelectedDefault')}</Text>
                  <View style={styles.fileBtnRow}>
                    <TouchableOpacity
                      style={styles.reSelectBtn}
                      onPress={() => { setFileUri(null); setFileName(null); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.reSelectBtnText}>{t('cryAnalyzer.reselectFile')}</Text>
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
                    <Image source={IC_DIARY} style={styles.selectBtnIconImg} resizeMode="contain" />
                    <Text style={styles.selectBtnText}>{t('cryAnalyzer.selectFile')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.selectHint}>{t('cryAnalyzer.selectHint')}</Text>
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
                  <Text style={styles.analyzeBtnText}>{t('cryAnalyzer.analyzing')}</Text>
                </View>
              ) : (
                <Text style={styles.analyzeBtnText}>
                  {fileUri ? t('cryAnalyzer.analyzeButton') : t('cryAnalyzer.selectFileFirstButton')}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>{t('cryAnalyzer.recordingTipTitle')}</Text>
              <Text style={styles.tipText}>
                {t('cryAnalyzer.recordingTipText')}
              </Text>
            </View>

            <MedicalCitation
              note={t('cryAnalyzer.citation.note')}
              sources={[
                { label: t('cryAnalyzer.citation.source1'), url: 'https://www.pediatrics.or.kr' },
                { label: t('cryAnalyzer.citation.source2'), url: 'https://health.kdca.go.kr' },
              ]}
            />
          </>
        )}
      </ScrollView>
      <UpsellModal visible={showUpsell} onClose={() => setShowUpsell(false)} />
    </View>
  );
}

/* ── 결과 뷰 ── */
function ResultView({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={resultStyles.container}>
      {result.needsDoctor && (
        <View style={resultStyles.warningBanner}>
          <Image source={IC_HOSPITAL} style={resultStyles.warningIconImg} resizeMode="contain" />
          <View style={resultStyles.warningTextWrap}>
            <Text style={resultStyles.warningTitle}>{t('cryAnalyzer.hospitalCheckTitle')}</Text>
            <Text style={resultStyles.warningDesc}>
              {t('cryAnalyzer.hospitalCheckDesc')}
            </Text>
          </View>
        </View>
      )}

      <View style={resultStyles.analysisCard}>
        <Text style={resultStyles.analysisTitle}>{t('cryAnalyzer.analysisResultTitle')}</Text>
        <Text style={resultStyles.analysisText}>{result.analysis}</Text>
      </View>

      {result.possibilities.length > 0 && (
        <View style={resultStyles.sectionCard}>
          <Text style={resultStyles.sectionTitle}>{t('cryAnalyzer.possibilitiesTitle')}</Text>
          {result.possibilities.map((p, i) => {
            const cfg = resolveLikelihoodConfig(p.likelihood);
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
          <Text style={resultStyles.sectionTitle}>{t('cryAnalyzer.recommendationsTitle')}</Text>
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
            {t('cryAnalyzer.usageSummary', {
              used: result.usage.used,
              limit: result.usage.limit,
              remaining: result.usage.remaining,
            })}
          </Text>
        </View>
      )}

      <View style={resultStyles.disclaimerBox}>
        <Text style={resultStyles.disclaimerText}>
          {t('cryAnalyzer.disclaimer')}
        </Text>
      </View>

      <TouchableOpacity style={resultStyles.resetBtn} onPress={onReset} activeOpacity={0.7}>
        <Text style={resultStyles.resetBtnText}>{t('cryAnalyzer.analyzeAgain')}</Text>
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
  selectBtnIconImg: { width: 44, height: 44, marginBottom: 10 },
  selectBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.purple },
  selectHint: { fontSize: 12, color: COLORS.textLight, marginTop: 10 },

  fileDoneEmoji: { fontSize: 48, marginBottom: 12 },
  fileDoneIconImg: { width: 56, height: 56, marginBottom: 12 },
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
  warningIconImg: { width: 32, height: 32 },
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
