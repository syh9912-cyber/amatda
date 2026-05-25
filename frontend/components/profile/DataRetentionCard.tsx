/**
 * 내 데이터 보관 기한 카드 — 휴면 정책(C안) UI.
 *
 * 두 가지 상태:
 *   1. 활성 — 마지막 접속일 + "1년 미접속 시 안내 발송" 안내
 *   2. 휴면 경고 — scheduledDeleteAt 표시 + "앱 켜면 연장" 안내 (강조 톤)
 *
 * 데이터 출처: GET /api/auth/me 응답 (lastActiveAt, dormantWarnedAt, scheduledDeleteAt).
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Alert } from 'react-native';
import { authApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

// PIPA 35조 / GDPR 20조 — 사용자 데이터 다운로드 요청 안내
const DATA_REQUEST_EMAIL = 'privacy@sylabs.kr';
function openDataRequestEmail() {
  const subject = encodeURIComponent('[아맞다] 내 데이터 다운로드 요청');
  const body = encodeURIComponent(
    '안녕하세요, 아맞다 회원입니다.\n\n' +
    '아래 정보 기준으로 제 개인정보 사본을 받고 싶어요.\n\n' +
    '- 가입 이메일: \n' +
    '- 가입 방법(카카오/네이버/구글/이메일): \n' +
    '- 자녀 이름(보유한 경우): \n\n' +
    '※ 본인 확인 후 영업일 기준 7일 이내에 회신해주세요.'
  );
  const url = `mailto:${DATA_REQUEST_EMAIL}?subject=${subject}&body=${body}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('이메일 앱이 없어요', `${DATA_REQUEST_EMAIL} 으로 직접 문의해주세요.`);
  });
}

interface MeRetention {
  lastActiveAt: string | null;
  dormantWarnedAt: string | null;
  scheduledDeleteAt: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DORMANT_THRESHOLD_DAYS = 365;

function formatDateKorean(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

/** 다음 자동 파기 안내 발송 예정일(=lastActiveAt + 365일). */
function calcNextWarningDate(lastActiveAtIso: string | null): string | null {
  if (!lastActiveAtIso) return null;
  const t = new Date(lastActiveAtIso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + DORMANT_THRESHOLD_DAYS * DAY_MS).toISOString();
}

export function DataRetentionCard() {
  const [retention, setRetention] = useState<MeRetention | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await authApi.getProfile();
        const data = (res.data as { data?: Record<string, unknown> })?.data
          ?? (res.data as Record<string, unknown>);
        if (!alive) return;
        setRetention({
          lastActiveAt: (data?.lastActiveAt as string | null) ?? null,
          dormantWarnedAt: (data?.dormantWarnedAt as string | null) ?? null,
          scheduledDeleteAt: (data?.scheduledDeleteAt as string | null) ?? null,
        });
      } catch {
        // 네트워크 오류 — 카드는 fallback 안내로만 표시
        if (alive) {
          setRetention({ lastActiveAt: null, dormantWarnedAt: null, scheduledDeleteAt: null });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  // 휴면 경고 상태
  if (retention?.dormantWarnedAt && retention?.scheduledDeleteAt) {
    return (
      <View style={[styles.card, styles.cardWarning]}>
        <Text style={styles.titleWarning}>⚠️ 휴면 계정 처리 예정</Text>
        <Text style={styles.dateBig}>{formatDateKorean(retention.scheduledDeleteAt)}</Text>
        <Text style={styles.body}>
          1년 이상 접속이 없어 위 날짜에 계정과 등록한 사진·기록이 모두 자동 파기될 예정입니다.
        </Text>
        <Text style={styles.bodyHighlight}>
          앱을 계속 이용하시면 자동으로 연장돼요. 별도 조작 필요 없음.
        </Text>
      </View>
    );
  }

  // 활성 상태
  const nextWarn = calcNextWarningDate(retention?.lastActiveAt ?? null);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>내 데이터 보관 기한</Text>
      <View style={styles.row}>
        <Text style={styles.label}>마지막 접속</Text>
        <Text style={styles.value}>{formatDateKorean(retention?.lastActiveAt ?? null)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>다음 자동 안내</Text>
        <Text style={styles.value}>{formatDateKorean(nextWarn)}</Text>
      </View>
      <Text style={styles.note}>
        1년 동안 접속이 없으면 푸시로 사전 안내드리고, 안내 후 30일 안에 다시 접속하지 않으면 계정과 사진이 자동 파기됩니다. (정보통신망법 시행령 16조)
      </Text>
      <TouchableOpacity style={styles.downloadBtn} onPress={openDataRequestEmail} activeOpacity={0.7}>
        <Text style={styles.downloadBtnText}>📥 내 데이터 사본 받기 (이메일 요청)</Text>
      </TouchableOpacity>
      <Text style={styles.downloadHint}>개인정보보호법 35조에 따라 본인 데이터 사본을 요청할 수 있어요. 영업일 기준 7일 이내 회신.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  cardWarning: {
    backgroundColor: '#FFF7F0',
    borderColor: '#FFB48A',
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: SPACING.sm,
  },
  titleWarning: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#D54A1F',
    marginBottom: SPACING.xs,
  },
  dateBig: {
    fontSize: 22,
    fontWeight: '700',
    color: '#D54A1F',
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: FONT_SIZE.sm,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  note: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.sm,
    lineHeight: 16,
  },
  downloadBtn: {
    marginTop: SPACING.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
    backgroundColor: '#F0F4FF',
    borderWidth: 1,
    borderColor: '#DCE3F3',
    alignItems: 'center',
  },
  downloadBtnText: {
    fontSize: FONT_SIZE.sm,
    color: '#3F51B5',
    fontWeight: '600',
  },
  downloadHint: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 6,
    lineHeight: 15,
  },
  body: {
    fontSize: FONT_SIZE.sm,
    color: '#5C2810',
    lineHeight: 19,
    marginBottom: SPACING.xs,
  },
  bodyHighlight: {
    fontSize: FONT_SIZE.sm,
    color: '#D54A1F',
    fontWeight: '600',
    lineHeight: 19,
  },
});
