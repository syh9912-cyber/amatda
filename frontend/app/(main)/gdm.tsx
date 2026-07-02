import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  RefreshControl,
  Image,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { pregnancyApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';
import { GuideButton } from '../../components/common/GuideButton';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { getGdmGuide } from '../../features/guide/gdmGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
import { pickImageFromLibrary, pickImageFromCamera } from '../../utils/imagePicker';
import type { ImageSourcePropType } from 'react-native';

const IC_BLOOD = require('../../assets/quick-blood.png') as ImageSourcePropType;
const IC_EATING = require('../../assets/mascot-eating.png') as ImageSourcePropType;

type MealType = 'fasting' | 'before_meal' | 'after_meal_1h' | 'after_meal_2h' | 'bedtime';
type FoodMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type TabMode = 'glucose' | 'food';

function getMealLabels(t: TFunction): Record<MealType, string> {
  return {
    fasting: t('gdm.mealFasting'),
    before_meal: t('gdm.mealBeforeMeal'),
    after_meal_1h: t('gdm.mealAfter1h'),
    after_meal_2h: t('gdm.mealAfter2h'),
    bedtime: t('gdm.mealBedtime'),
  };
}

function getFoodMealLabels(t: TFunction): Record<FoodMealType, string> {
  return {
    breakfast: t('gdm.foodMealBreakfast'),
    lunch: t('gdm.foodMealLunch'),
    dinner: t('gdm.foodMealDinner'),
    snack: t('gdm.foodMealSnack'),
  };
}

function getStatusColors(t: TFunction): Record<string, { bg: string; text: string; label: string }> {
  return {
    normal: { bg: '#E8F5E9', text: '#2E7D32', label: t('gdm.statusNormal') },
    caution: { bg: '#FFF8E1', text: '#F57F17', label: t('gdm.statusCaution') },
    warning: { bg: '#FFEBEE', text: '#C62828', label: t('gdm.statusWarning') },
  };
}

interface GdmRecord {
  id: string;
  glucoseLevel: number;
  mealType: MealType;
  status: 'normal' | 'caution' | 'warning';
  memo: string | null;
  measuredAt: string;
  date: string;
}

interface GdmStats {
  total: number;
  avg: number;
  max: number;
  min: number;
  cautionCount: number;
  warningCount: number;
  days: number;
}

interface FoodLog {
  id: string;
  foodName: string;
  mealType: FoodMealType;
  eatenAt: string;
  date: string;
  carbs: number | null;
  calories: number | null;
  photoUrl: string | null;
  memo: string | null;
}

interface AnalyzeResult {
  foodName: string;
  carbs: number | null;
  calories: number | null;
  notes: string;
  disclaimer: string;
  usage?: { used: number; limit: number; remaining: number; tier: 'free' | 'paid' };
}

interface WeeklyReport {
  summary: string;
  highlights: string[];
  cautions: string[];
  suggestions: string[];
  stats?: { days: number; measurements: number; meals: number; avg: number; max: number; min: number; cautionCount: number; warningCount: number };
  disclaimer: string;
}

function getGlucoseAdvice(t: TFunction): Record<string, { title: string; body: string }> {
  return {
    caution: {
      title: t('gdm.adviceCautionTitle'),
      body: t('gdm.adviceCautionBody'),
    },
    warning: {
      title: t('gdm.adviceWarningTitle'),
      body: t('gdm.adviceWarningBody'),
    },
  };
}

const MEAL_CARB_LIMIT: Record<FoodMealType, number> = {
  breakfast: 45,
  lunch: 60,
  dinner: 60,
  snack: 20,
};

export default function GdmScreen() {
  const { t, i18n } = useTranslation();
  const MEAL_LABELS = getMealLabels(t);
  const FOOD_MEAL_LABELS = getFoodMealLabels(t);
  const statusColors = getStatusColors(t);
  const GLUCOSE_ADVICE = getGlucoseAdvice(t);

  const child = useChildStore((s) => s.selectedChild);
  const childId = child?.id ?? '';

  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => { shouldAutoShowGuide('gdm').then((sh) => { if (sh) setGuideVisible(true); }); }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('gdm'); };

  const [tab, setTab] = useState<TabMode>('glucose');

  const [records, setRecords] = useState<GdmRecord[]>([]);
  const [stats, setStats] = useState<GdmStats | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 혈당 모달
  const [showGlucoseModal, setShowGlucoseModal] = useState(false);
  const [glucose, setGlucose] = useState('');
  const [mealType, setMealType] = useState<MealType>('fasting');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  // 식단 모달
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodMealType, setFoodMealType] = useState<FoodMealType>('breakfast');
  const [eatenTime, setEatenTime] = useState(''); // HH:mm
  const [carbs, setCarbs] = useState('');
  const [calories, setCalories] = useState('');
  const [foodMemo, setFoodMemo] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [savingFood, setSavingFood] = useState(false);

  // 주간 AI 리포트
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<WeeklyReport | null>(null);

  const loadData = useCallback(async () => {
    if (!childId) return;
    try {
      const [gdmRes, foodRes] = await Promise.all([
        pregnancyApi.getGdm(childId, 30),
        pregnancyApi.getFoodLogs(childId, 30),
      ]);
      const gdmData = gdmRes.data?.data ?? gdmRes.data;
      if (gdmData?.records) setRecords(gdmData.records as GdmRecord[]);
      if (gdmData?.stats) setStats(gdmData.stats as GdmStats);
      const foodData = foodRes.data?.data ?? foodRes.data;
      if (foodData?.records) setFoodLogs(foodData.records as FoodLog[]);
    } catch { /* silent */ }
  }, [childId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSaveGlucose = async () => {
    const level = parseFloat(glucose);
    if (isNaN(level) || level < 30 || level > 500) {
      Alert.alert(t('common.notice'), t('gdm.glucoseInputInvalid'));
      return;
    }
    setSaving(true);
    try {
      const res = await pregnancyApi.saveGdm({
        childId,
        glucoseLevel: level,
        mealType,
        memo: memo.trim() || undefined,
      });
      const saved = (res.data?.data ?? res.data) as { status?: string };
      setGlucose('');
      setMemo('');
      setShowGlucoseModal(false);
      await loadData();
      if (saved?.status && GLUCOSE_ADVICE[saved.status]) {
        const a = GLUCOSE_ADVICE[saved.status];
        Alert.alert(a.title, a.body);
      }
    } catch {
      Alert.alert(t('common.error'), t('gdm.saveGlucoseFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('common.delete'), t('gdm.confirmDeleteRecord'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await pregnancyApi.deleteGdm(id);
            await loadData();
          } catch {
            Alert.alert(t('common.error'), t('gdm.deleteFailed'));
          }
        },
      },
    ]);
  };

  const handleDeleteFood = (id: string) => {
    Alert.alert(t('common.delete'), t('gdm.confirmDeleteFoodRecord'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await pregnancyApi.deleteFoodLog(id);
            await loadData();
          } catch {
            Alert.alert(t('common.error'), t('gdm.deleteFailed'));
          }
        },
      },
    ]);
  };

  const resetFoodModal = () => {
    setFoodName('');
    setFoodMealType('breakfast');
    setEatenTime('');
    setCarbs('');
    setCalories('');
    setFoodMemo('');
    setPhotoUri(null);
    setPhotoMime(null);
    setAnalyzeResult(null);
  };

  const openFoodModal = () => {
    resetFoodModal();
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setEatenTime(`${hh}:${mm}`);
    const h = now.getHours();
    if (h < 10) setFoodMealType('breakfast');
    else if (h < 14) setFoodMealType('lunch');
    else if (h < 20) setFoodMealType('dinner');
    else setFoodMealType('snack');
    setShowFoodModal(true);
  };

  const handlePickPhoto = async (source: 'library' | 'camera') => {
    const pick = source === 'library' ? pickImageFromLibrary : pickImageFromCamera;
    const result = await pick(t, { quality: 0.7 });
    if (!result) return;
    setPhotoUri(result.uri);
    setPhotoMime(result.mimeType || 'image/jpeg');
    setAnalyzeResult(null);
  };

  const handleAnalyze = async () => {
    if (!photoUri || !photoMime) {
      Alert.alert(t('common.notice'), t('gdm.selectPhotoFirst'));
      return;
    }
    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await pregnancyApi.analyzeFoodPhoto(base64, photoMime, i18n.language);
      const data = (res.data?.data ?? res.data) as AnalyzeResult;
      setAnalyzeResult(data);
      if (!foodName && data.foodName) setFoodName(data.foodName);
      if (!carbs && typeof data.carbs === 'number') setCarbs(String(data.carbs));
      if (!calories && typeof data.calories === 'number') setCalories(String(data.calories));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert(t('gdm.analyzeFailedTitle'), msg || t('gdm.analyzeFailedBody'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveFood = async () => {
    if (!foodName.trim()) {
      Alert.alert(t('common.notice'), t('gdm.foodNameRequired'));
      return;
    }
    setSavingFood(true);
    try {
      let eatenAt = new Date().toISOString();
      if (eatenTime && /^\d{2}:\d{2}$/.test(eatenTime)) {
        const [h, m] = eatenTime.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        // 입력 시각이 현재보다 미래면 전날 식사로 간주(미래 시각 저장 방지)
        if (d.getTime() > Date.now()) {
          d.setDate(d.getDate() - 1);
        }
        eatenAt = d.toISOString();
      }
      const carbsNum = parseFloat(carbs);
      const caloriesNum = parseFloat(calories);
      await pregnancyApi.saveFoodLog({
        childId,
        foodName: foodName.trim(),
        mealType: foodMealType,
        eatenAt,
        carbs: isNaN(carbsNum) ? undefined : carbsNum,
        calories: isNaN(caloriesNum) ? undefined : caloriesNum,
        photoUrl: photoUri || undefined,
        memo: foodMemo.trim() || undefined,
      });
      setShowFoodModal(false);
      const savedCarbs = isNaN(carbsNum) ? null : carbsNum;
      const savedMealType = foodMealType;
      resetFoodModal();
      await loadData();
      if (savedCarbs !== null && savedCarbs > MEAL_CARB_LIMIT[savedMealType]) {
        Alert.alert(
          t('gdm.carbHighTitle'),
          t('gdm.carbHighBody', {
            mealLabel: FOOD_MEAL_LABELS[savedMealType],
            carbs: savedCarbs,
            limit: MEAL_CARB_LIMIT[savedMealType],
          }),
        );
      }
    } catch {
      Alert.alert(t('common.error'), t('gdm.saveFoodFailed'));
    } finally {
      setSavingFood(false);
    }
  };

  const handleLoadReport = async () => {
    if (!childId) return;
    setShowReportModal(true);
    setReportLoading(true);
    setReport(null);
    try {
      const res = await pregnancyApi.gdmWeeklyReport(childId, i18n.language);
      const data = (res.data?.data ?? res.data) as WeeklyReport;
      setReport(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert(t('common.notice'), msg || t('gdm.reportLoadFailed'));
      setShowReportModal(false);
    } finally {
      setReportLoading(false);
    }
  };

  // 날짜별 그룹핑
  const groupedGlucose: Record<string, GdmRecord[]> = {};
  for (const r of records) {
    const key = r.date ?? r.measuredAt?.slice(0, 10) ?? 'unknown';
    if (!groupedGlucose[key]) groupedGlucose[key] = [];
    groupedGlucose[key].push(r);
  }
  const glucoseDateKeys = Object.keys(groupedGlucose).sort((a, b) => b.localeCompare(a));

  const groupedFood: Record<string, FoodLog[]> = {};
  for (const f of foodLogs) {
    const key = f.date ?? f.eatenAt?.slice(0, 10) ?? 'unknown';
    if (!groupedFood[key]) groupedFood[key] = [];
    groupedFood[key].push(f);
  }
  const foodDateKeys = Object.keys(groupedFood).sort((a, b) => b.localeCompare(a));

  const thresholdInfo = t('gdm.thresholdInfo');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('gdm.screenTitle'), headerShown: true, headerLeft: () => <BackButton />, headerRight: () => <View style={{ marginRight: 14 }}><GuideButton onPress={() => setGuideVisible(true)} color="#7FB1BB" /></View> }} />

      {/* 탭 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'glucose' && styles.tabBtnActive]}
          onPress={() => setTab('glucose')}
        >
          <Text style={[styles.tabText, tab === 'glucose' && styles.tabTextActive]}>🩸 {t('gdm.tabGlucose')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'food' && styles.tabBtnActive]}
          onPress={() => setTab('food')}
        >
          <Text style={[styles.tabText, tab === 'food' && styles.tabTextActive]}>🍚 {t('gdm.tabFood')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <MedicalCitation
          compact
          note={t('gdm.citationNote')}
          sources={[
            { label: t('gdm.citationSourceDiabetesSociety'), url: 'https://www.diabetes.or.kr' },
            { label: t('gdm.citationSourceFoodSafety'), url: 'https://www.foodsafetykorea.go.kr' },
          ]}
        />

        {/* AI 주간 분석 버튼 */}
        <TouchableOpacity
          style={styles.reportBtn}
          onPress={handleLoadReport}
          activeOpacity={0.85}
        >
          <Text style={styles.reportBtnText}>🤖 {t('gdm.reportBtnText')}</Text>
          <Text style={styles.reportBtnSub}>{t('gdm.reportBtnSub')}</Text>
        </TouchableOpacity>

        {/* 인라인 입력 버튼 — FAB 가 광고에 가려 잘 안 보임 보완 */}
        <TouchableOpacity
          style={styles.inlineAddBtn}
          onPress={() => (tab === 'glucose' ? setShowGlucoseModal(true) : openFoodModal())}
          activeOpacity={0.85}
        >
          <Text style={styles.inlineAddBtnText}>
            {tab === 'glucose' ? t('gdm.addGlucoseRecord') : t('gdm.addFoodRecord')}
          </Text>
        </TouchableOpacity>

        {/* 산모 정보 */}
        {child && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t('gdm.infoTitle', { name: child.name })}</Text>
            {(child.momHeight || child.momWeight || child.momBloodType) ? (
              <Text style={styles.infoSub}>
                {[
                  child.momHeight ? `${child.momHeight}cm` : null,
                  child.momWeight ? `${child.momWeight}kg` : null,
                  child.momBloodType ? t('gdm.bloodTypeSuffix', { type: child.momBloodType }) : null,
                ].filter(Boolean).join(' / ')}
              </Text>
            ) : null}
            {tab === 'glucose' && <Text style={styles.thresholdText}>{thresholdInfo}</Text>}
            {tab === 'glucose' && <Text style={styles.thresholdText}>{t('gdm.classificationDisclaimer')}</Text>}
            {tab === 'food' && (
              <Text style={styles.thresholdText}>
                {t('gdm.foodTabHint')}
              </Text>
            )}
          </View>
        )}

        {tab === 'glucose' && (
          <>
            {stats && stats.total > 0 && (
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>{t('gdm.statsTitle', { days: stats.days })}</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.avg}</Text>
                    <Text style={styles.statLabel}>{t('gdm.statAvg')}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.min}</Text>
                    <Text style={styles.statLabel}>{t('gdm.statMin')}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.max}</Text>
                    <Text style={styles.statLabel}>{t('gdm.statMax')}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <Text style={styles.statLabel}>{t('gdm.statCount')}</Text>
                  </View>
                </View>
                {(stats.cautionCount > 0 || stats.warningCount > 0) && (
                  <View style={styles.alertRow}>
                    {stats.cautionCount > 0 && (
                      <View style={[styles.alertPill, { backgroundColor: '#FFF8E1' }]}>
                        <Text style={{ color: '#F57F17', fontSize: 12, fontWeight: '600' }}>
                          {t('gdm.cautionCount', { count: stats.cautionCount })}
                        </Text>
                      </View>
                    )}
                    {stats.warningCount > 0 && (
                      <View style={[styles.alertPill, { backgroundColor: '#FFEBEE' }]}>
                        <Text style={{ color: '#C62828', fontSize: 12, fontWeight: '600' }}>
                          {t('gdm.warningCount', { count: stats.warningCount })}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 혈당 추이 그래프 — 최근 14회 */}
            {(() => {
              const sorted = [...records]
                .filter((r) => typeof r.glucoseLevel === 'number' && !Number.isNaN(r.glucoseLevel))
                .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
              const last = sorted.slice(-14);
              if (last.length < 2) return null;

              const chartW = Dimensions.get('window').width - SPACING.lg * 2;
              const labels = last.map((r, i) => {
                if (i === 0 || i === last.length - 1 || i === Math.floor(last.length / 2)) {
                  const d = new Date(r.measuredAt);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }
                return '';
              });

              return (
                <View style={styles.statsCard}>
                  <Text style={styles.statsTitle}>{t('gdm.glucoseTrend')}</Text>
                  <LineChart
                    data={{
                      labels,
                      datasets: [{ data: last.map((r) => r.glucoseLevel) }],
                    }}
                    width={chartW}
                    height={200}
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundColor: '#FFFFFF',
                      backgroundGradientFrom: '#FFFFFF',
                      backgroundGradientTo: '#FFFFFF',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(255, 140, 90, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(60, 60, 60, ${opacity})`,
                      propsForDots: { r: '4', strokeWidth: '2', stroke: '#FF8C5A' },
                    }}
                    bezier
                    withInnerLines={false}
                    style={{ marginTop: SPACING.xs, borderRadius: RADIUS.md, marginLeft: -SPACING.xs }}
                  />
                </View>
              );
            })()}

            {!loading && glucoseDateKeys.length === 0 && (
              <View style={styles.emptyWrap}>
                <Image source={IC_BLOOD} style={styles.emptyEmojiImg} resizeMode="contain" />
                <Text style={styles.emptyTitle}>{t('gdm.emptyGlucoseTitle')}</Text>
                <Text style={styles.emptySub}>{t('gdm.emptyGlucoseSub')}</Text>
              </View>
            )}

            {glucoseDateKeys.map((date) => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateLabel}>{formatKoreanDate(date, t)}</Text>
                {groupedGlucose[date].map((r) => {
                  const sc = statusColors[r.status] ?? statusColors.normal;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.recordCard}
                      onLongPress={() => handleDelete(r.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.recordLeft}>
                        <Text style={styles.recordGlucose}>{r.glucoseLevel}</Text>
                        <Text style={styles.recordUnit}>mg/dL</Text>
                      </View>
                      <View style={styles.recordCenter}>
                        <Text style={styles.recordMeal}>{MEAL_LABELS[r.mealType] ?? r.mealType}</Text>
                        {r.memo ? <Text style={styles.recordMemo} numberOfLines={1}>{r.memo}</Text> : null}
                        <Text style={styles.recordTime}>
                          🕐 {r.measuredAt
                            ? new Date(r.measuredAt).toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                                timeZone: 'Asia/Seoul',
                              })
                            : ''}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </>
        )}

        {tab === 'food' && (
          <>
            {!loading && foodDateKeys.length === 0 && (
              <View style={styles.emptyWrap}>
                <Image source={IC_EATING} style={styles.emptyEmojiImg} resizeMode="contain" />
                <Text style={styles.emptyTitle}>{t('gdm.emptyFoodTitle')}</Text>
                <Text style={styles.emptySub}>{t('gdm.emptyFoodSub')}</Text>
              </View>
            )}

            {foodDateKeys.map((date) => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateLabel}>{formatKoreanDate(date, t)}</Text>
                {groupedFood[date].map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={styles.foodCard}
                    onLongPress={() => handleDeleteFood(f.id)}
                    activeOpacity={0.7}
                  >
                    {f.photoUrl ? (
                      <Image source={{ uri: f.photoUrl }} style={styles.foodThumb} />
                    ) : (
                      <View style={[styles.foodThumb, styles.foodThumbEmpty]}>
                        <Text style={{ fontSize: 22 }}>🍽️</Text>
                      </View>
                    )}
                    <View style={styles.foodInfo}>
                      <View style={styles.foodHeader}>
                        <Text style={styles.foodName} numberOfLines={1}>{f.foodName}</Text>
                        <Text style={styles.foodMealTag}>{FOOD_MEAL_LABELS[f.mealType] ?? f.mealType}</Text>
                      </View>
                      <Text style={styles.foodTime}>
                        🕐 {f.eatenAt
                          ? new Date(f.eatenAt).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                              timeZone: 'Asia/Seoul',
                            })
                          : ''}
                        {typeof f.carbs === 'number' ? ` · ${t('gdm.carbsSuffix', { carbs: f.carbs })}` : ''}
                        {typeof f.calories === 'number' ? ` · ${f.calories}kcal` : ''}
                      </Text>
                      {f.memo ? <Text style={styles.foodMemo} numberOfLines={1}>{f.memo}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      <AdSlot />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => (tab === 'glucose' ? setShowGlucoseModal(true) : openFoodModal())}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 혈당 모달 */}
      <Modal visible={showGlucoseModal} transparent animationType="slide" onRequestClose={() => setShowGlucoseModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowGlucoseModal(false)}>
                <Text style={styles.modalBack}>{`< ${t('gdm.modalBackToPrevious')}`}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('gdm.glucoseModalTitle')}</Text>
              <View style={{ width: 50 }} />
            </View>

            <Text style={styles.modalLabel}>{t('gdm.glucoseValueLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={glucose}
              onChangeText={setGlucose}
              placeholder={t('gdm.glucosePlaceholder')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              autoFocus
            />

            <Text style={styles.modalLabel}>{t('gdm.measuredAtLabel')}</Text>
            <View style={styles.mealGrid}>
              {(Object.keys(MEAL_LABELS) as MealType[]).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.mealChip, mealType === key && styles.mealChipActive]}
                  onPress={() => setMealType(key)}
                >
                  <Text style={[styles.mealChipText, mealType === key && styles.mealChipTextActive]}>
                    {MEAL_LABELS[key]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>{t('gdm.memoOptionalLabel')}</Text>
            <TextInput
              style={[styles.modalInput, { height: 50 }]}
              value={memo}
              onChangeText={setMemo}
              placeholder={t('gdm.glucoseMemoPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveGlucose}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? t('gdm.saving') : t('gdm.saveRecord')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 주간 AI 리포트 모달 */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Text style={styles.modalBack}>{`< ${t('common.close')}`}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('gdm.weeklyReportTitle')}</Text>
              <View style={{ width: 50 }} />
            </View>

            {reportLoading && (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#E91E63" />
                <Text style={{ marginTop: 12, color: COLORS.textSecondary }}>{t('gdm.reportLoadingText')}</Text>
              </View>
            )}

            {!reportLoading && report && (
              <ScrollView style={{ maxHeight: 560 }}>
                {report.stats && (
                  <View style={styles.reportStatsRow}>
                    <View style={styles.reportStat}>
                      <Text style={styles.reportStatVal}>{report.stats.avg}</Text>
                      <Text style={styles.reportStatLabel}>{t('gdm.reportStatAvgGlucose')}</Text>
                    </View>
                    <View style={styles.reportStat}>
                      <Text style={styles.reportStatVal}>{report.stats.measurements}</Text>
                      <Text style={styles.reportStatLabel}>{t('gdm.statCount')}</Text>
                    </View>
                    <View style={styles.reportStat}>
                      <Text style={styles.reportStatVal}>{report.stats.meals}</Text>
                      <Text style={styles.reportStatLabel}>{t('gdm.tabFood')}</Text>
                    </View>
                    {report.stats.warningCount > 0 && (
                      <View style={styles.reportStat}>
                        <Text style={[styles.reportStatVal, { color: '#C62828' }]}>{report.stats.warningCount}</Text>
                        <Text style={styles.reportStatLabel}>{t('gdm.statusWarning')}</Text>
                      </View>
                    )}
                  </View>
                )}

                {report.summary ? (
                  <View style={styles.reportSection}>
                    <Text style={styles.reportSummary}>{report.summary}</Text>
                  </View>
                ) : null}

                {report.highlights.length > 0 && (
                  <View style={[styles.reportSection, { backgroundColor: '#E8F5E9' }]}>
                    <Text style={[styles.reportSectionTitle, { color: '#2E7D32' }]}>👍 {t('gdm.reportHighlightsTitle')}</Text>
                    {report.highlights.map((h, i) => (
                      <Text key={i} style={styles.reportListItem}>• {h}</Text>
                    ))}
                  </View>
                )}

                {report.cautions.length > 0 && (
                  <View style={[styles.reportSection, { backgroundColor: '#FFF8E1' }]}>
                    <Text style={[styles.reportSectionTitle, { color: '#F57F17' }]}>⚠️ {t('gdm.reportCautionsTitle')}</Text>
                    {report.cautions.map((c, i) => (
                      <Text key={i} style={styles.reportListItem}>• {c}</Text>
                    ))}
                  </View>
                )}

                {report.suggestions.length > 0 && (
                  <View style={[styles.reportSection, { backgroundColor: '#FCE4EC' }]}>
                    <Text style={[styles.reportSectionTitle, { color: '#AD1457' }]}>💡 {t('gdm.reportSuggestionsTitle')}</Text>
                    {report.suggestions.map((s, i) => (
                      <Text key={i} style={styles.reportListItem}>• {s}</Text>
                    ))}
                  </View>
                )}

                <Text style={styles.disclaimerBottom}>⚠️ {report.disclaimer}</Text>
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 식단 모달 */}
      <Modal visible={showFoodModal} transparent animationType="slide" onRequestClose={() => setShowFoodModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ maxHeight: '90%' }}
            contentContainerStyle={{ flexGrow: 0 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowFoodModal(false)}>
                  <Text style={styles.modalBack}>{`< ${t('gdm.modalBackToPrevious')}`}</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{t('gdm.foodModalTitle')}</Text>
                <View style={{ width: 50 }} />
              </View>

              {/* 사진 선택 영역 */}
              <View style={styles.photoBox}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={{ fontSize: 36 }}>📷</Text>
                    <Text style={styles.photoHint}>{t('gdm.photoHint')}</Text>
                  </View>
                )}
                <View style={styles.photoBtnRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => handlePickPhoto('camera')}>
                    <Text style={styles.photoBtnText}>📷 {t('gdm.photoBtnCamera')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => handlePickPhoto('library')}>
                    <Text style={styles.photoBtnText}>🖼️ {t('gdm.photoBtnAlbum')}</Text>
                  </TouchableOpacity>
                  {photoUri && (
                    <TouchableOpacity
                      style={[styles.photoBtn, styles.photoBtnAnalyze]}
                      onPress={handleAnalyze}
                      disabled={analyzing}
                    >
                      {analyzing ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={[styles.photoBtnText, { color: '#FFF' }]}>🤖 {t('gdm.photoBtnAnalyze')}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {analyzeResult && (
                <View style={styles.analyzeCard}>
                  <Text style={styles.analyzeTitle}>{t('gdm.analyzeResultTitle')}</Text>
                  <Text style={styles.analyzeLine}>{t('gdm.analyzeFoodLine', { name: analyzeResult.foodName })}</Text>
                  {typeof analyzeResult.carbs === 'number' && (
                    <Text style={styles.analyzeLine}>{t('gdm.analyzeCarbsLine', { carbs: analyzeResult.carbs })}</Text>
                  )}
                  {typeof analyzeResult.calories === 'number' && (
                    <Text style={styles.analyzeLine}>{t('gdm.analyzeCaloriesLine', { calories: analyzeResult.calories })}</Text>
                  )}
                  {analyzeResult.notes ? (
                    <Text style={styles.analyzeNote}>{analyzeResult.notes}</Text>
                  ) : null}
                  <Text style={styles.disclaimer}>⚠️ {analyzeResult.disclaimer}</Text>
                  {analyzeResult.usage && (
                    <Text style={styles.usageText}>
                      {t('gdm.usageText', {
                        used: analyzeResult.usage.used,
                        limit: analyzeResult.usage.limit,
                        tier: analyzeResult.usage.tier === 'paid' ? t('gdm.tierPaid') : t('gdm.tierFree'),
                      })}
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.modalLabel}>{t('gdm.foodNameLabel')}</Text>
              <TextInput
                style={styles.modalInput}
                value={foodName}
                onChangeText={setFoodName}
                placeholder={t('gdm.foodNamePlaceholder')}
                placeholderTextColor={COLORS.textLight}
              />

              <Text style={styles.modalLabel}>{t('gdm.eatenTimeLabel')}</Text>
              <TextInput
                style={styles.modalInput}
                value={eatenTime}
                onChangeText={setEatenTime}
                placeholder={t('gdm.eatenTimePlaceholder')}
                placeholderTextColor={COLORS.textLight}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.modalLabel}>{t('gdm.mealLabel')}</Text>
              <View style={styles.mealGrid}>
                {(Object.keys(FOOD_MEAL_LABELS) as FoodMealType[]).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.mealChip, foodMealType === key && styles.mealChipActive]}
                    onPress={() => setFoodMealType(key)}
                  >
                    <Text style={[styles.mealChipText, foodMealType === key && styles.mealChipTextActive]}>
                      {FOOD_MEAL_LABELS[key]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>{t('gdm.carbsLabel')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder={t('gdm.optionalPlaceholder')}
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>{t('gdm.caloriesLabel')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={calories}
                    onChangeText={setCalories}
                    placeholder={t('gdm.optionalPlaceholder')}
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>{t('gdm.memoOptionalLabel')}</Text>
              <TextInput
                style={[styles.modalInput, { height: 50 }]}
                value={foodMemo}
                onChangeText={setFoodMemo}
                placeholder={t('gdm.foodMemoPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                multiline
              />

              <Text style={styles.disclaimerBottom}>
                {t('gdm.foodDisclaimer')}
              </Text>

              <TouchableOpacity
                style={[styles.saveBtn, savingFood && { opacity: 0.6 }]}
                onPress={handleSaveFood}
                disabled={savingFood}
              >
                <Text style={styles.saveBtnText}>{savingFood ? t('gdm.saving') : t('gdm.saveFood')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <GuideCarousel visible={guideVisible} pages={getGdmGuide(t)} onClose={closeGuide} onComplete={closeGuide} accent="#7FB1BB" />
    </View>
  );
}

function formatKoreanDate(dateStr: string, t: TFunction): string {
  const d = new Date(dateStr);
  const weekdays = [
    t('gdm.weekdaySun'),
    t('gdm.weekdayMon'),
    t('gdm.weekdayTue'),
    t('gdm.weekdayWed'),
    t('gdm.weekdayThu'),
    t('gdm.weekdayFri'),
    t('gdm.weekdaySat'),
  ];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: SPACING.md },

  /* Tab */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabBtnActive: { backgroundColor: '#FCE4EC', borderColor: '#E91E63' },
  tabText: { fontSize: FONT_SIZE.md, color: '#5D4037', fontWeight: '700' },
  tabTextActive: { color: '#AD1457', fontWeight: '600' },

  /* Info card */
  infoCard: {
    backgroundColor: '#FCE4EC',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  infoTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: '#AD1457', marginBottom: 4 },
  infoSub: { fontSize: FONT_SIZE.sm, color: '#C2185B' },
  thresholdText: { fontSize: 11, color: '#880E4F', marginTop: 8, textAlign: 'center' },

  /* Stats */
  statsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  statsTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  alertRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm, justifyContent: 'center' },
  alertPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },

  /* Records */
  dateGroup: { marginBottom: SPACING.md },
  dateLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    paddingLeft: 4,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 6,
    ...SHADOWS.soft,
  },
  recordLeft: { flexDirection: 'row', alignItems: 'baseline', marginRight: SPACING.md, minWidth: 70 },
  recordGlucose: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  recordUnit: { fontSize: 11, color: COLORS.textSecondary, marginLeft: 2 },
  recordCenter: { flex: 1 },
  recordMeal: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  recordMemo: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  recordTime: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },

  /* Food card */
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 6,
    ...SHADOWS.soft,
  },
  foodThumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.md,
    backgroundColor: COLORS.background,
  },
  foodThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  foodInfo: { flex: 1 },
  foodHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foodName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, flex: 1 },
  foodMealTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#AD1457',
    backgroundColor: '#FCE4EC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  foodTime: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  foodMemo: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  /* Empty */
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyEmojiImg: { width: 64, height: 64, marginBottom: 12 },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  emptySub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },

  /* FAB */
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E91E63',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
  fabText: { fontSize: 28, color: '#FFF', fontWeight: '300', marginTop: -2 },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalBack: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  modalLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  mealChipActive: { borderColor: '#E91E63', backgroundColor: '#FCE4EC' },
  mealChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  mealChipTextActive: { color: '#E91E63', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#E91E63',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  saveBtnText: { color: '#FFF', fontSize: FONT_SIZE.lg, fontWeight: '600' },

  /* Photo picker */
  photoBox: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  photoPreview: { width: '100%', height: 180, borderRadius: RADIUS.sm, marginBottom: SPACING.sm },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  photoHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, textAlign: 'center' },
  photoBtnRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  photoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  photoBtnAnalyze: { backgroundColor: '#E91E63', borderColor: '#E91E63' },
  photoBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },

  /* Analyze result */
  analyzeCard: {
    backgroundColor: '#F3E5F5',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  analyzeTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#6A1B9A', marginBottom: 6 },
  analyzeLine: { fontSize: FONT_SIZE.sm, color: COLORS.text, marginBottom: 2 },
  analyzeNote: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, lineHeight: 17 },
  disclaimer: { fontSize: 11, color: '#C62828', marginTop: 8, lineHeight: 15 },
  disclaimerBottom: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    lineHeight: 16,
    textAlign: 'center',
  },
  usageText: { fontSize: 11, color: COLORS.textLight, marginTop: 6, textAlign: 'right' },

  /* Weekly AI report */
  reportBtn: {
    backgroundColor: '#E91E63',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  reportBtnText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '700' },
  reportBtnSub: { color: '#FCE4EC', fontSize: 11, marginTop: 3 },
  inlineAddBtn: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E91E63',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  inlineAddBtnText: { color: '#AD1457', fontSize: FONT_SIZE.md, fontWeight: '600' },
  reportStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  reportStat: { alignItems: 'center' },
  reportStatVal: { fontSize: 20, fontWeight: '700', color: '#AD1457' },
  reportStatLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  reportSection: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  reportSectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', marginBottom: 6 },
  reportSummary: { fontSize: FONT_SIZE.md, color: COLORS.text, lineHeight: 22 },
  reportListItem: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20, marginTop: 3 },
});
