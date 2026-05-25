import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { analytics } from '../../services/analytics';
import { AuthInput } from '../../components/ui/AuthInput';

// 약관 본문 hosting URL — 시행일 변경 시 백엔드 consent.version 과 함께 갱신
const PRIVACY_VERSION = '2026-05-09';
const TERMS_URL = 'https://amatda-parenting.firebaseapp.com/terms.html';
const PRIVACY_URL = 'https://amatda-parenting.firebaseapp.com/privacy.html';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [parentRole, setParentRole] = useState<string>('엄마');
  const [loading, setLoading] = useState(false);
  // 동의 상태 (PIPA 15·22조, 정보통신망법 22조)
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const { setAuth } = useAuthStore();

  const allAgreed = useMemo(
    () => agreeTerms && agreePrivacy && agreeAge && agreeMarketing,
    [agreeTerms, agreePrivacy, agreeAge, agreeMarketing],
  );
  const requiredAgreed = agreeTerms && agreePrivacy && agreeAge;

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeAge(next);
    setAgreeMarketing(next);
  };

  const openLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('오류', '브라우저를 열 수 없습니다');
    }
  };

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요');
      return;
    }
    // 이메일 형식 검증 (RFC 5322 단순화 — local@domain.tld)
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
      Alert.alert('알림', '올바른 이메일 형식이 아니에요. (예: name@example.com)');
      return;
    }
    if (password !== confirm) {
      Alert.alert('알림', '비밀번호가 일치하지 않습니다');
      return;
    }
    if (password.length < 6) {
      Alert.alert('알림', '비밀번호는 6자 이상이어야 합니다');
      return;
    }
    if (!requiredAgreed) {
      Alert.alert('알림', '필수 약관에 모두 동의해주세요');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(email, password, parentRole, {
        terms: agreeTerms,
        privacy: agreePrivacy,
        ageOver14: agreeAge,
        marketing: agreeMarketing,
        version: PRIVACY_VERSION,
      });
      const { user, accessToken, refreshToken } = res.data.data;
      await setAuth({ accessToken, refreshToken, userId: user.id, email: user.email });
      analytics.setUserId(user.id);
      analytics.logSignUp('email');
      // 가입 직후 별명 설정 화면을 거쳐 child-info로 이동 (set-nickname에서 child-info로 redirect)
      router.replace('/onboarding/set-nickname');
    } catch {
      Alert.alert('가입 실패', '이미 사용 중인 이메일이거나 서버 오류입니다');
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
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/preg-leaf.png')} style={styles.emojiImg} resizeMode="contain" />
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>
            아맞다에 오신 것을 환영합니다
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.form}>
            <AuthInput
              icon={require('../../assets/icon-comment.png')}
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthInput
              icon={require('../../assets/icon-lock.png')}
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <AuthInput
              icon={require('../../assets/icon-lock.png')}
              placeholder="비밀번호 확인"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />
          </View>

          <Text style={styles.roleLabel}>누구로 가입하시나요?</Text>
          <View style={styles.roleWrap}>
            {['엄마', '아빠', '할머니', '할아버지', '고모/이모', '삼촌', '기타'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleBtn, parentRole === role && styles.roleBtnActive]}
                onPress={() => setParentRole(role)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: parentRole === role }}
                accessibilityLabel={`역할 ${role}`}
              >
                <Text style={[styles.roleBtnText, parentRole === role && styles.roleBtnTextActive]}>
                  {role}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 약관 동의 (PIPA 15·22조, 정보통신망법 22조) */}
          <View style={styles.consentBox}>
            <TouchableOpacity
              style={styles.consentRow}
              onPress={toggleAll}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allAgreed }}
              accessibilityLabel="전체 동의"
            >
              <View style={[styles.checkbox, allAgreed && styles.checkboxOn]}>
                {allAgreed && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={[styles.consentText, styles.consentAll]}>전체 동의</Text>
            </TouchableOpacity>
            <View style={styles.consentDivider} />

            <ConsentItem
              checked={agreeTerms}
              onToggle={() => setAgreeTerms((v) => !v)}
              required
              label="이용약관 동의"
              onLink={() => openLink(TERMS_URL)}
            />
            <ConsentItem
              checked={agreePrivacy}
              onToggle={() => setAgreePrivacy((v) => !v)}
              required
              label="개인정보 수집 및 이용 동의"
              onLink={() => openLink(PRIVACY_URL)}
            />
            <ConsentItem
              checked={agreeAge}
              onToggle={() => setAgreeAge((v) => !v)}
              required
              label="만 14세 이상입니다"
            />
            <ConsentItem
              checked={agreeMarketing}
              onToggle={() => setAgreeMarketing((v) => !v)}
              required={false}
              label="마케팅 정보 수신 동의"
            />
            <View style={styles.consentDivider} />
            <Text style={styles.dormantNote}>
              ⓘ 1년 이상 미접속 시 사전 안내 후 계정과 사진이 자동 파기됩니다 (정보통신망법 시행령 16조). 다시 접속하면 자동 연장됩니다.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (loading || !requiredAgreed) && styles.buttonDisabled,
            ]}
            onPress={handleRegister}
            disabled={loading || !requiredAgreed}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={loading ? '가입 중' : '가입하기'}
            accessibilityState={{ disabled: loading || !requiredAgreed, busy: loading }}
          >
            <Text style={styles.buttonText}>
              {loading ? '가입 중...' : '가입하기'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.back()}
            accessibilityRole="link"
            accessibilityLabel="이미 계정이 있으신가요? 로그인"
          >
            <Text style={styles.loginText}>
              {'이미 계정이 있으신가요? '}
              <Text style={styles.loginBold}>로그인</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ConsentItem({
  checked, onToggle, required, label, onLink,
}: {
  checked: boolean;
  onToggle: () => void;
  required: boolean;
  label: string;
  onLink?: () => void;
}) {
  return (
    <View style={styles.consentRow}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={styles.checkboxTouch}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${required ? '필수' : '선택'} ${label}`}
      >
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked && <Text style={styles.checkMark}>✓</Text>}
        </View>
      </TouchableOpacity>
      <Text style={styles.consentText}>
        <Text style={required ? styles.consentRequired : styles.consentOptional}>
          {required ? '(필수) ' : '(선택) '}
        </Text>
        {label}
      </Text>
      {onLink && (
        <TouchableOpacity
          onPress={onLink}
          activeOpacity={0.7}
          style={styles.consentLinkBtn}
          accessibilityRole="link"
          accessibilityLabel={`${label} 전문 보기`}
        >
          <Text style={styles.consentLink}>보기</Text>
        </TouchableOpacity>
      )}
    </View>
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
    paddingTop: 100,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  emojiImg: { width: 40, height: 40 },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    fontWeight: '400',
  },
  body: {
    paddingHorizontal: 32,
    marginTop: 40,
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
  loginLink: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  loginBold: {
    color: '#4338CA',
    fontWeight: '600',
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'center',
  },
  roleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  roleBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    minWidth: '28%',
  },
  roleBtnActive: {
    borderColor: '#FF8C5A',
    backgroundColor: '#FFF5F0',
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  roleBtnTextActive: {
    color: '#FF8C5A',
  },
  consentBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  consentDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
  checkboxTouch: {
    paddingRight: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxOn: {
    backgroundColor: '#FF8C5A',
    borderColor: '#FF8C5A',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  consentAll: {
    fontWeight: '700',
    fontSize: 14,
    color: '#1A1A1A',
  },
  consentRequired: {
    color: '#FF8C5A',
    fontWeight: '600',
  },
  consentOptional: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  consentLinkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  consentLink: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dormantNote: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 16,
    paddingTop: 6,
    paddingHorizontal: 2,
  },
});
