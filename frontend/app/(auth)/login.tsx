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
import { AuthInput } from '../../components/ui/AuthInput';
import { AuthDivider } from '../../components/ui/AuthDivider';
import { SocialLoginButtons } from '../../components/ui/SocialLoginButtons';
import { useLoginHandlers } from '../../hooks/useLoginHandlers';

const BG_TOP = '#FFF5EC';    // 따뜻한 피치 크림 (상단)
const BG_BOTTOM = '#F8FAFD'; // 차분한 화이트 (하단)
const { width: SW } = Dimensions.get('window');

export default function LoginScreen() {
  const h = useLoginHandlers();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* 전체 화면 부드러운 그라디언트 배경 */}
      <LinearGradient
        colors={[BG_TOP, BG_BOTTOM]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.scroll}>
        {/* ── 투명 배경 캐릭터 일러스트 (텍스트 없이 크게) ── */}
        <View style={styles.heroWrap}>
          <Image
            source={require('../../assets/login-hero.png')}
            style={styles.heroImage}
            resizeMode="contain"
            fadeDuration={0}
          />
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
    backgroundColor: BG_TOP,
  },
  scroll: {
    flex: 1,
  },

  /* ── 캐릭터 hero (적당한 여백 + 화면 전체 짤림 X, contain 모드) ── */
  heroWrap: {
    width: SW,
    // 약간의 여백 두고 적당히 크게 (이미지 비율 1.05)
    height: SW * 0.78,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60, // 로그인 화면 아래로 내림 (status bar 아래 여유)
    marginBottom: 16,
  },
  heroImage: {
    width: SW * 0.8,
    height: SW * 0.78,
  },

  /* ── Card — 은은한 그림자, 깨끗한 배경 ── */
  card: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#88A0B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  form: {
    gap: 8,
  },
  button: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  dividerWrap: {
    marginTop: 12,
    marginBottom: 8,
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
