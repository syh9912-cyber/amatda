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
  // ⚠️ 설치된 APK 의 네이티브는 0-인자 시그니처. (소스가 2-인자로 바뀌었으나 새 빌드 미배포)
  requestPinVoiceShortcut: () => Promise<void>;
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

/**
 * shortLabel/longLabel 인자는 호출부 호환을 위해 받되 네이티브로 넘기지 않는다.
 * ⚠️ OTA-네이티브 불일치 방어(2026-07-23): 설치된 APK 의 네이티브 requestPinVoiceShortcut 은
 *   0-인자 시그니처인데(라벨은 네이티브 내부 기본값 "음성 기록"), 소스/JS 가 2-인자로 바뀌면서
 *   "Received 2 arguments, but 0 was expected" 로 단축 아이콘 생성이 실패했다. OTA 로는 네이티브를
 *   못 바꾸므로 JS 를 0-인자 호출로 되돌려 설치본과 맞춘다. (라벨 다국어화는 네이티브 2-인자를
 *   되살린 새 APK 를 빌드할 때 index/native 를 동시에 되돌려 복원할 것.)
 */
export async function requestPinVoiceShortcut(
  _shortLabel?: string,
  _longLabel?: string,
): Promise<{ ok: boolean; reason?: string }> {
  const mod = loadModule();
  if (!mod) return { ok: false, reason: 'NATIVE_MODULE_UNAVAILABLE' };
  try {
    await mod.requestPinVoiceShortcut();
    return { ok: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'UNKNOWN';
    return { ok: false, reason };
  }
}
