/** 출산가방 체크리스트 가이드 — 맞춤 목록 · 상태/담당 태그 · 아빠모드/공유 */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_SHARE = require('../../assets/icon-share.png') as number;

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  selRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  selCard: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5 },
  selText: { fontSize: 12, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 10, marginVertical: 3 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: GUIDE_C.border },
  checkOn: { backgroundColor: GUIDE_C.green, borderColor: GUIDE_C.green, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  itemName: { flex: 1, fontSize: 12.5, fontWeight: '700', color: GUIDE_C.text },
  tag: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '800' },
  progressWrap: { marginTop: 8 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEEEF2', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: GUIDE_C.accent },
  progressText: { fontSize: 11, fontWeight: '800', color: GUIDE_C.accent, marginTop: 5, textAlign: 'right' },
  dadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: GUIDE_C.accentSoft, borderRadius: 12, padding: 11 },
  dadEmoji: { fontSize: 22 },
  dadText: { flex: 1, fontSize: 12.5, fontWeight: '800', color: '#BC7C53' },
  toggle: { width: 38, height: 22, borderRadius: 11, backgroundColor: GUIDE_C.accent, justifyContent: 'center', paddingHorizontal: 2 },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', alignSelf: 'flex-end' },
  shareChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'center', marginTop: 10 },
  shareIcon: { width: 16, height: 16 },
  shareText: { fontSize: 12, fontWeight: '700', color: GUIDE_C.textSub },
});

export function getBirthBagGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.birthBag.page1.title'),
      desc: t('guides.birthBag.page1.desc'),
      visual: (
        <GuideFrame>
          <Text style={g.cap}>{t('guides.birthBag.page1.birthTypeLabel')}</Text>
          <View style={g.selRow}>
            <View style={[g.selCard, { backgroundColor: GUIDE_C.accentSoft, borderColor: GUIDE_C.accent }]}><Text style={[g.selText, { color: GUIDE_C.accent }]}>{t('birthBag.birthTypes.natural.label')}</Text></View>
            <View style={[g.selCard, { backgroundColor: '#FFF', borderColor: GUIDE_C.border }]}><Text style={[g.selText, { color: GUIDE_C.textSub }]}>{t('birthBag.birthTypes.csection.label')}</Text></View>
          </View>
          <Text style={g.cap}>{t('guides.birthBag.page1.postpartumPlanLabel')}</Text>
          <View style={g.selRow}>
            <View style={[g.selCard, { backgroundColor: GUIDE_C.blueLight, borderColor: GUIDE_C.blue }]}><Text style={[g.selText, { color: GUIDE_C.blue }]}>{t('guides.birthBag.page1.postpartumCenter')}</Text></View>
            <View style={[g.selCard, { backgroundColor: '#FFF', borderColor: GUIDE_C.border }]}><Text style={[g.selText, { color: GUIDE_C.textSub }]}>{t('guides.birthBag.page1.postpartumHome')}</Text></View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.birthBag.page2.title'),
      desc: t('guides.birthBag.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.item}>
            <View style={g.check} />
            <Text style={g.itemName}>{t('guides.birthBag.page2.sampleItemPad')}</Text>
            <View style={[g.tag, { backgroundColor: GUIDE_C.accentSoft }]}><Text style={[g.tagText, { color: GUIDE_C.accent }]}>{t('birthBag.status.need')}</Text></View>
            <View style={[g.tag, { backgroundColor: '#FCE9F1' }]}><Text style={[g.tagText, { color: '#C77BA0' }]}>{t('birthBag.owner.mom')}</Text></View>
          </View>
          <View style={g.item}>
            <View style={[g.check, g.checkOn]}><Text style={g.checkMark}>✓</Text></View>
            <Text style={g.itemName}>{t('guides.birthBag.page2.sampleItemCarSeat')}</Text>
            <View style={[g.tag, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[g.tagText, { color: GUIDE_C.blue }]}>{t('birthBag.status.packed')}</Text></View>
            <View style={[g.tag, { backgroundColor: GUIDE_C.greenLight }]}><Text style={[g.tagText, { color: GUIDE_C.green }]}>{t('birthBag.owner.dad')}</Text></View>
          </View>
          <View style={g.progressWrap}>
            <View style={g.progressTrack}><View style={[g.progressFill, { width: '62%' }]} /></View>
            <Text style={g.progressText}>{t('guides.birthBag.page2.progressText')}</Text>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.birthBag.page3.title'),
      desc: t('guides.birthBag.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.dadRow}>
            <Text style={g.dadEmoji}>👨</Text>
            <Text style={g.dadText}>{t('guides.birthBag.page3.dadModeLabel')}</Text>
            <View style={g.toggle}><View style={g.knob} /></View>
          </View>
          <View style={g.shareChip}>
            <Image source={IC_SHARE} style={g.shareIcon} resizeMode="contain" />
            <Text style={g.shareText}>{t('guides.birthBag.page3.shareVia')}</Text>
          </View>
        </GuideFrame>
      ),
    },
  ];
}
