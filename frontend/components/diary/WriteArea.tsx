import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const CHAR_LIMIT = 500;

interface WriteAreaProps {
  content: string;
  onChangeContent: (text: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function WriteArea({ content, onChangeContent, onSubmit, loading }: WriteAreaProps) {
  const charCount = content.length;
  const isOverLimit = charCount > CHAR_LIMIT;

  const handleChange = (text: string) => {
    if (text.length <= CHAR_LIMIT) {
      onChangeContent(text);
    }
  };

  return (
    <View style={styles.card}>
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
      <View style={styles.footer}>
        <Text style={[styles.counter, isOverLimit && styles.counterOver]}>
          {charCount} / {CHAR_LIMIT}자
        </Text>
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
