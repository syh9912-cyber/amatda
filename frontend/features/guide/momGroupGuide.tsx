/** 맘스톡 가이드 페이지 — 월방/내 동네 커뮤니티 · 글쓰기 · 익명/신고 (커스텀 아이콘 사용) */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_MONTH = require('../../assets/quick-timeline.png') as number;
const IC_LOCAL = require('../../assets/cat-social.png') as number;
const IC_ANON = require('../../assets/icon-lock.png') as number;
const IC_REPORT = require('../../assets/icon-redflag.png') as number;

const g = StyleSheet.create({
  roomRow: { gap: 8 },
  room: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11 },
  roomIcon: { width: 30, height: 30 },
  roomName: { fontSize: 13, fontWeight: '800', color: GUIDE_C.text },
  roomDesc: { fontSize: 11.5, color: GUIDE_C.textSub, marginTop: 1 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  post: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11, marginVertical: 3 },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  catBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  catText: { fontSize: 10, fontWeight: '800' },
  postTitle: { flex: 1, fontSize: 12.5, fontWeight: '700', color: GUIDE_C.text },
  postMeta: { fontSize: 10.5, color: GUIDE_C.textLight, fontWeight: '600' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 12, marginVertical: 4 },
  noteIcon: { width: 24, height: 24 },
  noteText: { flex: 1, fontSize: 12, color: GUIDE_C.textSub, lineHeight: 18, fontWeight: '600' },
});

export function getMomGroupGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.momGroup.page1.title'),
      desc: t('guides.momGroup.page1.desc'),
      visual: (
        <GuideFrame>
          <View style={g.roomRow}>
            <View style={g.room}>
              <Image source={IC_MONTH} style={g.roomIcon} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={g.roomName}>{t('guides.momGroup.page1.monthRoomName')}</Text>
                <Text style={g.roomDesc}>{t('guides.momGroup.page1.monthRoomDesc')}</Text>
              </View>
            </View>
            <View style={g.room}>
              <Image source={IC_LOCAL} style={g.roomIcon} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={g.roomName}>{t('guides.momGroup.page1.localRoomName')}</Text>
                <Text style={g.roomDesc}>{t('guides.momGroup.page1.localRoomDesc')}</Text>
              </View>
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.momGroup.page2.title'),
      desc: t('guides.momGroup.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.post}>
            <View style={g.postTop}>
              <View style={[g.catBadge, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[g.catText, { color: GUIDE_C.blue }]}>{t('guides.momGroup.page2.catQuestion')}</Text></View>
              <Text style={g.postTitle} numberOfLines={1}>{t('guides.momGroup.page2.samplePostTitle')}</Text>
            </View>
            <Text style={g.postMeta}>{t('guides.momGroup.page2.samplePostMeta')}</Text>
          </View>
          <View style={g.catRow}>
            <View style={[g.catBadge, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[g.catText, { color: GUIDE_C.blue }]}>{t('guides.momGroup.page2.catQuestion')}</Text></View>
            <View style={[g.catBadge, { backgroundColor: '#FCE9F1' }]}><Text style={[g.catText, { color: '#C77BA0' }]}>{t('guides.momGroup.page2.catChat')}</Text></View>
            <View style={[g.catBadge, { backgroundColor: GUIDE_C.greenLight }]}><Text style={[g.catText, { color: GUIDE_C.green }]}>{t('guides.momGroup.page2.catInfo')}</Text></View>
            <View style={[g.catBadge, { backgroundColor: GUIDE_C.accentSoft }]}><Text style={[g.catText, { color: GUIDE_C.accent }]}>{t('guides.momGroup.page2.catWorry')}</Text></View>
            <View style={[g.catBadge, { backgroundColor: GUIDE_C.purpleLight }]}><Text style={[g.catText, { color: GUIDE_C.purple }]}>{t('guides.momGroup.page2.catCelebration')}</Text></View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.momGroup.page3.title'),
      desc: t('guides.momGroup.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.note}>
            <Image source={IC_ANON} style={g.noteIcon} resizeMode="contain" />
            <Text style={g.noteText}>{t('guides.momGroup.page3.anonNote')}</Text>
          </View>
          <View style={g.note}>
            <Image source={IC_REPORT} style={g.noteIcon} resizeMode="contain" />
            <Text style={g.noteText}>{t('guides.momGroup.page3.reportNote')}</Text>
          </View>
        </GuideFrame>
      ),
    },
  ];
}
