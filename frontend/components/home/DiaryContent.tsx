import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { questionApi, observationApi } from '../../services/api';
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  childId: string;
  ageMonths: number;
}

interface DailyQuestion {
  id: string;
  content: string;
}

interface DiaryEntry {
  id: string;
  content: string;
  createdAt: string;
}

export function DiaryContent({ childId, ageMonths }: Props) {
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [childId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [qRes, eRes] = await Promise.allSettled([
        questionApi.list(ageMonths, 'daily'),
        observationApi.list(childId),
      ]);
      if (qRes.status === 'fulfilled') {
        const questions = qRes.value.data.data ?? [];
        if (questions.length > 0) {
          const idx = new Date().getDate() % questions.length;
          setQuestion(questions[idx]);
        }
      }
      if (eRes.status === 'fulfilled') {
        const all: DiaryEntry[] = eRes.value.data.data ?? [];
        setEntries(all.slice(0, 3));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color="#6366F1" />
      </View>
    );
  }

  return (
    <View>
      {question && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {'\uD83D\uDCAC'} \uC624\uB298\uC758 \uC9C8\uBB38
          </Text>
          <Text style={styles.questionText}>{question.content}</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/(main)/diary')}
          >
            <Text style={styles.actionBtnText}>
              \uC77C\uAE30 \uC4F0\uAE30
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {entries.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {'\uD83D\uDCDD'} \uCD5C\uADFC \uC77C\uAE30
          </Text>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <Text style={styles.entryDate}>
                {new Date(entry.createdAt).toLocaleDateString('ko-KR')}
              </Text>
              <Text style={styles.entryContent} numberOfLines={1}>
                {entry.content}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => router.push('/(main)/diary')}
          >
            <Text style={styles.moreLink}>
              \uB354\uBCF4\uAE30 {'\u203A'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            \uC544\uC9C1 \uC791\uC131\uD55C \uC77C\uAE30\uAC00 \uC5C6\uC5B4\uC694
          </Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/(main)/diary')}
          >
            <Text style={styles.actionBtnText}>
              \uCCAB \uC77C\uAE30 \uC4F0\uAE30
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#1E1E2E',
    marginBottom: SPACING.sm,
  },
  questionText: {
    fontSize: FONT_SIZE.md,
    color: '#1E1E2E',
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  actionBtn: {
    backgroundColor: '#4338CA',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    alignSelf: 'flex-start',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: SPACING.sm,
  },
  entryDate: {
    fontSize: 10,
    color: '#A0A0B0',
    width: 70,
  },
  entryContent: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: '#1E1E2E',
  },
  moreLink: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: '#4338CA',
    fontWeight: '600',
    textAlign: 'right',
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: '#A0A0B0',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
});
