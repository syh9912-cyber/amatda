/**
 * 약관·개인정보 동의 페이지 — 3가지 모드 처리.
 *
 *   ① reauth=1: 기존 사용자 재동의 (main gate가 새 필수 약관 누락 감지 시).
 *      → saveConsent API → /(main)/home
 *   ② signup=email: 이메일 가입 신규 사용자 (register.tsx 가 자격증명을 pendingSignup 에 저장 후 진입).
 *      → authApi.register(creds + consent) → setAuth → /onboarding/kakao-channel
 *   ③ default (소셜): 소셜 가입 신규 사용자 (useLoginHandlers).
 *      → saveConsent API → /onboarding/kakao-channel
 *
 * PIPA 15·22조, 정보통신망법 22·50조 준수.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { analytics } from '../../services/analytics';
import { pendingSignup } from '../../utils/pendingSignup';

const PRIVACY_VERSION = '2026-05-28';
const TERMS_URL = 'https://sylabs.kr/terms.html';
const PRIVACY_URL = 'https://sylabs.kr/privacy.html';
const COMMUNITY_URL = 'https://sylabs.kr/community.html';

export default function ConsentScreen() {
  // 진입 모드 판별:
  //   reauth=1 → 재동의 (saveConsent)
  //   signup=email → 이메일 신규 가입 (register API 호출)
  //   기본(소셜) → saveConsent
  const params = useLocalSearchParams<{ reauth?: string; signup?: string }>();
  const isReauth = params.reauth === '1';
  const isEmailSignup = params.signup === 'email';
  const setAuth = useAuthStore((s) => s.setAuth);
  const insets = useSafeAreaInsets();
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeCommunity, setAgreeCommunity] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [agreeMarketingData, setAgreeMarketingData] = useState(false);
  const [agreeNightAd, setAgreeNightAd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allAgreed = useMemo(
    () =>
      agreeTerms && agreePrivacy && agreeCommunity && agreeAge &&
      agreeMarketing && agreeMarketingData && agreeNightAd,
    [
      agreeTerms, agreePrivacy, agreeCommunity, agreeAge,
      agreeMarketing, agreeMarketingData, agreeNightAd,
    ],
  );
  const requiredAgreed = agreeTerms && agreePrivacy && agreeCommunity && agreeAge;

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeCommunity(next);
    setAgreeAge(next);
    setAgreeMarketing(next);
    setAgreeMarketingData(next);
    setAgreeNightAd(next);
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
    const consentPayload = {
      terms: agreeTerms,
      privacy: agreePrivacy,
      community: agreeCommunity,
      ageOver14: agreeAge,
      marketing: agreeMarketing,
      marketingDataUse: agreeMarketingData,
      nightAd: agreeNightAd,
      version: PRIVACY_VERSION,
    };
    try {
      if (isEmailSignup) {
        // 이메일 가입 모드: register API 호출 (자격증명 + 약관 동의 한 번에)
        const creds = pendingSignup.get();
        if (!creds) {
          Alert.alert('오류', '가입 정보가 만료되었습니다. 다시 시도해주세요.');
          router.replace('/(auth)/register');
          return;
        }
        const res = await authApi.register(creds.email, creds.password, creds.parentRole, consentPayload);
        const { user, accessToken, refreshToken } = res.data.data;
        await setAuth({ accessToken, refreshToken, userId: user.id, email: user.email });
        analytics.setUserId(user.id);
        analytics.logSignUp('email');
        pendingSignup.clear();
        // 신규 가입: priming → 카카오 채널 추가 화면 거쳐 홈. (별명/자녀 등록은 추후 메뉴에서)
        router.replace('/onboarding/notification-permission?next=kakao-channel');
        return;
      }
      // reauth / 소셜 신규: saveConsent
      await authApi.saveConsent(consentPayload);
      // 재동의(reauth)는 기존 사용자 → 홈 직행. 신규 소셜 가입은 채널 추가 화면 거침.
      // priming 화면은 primed 키가 자동으로 1회만 표시 관리.
      router.replace(
        isReauth
          ? '/onboarding/notification-permission?next=home'
          : '/onboarding/notification-permission?next=kakao-channel',
      );
    } catch {
      // 가입/저장 실패 시 자격증명 임시 보관도 비움 — stale 방지.
      if (isEmailSignup) pendingSignup.clear();
      Alert.alert('오류', '약관 동의 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.overlay}>
      {/* expo-router route 헤더 숨김 — "consent" 텍스트가 상단에 보이는 이슈 해결 */}
      <Stack.Screen options={{ headerShown: false, presentation: 'transparentModal' }} />
      <KeyboardAvoidingView
        style={styles.kavWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { paddingTop: insets.top + 16 }]}>
          <View style={styles.header}>
            <Image source={require('../../assets/preg-leaf.png')} style={styles.emojiImg} resizeMode="contain" />
            <Text style={styles.title}>약관 동의</Text>
            <Text style={styles.subtitle}>
              서비스 이용을 위해 약관에 동의해주세요
            </Text>
          </View>

          <ScrollView
            style={styles.scrollFlex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                checked={agreeCommunity}
                onToggle={() => setAgreeCommunity((v) => !v)}
                required
                label="커뮤니티 이용약관 동의"
                onLink={() => openLink(COMMUNITY_URL)}
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
              <ConsentItem
                checked={agreeMarketingData}
                onToggle={() => setAgreeMarketingData((v) => !v)}
                required={false}
                label="개인정보 마케팅 활용 동의"
              />
              <ConsentItem
                checked={agreeNightAd}
                onToggle={() => setAgreeNightAd((v) => !v)}
                required={false}
                label="야간(21:00~08:00) 광고성 정보 수신 동의"
              />
              <View style={styles.consentDivider} />
              <Text style={styles.ugcNote}>
                ⚠️ 커뮤니티(맘스톡·가족피드)는 욕설·혐오·음란·불법 등 부적절한 콘텐츠와 타인을 괴롭히는 행위에 대해 무관용 원칙을 적용합니다. 위반 시 사전 통지 없이 게시물이 삭제되고 이용이 제한될 수 있으며, 부적절한 콘텐츠 신고 및 사용자 차단 기능을 제공합니다.
              </Text>
              <View style={styles.consentDivider} />
              <Text style={styles.dormantNote}>
                ⓘ 1년 이상 미접속 시 사전 안내 후 계정과 사진이 자동 파기됩니다 (정보통신망법 시행령 16조). 다시 접속하면 자동 연장됩니다.
              </Text>
            </View>
          </ScrollView>

          {/* sticky bottom 버튼 + 안드로이드 네비게이션 바 영역 확보 */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
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
        </View>
      </KeyboardAvoidingView>
    </View>
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
  // 반투명 오버레이 + 풀스크린 카드 — 상단에서 위로 슬라이드 인 (Stack 전환)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  kavWrap: { flex: 1 },
  card: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 32, // 상단에 어두운 영역 살짝 노출 → 팝업 느낌
    overflow: 'hidden',
  },
  scrollFlex: { flex: 1 },
  scrollContent: { paddingHorizontal: 32, paddingBottom: 24 },
  header: { paddingTop: 8, alignItems: 'center', paddingHorizontal: 32 },
  emojiImg: { width: 40, height: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginTop: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  bottomBar: {
    paddingHorizontal: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0EF',
    backgroundColor: '#FAFAF8',
  },
  body: { paddingHorizontal: 32, marginTop: 40, flex: 1 },
  consentBox: {
    marginTop: 20,
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
  ugcNote: { fontSize: 11, color: '#8A6520', lineHeight: 16, paddingTop: 6, paddingHorizontal: 2, fontWeight: '600' },
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
