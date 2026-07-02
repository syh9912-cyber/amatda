import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SocialProvider } from '../../services/social-auth';
import { FONT_SIZE, SPACING } from '../../constants/theme';
import { getSocialButtonList } from './socialButtonConfig';

// Apple 네이티브 모듈이 현재 빌드에 포함됐는지 확인 (동적 require + fallback).
// OTA 안전장치: 모듈이 없는 기존 빌드에선 require 가 throw → Apple 버튼 숨김.
// 모듈이 포함된 새 빌드에서만 버튼이 자동 노출되어 "눌러도 에러" 상황을 방지.
function isAppleAuthAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-apple-authentication');
    return true;
  } catch {
    return false;
  }
}

interface SocialLoginButtonsProps {
  onPress: (provider: SocialProvider) => void;
  loadingProvider: SocialProvider | null;
}

export function SocialLoginButtons({
  onPress,
  loadingProvider,
}: SocialLoginButtonsProps) {
  const { t, i18n } = useTranslation();
  const isKo = i18n.language === 'ko';

  // Apple 로그인은 iOS + 네이티브 모듈 존재 시에만 노출 (Android/web/구빌드 제외)
  // 카카오·네이버(koreaOnly)는 한국어 로케일에서만 노출
  const visibleSocialButtons = getSocialButtonList(t).filter(
    (b) => (!b.iosOnly || isAppleAuthAvailable()) && (!b.koreaOnly || isKo),
  );

  return (
    <View style={styles.container}>
      {visibleSocialButtons.map((btn) => (
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
          accessibilityRole="button"
          accessibilityLabel={t('components.socialLoginButtons.loginWithProvider', { provider: btn.label })}
          accessibilityState={{ disabled: loadingProvider !== null, busy: loadingProvider === btn.provider }}
        >
          <View
            style={[styles.letterCircle, { backgroundColor: btn.letterBg }]}
          >
            <Text style={[styles.letter, { color: btn.letterColor }]}>
              {btn.letter}
            </Text>
          </View>
          <Text style={[styles.label, { color: btn.color }]}>
            {loadingProvider === btn.provider ? t('components.socialLoginButtons.connecting') : btn.label}
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
