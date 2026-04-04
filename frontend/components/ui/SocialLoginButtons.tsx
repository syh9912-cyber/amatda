import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SocialProvider } from '../../services/social-auth';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';
import { SOCIAL_BUTTON_LIST } from './socialButtonConfig';

interface SocialLoginButtonsProps {
  onPress: (provider: SocialProvider) => void;
  loadingProvider: SocialProvider | null;
}

export function SocialLoginButtons({
  onPress,
  loadingProvider,
}: SocialLoginButtonsProps) {
  return (
    <View style={styles.container}>
      {SOCIAL_BUTTON_LIST.map((btn) => (
        <TouchableOpacity
          key={btn.provider}
          style={[
            styles.button,
            { backgroundColor: btn.bg },
            btn.border
              ? { borderWidth: 1, borderColor: btn.border }
              : undefined,
            loadingProvider === btn.provider && styles.disabled,
          ]}
          onPress={() => onPress(btn.provider)}
          disabled={loadingProvider !== null}
          activeOpacity={0.75}
        >
          <View
            style={[styles.letterCircle, { backgroundColor: btn.letterBg }]}
          >
            <Text style={[styles.letter, { color: btn.letterColor }]}>
              {btn.letter}
            </Text>
          </View>
          <Text style={[styles.label, { color: btn.color }]}>
            {loadingProvider === btn.provider ? '연결 중...' : btn.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
  },
  disabled: { opacity: 0.6 },
  letterCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  letter: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: FONT_SIZE.md, fontWeight: '600' },
});
