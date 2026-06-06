/**
 * 카카오톡 채널 추가 유도 화면 (회원가입 직후).
 *
 * 카카오 채널 추가 → 환영 메시지 자동 발송 + 이후 운영 푸시 채널 확보.
 * SDK 통합 대신 웹 URL 방식(Linking) — 카카오톡 앱 설치 시 앱 열림, 미설치 시 브라우저.
 * 출시 일정상 네이티브 모듈 추가 회피.
 *
 * 진입: register.tsx / consent.tsx 신규 가입 성공 직후
 * 종료: 추가/나중에 양쪽 모두 → /onboarding/set-nickname
 */
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Platform, Linking,
} from 'react-native';
import { router } from 'expo-router';

// 카카오톡 채널 URL — 비즈니스 채널 "아맞다" (검색용 ID: _xnxjFxjX).
//   채널 추가 페이지: /friend, 채팅: /chat
//   https → 카카오톡 앱 설치 시 앱 열림, 미설치 시 브라우저.
const CHANNEL_URLS = [
  'https://pf.kakao.com/_xnxjFxjX/friend',
];

export default function KakaoChannelScreen() {
  const [submitting, setSubmitting] = useState(false);

  const goNext = () => {
    router.replace('/onboarding/set-nickname');
  };

  const handleAdd = async () => {
    setSubmitting(true);
    try {
      // 신형 URL 시도 → 못 열면 구형으로 폴백
      let opened = false;
      for (const url of CHANNEL_URLS) {
        try {
          const can = await Linking.canOpenURL(url);
          if (can) {
            await Linking.openURL(url);
            opened = true;
            break;
          }
        } catch {
          // 다음 URL 시도
        }
      }
      // 둘 다 실패하면 마지막 URL 강제 호출 (canOpenURL false 라도 일부 환경에서 동작)
      if (!opened) {
        try { await Linking.openURL(CHANNEL_URLS[0]); } catch { /* noop */ }
      }
    } finally {
      setSubmitting(false);
      // 카카오톡으로 전환됐어도 앱 복귀 시 다음 단계 진행되도록 즉시 라우팅
      goNext();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/mascot-waving.png')}
            style={styles.heroImg}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>아맞다 카톡 채널 추가</Text>
        <Text style={styles.subtitle}>
          채널 친구가 되면{'\n'}새벽에도 도움받을 수 있어요
        </Text>

        <View style={styles.benefitList}>
          <Benefit emoji="🆘" title="새벽 응급 핫라인" desc="119 안내 + 즉시 코칭" />
          <Benefit emoji="🎁" title="출시 기념 쿠폰" desc="채널 친구만 받는 혜택" />
          <Benefit emoji="📰" title="신기능 가장 먼저" desc="베타 기능 사전 체험" />
          <Benefit emoji="💬" title="1:1 운영팀 채널" desc="문의 카톡으로 바로" />
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            ⓘ 카카오톡 친구 추가 후 자동 환영 메시지를 받게 돼요. 언제든 채널을 차단할 수 있어요.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addBtn, submitting && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={submitting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="카카오 채널 추가"
        >
          <Text style={styles.addBtnText}>
            {submitting ? '카카오톡 여는 중...' : '카카오 채널 추가'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={goNext}
          disabled={submitting}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="나중에"
        >
          <Text style={styles.skipText}>나중에</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Benefit({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={styles.benefitRow}>
      <Text style={styles.benefitEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  scroll: { paddingHorizontal: 28, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 16 },
  heroImg: { width: 96, height: 96 },
  title: {
    fontSize: 26, fontWeight: '700', color: '#1A1A1A',
    textAlign: 'center', marginTop: 8, letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14, color: '#6B7280',
    textAlign: 'center', marginTop: 10, lineHeight: 22,
  },
  benefitList: {
    marginTop: 28, padding: 18,
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  benefitEmoji: { fontSize: 24, marginRight: 14 },
  benefitTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  benefitDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  note: {
    marginTop: 16, padding: 12,
    backgroundColor: '#FFF7E6', borderRadius: 10,
  },
  noteText: { fontSize: 12, color: '#8A6520', lineHeight: 18 },
  // 카카오톡 브랜드 컬러 (#FEE500 / 검정 글씨)
  addBtn: {
    marginTop: 24, height: 56, borderRadius: 14,
    backgroundColor: '#FEE500',
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: { color: '#191919', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  skipBtn: { marginTop: 12, height: 44, justifyContent: 'center', alignItems: 'center' },
  skipText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
});
