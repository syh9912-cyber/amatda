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
 *
 * ⚠️ 2026-07-09 임시 비활성화: try/catch로 감쌌음에도 실기기(안드로이드, New Architecture
 * Bridgeless)에서 fever 화면 렌더링 중 호출 시 "Cannot find native module 'ExpoLocalization'"
 * 가 JS try/catch를 우회하는 "소프트 익셉션"으로 ReactHost까지 전파되어 화면이 하얗게
 * 꺼지는 문제 실기기 로그로 확인(FATAL은 아니라 프로세스는 안 죽지만 React 인스턴스가 리로드됨).
 * requireNativeModule 이 없는 모듈을 렌더 경로에서 건드리는 자체가 이 런타임(New Arch)에서는
 * JS 레벨 가드로 100% 안전하지 않다고 판단 — 새 네이티브 빌드(모듈 포함) 배포 전까지는
 * 아예 호출하지 않고 무조건 undefined 반환(zh-Hant TW/HK 자동감지만 비활성, 사용자가
 * 화면 내 토글로 직접 선택 가능해 기능 손실 없음). resolveDeviceLocale()은 부팅 시점(New
 * Arch 초기화 이전) 호출이라 실기기 검증 결과 안전 — 그대로 유지.
 */
export function getDeviceRegionCode(): string | undefined {
  return undefined;
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
