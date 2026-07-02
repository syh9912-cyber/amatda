import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import i18n from '../i18n';

/**
 * API 오류 발생 시 OTA 업데이트 여부를 확인하고, 새 버전이 있으면 사용자에게 안내.
 * - 서버가 새 엔드포인트/필드를 요구할 때, 구버전 앱이 404/400을 받으면 대부분 OTA 미수신 때문.
 * - 중복 호출 방지 위해 1분 쿨다운.
 * - 다이얼로그 중복 표시 방지.
 */

let lastCheckAt = 0;
let dialogShown = false;
const COOLDOWN_MS = 60_000;

async function applyUpdate() {
  try {
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    Alert.alert(i18n.t('otaCheck.updateFailed.title'), i18n.t('otaCheck.updateFailed.message'));
    dialogShown = false;
  }
}

export async function checkOtaOnApiError(): Promise<void> {
  if (__DEV__) return;
  if (dialogShown) return;
  const now = Date.now();
  if (now - lastCheckAt < COOLDOWN_MS) return;
  lastCheckAt = now;

  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;

    dialogShown = true;
    Alert.alert(
      i18n.t('otaCheck.updateAvailable.title'),
      i18n.t('otaCheck.updateAvailable.message'),
      [
        {
          text: i18n.t('onboardingNotificationPermission.later'),
          style: 'cancel',
          onPress: () => { dialogShown = false; },
        },
        {
          text: i18n.t('otaCheck.updateAvailable.updateButton'),
          style: 'default',
          onPress: () => { applyUpdate(); },
        },
      ],
      { cancelable: false },
    );
  } catch {
    // 업데이트 서버 접근 실패 — 조용히 무시 (다음 오류 때 재시도)
  }
}
