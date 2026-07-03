import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

/**
 * 개발/프리뷰 전용 언어 전환기 — 실기기 다국어 검증용.
 * 프로덕션 빌드에서는 렌더되지 않는다(EXPO_PUBLIC_SHOW_LANG_TOGGLE 미설정 + __DEV__ false).
 * 폰 시스템 언어를 바꾸지 않고 앱 안에서 KO/JA/ZH를 즉시 전환한다(런타임 i18n.changeLanguage).
 * 주의: 재시작 시 기기 언어 기준으로 되돌아간다(영속 저장 안 함).
 */
const SHOW = __DEV__ || process.env.EXPO_PUBLIC_SHOW_LANG_TOGGLE === 'true';

const LANGS: { code: string; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-Hant', label: '繁體中文' },
];

export function DevLanguageSwitcher() {
  const { i18n } = useTranslation();
  if (!SHOW) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🌐 언어 전환 (개발/테스트 전용)</Text>
      <View style={styles.row}>
        {LANGS.map((l) => {
          const active = i18n.language === l.code;
          return (
            <TouchableOpacity
              key={l.code}
              style={[styles.btn, active && styles.btnActive]}
              onPress={() => i18n.changeLanguage(l.code)}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, active && styles.btnTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
  },
  title: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  btnActive: { backgroundColor: '#FF8C5A20', borderColor: '#FF8C5A' },
  btnText: { fontSize: 13, fontWeight: '600', color: '#666' },
  btnTextActive: { color: '#FF8C5A', fontWeight: '700' },
});
