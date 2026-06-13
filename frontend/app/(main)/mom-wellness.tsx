import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChildStore } from '../../stores/childStore';
import { pregnancyApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideButton } from '../../components/common/GuideButton';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { MOMWELLNESS_GUIDE } from '../../features/guide/momWellnessGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';

// ─── 빠른 기분 일기 (간단 mood pick + 한 줄 메모) — EPDS 와 별개, AsyncStorage 로컬 저장 ───
type MoodKey = 'great' | 'good' | 'soso' | 'down' | 'bad';
const MOOD_OPTIONS: { key: MoodKey; emoji: string; label: string; color: string }[] = [
  { key: 'great', emoji: '😊', label: '아주 좋음', color: '#43A047' },
  { key: 'good', emoji: '🙂', label: '좋음', color: '#7CB342' },
  { key: 'soso', emoji: '😐', label: '보통', color: '#FB8C00' },
  { key: 'down', emoji: '😔', label: '우울', color: '#FB6F92' },
  { key: 'bad', emoji: '😢', label: '많이 힘듦', color: '#C62828' },
];
const MOOD_STORAGE_PREFIX = 'amatda_mood_diary_';
interface MoodEntry { date: string; mood: MoodKey; note?: string }

function todayKstStr(): string {
  const KST = 9 * 60 * 60 * 1000;
  return new Date(Date.now() + KST).toISOString().slice(0, 10);
}

interface EpdsQuestion { id: number; text: string }
interface EpdsRecord {
  id: string; score: number; riskLevel: string;
  shareWithPartner: boolean; createdAt: string;
}
interface EpdsResult {
  score: number; maxScore: number;
  riskLevel: 'low' | 'mild' | 'moderate' | 'high' | 'urgent';
  message: string; notifiedFamily: number;
  nextRecommendedAt?: string;
}

interface EpdsAnalysis {
  count: number;
  avgScore?: number;
  latestScore?: number;
  prevScore?: number | null;
  direction?: 'improving' | 'stable' | 'worsening' | 'unknown';
  recentAvg?: number | null;
  earlierAvg?: number | null;
  timeline?: { score: number; createdAt: string; riskLevel: string }[];
  recommendation?: string;
  nextRecommendedAt?: string;
  stage?: string;
}

type MentalStage = 'prenatal' | 'postpartum_early' | 'postpartum_mid' | 'postpartum_late' | 'general';

function detectStage(dueDate?: string | null, birthDate?: string | null): MentalStage {
  const now = Date.now();
  if (dueDate) {
    const due = new Date(dueDate).getTime();
    if (!isNaN(due) && due > now) return 'prenatal';
  }
  if (birthDate) {
    const b = new Date(birthDate).getTime();
    if (!isNaN(b)) {
      const months = (now - b) / (1000 * 60 * 60 * 24 * 30.44);
      if (months < 3) return 'postpartum_early';
      if (months < 6) return 'postpartum_mid';
      if (months < 12) return 'postpartum_late';
    }
  }
  return 'general';
}

const STAGE_LABEL: Record<MentalStage, string> = {
  prenatal: '임신 중',
  postpartum_early: '출산 후 0~3개월',
  postpartum_mid: '출산 후 3~6개월',
  postpartum_late: '출산 후 6~12개월',
  general: '일반',
};

const DIRECTION_META: Record<string, { emoji: string; label: string; color: string }> = {
  improving: { emoji: '📉', label: '호전 중', color: '#2E7D32' },
  stable: { emoji: '➡️', label: '안정적', color: '#1565C0' },
  worsening: { emoji: '📈', label: '악화 주의', color: '#C62828' },
  unknown: { emoji: '—', label: '데이터 부족', color: '#666' },
};

const EPDS_OPTIONS = [
  { score: 0, label: '전혀 그렇지 않다' },
  { score: 1, label: '가끔 그렇다' },
  { score: 2, label: '자주 그렇다' },
  { score: 3, label: '항상 그렇다' },
];

const RISK_STYLE: Record<string, { bg: string; color: string; emoji: string; label: string }> = {
  low: { bg: '#E8F5E9', color: '#2E7D32', emoji: '😊', label: '안정' },
  mild: { bg: '#FFF8E1', color: '#F57C00', emoji: '😌', label: '약간 스트레스' },
  moderate: { bg: '#FFECB3', color: '#E65100', emoji: '😔', label: '경미한 우울감' },
  high: { bg: '#FFCDD2', color: '#C62828', emoji: '😢', label: '우울감 뚜렷' },
  urgent: { bg: '#B71C1C', color: '#FFFFFF', emoji: '🚨', label: '긴급' },
};

export default function MomWellnessScreen() {
  const insets = useSafeAreaInsets();
  const { selectedChild } = useChildStore();
  const childId = selectedChild?.id ?? '';
  const stage: MentalStage = detectStage(selectedChild?.dueDate, selectedChild?.birthDate);

  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => { shouldAutoShowGuide('mom-wellness').then((sh) => { if (sh) setGuideVisible(true); }); }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('mom-wellness'); };

  const [questions, setQuestions] = useState<EpdsQuestion[]>([]);
  const [extraQuestions, setExtraQuestions] = useState<EpdsQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [extraAnswers, setExtraAnswers] = useState<Record<number, number>>({});
  const [shareWithPartner, setShareWithPartner] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EpdsResult | null>(null);
  const [history, setHistory] = useState<EpdsRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [analysis, setAnalysis] = useState<EpdsAnalysis | null>(null);

  // 빠른 기분 일기 — 오늘 mood + 한 줄 메모, AsyncStorage 로컬
  const [todayMood, setTodayMood] = useState<MoodKey | null>(null);
  const [moodNote, setMoodNote] = useState('');
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([]);

  const loadMoodDiary = useCallback(async () => {
    try {
      const today = todayKstStr();
      const todayRaw = await AsyncStorage.getItem(MOOD_STORAGE_PREFIX + today);
      if (todayRaw) {
        const parsed = JSON.parse(todayRaw) as MoodEntry;
        setTodayMood(parsed.mood);
        setMoodNote(parsed.note ?? '');
      } else {
        setTodayMood(null);
        setMoodNote('');
      }
      // 최근 7일 조회
      const recent: MoodEntry[] = [];
      const now = new Date(today);
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const raw = await AsyncStorage.getItem(MOOD_STORAGE_PREFIX + dateStr);
        if (raw) {
          try { recent.push(JSON.parse(raw) as MoodEntry); } catch { /* skip */ }
        }
      }
      setRecentMoods(recent);
    } catch { /* silent */ }
  }, []);

  const saveMood = useCallback(async (mood: MoodKey, note?: string) => {
    try {
      const today = todayKstStr();
      const entry: MoodEntry = { date: today, mood, note: note?.trim() || undefined };
      await AsyncStorage.setItem(MOOD_STORAGE_PREFIX + today, JSON.stringify(entry));
      setTodayMood(mood);
      if (note !== undefined) setMoodNote(note);
      // 최근 목록 갱신
      loadMoodDiary();
    } catch { /* silent */ }
  }, [loadMoodDiary]);

  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    setLoadError(null);
    try {
      const res = await pregnancyApi.mentalCheckQuestions(stage);
      const payload = res.data.data as {
        questions?: EpdsQuestion[];
        extraQuestions?: EpdsQuestion[];
      } | undefined;
      const q = payload?.questions;
      if (q && q.length > 0) {
        setQuestions(q);
        setExtraQuestions(payload?.extraQuestions ?? []);
      } else {
        setLoadError('문항을 불러오지 못했어요');
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '네트워크 오류';
      setLoadError(`문항 로드 실패: ${msg}`);
    } finally {
      setLoadingQuestions(false);
    }
  }, [stage]);

  const loadHistoryAndAnalysis = useCallback(async () => {
    if (!childId) return;
    setLoadingHistory(true);
    try {
      const [hRes, aRes] = await Promise.all([
        pregnancyApi.getMentalChecks(childId),
        pregnancyApi.mentalCheckAnalysis(childId),
      ]);
      setHistory((hRes.data.data as EpdsRecord[]) ?? []);
      setAnalysis((aRes.data.data as EpdsAnalysis) ?? null);
    } catch { /* silent */ }
    setLoadingHistory(false);
  }, [childId]);

  useEffect(() => { loadHistoryAndAnalysis(); }, [loadHistoryAndAnalysis]);
  useEffect(() => { loadMoodDiary(); }, [loadMoodDiary]);

  const startSurvey = () => {
    setAnswers({});
    setExtraAnswers({});
    setResult(null);
    setShowSurvey(true);
    loadQuestions();
  };

  const cancelSurvey = () => {
    setShowSurvey(false);
    setAnswers({});
    setExtraAnswers({});
  };

  const handleSubmit = async () => {
    if (!childId) return;
    if (Object.keys(answers).length < 10) {
      Alert.alert('알림', '모든 문항에 답해주세요');
      return;
    }
    if (extraQuestions.length > 0 && Object.keys(extraAnswers).length < extraQuestions.length) {
      Alert.alert('알림', '맞춤 문항에도 답해주세요');
      return;
    }
    setSubmitting(true);
    try {
      const orderedAnswers = questions.map((q) => answers[q.id] ?? 0);
      const orderedExtras = extraQuestions.map((q) => extraAnswers[q.id] ?? 0);
      const res = await pregnancyApi.saveMentalCheck({
        childId, answers: orderedAnswers, shareWithPartner,
        extraAnswers: orderedExtras.length > 0 ? orderedExtras : undefined,
        stage,
      });
      setResult(res.data.data as EpdsResult);
      setAnswers({});
      setExtraAnswers({});
      loadHistoryAndAnalysis();
    } catch {
      Alert.alert('오류', '저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
    setSubmitting(false);
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR');
  };

  if (!selectedChild) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="마음 진단" />
        <View style={styles.emptyCenter}><Text style={styles.emptyText}>아이를 선택해주세요</Text></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader title="마음 진단" right={<GuideButton onPress={() => setGuideVisible(true)} color="#9D8CC6" />} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── 빠른 기분 일기 ─── */}
        {!showSurvey && !result && (
          <View style={styles.moodCard}>
            <Text style={styles.moodTitle}>💝 오늘 내 기분</Text>
            <Text style={styles.moodHint}>이모지를 눌러 기록해두세요. EPDS 와 별개로 매일 가볍게 남길 수 있어요.</Text>
            <View style={styles.moodRow}>
              {MOOD_OPTIONS.map((opt) => {
                const selected = todayMood === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.moodBtn, selected && { borderColor: opt.color, backgroundColor: opt.color + '22' }]}
                    onPress={() => saveMood(opt.key, moodNote)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.moodEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.moodLabel, selected && { color: opt.color, fontWeight: '700' }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {todayMood && (
              <>
                <TextInput
                  style={styles.moodNoteInput}
                  placeholder="한 줄 메모 (선택) — 오늘 어땠어요?"
                  placeholderTextColor={COLORS.textLight}
                  value={moodNote}
                  onChangeText={setMoodNote}
                  onBlur={() => { if (todayMood) saveMood(todayMood, moodNote); }}
                  maxLength={120}
                  multiline
                />
                <Text style={styles.moodSavedHint}>✓ 저장됨 (기기에만 보관)</Text>
              </>
            )}
            {recentMoods.length > 1 && (
              <View style={styles.moodHistoryRow}>
                <Text style={styles.moodHistoryLabel}>지난 7일</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {recentMoods.slice(0, 7).reverse().map((m, i) => {
                    const opt = MOOD_OPTIONS.find((o) => o.key === m.mood);
                    return <Text key={i} style={styles.moodHistoryEmoji}>{opt?.emoji ?? '·'}</Text>;
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 소개 + 시작 버튼 */}
        {!showSurvey && !result && (
          <View style={styles.introCard}>
            <View style={styles.stageBadge}>
              <Text style={styles.stageBadgeText}>🗓 {STAGE_LABEL[stage]}</Text>
            </View>
            <Text style={styles.introTitle}>💗 산전·산후 우울감 체크 (EPDS)</Text>
            <Text style={styles.introDesc}>
              세계적으로 표준인 10문항 자가진단이에요. 지난 7일 기준으로 답해주세요.
              {'\n'}30점 만점 · ≥10 주의, ≥13 상담 권장
              {'\n'}현재 단계에 맞춘 보조 문항도 함께 나와요.
            </Text>
            <Text style={styles.introDisclaimer}>
              ⚠️ 이 검사는 참고용 자가 체크이며 전문의의 진단이나 처방을 대체하지 않습니다.
              점수가 높거나 걱정이 된다면 반드시 의료 전문가 또는 아래 위기상담 전화에 연락하세요.
            </Text>
            <TouchableOpacity style={styles.startBtn} onPress={startSurvey}>
              <Text style={styles.startBtnText}>📝 지금 체크 시작하기</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 추이 분석 카드 */}
        {!showSurvey && !result && analysis && analysis.count >= 2 && analysis.direction && (
          (() => {
            const meta = DIRECTION_META[analysis.direction] ?? DIRECTION_META.unknown;
            return (
              <View style={[styles.analysisCard, { borderLeftColor: meta.color }]}>
                <Text style={[styles.analysisDirection, { color: meta.color }]}>
                  {meta.emoji} {meta.label}
                </Text>
                <View style={styles.analysisRow}>
                  <Text style={styles.analysisLabel}>총 체크</Text>
                  <Text style={styles.analysisValue}>{analysis.count}회</Text>
                </View>
                {typeof analysis.avgScore === 'number' && (
                  <View style={styles.analysisRow}>
                    <Text style={styles.analysisLabel}>평균 점수</Text>
                    <Text style={styles.analysisValue}>{analysis.avgScore.toFixed(1)}점</Text>
                  </View>
                )}
                {typeof analysis.latestScore === 'number' && (
                  <View style={styles.analysisRow}>
                    <Text style={styles.analysisLabel}>최근 / 직전</Text>
                    <Text style={styles.analysisValue}>
                      {analysis.latestScore}점
                      {typeof analysis.prevScore === 'number' ? ` / ${analysis.prevScore}점` : ''}
                    </Text>
                  </View>
                )}
                {analysis.recommendation && (
                  <Text style={styles.analysisRecommendation}>💡 {analysis.recommendation}</Text>
                )}
                {analysis.nextRecommendedAt && (
                  <View style={styles.nextCheckBadge}>
                    <Text style={styles.nextCheckText}>
                      📅 다음 권장일 · {formatDate(analysis.nextRecommendedAt)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })()
        )}

        {/* 결과 */}
        {result && (
          <View style={[styles.resultCard, { backgroundColor: RISK_STYLE[result.riskLevel].bg }]}>
            <Text style={[styles.resultScore, { color: RISK_STYLE[result.riskLevel].color }]}>
              {RISK_STYLE[result.riskLevel].emoji} {result.score} / {result.maxScore}점 · {RISK_STYLE[result.riskLevel].label}
            </Text>
            <Text style={[styles.resultMessage, { color: RISK_STYLE[result.riskLevel].color }]}>
              {result.message}
            </Text>
            {result.notifiedFamily > 0 && (
              <Text style={[styles.resultNotice, { color: RISK_STYLE[result.riskLevel].color }]}>
                📨 가족 {result.notifiedFamily}명에게 알림이 전달됐어요
              </Text>
            )}
            <TouchableOpacity style={styles.resultCloseBtn} onPress={() => { setResult(null); setShowSurvey(false); }}>
              <Text style={styles.resultCloseText}>확인</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 로딩·에러 */}
        {showSurvey && !result && loadingQuestions && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={{ marginTop: 8, color: COLORS.textSecondary, fontSize: FONT_SIZE.sm }}>
              문항을 불러오는 중...
            </Text>
          </View>
        )}
        {showSurvey && !result && !loadingQuestions && loadError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠️ {loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadQuestions}>
              <Text style={styles.retryBtnText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 문항 */}
        {showSurvey && !result && !loadingQuestions && questions.length > 0 && (
          <>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelSurvey}>
              <Text style={styles.cancelBtnText}>‹ 체크 취소</Text>
            </TouchableOpacity>
            {questions.map((q, idx) => (
              <View key={q.id} style={styles.questionCard}>
                <Text style={styles.questionText}>{idx + 1}. {q.text}</Text>
                <View style={styles.optionsRow}>
                  {EPDS_OPTIONS.map((opt) => {
                    const selected = answers[q.id] === opt.score;
                    return (
                      <TouchableOpacity
                        key={opt.score}
                        style={[styles.optionBtn, selected && styles.optionBtnActive]}
                        onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.score }))}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {extraQuestions.length > 0 && (
              <>
                <View style={styles.extraSeparator}>
                  <Text style={styles.extraSeparatorText}>
                    📌 {STAGE_LABEL[stage]} 맞춤 추가 문항
                  </Text>
                </View>
                {extraQuestions.map((q, idx) => (
                  <View key={`extra-${q.id}`} style={styles.questionCard}>
                    <Text style={styles.questionText}>
                      추가 {idx + 1}. {q.text}
                    </Text>
                    <View style={styles.optionsRow}>
                      {EPDS_OPTIONS.map((opt) => {
                        const selected = extraAnswers[q.id] === opt.score;
                        return (
                          <TouchableOpacity
                            key={opt.score}
                            style={[styles.optionBtn, selected && styles.optionBtnActive]}
                            onPress={() => setExtraAnswers((prev) => ({ ...prev, [q.id]: opt.score }))}
                          >
                            <Text style={[styles.optionText, selected && styles.optionTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* 파트너 공유 */}
            <View style={styles.shareCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shareTitle}>💑 남편·가족과 공유</Text>
                <Text style={styles.shareDesc}>
                  우울감 수치가 중간 이상일 때만 가족에게 알림이 가요. 점수는 공유되지 않아요.
                </Text>
              </View>
              <Switch
                value={shareWithPartner}
                onValueChange={setShareWithPartner}
                trackColor={{ false: '#D1D5DB', true: '#F48FB1' }}
                thumbColor={shareWithPartner ? '#E91E63' : '#F3F4F6'}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>결과 확인하기</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* 기록 */}
        <View style={styles.historySection}>
          <Text style={styles.historySectionTitle}>📈 내 마음 기록</Text>
          {loadingHistory ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : history.length === 0 ? (
            <Text style={styles.historyEmpty}>아직 기록이 없어요. 주 1회 정기 체크를 권해드려요.</Text>
          ) : (
            history.slice(0, 10).map((h) => {
              const style = RISK_STYLE[h.riskLevel] ?? RISK_STYLE.low;
              return (
                <View key={h.id} style={styles.historyRow}>
                  <View style={[styles.historyDot, { backgroundColor: style.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyDate}>
                      {h.createdAt ? new Date(h.createdAt).toLocaleDateString('ko-KR') : '-'}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {style.emoji} {h.score}점 · {style.label}
                      {h.shareWithPartner ? ' · 가족 공유' : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* 위기 안내 */}
        <View style={styles.emergencyCard}>
          <Text style={styles.emergencyTitle}>🆘 지금 많이 힘드시다면</Text>
          <Text style={styles.emergencyText}>
            정신건강위기상담전화 {'\u2060'}<Text style={styles.emergencyNum}>1577-0199</Text>{'\u2060'} (24시간 무료)
            {'\n'}자살예방상담전화 {'\u2060'}<Text style={styles.emergencyNum}>1393</Text>
            {'\n'}보건소 모자건강사업 (지역별 전화)
          </Text>
        </View>

        <MedicalCitation
          note="자가 체크 결과는 참고용이며 의학적 진단이 아닙니다. 지속되는 우울감은 전문가와 상담하세요."
          sources={[
            { label: '에든버러 산후우울척도(EPDS) — Cox, Holden & Sagovsky (1987)' },
            { label: '보건복지부 국가정신건강정보포털', url: 'https://www.mentalhealth.go.kr' },
          ]}
        />
      </ScrollView>
      <AdSlot />
      <GuideCarousel visible={guideVisible} pages={MOMWELLNESS_GUIDE} onClose={closeGuide} onComplete={closeGuide} accent="#9D8CC6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },

  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xl * 2 },

  // ─── 빠른 기분 일기 ───
  moodCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFE0EC',
  },
  moodTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#880E4F', marginBottom: 4 },
  moodHint: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 16, marginBottom: SPACING.sm },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  moodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  moodEmoji: { fontSize: 26, marginBottom: 2 },
  moodLabel: { fontSize: 10, color: COLORS.textSecondary },
  moodNoteInput: {
    marginTop: 4,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    minHeight: 40,
    maxHeight: 80,
    textAlignVertical: 'top',
  },
  moodSavedHint: { fontSize: 11, color: '#43A047', marginTop: 4, marginLeft: 2 },
  moodHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  moodHistoryLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  moodHistoryEmoji: { fontSize: 18 },

  introCard: {
    backgroundColor: '#FCE4EC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  introTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#880E4F', marginBottom: 6 },
  introDesc: { fontSize: FONT_SIZE.sm, color: '#AD1457', lineHeight: 20 },
  introDisclaimer: { fontSize: 11, color: '#888', lineHeight: 16, marginTop: 10, marginBottom: 4, backgroundColor: '#F5F5F5', borderRadius: 8, padding: 10 },

  resultCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  resultScore: { fontSize: FONT_SIZE.lg, fontWeight: '600', marginBottom: SPACING.sm },
  resultMessage: { fontSize: FONT_SIZE.md, lineHeight: 22, marginBottom: SPACING.sm },
  resultNotice: { fontSize: FONT_SIZE.sm, fontWeight: '600', marginTop: 4 },
  resultCloseBtn: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: RADIUS.sm,
  },
  resultCloseText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#880E4F' },

  questionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  questionText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm, lineHeight: 22 },
  optionsRow: { gap: 6 },
  optionBtn: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionBtnActive: {
    backgroundColor: '#FCE4EC',
    borderColor: '#E91E63',
  },
  optionText: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  optionTextActive: { color: '#C2185B', fontWeight: '700' },

  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  shareTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#1565C0', marginBottom: 4 },
  shareDesc: { fontSize: FONT_SIZE.xs, color: '#1976D2', lineHeight: 18 },

  submitBtn: {
    backgroundColor: '#E91E63',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  submitBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#fff' },

  startBtn: {
    marginTop: SPACING.md,
    backgroundColor: '#E91E63',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  startBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#fff' },
  cancelBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6, paddingHorizontal: 12,
    marginBottom: SPACING.sm,
  },
  cancelBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600' },

  historySection: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historySectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  historyEmpty: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: SPACING.md },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginRight: SPACING.md },
  historyDate: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },
  historyMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },

  emergencyCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: '#E65100',
  },
  emergencyTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#E65100', marginBottom: 6 },
  emergencyText: { fontSize: FONT_SIZE.sm, color: '#BF360C', lineHeight: 22 },
  emergencyNum: { fontWeight: '600', color: '#BF360C' },

  errorCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  errorText: { fontSize: FONT_SIZE.sm, color: '#C62828', marginBottom: SPACING.sm, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#E91E63',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },

  stageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F8BBD0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginBottom: 8,
  },
  stageBadgeText: { fontSize: FONT_SIZE.xs, color: '#880E4F', fontWeight: '700' },

  analysisCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    ...SHADOWS.soft,
  },
  analysisDirection: { fontSize: FONT_SIZE.md, fontWeight: '600', marginBottom: SPACING.sm },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  analysisLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  analysisValue: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '700' },
  analysisRecommendation: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  nextCheckBadge: {
    marginTop: SPACING.sm,
    backgroundColor: '#E3F2FD',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  nextCheckText: { fontSize: FONT_SIZE.xs, color: '#1565C0', fontWeight: '700' },

  extraSeparator: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFF3E0',
    borderRadius: RADIUS.sm,
  },
  extraSeparatorText: { fontSize: FONT_SIZE.sm, color: '#E65100', fontWeight: '700' },
});
