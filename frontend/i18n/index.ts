import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ko from './locales/ko.json';
import ja from './locales/ja.json';
import zhHant from './locales/zh-Hant.json';

export type AppLocale = 'ko' | 'ja' | 'zh-Hant';

/**
 * 기기 언어 → 지원 로케일 매핑. 미지원 언어는 한국어(ko)로 fallback.
 * - ja  : 일본
 * - zh  : 번체(대만·홍콩). 간체(zh-Hans)는 추후 별도.
 *
 * ⚠️ expo-localization 은 네이티브 모듈이다. 해당 네이티브가 없는 빌드(OTA 로만 JS 가
 * 갱신되고 네이티브는 옛 버전인 경우)에서 이 모듈을 static import 하면 로드 시점에
 * "Cannot find native module 'ExpoLocalization'" 로 앱 전체가 부팅 크래시한다.
 * → static import 금지, 런타임에 require 를 try/catch 로 감싼다 (CLAUDE.md 규칙 6).
 *   네이티브 없으면 조용히 ko 로 폴백(언어 자동감지만 비활성, 앱은 정상 부팅).
 */
export function resolveDeviceLocale(): AppLocale {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = require('expo-localization') as {
      getLocales?: () => Array<{ languageCode?: string | null }>;
    };
    const code = (Localization.getLocales?.()[0]?.languageCode ?? 'ko').toLowerCase();
    if (code === 'ja') return 'ja';
    if (code === 'zh') return 'zh-Hant';
    return 'ko';
  } catch {
    return 'ko';
  }
}

/**
 * 기기 지역코드(예: 'KR','TW','HK','JP'). 네이티브(expo-localization) 없으면 undefined.
 * resolveDeviceLocale 과 동일한 이유로 static import 금지 — 안전 require + try/catch.
 */
export function getDeviceRegionCode(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = require('expo-localization') as {
      getLocales?: () => Array<{ regionCode?: string | null }>;
    };
    return Localization.getLocales?.()[0]?.regionCode ?? undefined;
  } catch {
    return undefined;
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
