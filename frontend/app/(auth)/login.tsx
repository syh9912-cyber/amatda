import {
  View,
  Text,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AppNameDisplay } from '../../components/ui/AppNameDisplay';
import { AuthInput } from '../../components/ui/AuthInput';
import { AuthDivider } from '../../components/ui/AuthDivider';
import { SocialLoginButtons } from '../../components/ui/SocialLoginButtons';
import { useLoginHandlers } from '../../hooks/useLoginHandlers';

const BG = '#F2F2F7';
const { width: SW } = Dimensions.get('window');

export default function LoginScreen() {
  const h = useLoginHandlers();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.scroll}>
        {/* ── Full-width character image + gradient fade ── */}
        <View style={styles.imageSection}>
          {/* 투명 배경 아티팩트 방지: 이미지 뒤에 solid 배경 */}
          <View style={styles.imageBg} />
          <Image
            source={require('../../assets/child-diary.png')}
            style={styles.bgImage}
            resizeMode="cover"
            fadeDuration={0}
          />
          <LinearGradient
            colors={['transparent', `${BG}80`, BG]}
            locations={[0.2, 0.6, 0.95]}
            style={styles.gradientOverlay}
          />
        </View>

        {/* ── Brand (overlaps gradient area) ── */}
        <View style={styles.brandWrap}>
          <AppNameDisplay size="small" />
          <Text style={styles.tagline}>
            아이의 기질을 기록하는 특별한 다이어리
          </Text>
        </View>

        {/* ── Login Card ── */}
        <View style={styles.card}>
          <View style={styles.form}>
            <AuthInput
              icon={require('../../assets/icon-comment.png')}
              placeholder="이메일"
              value={h.email}
              onChangeText={h.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthInput
              icon={require('../../assets/icon-lock.png')}
              placeholder="비밀번호"
              value={h.password}
              onChangeText={h.setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, h.loading && styles.buttonLoading]}
            onPress={h.handleLogin}
            disabled={h.loading}
            activeOpacity={0.8}
          >
            {h.loading ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.buttonText}>로그인 중...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>로그인</Text>
            )}
          </TouchableOpacity>
          {h.loading && (
            <Text style={styles.loadingHint}>서버 연결 중이에요. 잠시만 기다려주세요…</Text>
          )}

          <View style={styles.dividerWrap}>
            <AuthDivider />
          </View>

          <SocialLoginButtons
            onPress={h.handleSocialLogin}
            loadingProvider={h.socialLoading}
          />

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.registerText}>
              {'계정이 없으신가요? '}
              <Text style={styles.registerBold}>회원가입</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.version}>{`v${require('../../app.json').expo.version}`}</Text>
          <Text style={styles.companyName}>SY Labs</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },

  /* ── Full-width image with gradient ── */
  imageSection: {
    width: SW,
    height: SW * 0.55,
    overflow: 'hidden',
  },
  imageBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF8F2',
  },
  bgImage: {
    width: SW,
    height: SW * 0.7,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SW * 0.4,
  },

  /* ── Brand ── */
  brandWrap: {
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 12,
    color: '#A0A0A0',
    marginTop: 4,
    fontWeight: '400',
    letterSpacing: -0.2,
  },

  /* ── Card — 은은한 그림자, 깨끗한 배경 ── */
  card: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  form: {
    gap: 10,
  },
  button: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLoading: {
    opacity: 0.85,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingHint: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dividerWrap: {
    marginTop: 14,
    marginBottom: 10,
  },
  registerLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  registerBold: {
    color: '#1C1C1E',
    fontWeight: '600',
  },

  /* ── Footer ── */
  footer: {
    alignItems: 'center',
    paddingBottom: 14,
    paddingTop: 10,
    marginTop: 'auto',
  },
  version: {
    fontSize: 11,
    color: '#C8C8C8',
  },
  companyName: {
    fontSize: 10,
    color: '#D0D0D0',
    marginTop: 4,
    letterSpacing: 1.5,
    fontWeight: '500',
  },
});
