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
 * ⚠️ 2026-07-09 임시 비활성화: expo-localization 은 네이티브 모듈이라, 해당 네이티브가
 * 없는 빌드(OTA 로만 JS 가 갱신되고 네이티브는 옛 버전인 경우)에서 건드리면
 * "Cannot find native module 'ExpoLocalization'" 로 크래시한다. 기존엔 require를
 * try/catch 로 감싸 "부팅 시점엔 안전"이라 판단했으나, 실기기 로그로 반증됨 — OTA
 * 갱신 직후(expo-updates 재시작 순간) 호출 시 FATAL EXCEPTION(expo-updates-error-recovery)
 * 으로 프로세스가 실제로 죽는 것을 확인(자체 크래시 복구로 재시작되어 겉보기엔 정상처럼
 * 보이지만 매 콜드스타트마다 크래시→복구 사이클을 탐 — 불안정). try/catch 로도 이
 * 런타임(New Arch)에서 100% 안전을 보장 못한다고 최종 판단 — 새 네이티브 빌드(모듈 포함)
 * 배포 전까지는 아예 호출하지 않고 무조건 'ko' 반환(언어 자동감지만 비활성, 앱은 항상
 * 안정적으로 부팅). 사용자가 앱 내 언어 설정에서 직접 선택 가능해 기능 손실 없음.
 */
export function resolveDeviceLocale(): AppLocale {
  return 'ko';
}

/**
 * 기기 지역코드(예: 'KR','TW','HK','JP'). resolveDeviceLocale 과 동일한 이유로
 * 새 네이티브 빌드 배포 전까지 비활성 — 무조건 undefined 반환.
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
