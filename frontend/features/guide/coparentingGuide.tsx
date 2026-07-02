/** 공동육아 가이드 페이지 */
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  inviteCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 14, padding: 14, alignItems: 'center' },
  code: { fontSize: 22, fontWeight: '900', color: GUIDE_C.accent, letterSpacing: 3 },
  codeSub: { fontSize: 11.5, color: GUIDE_C.textSub, marginTop: 4, fontWeight: '600' },
  shareRow: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'center' },
  shareChip: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  shareText: { fontSize: 12, fontWeight: '800', color: '#C2703B' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 10, marginVertical: 4 },
  roleEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  roleName: { fontSize: 13, fontWeight: '800', color: GUIDE_C.text },
  rolePerm: { fontSize: 11.5, color: GUIDE_C.textSub, marginTop: 1 },
  permPill: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 },
  permText: { fontSize: 10.5, fontWeight: '800' },
  note: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 12, padding: 12, marginTop: 8 },
  noteText: { fontSize: 12, color: '#C2703B', lineHeight: 18, fontWeight: '700' },
});

function Role({ emoji, name, perm, permBadge, color, bg }: { emoji: string; name: string; perm: string; permBadge: string; color: string; bg: string }) {
  return (
    <View style={g.roleRow}>
      <Text style={g.roleEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={g.roleName}>{name}</Text>
        <Text style={g.rolePerm}>{perm}</Text>
      </View>
      <View style={[g.permPill, { backgroundColor: bg }]}><Text style={[g.permText, { color }]}>{permBadge}</Text></View>
    </View>
  );
}

export function getCoparentingGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.coparenting.page1.title'),
      desc: t('guides.coparenting.page1.desc'),
      emoji: '👨‍👩‍👧‍👦',
    },
    {
      title: t('guides.coparenting.page2.title'),
      desc: t('guides.coparenting.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.inviteCard}>
            <Text style={g.code}>A1B2C3D4</Text>
            <Text style={g.codeSub}>{t('guides.coparenting.page2.inviteCode')}</Text>
            <View style={g.shareRow}>
              <View style={g.shareChip}><Text style={g.shareText}>💬 {t('guides.coparenting.page2.kakao')}</Text></View>
              <View style={g.shareChip}><Text style={g.shareText}>✉️ {t('guides.coparenting.page2.sms')}</Text></View>
              <View style={g.shareChip}><Text style={g.shareText}>🔗 {t('guides.coparenting.page2.link')}</Text></View>
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.coparenting.page3.title'),
      desc: t('guides.coparenting.page3.desc'),
      visual: (
        <GuideFrame>
          <Role emoji="👩" name={t('guides.coparenting.page3.roleParent')} perm={t('guides.coparenting.page3.permParent')} permBadge={t('guides.coparenting.page3.badgeCanRecord')} color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
          <Role emoji="👵" name={t('guides.coparenting.page3.roleGrandma')} perm={t('guides.coparenting.page3.permViewOnly')} permBadge={t('guides.coparenting.page3.badgeViewOnly')} color={GUIDE_C.blue} bg={GUIDE_C.blueLight} />
          <Role emoji="🧑‍🍼" name={t('guides.coparenting.page3.roleHelper')} perm={t('guides.coparenting.page3.permRecordOnly')} permBadge={t('guides.coparenting.page3.badgeCanRecord')} color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
        </GuideFrame>
      ),
    },
    {
      title: t('guides.coparenting.page4.title'),
      desc: t('guides.coparenting.page4.desc'),
      visual: (
        <GuideFrame>
          <View style={g.note}>
            <Text style={g.noteText}>{t('guides.coparenting.page4.note')}</Text>
          </View>
        </GuideFrame>
      ),
    },
  ];
}
