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
import { pregnancyApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';
import { GuideButton } from '../../components/common/GuideButton';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { GDM_GUIDE } from '../../features/guide/gdmGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
import { pickImageFromLibrary, pickImageFromCamera } from '../../utils/imagePicker';
import type { ImageSourcePropType } from 'react-native';

const IC_BLOOD = require('../../assets/quick-blood.png') as ImageSourcePropType;
const IC_EATING = require('../../assets/mascot-eating.png') as ImageSourcePropType;

type MealType = 'fasting' | 'before_meal' | 'after_meal_1h' | 'after_meal_2h' | 'bedtime';
type FoodMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type TabMode = 'glucose' | 'food';

const MEAL_LABELS: Record<MealType, string> = {
  fasting: '공복',
  before_meal: '식전',
  after_meal_1h: '식후 1시간',
  after_meal_2h: '식후 2시간',
  bedtime: '취침 전',
};

const FOOD_MEAL_LABELS: Record<FoodMealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  normal: { bg: '#E8F5E9', text: '#2E7D32', label: '정상' },
  caution: { bg: '#FFF8E1', text: '#F57F17', label: '주의' },
  warning: { bg: '#FFEBEE', text: '#C62828', label: '위험' },
};

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

const GLUCOSE_ADVICE: Record<string, { title: string; body: string }> = {
  caution: {
    title: '살짝 주의가 필요해요',
    body: '기준치보다 조금 높아요.\n· 식후라면 10~15분 가벼운 산책이 도움돼요\n· 다음 끼니는 탄수화물 양을 조금 줄여보세요\n· 물을 충분히 드시고, 1~2시간 후 재측정을 권해요',
  },
  warning: {
    title: '위험 범위예요',
    body: '기준치보다 많이 높아요.\n· 물을 충분히 드시고 안정을 취하세요\n· 같은 패턴이 반복되면 담당 의료진과 상의하세요\n· 이번 식사 내용을 식단 탭에 기록해두면 원인 파악에 도움돼요',
  },
};

const MEAL_CARB_LIMIT: Record<FoodMealType, number> = {
  breakfast: 45,
  lunch: 60,
  dinner: 60,
  snack: 20,
};

export default function GdmScreen() {
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
      Alert.alert('알림', '혈당 수치를 올바르게 입력해주세요 (30~500 mg/dL)');
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
      Alert.alert('오류', '혈당 기록 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await pregnancyApi.deleteGdm(id);
            await loadData();
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const handleDeleteFood = (id: string) => {
    Alert.alert('삭제', '이 식단 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await pregnancyApi.deleteFoodLog(id);
            await loadData();
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
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
    const result = await pick({ quality: 0.7 });
    if (!result) return;
    setPhotoUri(result.uri);
    setPhotoMime(result.mimeType || 'image/jpeg');
    setAnalyzeResult(null);
  };

  const handleAnalyze = async () => {
    if (!photoUri || !photoMime) {
      Alert.alert('알림', '먼저 사진을 선택해주세요.');
      return;
    }
    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await pregnancyApi.analyzeFoodPhoto(base64, photoMime);
      const data = (res.data?.data ?? res.data) as AnalyzeResult;
      setAnalyzeResult(data);
      if (!foodName && data.foodName) setFoodName(data.foodName);
      if (!carbs && typeof data.carbs === 'number') setCarbs(String(data.carbs));
      if (!calories && typeof data.calories === 'number') setCalories(String(data.calories));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert('분석 불가', msg || 'AI 분석에 실패했어요.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveFood = async () => {
    if (!foodName.trim()) {
      Alert.alert('알림', '음식 이름을 입력해주세요.');
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
          '탄수화물이 조금 많아요',
          `이번 ${FOOD_MEAL_LABELS[savedMealType]}의 탄수화물이 ${savedCarbs}g이에요. (${FOOD_MEAL_LABELS[savedMealType]} 권장 ${MEAL_CARB_LIMIT[savedMealType]}g 내외)\n· 식후 1시간 혈당을 꼭 재보세요\n· 다음 끼니는 채소/단백질 비율을 높여보세요\n· 식후 10~15분 가벼운 산책이 혈당 상승을 완화해줘요`,
        );
      }
    } catch {
      Alert.alert('오류', '식단 기록 저장에 실패했습니다.');
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
      const res = await pregnancyApi.gdmWeeklyReport(childId);
      const data = (res.data?.data ?? res.data) as WeeklyReport;
      setReport(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert('알림', msg || 'AI 분석을 가져오지 못했어요. 잠시 후 다시 시도해주세요.');
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

  const thresholdInfo = `공복: 95 이하 | 식후1h: 140 이하 | 식후2h: 120 이하`;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '임당 관리', headerShown: true, headerLeft: () => <BackButton />, headerRight: () => <View style={{ marginRight: 14 }}><GuideButton onPress={() => setGuideVisible(true)} color="#7FB1BB" /></View> }} />

      {/* 탭 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'glucose' && styles.tabBtnActive]}
          onPress={() => setTab('glucose')}
        >
          <Text style={[styles.tabText, tab === 'glucose' && styles.tabTextActive]}>🩸 혈당</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'food' && styles.tabBtnActive]}
          onPress={() => setTab('food')}
        >
          <Text style={[styles.tabText, tab === 'food' && styles.tabTextActive]}>🍚 식단</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <MedicalCitation
          compact
          note="혈당·식단 권고는 일반 기준이며 개인별 목표는 담당 의료진과 상의하세요."
          sources={[
            { label: '대한당뇨병학회 「당뇨병 진료지침」 (임신성 당뇨병)', url: 'https://www.diabetes.or.kr' },
            { label: '식품의약품안전처 식품영양성분 데이터베이스', url: 'https://www.foodsafetykorea.go.kr' },
          ]}
        />

        {/* AI 주간 분석 버튼 */}
        <TouchableOpacity
          style={styles.reportBtn}
          onPress={handleLoadReport}
          activeOpacity={0.85}
        >
          <Text style={styles.reportBtnText}>🤖 이번 주 AI 분석 받기</Text>
          <Text style={styles.reportBtnSub}>최근 7일 혈당+식단 종합 코칭</Text>
        </TouchableOpacity>

        {/* 인라인 입력 버튼 — FAB 가 광고에 가려 잘 안 보임 보완 */}
        <TouchableOpacity
          style={styles.inlineAddBtn}
          onPress={() => (tab === 'glucose' ? setShowGlucoseModal(true) : openFoodModal())}
          activeOpacity={0.85}
        >
          <Text style={styles.inlineAddBtnText}>
            {tab === 'glucose' ? '＋ 혈당 기록 추가' : '＋ 식단 기록 추가'}
          </Text>
        </TouchableOpacity>

        {/* 산모 정보 */}
        {child && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{child.name} 산모님의 임당 관리</Text>
            {(child.momHeight || child.momWeight || child.momBloodType) ? (
              <Text style={styles.infoSub}>
                {[
                  child.momHeight ? `${child.momHeight}cm` : null,
                  child.momWeight ? `${child.momWeight}kg` : null,
                  child.momBloodType ? `${child.momBloodType}형` : null,
                ].filter(Boolean).join(' / ')}
              </Text>
            ) : null}
            {tab === 'glucose' && <Text style={styles.thresholdText}>{thresholdInfo}</Text>}
            {tab === 'food' && (
              <Text style={styles.thresholdText}>
                임당은 탄수화물 섭취량 관리가 핵심이에요. 매끼 식사 내용과 시간을 남겨주세요.
              </Text>
            )}
          </View>
        )}

        {tab === 'glucose' && (
          <>
            {stats && stats.total > 0 && (
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>최근 {stats.days}일 통계</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.avg}</Text>
                    <Text style={styles.statLabel}>평균</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.min}</Text>
                    <Text style={styles.statLabel}>최저</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.max}</Text>
                    <Text style={styles.statLabel}>최고</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <Text style={styles.statLabel}>측정</Text>
                  </View>
                </View>
                {(stats.cautionCount > 0 || stats.warningCount > 0) && (
                  <View style={styles.alertRow}>
                    {stats.cautionCount > 0 && (
                      <View style={[styles.alertPill, { backgroundColor: '#FFF8E1' }]}>
                        <Text style={{ color: '#F57F17', fontSize: 12, fontWeight: '600' }}>
                          주의 {stats.cautionCount}회
                        </Text>
                      </View>
                    )}
                    {stats.warningCount > 0 && (
                      <View style={[styles.alertPill, { backgroundColor: '#FFEBEE' }]}>
                        <Text style={{ color: '#C62828', fontSize: 12, fontWeight: '600' }}>
                          위험 {stats.warningCount}회
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
                  <Text style={styles.statsTitle}>혈당 추이</Text>
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
                <Text style={styles.emptyTitle}>아직 기록이 없어요</Text>
                <Text style={styles.emptySub}>+ 버튼으로 혈당을 기록해보세요</Text>
              </View>
            )}

            {glucoseDateKeys.map((date) => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateLabel}>{formatKoreanDate(date)}</Text>
                {groupedGlucose[date].map((r) => {
                  const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.normal;
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
                <Text style={styles.emptyTitle}>아직 식단 기록이 없어요</Text>
                <Text style={styles.emptySub}>+ 버튼으로 먹은 음식과 시간을 남겨보세요</Text>
              </View>
            )}

            {foodDateKeys.map((date) => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateLabel}>{formatKoreanDate(date)}</Text>
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
                        {typeof f.carbs === 'number' ? ` · 탄수 ${f.carbs}g` : ''}
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
                <Text style={styles.modalBack}>{'< 뒤로'}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>혈당 기록</Text>
              <View style={{ width: 50 }} />
            </View>

            <Text style={styles.modalLabel}>혈당 수치 (mg/dL)</Text>
            <TextInput
              style={styles.modalInput}
              value={glucose}
              onChangeText={setGlucose}
              placeholder="예: 95"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              autoFocus
            />

            <Text style={styles.modalLabel}>측정 시점</Text>
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

            <Text style={styles.modalLabel}>메모 (선택)</Text>
            <TextInput
              style={[styles.modalInput, { height: 50 }]}
              value={memo}
              onChangeText={setMemo}
              placeholder="아침식사 후, 간식 먹고 등"
              placeholderTextColor={COLORS.textLight}
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveGlucose}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '기록 저장'}</Text>
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
                <Text style={styles.modalBack}>{'< 닫기'}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>이번 주 AI 분석</Text>
              <View style={{ width: 50 }} />
            </View>

            {reportLoading && (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#E91E63" />
                <Text style={{ marginTop: 12, color: COLORS.textSecondary }}>최근 7일 기록을 분석하고 있어요...</Text>
              </View>
            )}

            {!reportLoading && report && (
              <ScrollView style={{ maxHeight: 560 }}>
                {report.stats && (
                  <View style={styles.reportStatsRow}>
                    <View style={styles.reportStat}>
                      <Text style={styles.reportStatVal}>{report.stats.avg}</Text>
                      <Text style={styles.reportStatLabel}>평균혈당</Text>
                    </View>
                    <View style={styles.reportStat}>
                      <Text style={styles.reportStatVal}>{report.stats.measurements}</Text>
                      <Text style={styles.reportStatLabel}>측정</Text>
                    </View>
                    <View style={styles.reportStat}>
                      <Text style={styles.reportStatVal}>{report.stats.meals}</Text>
                      <Text style={styles.reportStatLabel}>식단</Text>
                    </View>
                    {report.stats.warningCount > 0 && (
                      <View style={styles.reportStat}>
                        <Text style={[styles.reportStatVal, { color: '#C62828' }]}>{report.stats.warningCount}</Text>
                        <Text style={styles.reportStatLabel}>위험</Text>
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
                    <Text style={[styles.reportSectionTitle, { color: '#2E7D32' }]}>👍 잘하고 있는 점</Text>
                    {report.highlights.map((h, i) => (
                      <Text key={i} style={styles.reportListItem}>• {h}</Text>
                    ))}
                  </View>
                )}

                {report.cautions.length > 0 && (
                  <View style={[styles.reportSection, { backgroundColor: '#FFF8E1' }]}>
                    <Text style={[styles.reportSectionTitle, { color: '#F57F17' }]}>⚠️ 주의할 점</Text>
                    {report.cautions.map((c, i) => (
                      <Text key={i} style={styles.reportListItem}>• {c}</Text>
                    ))}
                  </View>
                )}

                {report.suggestions.length > 0 && (
                  <View style={[styles.reportSection, { backgroundColor: '#FCE4EC' }]}>
                    <Text style={[styles.reportSectionTitle, { color: '#AD1457' }]}>💡 이번 주 실천 팁</Text>
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
                  <Text style={styles.modalBack}>{'< 뒤로'}</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>식단 기록</Text>
                <View style={{ width: 50 }} />
              </View>

              {/* 사진 선택 영역 */}
              <View style={styles.photoBox}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={{ fontSize: 36 }}>📷</Text>
                    <Text style={styles.photoHint}>사진을 추가하면 AI가 음식을 분석해줘요</Text>
                  </View>
                )}
                <View style={styles.photoBtnRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => handlePickPhoto('camera')}>
                    <Text style={styles.photoBtnText}>📷 촬영</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => handlePickPhoto('library')}>
                    <Text style={styles.photoBtnText}>🖼️ 앨범</Text>
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
                        <Text style={[styles.photoBtnText, { color: '#FFF' }]}>🤖 AI 분석</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {analyzeResult && (
                <View style={styles.analyzeCard}>
                  <Text style={styles.analyzeTitle}>AI 분석 결과 (참고용)</Text>
                  <Text style={styles.analyzeLine}>음식: {analyzeResult.foodName}</Text>
                  {typeof analyzeResult.carbs === 'number' && (
                    <Text style={styles.analyzeLine}>탄수화물 추정: {analyzeResult.carbs}g</Text>
                  )}
                  {typeof analyzeResult.calories === 'number' && (
                    <Text style={styles.analyzeLine}>칼로리 추정: {analyzeResult.calories}kcal</Text>
                  )}
                  {analyzeResult.notes ? (
                    <Text style={styles.analyzeNote}>{analyzeResult.notes}</Text>
                  ) : null}
                  <Text style={styles.disclaimer}>⚠️ {analyzeResult.disclaimer}</Text>
                  {analyzeResult.usage && (
                    <Text style={styles.usageText}>
                      오늘 사진 분석 {analyzeResult.usage.used}/{analyzeResult.usage.limit}회 사용 ({analyzeResult.usage.tier === 'paid' ? '프리미엄' : '무료'})
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.modalLabel}>음식 이름</Text>
              <TextInput
                style={styles.modalInput}
                value={foodName}
                onChangeText={setFoodName}
                placeholder="예: 잡곡밥, 된장국, 시금치나물"
                placeholderTextColor={COLORS.textLight}
              />

              <Text style={styles.modalLabel}>먹은 시간 (HH:mm)</Text>
              <TextInput
                style={styles.modalInput}
                value={eatenTime}
                onChangeText={setEatenTime}
                placeholder="예: 08:30"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.modalLabel}>끼니</Text>
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
                  <Text style={styles.modalLabel}>탄수화물(g)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder="선택"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>칼로리(kcal)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="선택"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>메모 (선택)</Text>
              <TextInput
                style={[styles.modalInput, { height: 50 }]}
                value={foodMemo}
                onChangeText={setFoodMemo}
                placeholder="식후 혈당, 맛/컨디션 등"
                placeholderTextColor={COLORS.textLight}
                multiline
              />

              <Text style={styles.disclaimerBottom}>
                ⚠️ AI 사진 분석은 참고용 추정치이며, 의료 진단이나 영양 처방이 아닙니다.
                정확한 임당 관리는 담당 의료진과 상담해주세요.
              </Text>

              <TouchableOpacity
                style={[styles.saveBtn, savingFood && { opacity: 0.6 }]}
                onPress={handleSaveFood}
                disabled={savingFood}
              >
                <Text style={styles.saveBtnText}>{savingFood ? '저장 중...' : '식단 저장'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <GuideCarousel visible={guideVisible} pages={GDM_GUIDE} onClose={closeGuide} onComplete={closeGuide} accent="#7FB1BB" />
    </View>
  );
}

function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
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
