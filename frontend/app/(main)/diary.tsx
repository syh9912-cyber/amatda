import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { observationApi, uploadApi, coachingApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { canDo } from '../../features/coparenting/permissions';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { WriteArea } from '../../components/diary/WriteArea';
import { ObservationCard } from '../../components/diary/ObservationCard';
import { getTodayQuestion } from '../../constants/dailyQuestions';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';

interface ObservationItem {
  id: string;
  type: string;
  rawContent: string;
  createdAt: string;
}

interface AiDiaryData {
  childName: string;
  date: string;
  diary: string;
}

export default function DiaryScreen() {
  const [content, setContent] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [observations, setObservations] = useState<ObservationItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [aiDiary, setAiDiary] = useState<AiDiaryData | null>(null);
  const [aiDiaryLoading, setAiDiaryLoading] = useState(false);
  const selectedChild = useChildStore((s) => s.selectedChild);

  const dailyQuestion = useMemo(() => {
    if (!selectedChild) return undefined;
    const ageGroup = selectedChild.ageInfo.group;
    const q = getTodayQuestion(ageGroup);
    return { question: q.question, hint: q.hint };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.ageInfo.group]);

  useEffect(() => {
    if (selectedChild) loadObservations();
    else { setObservations([]); setListLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id]);

  const loadObservations = async () => {
    if (!selectedChild) { setListLoading(false); return; }
    try {
      const res = await observationApi.list(selectedChild.id);
      setObservations(res.data.data ?? []);
    } catch {
      Alert.alert('오류', '관찰 기록을 불러오지 못했습니다');
    } finally {
      setListLoading(false);
    }
  };

  const handleGenerateAiDiary = async () => {
    if (!selectedChild) return;
    // 공동육아: AI 일기 생성은 useCoaching 권한 필요
    if (!(await canDo(selectedChild.id, 'useCoaching'))) {
      Alert.alert('열람 전용', 'AI 일기 생성 권한이 없어요.\n보호자에게 "상담이모 사용" 권한을 요청해주세요.');
      return;
    }
    setAiDiaryLoading(true);
    try {
      const res = await coachingApi.dailyDiary(selectedChild.id);
      const data = res.data?.data as AiDiaryData | undefined;
      if (data?.diary) {
        setAiDiary(data);
      } else {
        Alert.alert('알림', 'AI 일기를 생성하지 못했습니다. 오늘 상담 내역이 있어야 생성됩니다.');
      }
    } catch {
      Alert.alert('오류', 'AI 일기 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setAiDiaryLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('알림', '관찰 내용을 입력해주세요');
      return;
    }
    if (!selectedChild) {
      Alert.alert('알림', '선택된 자녀가 없습니다');
      return;
    }
    // 공동육아: 관찰 일기 작성은 editRecords 권한 필요 (열람 전용 멤버 차단)
    if (!(await canDo(selectedChild.id, 'editRecords'))) {
      Alert.alert('열람 전용', '기록 작성 권한이 없어요.\n보호자에게 "육아 기록 작성/수정" 권한을 요청해주세요.');
      return;
    }
    setLoading(true);
    try {
      // 사진이 있으면 Firebase Storage에 업로드
      let uploadedPhotoUrl: string | undefined;
      if (photoUri) {
        try {
          const uploaded = await uploadApi.upload(photoUri, 'diary');
          uploadedPhotoUrl = uploaded.url;
        } catch {
          // 사진 업로드 실패해도 텍스트는 저장
        }
      }
      const res = await observationApi.create(selectedChild.id, content.trim(), uploadedPhotoUrl ? 'PHOTO' : 'TEXT');
      setObservations((prev) => [res.data.data.observation, ...prev]);
      setContent('');
      setPhotoUri(null);
      Alert.alert('완료', '관찰 일기가 저장되었습니다');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Stack.Screen options={{ title: '관찰 일기', headerShown: true, headerLeft: () => <BackButton /> }} />

        {selectedChild && (
          <Text style={styles.childLabel}>
            {selectedChild.name}의 관찰 일기
          </Text>
        )}

        <WriteArea
          content={content}
          onChangeContent={setContent}
          onSubmit={handleSubmit}
          loading={loading}
          dailyQuestion={dailyQuestion}
          photoUri={photoUri}
          onChangePhoto={setPhotoUri}
        />

        {/* AI 오늘 일기 섹션 */}
        <View style={styles.aiDiarySection}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>AI 오늘 일기</Text>
          </View>
          {aiDiary ? (
            <View style={styles.aiDiaryCard}>
              <Text style={styles.aiDiaryDate}>{aiDiary.date} · {aiDiary.childName}</Text>
              <Text style={styles.aiDiaryText}>{aiDiary.diary}</Text>
              <TouchableOpacity
                style={styles.aiDiaryRefreshBtn}
                onPress={handleGenerateAiDiary}
                disabled={aiDiaryLoading}
              >
                <Text style={styles.aiDiaryRefreshText}>
                  {aiDiaryLoading ? '생성 중...' : '다시 생성'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.aiDiaryGenBtn, aiDiaryLoading && styles.btnDisabled]}
              onPress={handleGenerateAiDiary}
              disabled={aiDiaryLoading}
            >
              {aiDiaryLoading ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.aiDiaryGenText}>✨ AI 오늘 일기 생성</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>이전 기록</Text>
          {observations.length > 0 && (
            <Text style={styles.countBadge}>{observations.length}건</Text>
          )}
        </View>

        {listLoading ? (
          <ActivityIndicator color={COLORS.primary} style={styles.loader} />
        ) : observations.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Image
              source={require('../../assets/empty-diary.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>
              아직 작성된 관찰 일기가 없습니다
            </Text>
            <Text style={styles.emptyHint}>
              위에서 아이의 모습을 기록해보세요
            </Text>
          </View>
        ) : (
          observations.map((obs) => (
            <ObservationCard
              key={obs.id}
              rawContent={obs.rawContent}
              createdAt={obs.createdAt}
              onShare={() => {
                router.push({
                  pathname: '/(main)/momstagram-post',
                  params: { prefillContent: obs.rawContent },
                });
              }}
            />
          ))
        )}
      </ScrollView>
      <AdSlot />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 100 },
  childLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  countBadge: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  loader: { marginTop: SPACING.xl },
  aiDiarySection: { marginBottom: SPACING.lg },
  aiDiaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  aiDiaryDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
  aiDiaryText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  aiDiaryRefreshBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  aiDiaryRefreshText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  aiDiaryGenBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    minHeight: 52,
    justifyContent: 'center',
  },
  aiDiaryGenText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  btnDisabled: { opacity: 0.6 },
  emptyWrap: {
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.md,
  },
  emptyImage: { width: 160, height: 160, marginBottom: SPACING.sm },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  emptyHint: {
    color: COLORS.textLight,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
});
