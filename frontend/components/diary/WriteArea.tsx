import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { pickImageFromLibrary } from '../../utils/imagePicker';

const CHAR_LIMIT = 500;

interface DailyQuestionInfo {
  question: string;
  hint: string;
}

interface WriteAreaProps {
  content: string;
  onChangeContent: (text: string) => void;
  onSubmit: () => void;
  loading: boolean;
  dailyQuestion?: DailyQuestionInfo;
  photoUri?: string | null;
  onChangePhoto?: (uri: string | null) => void;
}

export function WriteArea({
  content,
  onChangeContent,
  onSubmit,
  loading,
  dailyQuestion,
  photoUri,
  onChangePhoto,
}: WriteAreaProps) {
  const charCount = content.length;
  const isOverLimit = charCount > CHAR_LIMIT;

  const handleChange = (text: string) => {
    if (text.length <= CHAR_LIMIT) {
      onChangeContent(text);
    }
  };

  return (
    <View style={styles.card}>
      {dailyQuestion && (
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>오늘의 질문</Text>
          <Text style={styles.questionText}>{dailyQuestion.question}</Text>
          <Text style={styles.questionHint}>{dailyQuestion.hint}</Text>
        </View>
      )}
      <TextInput
        style={styles.textArea}
        placeholder="오늘 아이의 모습을 자유롭게 기록해주세요..."
        placeholderTextColor={COLORS.textLight}
        value={content}
        onChangeText={handleChange}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />
      {photoUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: photoUri }} style={styles.preview} />
          {onChangePhoto && (
            <TouchableOpacity style={styles.removeBtn} onPress={() => onChangePhoto(null)}>
              <Text style={styles.removeText}>{'✕'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      <View style={styles.footer}>
        <Text style={[styles.counter, isOverLimit && styles.counterOver]}>
          {charCount} / {CHAR_LIMIT}자
        </Text>
        <View style={styles.actions}>
          {onChangePhoto && (
            <TouchableOpacity
              style={styles.photoBtn}
              onPress={async () => {
                const picked = await pickImageFromLibrary({ quality: 0.7 });
                if (picked) onChangePhoto(picked.uri);
              }}
            >
              <Text style={styles.photoBtnText}>{'📷'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={loading || isOverLimit}
          >
            <Text style={styles.submitText}>
              {loading ? '분석 중...' : '기록하기'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  questionCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  questionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.xs,
  },
  questionHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  textArea: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    lineHeight: 22,
  },
  previewWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  preview: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.md,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
  counterOver: {
    color: COLORS.error,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  photoBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtnText: {
    fontSize: 18,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  submitText: {
    color: '#FFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
