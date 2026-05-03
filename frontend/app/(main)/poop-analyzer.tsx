import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useChildStore } from '../../stores/childStore';
import { coachingApi } from '../../services/api';
import { isScreenAvailable } from '../../constants/ageFeatures';
import { AdSlot } from '../../components/ads/AdSlot';
import { UpsellModal } from '../../components/common/UpsellModal';
import { saveAnalysisHistory } from '../../utils/analysisHistory';
import type { ImageSourcePropType } from 'react-native';

const IC_CAMERA = require('../../assets/icon-camera.png') as ImageSourcePropType;
const IC_REDFLAG = require('../../assets/icon-redflag.png') as ImageSourcePropType;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  bg: '#F2F2F7',
  white: '#FFFFFF',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  accent: '#FF8C5A',
  border: '#E5E5EA',
  urgentBg: '#FFF0F0',
  urgentBorder: '#FF3B30',
  normalBg: '#E8FAF8',
  normal: '#7DD3B8',
  attentionBg: '#FFF9E6',
  attention: '#FFD76E',
  warningBg: '#FFF0E8',
  warning: '#FF8C5A',
};

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
}

interface AnalysisResult {
  analysis: string;
  possibilities: Array<{ label: string; likelihood: string }>;
  recommendations: string[];
  needsDoctor: boolean;
  usage?: UsageInfo;
}

const LIKELIHOOD_CONFIG: Record<string, { color: string; bg: string }> = {
  '\uB192\uC74C': { color: '#D32F2F', bg: '#FFF0F0' },
  '\uBCF4\uD1B5': { color: '#F57C00', bg: '#FFF8E1' },
  '\uB0AE\uC74C': { color: COLORS.normal, bg: COLORS.normalBg },
};

export default function PoopAnalyzerScreen() {
  const router = useRouter();
  const selectedChild = useChildStore((s) => s.selectedChild);

  // 연령 제한: 영아+유아(0-72개월)만 접근 가능 (임신부 모드는 조용히 뒤로)
  useEffect(() => {
    if (selectedChild?.isPregnant) {
      Alert.alert('안내', '출산 후 이용 가능합니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
      return;
    }
    const ageGroup = selectedChild?.ageInfo?.group ?? 'infant';
    if (!isScreenAvailable('poop-analyzer', ageGroup)) {
      Alert.alert('안내', '대변 분석은 영유아(0~72개월) 전용 기능이에요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    }
  }, [selectedChild, router]);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  const handlePickImage = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) return;
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setPhotoUri(pickerResult.assets[0].uri);
        setResult(null);
      }
    } catch { /* not available */ }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permResult.granted) return;
      const pickerResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setPhotoUri(pickerResult.assets[0].uri);
        setResult(null);
      }
    } catch { /* not available */ }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!photoUri || !selectedChild) return;
    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await coachingApi.analyzeMedia(
        selectedChild.id,
        'poop',
        undefined,
        base64,
        'image/jpeg',
      );
      const data = res.data?.data as AnalysisResult | undefined;
      if (data) {
        setResult(data);
        void saveAnalysisHistory({
          type: 'poop',
          summary: data.analysis?.slice(0, 80) ?? '대변 분석 완료',
          details: data.recommendations?.join(' · '),
          childId: selectedChild.id,
          childName: selectedChild.name,
          thumbnailUri: photoUri ?? undefined,
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
            analysis: axiosErr.response.data?.error ?? '이번 달 분석 횟수를 모두 사용했습니다.',
            possibilities: [],
            recommendations: [],
            needsDoctor: false,
            usage,
          });
        }
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
  }, [photoUri, selectedChild]);

  const handleReset = useCallback(() => {
    setResult(null);
    setPhotoUri(null);
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <Text style={styles.backBtn}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'대변 분석기'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {result ? (
          <ResultView result={result} onReset={handleReset} />
        ) : (
          <>
            {/* 안내 카드 */}
            <View style={styles.guideCard}>
              <Image source={require('../../assets/mascot-thinking.png')} style={styles.guideImage} resizeMode="contain" />
              <Text style={styles.guideTitle}>{'사진으로 대변을 분석해요'}</Text>
              <Text style={styles.guideDesc}>
                {'아이의 대변 사진을 촬영하거나 갤러리에서 선택하면\nAI가 색상, 형태, 상태를 분석해 드려요.'}
              </Text>
            </View>

            {/* 사진 영역 */}
            {photoUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={styles.photoRemoveBtn}
                  onPress={() => { setPhotoUri(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.photoRemoveText}>{'X'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoButtonRow}>
                <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto} activeOpacity={0.7}>
                  <Image source={IC_CAMERA} style={styles.photoBtnIconImg} resizeMode="contain" />
                  <Text style={styles.photoBtnText}>{'카메라 촬영'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={handlePickImage} activeOpacity={0.7}>
                  <Image source={IC_CAMERA} style={styles.photoBtnIconImg} resizeMode="contain" />
                  <Text style={styles.photoBtnText}>{'갤러리 선택'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 분석 버튼 */}
            <TouchableOpacity
              style={[styles.analyzeBtn, (!photoUri || analyzing) && styles.analyzeBtnDisabled]}
              onPress={handleAnalyze}
              disabled={!photoUri || analyzing}
              activeOpacity={0.7}
            >
              {analyzing ? (
                <View style={styles.analyzingRow}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={styles.analyzeBtnText}>{'AI 분석 중...'}</Text>
                </View>
              ) : (
                <Text style={styles.analyzeBtnText}>
                  {photoUri ? '사진 분석하기' : '사진을 먼저 선택해주세요'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                {'이 분석은 의학적 진단을 대체하지 않습니다. 걱정되는 증상이 있으면 반드시 소아과 전문의와 상담하세요.'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      <AdSlot />
      <UpsellModal visible={showUpsell} onClose={() => setShowUpsell(false)} />
    </View>
  );
}

/* ── 결과 화면 ── */
function ResultView({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  return (
    <View style={resultStyles.container}>
      {result.needsDoctor && (
        <View style={resultStyles.urgentBanner}>
          <Image source={IC_REDFLAG} style={resultStyles.urgentIconImg} resizeMode="contain" />
          <View style={resultStyles.urgentTextWrap}>
            <Text style={resultStyles.urgentTitle}>{'병원 방문을 권장합니다'}</Text>
            <Text style={resultStyles.urgentDesc}>
              {'분석 결과 주의가 필요한 징후가 발견되었습니다. 소아과를 방문해주세요.'}
            </Text>
          </View>
        </View>
      )}

      {/* 분석 소견 */}
      <View style={resultStyles.analysisCard}>
        <Text style={resultStyles.analysisTitle}>{'분석 결과'}</Text>
        <Text style={resultStyles.analysisText}>{result.analysis}</Text>
      </View>

      {/* 가능성 */}
      {result.possibilities.length > 0 && (
        <View style={resultStyles.sectionCard}>
          <Text style={resultStyles.sectionTitle}>{'가능성 분석'}</Text>
          {result.possibilities.map((p, i) => {
            const cfg = LIKELIHOOD_CONFIG[p.likelihood] ?? LIKELIHOOD_CONFIG['\uBCF4\uD1B5'];
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

      {/* 권장 조치 */}
      {result.recommendations.length > 0 && (
        <View style={[resultStyles.sectionCard, { backgroundColor: '#F0FAF8' }]}>
          <Text style={resultStyles.sectionTitle}>{'권장 조치'}</Text>
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
          {'이 분석 결과는 참고용이며 의학적 진단을 대체하지 않습니다.'}
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
  backBtn: { fontSize: 22, fontWeight: '600', color: COLORS.text, paddingRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  headerSpacer: { width: 30 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },

  guideCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  guideEmoji: { fontSize: 48, marginBottom: 12 },
  guideImage: { width: 80, height: 80, marginBottom: 12 },
  guideTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  guideDesc: { fontSize: 13, color: COLORS.textSub, lineHeight: 20, textAlign: 'center' },

  photoButtonRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  photoBtn: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 16,
    paddingVertical: 32, alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  photoBtnEmoji: { fontSize: 36, marginBottom: 10 },
  photoBtnIconImg: { width: 40, height: 40, marginBottom: 10 },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSub },

  photoPreviewWrap: {
    position: 'relative', alignSelf: 'center',
    borderRadius: 16, overflow: 'hidden', marginBottom: 20,
  },
  photoPreview: {
    width: SCREEN_WIDTH - 80, height: SCREEN_WIDTH - 80, borderRadius: 16,
  },
  photoRemoveBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  analyzeBtn: {
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 16,
  },
  analyzeBtnDisabled: { opacity: 0.45 },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  disclaimerBox: { backgroundColor: '#F5F0EB', borderRadius: 12, padding: 14 },
  disclaimerText: { fontSize: 12, color: COLORS.textSub, lineHeight: 18, textAlign: 'center' },
});

const resultStyles = StyleSheet.create({
  container: { gap: 16 },

  urgentBanner: {
    flexDirection: 'row', backgroundColor: COLORS.urgentBg, borderRadius: 16,
    padding: 16, borderWidth: 2, borderColor: COLORS.urgentBorder, gap: 12,
  },
  urgentIcon: { fontSize: 28 },
  urgentIconImg: { width: 32, height: 32 },
  urgentTextWrap: { flex: 1 },
  urgentTitle: { fontSize: 16, fontWeight: '800', color: '#D32F2F', marginBottom: 6 },
  urgentDesc: { fontSize: 13, color: '#C62828', lineHeight: 20 },

  analysisCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  analysisTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  analysisText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },

  sectionCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  possibilityRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  possibilityLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  likelihoodBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  likelihoodText: { fontSize: 12, fontWeight: '700' },

  bulletRow: { flexDirection: 'row', marginBottom: 8, gap: 10 },
  bulletNum: { fontSize: 13, fontWeight: '700', color: COLORS.accent, width: 16 },
  bulletText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 22 },

  disclaimerBox: { backgroundColor: '#F5F0EB', borderRadius: 12, padding: 14 },
  disclaimerText: { fontSize: 12, color: COLORS.textSub, lineHeight: 18, textAlign: 'center' },

  usageBox: { backgroundColor: '#F5F0EB', borderRadius: 12, padding: 12, alignItems: 'center' },
  usageText: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },

  resetBtn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  resetBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
