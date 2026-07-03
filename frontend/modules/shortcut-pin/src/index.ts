import { Platform } from 'react-native';

/**
 * Android 홈 화면에 "음성 기록" 단축 아이콘을 고정하는 모듈.
 *
 * 시스템 다이얼로그 "바로가기 추가" 가 뜨고, 사용자가 승인하면 홈에 아이콘 생성.
 * 아이콘 1탭 = amatda://voice → 앱 열리며 음성 인식 즉시 시작.
 *
 * iOS 미지원 — Apple 정책상 단축 아이콘 추가 API 없음.
 */

interface ShortcutPinNative {
  isSupported: () => Promise<boolean>;
  requestPinVoiceShortcut: (shortLabel?: string, longLabel?: string) => Promise<void>;
}

let _module: ShortcutPinNative | null = null;
let _loadAttempted = false;

function loadModule(): ShortcutPinNative | null {
  if (_loadAttempted) return _module;
  _loadAttempted = true;
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require('expo-modules-core');
    _module = requireNativeModule('ShortcutPin') as ShortcutPinNative;
    return _module;
  } catch {
    return null;
  }
}

export async function isPinShortcutSupported(): Promise<boolean> {
  const mod = loadModule();
  if (!mod) return false;
  try {
    return await mod.isSupported();
  } catch {
    return false;
  }
}

export async function requestPinVoiceShortcut(
  shortLabel?: string,
  longLabel?: string,
): Promise<{ ok: boolean; reason?: string }> {
  const mod = loadModule();
  if (!mod) return { ok: false, reason: 'NATIVE_MODULE_UNAVAILABLE' };
  try {
    await mod.requestPinVoiceShortcut(shortLabel, longLabel);
    return { ok: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'UNKNOWN';
    return { ok: false, reason };
  }
}
