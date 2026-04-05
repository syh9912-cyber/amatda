import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { AppNameDisplay } from '../components/ui/AppNameDisplay';

const BG = '#FDF6F0';
const SIZES = [
  { label: 'A: 소형 (180px)', img: 180, name: 'large' as const, gap: 16 },
  { label: 'B: 중형 (240px)', img: 240, name: 'large' as const, gap: 20 },
  { label: 'C: 대형 (300px)', img: 300, name: 'large' as const, gap: 24 },
  { label: 'D: 특대 (340px)', img: 340, name: 'large' as const, gap: 28 },
  { label: 'E: 최대 (380px)', img: 380, name: 'large' as const, gap: 30 },
];

export default function SplashPreview() {
  const [idx, setIdx] = useState(0);
  const s = SIZES[idx];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* 탭 선택 */}
      <ScrollView horizontal style={styles.tabs} contentContainerStyle={styles.tabContent}>
        {SIZES.map((size, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tab, idx === i && styles.tabActive]}
            onPress={() => setIdx(i)}
          >
            <Text style={[styles.tabText, idx === i && styles.tabTextActive]}>{size.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 미리보기 */}
      <View style={styles.preview}>
        <Image
          source={require('../assets/child-diary.png')}
          style={{ width: s.img, height: s.img }}
          resizeMode="contain"
        />
        <View style={{ marginTop: s.gap, marginBottom: 18 }}>
          <AppNameDisplay size={s.name} />
        </View>
        <View style={styles.line} />
        <Text style={styles.eng}>Child-Customized Diary</Text>
        <View style={styles.companyWrap}>
          <Text style={styles.companyName}>Bloomin Corp.</Text>
          <Text style={styles.companyInfo}>Growing with every child</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { maxHeight: 50, borderBottomWidth: 1, borderColor: '#E0D8D0' },
  tabContent: { gap: 8, paddingHorizontal: 12, alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 10 },
  tabActive: { borderBottomWidth: 2, borderColor: '#4338CA' },
  tabText: { fontSize: 12, color: '#999' },
  tabTextActive: { color: '#4338CA', fontWeight: '700' },
  preview: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  line: { height: 2, width: 56, backgroundColor: '#D4C8BE', marginBottom: 16, borderRadius: 1 },
  eng: { fontSize: 14, color: '#9CA3AF', letterSpacing: 1.5 },
  companyWrap: { marginTop: 44, alignItems: 'center' },
  companyName: { fontSize: 13, color: '#B0A89E', fontWeight: '600', letterSpacing: 1.2 },
  companyInfo: { fontSize: 10, color: '#C8C0B8', marginTop: 3, letterSpacing: 0.5 },
});
