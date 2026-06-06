import { useEffect, useRef } from 'react';
import { AppState, Platform, Settings } from 'react-native';
import { router } from 'expo-router';

/**
 * iOS Siri App Shortcut("시리야, 아맞다 육아") 진입 처리.
 *
 * 네이티브 App Intent(AmatdaVoiceRecordIntent)가 openAppWhenRun 으로 앱을 전면에 띄우고
 * NSUserDefaults 에 `amatda_siri_voice_pending = true` 를 기록한다.
 * 여기서 그 플래그를 읽어 음성 화면(/voice)으로 이동 → 텍스트 없는 진입이라 녹음 자동 시작.
 *
 * - react-native `Settings` 는 iOS `NSUserDefaults.standard` 를 읽고 쓴다(iOS 전용).
 * - 앱이 전면으로 올라오는(AppState active) 시점 + 콜드 런치(mount) 시점에 확인.
 * - OpenURLIntent(커스텀 스킴 실행 차단) 대신 쓰는 우회 방식.
 */
const PENDING_KEY = 'amatda_siri_voice_pending';

export function useSiriVoiceLaunch(): void {
  const busyRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const consumeAndGo = () => {
      if (busyRef.current) return;
      let pending = false;
      try {
        pending = !!Settings.get(PENDING_KEY);
      } catch {
        pending = false;
      }
      if (!pending) return;

      busyRef.current = true;
      // 라우터/인증 준비 시간 확보 후 이동
      setTimeout(() => {
        try {
          Settings.set({ [PENDING_KEY]: false });
          router.push('/voice');
        } catch {
          // 이동 실패 시 다음 active 에서 재시도되도록 플래그 복구
          try { Settings.set({ [PENDING_KEY]: true }); } catch { /* ignore */ }
        } finally {
          busyRef.current = false;
        }
      }, 450);
    };

    consumeAndGo(); // 콜드 런치
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') consumeAndGo();
    });
    return () => sub.remove();
  }, []);
}
