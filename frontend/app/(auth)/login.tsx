import {
  View,
  Text,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { AppNameDisplay } from '../../components/ui/AppNameDisplay';
import { AuthInput } from '../../components/ui/AuthInput';
import { AuthDivider } from '../../components/ui/AuthDivider';
import { SocialLoginButtons } from '../../components/ui/SocialLoginButtons';
import { useLoginHandlers } from './useLoginHandlers';

export default function LoginScreen() {
  const h = useLoginHandlers();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/child-diary.png')}
            style={{ width: 150, height: 150 }}
            resizeMode="contain"
          />
          <View style={styles.nameWrap}>
            <AppNameDisplay size="small" />
          </View>
          <Text style={styles.tagline}>
            {'\uC544\uC774\uC758 \uAE30\uC9C8\uC744 \uAE30\uB85D\uD558\uB294 \uD2B9\uBCC4\uD55C \uB2E4\uC774\uC5B4\uB9AC'}
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.form}>
            <AuthInput
              icon={'\u{1F4E7}'}
              placeholder={'\uC774\uBA54\uC77C'}
              value={h.email}
              onChangeText={h.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthInput
              icon={'\u{1F512}'}
              placeholder={'\uBE44\uBC00\uBC88\uD638'}
              value={h.password}
              onChangeText={h.setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, h.loading && styles.buttonDisabled]}
            onPress={h.handleLogin}
            disabled={h.loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {h.loading
                ? '\uB85C\uADF8\uC778 \uC911...'
                : '\uB85C\uADF8\uC778'}
            </Text>
          </TouchableOpacity>

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
              {'\uACC4\uC815\uC774 \uC5C6\uC73C\uC2E0\uAC00\uC694? '}
              <Text style={styles.registerBold}>
                {'\uD68C\uC6D0\uAC00\uC785'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>v1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 72,
    alignItems: 'center',
  },
  nameWrap: {
    marginTop: 12,
  },
  tagline: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
    fontWeight: '400',
  },
  body: {
    paddingHorizontal: 32,
    marginTop: 32,
    flex: 1,
  },
  form: {
    gap: 12,
  },
  button: {
    backgroundColor: '#4338CA',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dividerWrap: {
    marginTop: 28,
    marginBottom: 16,
  },
  registerLink: {
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  registerBold: {
    color: '#4338CA',
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: '#C0C0C0',
    paddingBottom: 24,
  },
});
