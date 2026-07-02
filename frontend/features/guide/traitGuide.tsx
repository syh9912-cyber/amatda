/** 기질 분석 가이드 — 앱의 핵심 가치 설명 (사주/오행 용어 금지: 기질·에너지·성향만) */
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  enRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  enLabel: { width: 30, fontSize: 11, fontWeight: '700', color: GUIDE_C.textSub },
  enTrack: { flex: 1, height: 8, backgroundColor: '#EEEEF2', borderRadius: 4, overflow: 'hidden' },
  enFill: { height: '100%', borderRadius: 4 },
  flowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginVertical: 6 },
  flowBox: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  flowText: { fontSize: 11.5, fontWeight: '700', color: GUIDE_C.text },
  flowArrow: { fontSize: 14, color: GUIDE_C.textLight, fontWeight: '900' },
  useRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 10, marginVertical: 4 },
  useEmoji: { fontSize: 20, width: 26, textAlign: 'center' },
  useText: { flex: 1, fontSize: 12.5, color: GUIDE_C.text, fontWeight: '600', lineHeight: 17 },
});

function EnergyBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={g.enRow}>
      <Text style={g.enLabel}>{label}</Text>
      <View style={g.enTrack}><View style={[g.enFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

export function getTraitGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.trait.page1.title'),
      desc: t('guides.trait.page1.desc'),
      visual: (
        <GuideFrame>
          <Text style={g.cap}>{t('guides.trait.page1.cap')}</Text>
          <EnergyBar label={t('guides.trait.energyLabels.explore')} pct={82} color={GUIDE_C.blue} />
          <EnergyBar label={t('guides.trait.energyLabels.active')} pct={64} color={GUIDE_C.accent} />
          <EnergyBar label={t('guides.trait.energyLabels.stable')} pct={48} color={GUIDE_C.green} />
          <EnergyBar label={t('guides.trait.energyLabels.analytic')} pct={70} color={GUIDE_C.purple} />
          <EnergyBar label={t('guides.trait.energyLabels.emotional')} pct={55} color={GUIDE_C.gold} />
        </GuideFrame>
      ),
    },
    {
      title: t('guides.trait.page2.title'),
      desc: t('guides.trait.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.flowRow}>
            <View style={g.flowBox}><Text style={g.flowText}>{t('guides.trait.page2.flowBirth')}</Text></View>
            <Text style={g.flowArrow}>＋</Text>
            <View style={g.flowBox}><Text style={g.flowText}>{t('guides.trait.page2.flowQuestion')}</Text></View>
          </View>
          <Text style={g.flowArrow}>↓</Text>
          <View style={[g.flowBox, { alignSelf: 'center', backgroundColor: GUIDE_C.accentSoft, borderColor: GUIDE_C.accent }]}>
            <Text style={[g.flowText, { color: '#C2703B' }]}>{t('guides.trait.page2.flowResult')}</Text>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.trait.page3.title'),
      desc: t('guides.trait.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.useRow}><Text style={g.useEmoji}>💬</Text><Text style={g.useText}>{t('guides.trait.page3.useChat')}</Text></View>
          <View style={g.useRow}><Text style={g.useEmoji}>🍎</Text><Text style={g.useText}>{t('guides.trait.page3.useRecommend')}</Text></View>
          <View style={g.useRow}><Text style={g.useEmoji}>🌙</Text><Text style={g.useText}>{t('guides.trait.page3.useTips')}</Text></View>
        </GuideFrame>
      ),
    },
  ];
}
