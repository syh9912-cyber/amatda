/**
 * 알림 권한 사전 설득(priming) 화면.
 *
 * Apple HIG / Material Guidelines: 첫 권한 요청 전 가치 설명 화면을 보여주면
 * 허용률이 2~3배 상승. OS "거부" 누르면 영구 차단되므로 사용자가 가치를 이해한
 * 상태에서 결정하도록 유도.
 *
 * 진입 조건 ((main)/_layout 게이트):
 *   - 인증 + 약관 게이트 통과 후
 *   - Notifications.getPermissionsAsync() === 'undetermined'
 *   - AsyncStorage 'notif_primed' === null (이번 설치에서 아직 안 봄)
 *
 * 결과:
 *   - 허용: OS 다이얼로그 → granted 시 푸시 토큰 등록 → 홈
 *   - 나중에: 토큰 등록 스킵 → 홈
 *   양쪽 모두 'notif_primed' = '1' 저장 → 다음 진입에서 재표시 안 함.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// v4: 가입 흐름 간소화 (consent → priming → home) + primed key bump 으로 강제 재노출.
const PRIMED_KEY = 'notif_primed_v4';

export default function NotificationPermissionScreen() {
  const params = useLocalSearchParams<{ next?: string }>();
  const next = params.next; // 'kakao-channel' | 'home' | undefined
  const [submitting, setSubmitting] = useState(false);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(PRIMED_KEY, '1');
    } catch {
      // AsyncStorage 실패해도 라우팅은 진행 — 다음 진입에서 다시 표시될 뿐.
    }
    // next 파라미터에 따라 다음 화면 분기. 미지정 시 홈 (gate 진입 흐름).
    if (next === 'kakao-channel') {
      router.replace('/onboarding/kakao-channel');
    } else {
      router.replace('/(main)/home');
    }
  };

  const handleAllow = async () => {
    setSubmitting(true);
    try {
      if (Device.isDevice) {
        // status 가 'undetermined' 일 때만 OS 다이얼로그 호출. granted/denied 면 의미 없음.
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'undetermined') {
          await Notifications.requestPermissionsAsync();
        }
        // 토큰 발급·백엔드 저장은 app/_layout.tsx 의
        //   registerForPushNotifications() 가 상태 'granted' 감지 후 자동 처리.
      }
    } finally {
      setSubmitting(false);
      await finish();
    }
  };

  const handleLater = async () => {
    await finish();
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

        <Text style={styles.title}>알림으로 코칭 받기</Text>
        <Text style={styles.subtitle}>
          아이 발달 단계별 팁과 일일 리마인더를{'\n'}제때 받아보세요
        </Text>

        <View style={styles.benefitList}>
          <Benefit emoji="🌙" title="모닝 팔로업" desc="간밤 수면·수유 한 줄 요약" />
          <Benefit emoji="🍼" title="발달 단계 알림" desc="월령별 꼭 챙길 포인트" />
          <Benefit emoji="🏥" title="병원·접종 리마인더" desc="놓치기 쉬운 일정 미리 안내" />
          <Benefit emoji="💛" title="AI 응답 도착" desc="상담 답변 즉시 알림" />
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            ⓘ 광고/마케팅 알림은 별도 동의 시에만 발송되며, 모든 알림은 [더보기 &gt; 알림 설정]에서 끌 수 있어요.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.allowBtn, submitting && styles.allowBtnDisabled]}
          onPress={handleAllow}
          disabled={submitting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="알림 허용"
        >
          <Text style={styles.allowBtnText}>
            {submitting ? '요청 중...' : '알림 허용'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.laterBtn}
          onPress={handleLater}
          disabled={submitting}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="나중에"
        >
          <Text style={styles.laterText}>나중에</Text>
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
    backgroundColor: '#FFF7ED', borderRadius: 10,
  },
  noteText: { fontSize: 12, color: '#9A6635', lineHeight: 18 },
  allowBtn: {
    marginTop: 24, height: 56, borderRadius: 14,
    backgroundColor: '#FF8C5A',
    justifyContent: 'center', alignItems: 'center',
  },
  allowBtnDisabled: { opacity: 0.6 },
  allowBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  laterBtn: { marginTop: 12, height: 44, justifyContent: 'center', alignItems: 'center' },
  laterText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
});
