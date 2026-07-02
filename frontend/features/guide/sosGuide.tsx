/** 응급/SOS 가이드 페이지 — 위험 4단계 색상 의미 강조 */
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const g = StyleSheet.create({
  level: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginVertical: 4 },
  levelBar: { width: 6, height: 34, borderRadius: 3 },
  levelName: { fontSize: 13, fontWeight: '900' },
  levelDesc: { fontSize: 11.5, color: GUIDE_C.text, fontWeight: '600', marginTop: 1 },
  symRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  sym: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  symText: { fontSize: 12, fontWeight: '700', color: GUIDE_C.textSub },
  note: { backgroundColor: GUIDE_C.redLight, borderRadius: 12, padding: 12, marginTop: 10 },
  noteText: { fontSize: 12, color: GUIDE_C.red, lineHeight: 18, fontWeight: '700' },
});

function Level({ name, desc, color, bg }: { name: string; desc: string; color: string; bg: string }) {
  return (
    <View style={[g.level, { backgroundColor: bg }]}>
      <View style={[g.levelBar, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[g.levelName, { color }]}>{name}</Text>
        <Text style={g.levelDesc}>{desc}</Text>
      </View>
    </View>
  );
}

export function getSosGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.sos.page1.title'),
      desc: t('guides.sos.page1.desc'),
      visual: (
        <GuideFrame>
          <Level name={t('guides.sos.page1.levelEmergencyName')} desc={t('guides.sos.page1.levelEmergencyDesc')} color={GUIDE_C.red} bg={GUIDE_C.redLight} />
          <Level name={t('guides.sos.page1.levelHospitalName')} desc={t('guides.sos.page1.levelHospitalDesc')} color="#CF9352" bg="#FAF0E0" />
          <Level name={t('guides.sos.page1.levelCautionName')} desc={t('guides.sos.page1.levelCautionDesc')} color="#BBA34A" bg="#F8F3DD" />
          <Level name={t('guides.sos.page1.levelObserveName')} desc={t('guides.sos.page1.levelObserveDesc')} color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
        </GuideFrame>
      ),
    },
    {
      title: t('guides.sos.page2.title'),
      desc: t('guides.sos.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.symRow}>
            {(t('guides.sos.page2.symptoms', { returnObjects: true }) as string[]).map((sm) => (
              <View key={sm} style={g.sym}><Text style={g.symText}>{sm}</Text></View>
            ))}
          </View>
          <View style={g.note}>
            <Text style={g.noteText}>{t('guides.sos.page2.note')}</Text>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.sos.page3.title'),
      desc: t('guides.sos.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.symRow}>
            {(t('guides.sos.page3.items', { returnObjects: true }) as string[]).map((it) => (
              <View key={it} style={g.sym}><Text style={g.symText}>{it}</Text></View>
            ))}
          </View>
          <View style={[g.note, { backgroundColor: GUIDE_C.accentSoft }]}>
            <Text style={[g.noteText, { color: '#C2703B' }]}>{t('guides.sos.page3.note')}</Text>
          </View>
        </GuideFrame>
      ),
    },
  ];
}
