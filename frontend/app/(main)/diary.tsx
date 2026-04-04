import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { observationApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

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
  const [loading, setLoading] = useState(false);
  const [observations, setObservations] = useState<ObservationItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const selectedChild = useChildStore((s) => s.selectedChild);

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
      Alert.alert('완료', '관찰 일기가 저장되고 성향이 분석되었습니다');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '관찰 일기', headerShown: true }} />

      {selectedChild && (
        <Text style={styles.childLabel}>{selectedChild.name}의 관찰 일기</Text>
      )}

      {/* 작성 영역 */}
      <View style={styles.writeCard}>
        <TextInput
          style={styles.textArea}
          placeholder="오늘 아이의 모습을 자유롭게 기록해주세요..."
          placeholderTextColor={COLORS.textLight}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? '분석 중...' : '기록하기'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 기록 목록 */}
      <Text style={styles.sectionTitle}>이전 기록</Text>
      {listLoading ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : observations.length === 0 ? (
        <Text style={styles.emptyText}>아직 작성된 관찰 일기가 없습니다</Text>
      ) : (
        observations.map((obs) => (
          <View key={obs.id} style={styles.entryCard}>
            <Text style={styles.entryDate}>
              {new Date(obs.createdAt).toLocaleDateString('ko-KR')}
            </Text>
            <Text style={styles.entryContent}>{obs.rawContent}</Text>
            <View style={styles.traitRow}>
              {obs.extractedTraits.emotions.map((e, i) => (
                <View key={i} style={styles.traitBadge}>
                  <Text style={styles.traitText}>{e}</Text>
                </View>
              ))}
              {obs.extractedTraits.interests.map((e, i) => (
                <View key={`i${i}`} style={[styles.traitBadge, styles.interestBadge]}>
                  <Text style={styles.traitText}>{e}</Text>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: SPACING.md },
  childLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  writeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  textArea: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '600' },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  emptyText: { color: COLORS.textLight, textAlign: 'center', padding: SPACING.xl },
  entryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  entryDate: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginBottom: SPACING.xs },
  entryContent: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  traitBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  interestBadge: { backgroundColor: COLORS.secondaryLight },
  traitText: { fontSize: FONT_SIZE.xs, color: COLORS.text },
});
