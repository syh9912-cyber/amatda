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
} from 'react-native';
import { Stack, router } from 'expo-router';
import { observationApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { WriteArea } from '../../components/diary/WriteArea';
import { ObservationCard } from '../../components/diary/ObservationCard';
import { getTodayQuestion } from '../../constants/dailyQuestions';

interface ObservationItem {
  id: string;
  type: string;
  rawContent: string;
  extractedTraits: {
    emotions: string[];
    socialStyle: string;
    interests: string[];
    summary: string;
  };
  createdAt: string;
}

export default function DiaryScreen() {
  const [content, setContent] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [observations, setObservations] = useState<ObservationItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const selectedChild = useChildStore((s) => s.selectedChild);

  const dailyQuestion = useMemo(() => {
    if (!selectedChild) return undefined;
    const ageGroup = selectedChild.ageInfo.group;
    const q = getTodayQuestion(ageGroup);
    return { question: q.question, hint: q.hint };
  }, [selectedChild?.ageInfo.group]);

  useEffect(() => {
    if (selectedChild) loadObservations();
  }, [selectedChild?.id]);

  const loadObservations = async () => {
    if (!selectedChild) return;
    try {
      const res = await observationApi.list(selectedChild.id);
      setObservations(res.data.data);
    } catch {
      // ignore
    } finally {
      setListLoading(false);
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
    setLoading(true);
    try {
      const res = await observationApi.create(selectedChild.id, content.trim());
      setObservations((prev) => [res.data.data.observation, ...prev]);
      setContent('');
      setPhotoUri(null);
      Alert.alert('완료', '관찰 일기가 저장되고 성향이 분석되었습니다');
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
        <Stack.Screen options={{ title: '관찰 일기', headerShown: true }} />

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
              emotions={obs.extractedTraits.emotions}
              interests={obs.extractedTraits.interests}
              socialStyle={obs.extractedTraits.socialStyle}
              summary={obs.extractedTraits.summary}
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
