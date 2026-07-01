import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import ko from './locales/ko.json';
import ja from './locales/ja.json';
import zhHant from './locales/zh-Hant.json';

export type AppLocale = 'ko' | 'ja' | 'zh-Hant';

/**
 * 기기 언어 → 지원 로케일 매핑. 미지원 언어는 한국어(ko)로 fallback.
 * - ja  : 일본
 * - zh  : 번체(대만·홍콩). 간체(zh-Hans)는 추후 별도.
 */
export function resolveDeviceLocale(): AppLocale {
  try {
    const code = (getLocales()[0]?.languageCode ?? 'ko').toLowerCase();
    if (code === 'ja') return 'ja';
    if (code === 'zh') return 'zh-Hant';
    return 'ko';
  } catch {
    return 'ko';
  }
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      ko: { translation: ko },
      ja: { translation: ja },
      'zh-Hant': { translation: zhHant },
    },
    lng: resolveDeviceLocale(),
    fallbackLng: 'ko',
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });
}

export default i18n;
