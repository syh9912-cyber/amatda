import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useChildStore } from '../../stores/childStore';
import { memoriesApi, retentionApi } from '../../services/api';
import { LEVELS } from './parent-level';
import { captureRef } from 'react-native-view-shot';

/* eslint-disable @typescript-eslint/no-require-imports */
const IC_BOY = require('../../assets/avatar-boy.png') as number;
const IC_GIRL = require('../../assets/avatar-girl.png') as number;
/* eslint-enable @typescript-eslint/no-require-imports */

/* ── Types ── */

interface GrowthData { height: number | null; weight: number | null; birthDate: string; months: number }
interface TemperamentDetail { dominantType: string; dominantLabel: string | null; subType: string | null; energyRatios: Record<string, number> | null }
interface ChildCardData {
  name: string; ageLabel: string; temperament: string; temperamentEmoji: string;
  photoUrl: string | null; traits: string[]; favoriteActivities: string[];
  shareCode: string; growth: GrowthData | null; temperamentDetail: TemperamentDetail | null;
}

/* ── Screen ── */

export default function ChildCardScreen() {
  const child = useChildStore((s) => s.selectedChild);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<ChildCardData | null>(null);
  const [error, setError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [parentLevel, setParentLevel] = useState(1);
  const passportRef = useRef<View>(null);

  useEffect(() => {
    if (!child) return;
    retentionApi.streak(child.id).then((res) => {
      const d = res.data?.data as { level?: number } | undefined;
      if (d?.level) setParentLevel(d.level);
    }).catch(() => {});
  }, [child?.id]);

  const skin = LEVELS.find((l) => l.level === parentLevel) ?? LEVELS[0];
  const SKIN_PRIMARY = skin.passportColors[0];
  const SKIN_ACCENT = parentLevel >= 4 ? '#D4AF37' : parentLevel >= 3 ? '#F8BBD0' : parentLevel >= 2 ? '#81C784' : '#D4AF37';

  const fetchCard = () => {
    if (!child) return;
    setLoading(true); setError(false);
    memoriesApi.childCard(child.id)
      .then((res) => {
        const r = res.data?.data as Record<string, unknown> | undefined;
        if (!r) return;
        const g = r.growth as Record<string, unknown> | undefined;
        const t = r.temperamentDetail as Record<string, unknown> | undefined;
        setCard({
          name: String(r.childName ?? r.name ?? ''),
          ageLabel: String(r.ageInfo ?? r.ageLabel ?? ''),
          temperament: String(r.temperament ?? ''),
          temperamentEmoji: String(r.temperamentEmoji ?? ''),
          photoUrl: (r.photo as string | null) ?? (r.photoUrl as string | null) ?? null,
          traits: Array.isArray(r.personality) ? r.personality as string[] : Array.isArray(r.traits) ? r.traits as string[] : [],
          favoriteActivities: Array.isArray(r.favorites) ? r.favorites as string[] : Array.isArray(r.favoriteActivities) ? r.favoriteActivities as string[] : [],
          shareCode: String(r.shareCode ?? ''),
          growth: g ? { height: (g.height as number | null) ?? null, weight: (g.weight as number | null) ?? null, birthDate: String(g.birthDate ?? ''), months: (g.months as number) ?? 0 } : null,
          temperamentDetail: t ? { dominantType: String(t.dominantType ?? ''), dominantLabel: (t.dominantLabel as string | null) ?? null, subType: (t.subType as string | null) ?? null, energyRatios: (t.energyRatios as Record<string, number> | null) ?? null } : null,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCard(); }, [child?.id]);

  const handleShare = async () => {
    if (!child || !card || !passportRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(passportRef, { format: 'png', quality: 1 });
      const S = require('expo-sharing') as { isAvailableAsync: () => Promise<boolean>; shareAsync: (u: string, o?: Record<string, unknown>) => Promise<void> };
      if (!(await S.isAvailableAsync())) throw new Error('no');
      await S.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '여권 공유' });
    } catch { Alert.alert('공유 불가', 'APK 설치 후 이용해주세요.'); }
    finally { setSharing(false); }
  };

  /* ── Date utils ── */
  const fmtDate = (d: string) => d ? new Date(d).toISOString().slice(0, 10).replace(/-/g, '. ') : '';
  const birthFmt = child?.birthDate ? fmtDate(child.birthDate) : '';
  const issueFmt = new Date().toISOString().slice(0, 10).replace(/-/g, '. ');

  /* ── D+day ── */
  const birthMs = child?.birthDate ? new Date(child.birthDate).getTime() : 0;
  const dDays = birthMs ? Math.floor((Date.now() - birthMs) / (1000 * 60 * 60 * 24)) : 0;

  /* ── Expiry (18 years from birth) ── */
  const expiryDate = child?.birthDate ? new Date(child.birthDate) : new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 18);
  const expiryFmt = expiryDate.toISOString().slice(0, 10).replace(/-/g, '. ');

  /* ── MRZ ── */
  const mrzLine1 = `P<CHD<${card?.name ?? ''}`.padEnd(44, '<');
  const mrzLine2 = `${(card?.shareCode || 'AMATDA001').toUpperCase()}<1CHD${birthFmt.replace(/\.\s*/g, '')}${child?.gender === 'F' ? 'F' : 'M'}FOREVER`.padEnd(44, '<');

  if (!child) return null;

  /* ── Temperament description ── */
  const temperamentDesc = card?.temperament
    ? `${card.temperament} ${card.temperamentEmoji}`
    : '';

  return (
    <ScrollView style={s.bg} contentContainerStyle={s.scroll}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Nav header ── */}
      <View style={s.navRow}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(main)/home')}>
          <Text style={s.navBack}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>PASSPORT</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={s.loadTxt}>{'여권을 발급하고 있어요...'}</Text>
        </View>
      ) : error || !card ? (
        <View style={s.center}>
          <Image source={child.gender === 'F' ? IC_GIRL : IC_BOY} style={{ width: 56, height: 56, borderRadius: 28 }} />
          <Text style={s.loadTxt}>{'여권을 발급할 수 없습니다'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchCard}>
            <Text style={s.retryTxt}>{'다시 시도'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ═══ Passport Card — 2-Page Fold ═══ */}
          {/* Level badge */}
          <View style={s.levelBadgeRow}>
            <Text style={s.levelBadgeIcon}>{skin.icon}</Text>
            <Text style={s.levelBadgeText}>{skin.name}</Text>
          </View>

          <View ref={passportRef} collapsable={false} style={[s.card, { borderColor: SKIN_PRIMARY }]}>
            <View style={s.foldContainer}>

              {/* ════════ PAGE 1 (Left) ════════ */}
              <View style={s.page}>
                {/* Dark header — skin-colored */}
                <LinearGradient
                  colors={skin.passportColors.length >= 2 ? skin.passportColors as [string, string, ...string[]] : [skin.passportColors[0], skin.passportColors[0]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.header}
                >
                  <Text style={[s.headerKr, { color: SKIN_ACCENT }]}>{'어 린 이  공 화 국'}</Text>
                  <Text style={[s.headerSub, { color: SKIN_ACCENT }]}>REPUBLIC OF CHILDHOOD</Text>
                  <Text style={[s.headerTitle, { color: SKIN_ACCENT }]}>PASSPORT</Text>
                </LinearGradient>

                <View style={s.pageBody}>
                  {/* Type / Country / No. */}
                  <View style={s.compactRow}>
                    <View style={s.compactField}>
                      <Text style={s.fl}>{'종류/Type'}</Text>
                      <Text style={s.fvBold}>P</Text>
                    </View>
                    <View style={s.compactField}>
                      <Text style={s.fl}>{'발행국/Country'}</Text>
                      <Text style={s.fvBold}>CHD</Text>
                    </View>
                  </View>
                  <View style={{ marginBottom: 6 }}>
                    <Text style={s.fl}>{'여권번호/Passport No.'}</Text>
                    <Text style={s.fvBold}>{card.shareCode?.toUpperCase() || 'AMATDA001'}</Text>
                  </View>

                  <View style={s.thinDivider} />

                  {/* Photo + Name/Nationality */}
                  <View style={s.photoNameRow}>
                    <View style={s.photoBoxS}>
                      <View style={s.photoFrameS}>
                        {(card.photoUrl || child.photoUri) ? (
                          <Image
                            source={{ uri: (card.photoUrl || child.photoUri) as string }}
                            style={s.photoImgS}
                            onError={() => setCard((prev) => prev ? { ...prev, photoUrl: null } : prev)}
                          />
                        ) : (
                          <Image
                            source={child.gender === 'F' ? IC_GIRL : IC_BOY}
                            style={s.photoPlaceholderS}
                            resizeMode="cover"
                          />
                        )}
                      </View>
                    </View>

                    <View style={s.nameFieldsS}>
                      <Text style={s.fl}>{'성/Surname'}</Text>
                      <Text style={s.fvName}>{card.name.charAt(0)}</Text>
                      <Text style={s.fl}>{'이름/Given names'}</Text>
                      <Text style={s.fvName}>{card.name.slice(1)}</Text>
                      <Text style={s.fl}>{'국적/Nationality'}</Text>
                      <Text style={[s.fvBold, { fontSize: 8 }]}>REPUBLIC OF CHILDHOOD</Text>
                    </View>
                  </View>

                  <View style={s.thinDivider} />

                  {/* DOB / Age */}
                  <View style={s.compactRow}>
                    <View style={s.compactField}>
                      <Text style={s.fl}>{'생년월일/DOB'}</Text>
                      <Text style={s.fvBold}>{birthFmt}</Text>
                    </View>
                    <View style={s.compactField}>
                      <Text style={s.fl}>{'나이/Age'}</Text>
                      <Text style={s.fvBold}>{`${card.growth?.months ?? ''}개월`}</Text>
                    </View>
                  </View>

                  {/* Sex / D+day */}
                  <View style={s.compactRow}>
                    <View style={s.compactField}>
                      <Text style={s.fl}>{'성별/Sex'}</Text>
                      <Text style={s.fvBold}>{child.gender === 'F' ? 'F' : 'M'}</Text>
                    </View>
                    <View style={s.compactField}>
                      <Text style={s.fl}>{`D+${dDays}`}</Text>
                      <Text style={[s.fvBold, { color: GOLD }]}>{'이 세상에 온 날'}</Text>
                    </View>
                  </View>

                  <View style={s.thinDivider} />

                  {/* Issue / Expiry / Authority — stacked */}
                  <View style={s.compactRow}>
                    <View style={s.compactField}>
                      <Text style={s.fl}>{'발급일/Issue'}</Text>
                      <Text style={s.fvBold}>{issueFmt}</Text>
                    </View>
                    <View style={s.compactField}>
                      <Text style={s.fl}>{'만료일/Expiry'}</Text>
                      <Text style={[s.fvBold, { color: GOLD }]}>FOREVER</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 2 }}>
                    <Text style={s.fl}>{'발행관청/Authority'}</Text>
                    <Text style={s.fvBold}>A-MATDA</Text>
                  </View>
                </View>
              </View>

              {/* ════════ FOLD LINE ════════ */}
              <View style={s.foldLine}>
                <View style={s.foldShadowL} />
                <View style={s.foldCenter} />
                <View style={s.foldShadowR} />
              </View>

              {/* ════════ PAGE 2 (Right) ════════ */}
              <View style={s.page}>
                {/* Same header as page 1 — skin-colored */}
                <LinearGradient
                  colors={skin.passportColors.length >= 2 ? skin.passportColors as [string, string, ...string[]] : [skin.passportColors[0], skin.passportColors[0]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.header}
                >
                  <Text style={[s.headerKr, { color: SKIN_ACCENT }]}>{'어 린 이  공 화 국'}</Text>
                  <Text style={[s.headerSub, { color: SKIN_ACCENT }]}>REPUBLIC OF CHILDHOOD</Text>
                  <Text style={[s.headerTitle, { color: SKIN_ACCENT }]}>PASSPORT</Text>
                </LinearGradient>

                <View style={s.pageBody}>
                  {/* 한글성명 */}
                  <Text style={s.fl}>{'한글성명'}</Text>
                  <Text style={s.fvName}>{card.name}</Text>

                  <View style={s.thinDivider} />

                  {/* 기질유형 */}
                  <Text style={s.fl}>{'기질유형/Temperament'}</Text>
                  <Text style={s.temperamentS}>{temperamentDesc}</Text>

                  <View style={s.thinDivider} />

                  {/* Personality chips */}
                  {card.traits.length > 0 && (
                    <>
                      <Text style={s.fl}>{'성격/Personality'}</Text>
                      <View style={s.chipRowS}>
                        {card.traits.slice(0, 4).map((t) => (
                          <View key={t} style={s.chipS}>
                            <Text style={s.chipTextS}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  <View style={s.thinDivider} />

                  {/* Growth stats */}
                  {card.growth && (
                    <View style={s.growthTableS}>
                      <View style={s.growthCellS}>
                        <Text style={s.growthLabelS}>{'키/Height'}</Text>
                        <Text style={s.growthValueS}>{card.growth.height ? `${card.growth.height}cm` : '-'}</Text>
                      </View>
                      <View style={[s.growthCellS, s.growthCellBorderS]}>
                        <Text style={s.growthLabelS}>{'몸무게/Weight'}</Text>
                        <Text style={s.growthValueS}>{card.growth.weight ? `${card.growth.weight}kg` : '-'}</Text>
                      </View>
                      <View style={s.growthCellS}>
                        <Text style={s.growthLabelS}>{'개월/Months'}</Text>
                        <Text style={s.growthValueS}>{String(card.growth.months)}</Text>
                      </View>
                    </View>
                  )}

                  {/* MRZ */}
                  <View style={s.mrzBoxS}>
                    <Text style={s.mrzTextS}>{mrzLine1}</Text>
                    <Text style={s.mrzTextS}>{mrzLine2}</Text>
                  </View>

                  {/* Footer */}
                  <View style={s.passportFooterS}>
                    <View style={s.footerBadgeS}>
                      <Text style={s.footerBadgeTextS}>A</Text>
                    </View>
                    <View>
                      <Text style={s.footerBrandS}>A-matda</Text>
                      <Text style={s.footerDescS}>{'상담이모'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ═══ Share button ═══ */}
          <TouchableOpacity
            style={[s.shareBtn, sharing && { opacity: 0.6 }]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#D4AF37', '#B8941F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.shareBtnInner}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={s.shareBtnText}>SNS에 여권 공유하기</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <Text style={s.hintText}>{'카카오톡, 인스타그램 등에 바로 공유할 수 있어요'}</Text>
        </>
      )}
    </ScrollView>
  );
}

/* ── Styles ── */

const NAVY = '#1B3A5C';
const GOLD = '#D4AF37';
const CREAM = '#F8F4EF';
const LABEL_COLOR = '#8B8579';
const BORDER_COLOR = '#D6CCBE';

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0D1B2A' },
  scroll: { paddingHorizontal: 12, paddingTop: 52, paddingBottom: 120 },

  /* Nav */
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
  navBack: { fontSize: 24, color: GOLD, fontWeight: '300', paddingRight: 8 },
  navTitle: { fontSize: 20, fontWeight: '700', color: GOLD, letterSpacing: 4 },

  /* Loading / Error */
  center: { alignItems: 'center', paddingTop: 80 },
  loadTxt: { fontSize: 14, color: '#FFF8', marginTop: 12 },
  retryBtn: { marginTop: 16, backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryTxt: { color: NAVY, fontSize: 14, fontWeight: '700' },

  /* Level badge */
  levelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  levelBadgeIcon: {
    fontSize: 20,
  },
  levelBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1,
  },

  /* Card container */
  card: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A4A6B',
    ...Platform.select({
      android: { elevation: 12 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
    }),
  },

  /* ═══ 2-Page Fold Layout ═══ */
  foldContainer: {
    flexDirection: 'row',
  },
  page: {
    flex: 1,
  },

  /* Fold line (center crease) */
  foldLine: {
    width: 4,
    flexDirection: 'row',
  },
  foldShadowL: {
    width: 1.5,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  foldCenter: {
    width: 1,
    backgroundColor: '#C5B9AA',
  },
  foldShadowR: {
    width: 1.5,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },

  /* ═══ Page 1 — Header ═══ */
  header: {
    backgroundColor: NAVY,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerKr: {
    fontSize: 8,
    fontWeight: '600',
    color: GOLD,
    letterSpacing: 2,
    marginTop: 2,
    opacity: 0.85,
  },
  headerSub: {
    fontSize: 6,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: GOLD,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  /* (Page 2 now uses same header style as Page 1) */

  /* ═══ Page body (shared) ═══ */
  pageBody: {
    backgroundColor: CREAM,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flex: 1,
  },

  /* Compact row (2-col) */
  compactRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 3,
  },
  compactField: {
    flex: 1,
  },

  /* Field labels & values (compact — unified sizes) */
  fl: {
    fontSize: 6,
    fontWeight: '700',
    color: LABEL_COLOR,
    letterSpacing: 0.5,
    marginTop: 1,
    marginBottom: 0,
  },
  fvBold: {
    fontSize: 10,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  fvName: {
    fontSize: 12,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 1,
  },

  /* Thin divider */
  thinDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_COLOR,
    marginVertical: 5,
  },

  /* Photo + Name row */
  photoNameRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  photoBoxS: {
    width: 58,
    marginRight: 8,
  },
  photoFrameS: {
    width: 54,
    height: 68,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: '#EDE8E0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImgS: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholderS: {
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.6,
  },
  nameFieldsS: {
    flex: 1,
    justifyContent: 'center',
  },

  /* Temperament (compact) */
  temperamentS: {
    fontSize: 10,
    fontWeight: '700',
    color: NAVY,
    lineHeight: 15,
    marginBottom: 2,
    letterSpacing: -0.3,
  },

  /* Personality chips (compact) */
  chipRowS: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
    marginBottom: 2,
  },
  chipS: {
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipTextS: {
    fontSize: 8,
    fontWeight: '600',
    color: NAVY,
  },

  /* Growth table (compact) */
  growthTableS: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 4,
    marginTop: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  growthCellS: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  growthCellBorderS: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: BORDER_COLOR,
    borderRightColor: BORDER_COLOR,
  },
  growthLabelS: {
    fontSize: 6,
    fontWeight: '700',
    color: LABEL_COLOR,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  growthValueS: {
    fontSize: 14,
    fontWeight: '800',
    color: NAVY,
  },

  /* MRZ (compact) */
  mrzBoxS: {
    backgroundColor: '#EDE8E0',
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  mrzTextS: {
    fontFamily: 'monospace',
    fontSize: 4.5,
    color: '#6B5B4B',
    letterSpacing: 0.3,
    lineHeight: 8,
  },

  /* Footer (compact) */
  passportFooterS: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  footerBadgeS: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBadgeTextS: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
  footerBrandS: {
    fontSize: 10,
    fontWeight: '800',
    color: NAVY,
  },
  footerDescS: {
    fontSize: 6,
    color: LABEL_COLOR,
    marginTop: 1,
  },

  /* Share button */
  shareBtn: { marginTop: 20, borderRadius: 14, overflow: 'hidden' },
  shareBtnInner: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  shareBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  hintText: { textAlign: 'center', fontSize: 11, color: '#FFF3', marginTop: 8 },
});
