/** 주수별 발달 가이드 — 이번 주 발달 · 크기 비교 · 매주 업데이트 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GuidePill, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_BABY = require('../../assets/quick-baby.png') as number;
const IC_LEAF = require('../../assets/preg-leaf.png') as number;

const g = StyleSheet.create({
  hero: { width: 46, height: 46, alignSelf: 'center', marginBottom: 8 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, textAlign: 'center', marginBottom: 10 },
  weekBadge: { alignSelf: 'center', backgroundColor: GUIDE_C.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10 },
  weekText: { fontSize: 13, fontWeight: '900', color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: GUIDE_C.border, padding: 12 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  lineLabel: { fontSize: 12.5, color: GUIDE_C.textSub, fontWeight: '600' },
  lineVal: { fontSize: 12.5, fontWeight: '800', color: GUIDE_C.text },
  bigEmoji: { fontSize: 40, textAlign: 'center', marginBottom: 4 },
  compare: { fontSize: 13, fontWeight: '800', color: GUIDE_C.text, textAlign: 'center', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  arrow: { fontSize: 14, color: GUIDE_C.textLight, fontWeight: '800' },
});

export function getWeeklyDevGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.weeklyDev.page1.title'),
      desc: t('guides.weeklyDev.page1.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_BABY} style={g.hero} resizeMode="contain" />
          <View style={g.weekBadge}><Text style={g.weekText}>{t('guides.weeklyDev.page1.weekBadge')}</Text></View>
          <View style={g.card}>
            <View style={g.line}>
              <Text style={g.lineLabel}>{t('guides.weeklyDev.page1.heightLabel')}</Text><Text style={g.lineVal}>{t('guides.weeklyDev.page1.heightVal')}</Text>
            </View>
            <View style={[g.line, { borderTopWidth: 1, borderTopColor: GUIDE_C.border }]}>
              <Text style={g.lineLabel}>{t('guides.weeklyDev.page1.weightLabel')}</Text><Text style={g.lineVal}>{t('guides.weeklyDev.page1.weightVal')}</Text>
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.weeklyDev.page2.title'),
      desc: t('guides.weeklyDev.page2.desc'),
      visual: (
        <GuideFrame>
          <Text style={g.bigEmoji}>🍌</Text>
          <Text style={g.compare}>{t('guides.weeklyDev.page2.compare')}</Text>
          <View style={g.row}>
            <GuidePill label={t('guides.weeklyDev.page2.week12')} color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
            <Text style={g.arrow}>→</Text>
            <GuidePill label={t('guides.weeklyDev.page2.week20')} color="#FFF" filled bg={GUIDE_C.accent} />
            <Text style={g.arrow}>→</Text>
            <GuidePill label={t('guides.weeklyDev.page2.week36')} color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.weeklyDev.page3.title'),
      desc: t('guides.weeklyDev.page3.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_LEAF} style={g.hero} resizeMode="contain" />
          <Text style={g.cap}>{t('guides.weeklyDev.page3.cap')}</Text>
          <View style={g.row}>
            <GuidePill label={t('guides.weeklyDev.page3.week20')} color={GUIDE_C.textSub} bg="#EFEFF3" />
            <Text style={g.arrow}>→</Text>
            <GuidePill label={t('guides.weeklyDev.page3.week21')} color="#FFF" filled bg={GUIDE_C.green} />
          </View>
        </GuideFrame>
      ),
    },
  ];
}
