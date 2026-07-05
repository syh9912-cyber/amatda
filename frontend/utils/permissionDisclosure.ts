import { Alert } from 'react-native';
import i18n from '../i18n';

/**
 * Google Play "prominent disclosure" 대응 유틸.
 *
 * 민감 권한(마이크·위치)의 OS 권한 요청 "전"에, 왜 필요한지·무엇을 수집하는지·
 * 어떻게 쓰는지를 인앱에서 먼저 고지하고 명시적 동의를 받는다.
 * (Google Play 정책: 사전 고지는 앱 설명/웹이 아니라 인앱에서, 요청 직전에 노출해야 함)
 *
 * 호출부에서 권한 상태가 'undetermined'(최초)일 때만 호출 → 매번 뜨지 않게 게이팅.
 *
 * @returns 사용자가 '계속'을 누르면 true, '취소'면 false
 */
export type DisclosureKind = 'microphone' | 'location';

export function showPermissionDisclosure(kind: DisclosureKind): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      i18n.t(`permissionDisclosure.${kind}.title`),
      i18n.t(`permissionDisclosure.${kind}.message`),
      [
        {
          text: i18n.t('permissionDisclosure.cancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: i18n.t('permissionDisclosure.allow'),
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false },
    );
  });
}
