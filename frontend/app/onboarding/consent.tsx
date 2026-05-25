/**
 * 약관·개인정보 동의 페이지 (소셜 가입 신규 사용자 전용).
 *
 * PIPA 15·22조, 정보통신망법 22조 — 소셜 첫 가입 후 닉네임 설정 전에 반드시 동의 필요.
 * register.tsx (이메일 가입) 와 동일한 동의 항목·정책 버전 사용.
 */
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

const PRIVACY_VERSION = '2026-05-25';
const TERMS_URL = 'https://amatda-parenting.firebaseapp.com/terms.html';
const PRIVACY_URL = 'https://amatda-parenting.firebaseapp.com/privacy.html';

export default function ConsentScreen() {
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    if (!requiredAgreed) {
      Alert.alert('알림', '필수 약관에 모두 동의해주세요');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.saveConsent({
        terms: agreeTerms,
        privacy: agreePrivacy,
        ageOver14: agreeAge,
        marketing: agreeMarketing,
        version: PRIVACY_VERSION,
      });
      router.replace('/onboarding/set-nickname');
    } catch {
      Alert.alert('오류', '약관 동의 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/preg-leaf.png')} style={styles.emojiImg} resizeMode="contain" />
          <Text style={styles.title}>약관 동의</Text>
          <Text style={styles.subtitle}>
            서비스 이용을 위해 약관에 동의해주세요
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.consentBox}>
            <TouchableOpacity
              style={styles.consentRow}
              onPress={toggleAll}
              activeOpacity={0.7}
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
              (submitting || !requiredAgreed) && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || !requiredAgreed}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {submitting ? '저장 중...' : '동의하고 시작'}
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
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.checkboxTouch}>
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
        <TouchableOpacity onPress={onLink} activeOpacity={0.7} style={styles.consentLinkBtn}>
          <Text style={styles.consentLink}>보기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  scroll: { flexGrow: 1 },
  header: { paddingTop: 100, alignItems: 'center' },
  emojiImg: { width: 40, height: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginTop: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  body: { paddingHorizontal: 32, marginTop: 40, flex: 1 },
  consentBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  consentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  consentDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
  checkboxTouch: { paddingRight: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: '#D1D5DB', backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkboxOn: { backgroundColor: '#FF8C5A', borderColor: '#FF8C5A' },
  checkMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 14 },
  consentText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  consentAll: { fontWeight: '700', fontSize: 14, color: '#1A1A1A' },
  consentRequired: { color: '#FF8C5A', fontWeight: '600' },
  consentOptional: { color: '#9CA3AF', fontWeight: '600' },
  consentLinkBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  consentLink: { fontSize: 12, color: '#6366F1', fontWeight: '600', textDecorationLine: 'underline' },
  dormantNote: { fontSize: 11, color: '#9CA3AF', lineHeight: 16, paddingTop: 6, paddingHorizontal: 2 },
  button: {
    backgroundColor: '#4338CA',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
});
