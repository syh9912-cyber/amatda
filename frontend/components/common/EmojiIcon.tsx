/**
 * 임신/육아 도메인 emoji → 3D clay 일러스트 매핑.
 *
 * 안드로이드 일부 폰트에서 emoji 가 빈 박스로 렌더되는 케이스 방어 +
 * 앱 마스코트와 톤 일관성. 매핑 안 된 emoji 는 기본 아이콘으로 폴백.
 *
 * 사용처: pregnancy.tsx (작성 폼·타임라인), PostCard.tsx (가족피드 글), 기타.
 */
import { Image, ImageSourcePropType } from 'react-native';

export const PREG_EMOJI_ICON: Record<string, ImageSourcePropType> = {
  '🤰': require('../../assets/preg-test.png'),
  '💊': require('../../assets/quick-pill.png'),
  '🏥': require('../../assets/preg-stethoscope.png'),
  '📸': require('../../assets/preg-ultrasound.png'),
  '💓': require('../../assets/icon-heart.png'),
  '🔬': require('../../assets/preg-ultrasound.png'),
  '🌿': require('../../assets/preg-leaf.png'),
  '🌱': require('../../assets/preg-leaf.png'),
  '🧪': require('../../assets/preg-ultrasound.png'),
  '🎀': require('../../assets/preg-ribbon.png'),
  '🦶': require('../../assets/preg-foot.png'),
  '📋': require('../../assets/preg-ultrasound.png'),
  '🩸': require('../../assets/quick-blood.png'),
  '🧳': require('../../assets/preg-bag.png'),
  '📷': require('../../assets/icon-camera.png'),
  '👶': require('../../assets/quick-baby.png'),
  '🤢': require('../../assets/preg-mood-nausea.png'),
  '😴': require('../../assets/preg-mood-tired.png'),
  '🦴': require('../../assets/preg-mood-pain.png'),
  '🤕': require('../../assets/preg-mood-pain.png'),
  '🌙': require('../../assets/preg-mood-tired.png'),
  '🔥': require('../../assets/preg-mood-pain.png'),
  '😣': require('../../assets/preg-mood-pain.png'),
  '🦵': require('../../assets/preg-mood-pain.png'),
  '😢': require('../../assets/preg-mood-tired.png'),
  '🚽': require('../../assets/preg-mood-tired.png'),
  '😊': require('../../assets/preg-mood-good.png'),
  '🫠': require('../../assets/preg-mood-pain.png'),
  '😖': require('../../assets/preg-mood-pain.png'),
  '💩': require('../../assets/preg-mood-pain.png'),
  '📚': require('../../assets/preg-bag.png'),
  '📝': require('../../assets/child-diary.png'),
  '🎉': require('../../assets/preg-ribbon.png'),
  '🏠': require('../../assets/mascot-happy.png'),
  '⭐': require('../../assets/preg-ribbon.png'),
};

export const DEFAULT_PREG_ICON: ImageSourcePropType = require('../../assets/preg-leaf.png');

/**
 * emoji 를 받아서 매핑된 3D clay 이미지로 렌더. 매핑 없으면 default.
 * 라벨/텍스트는 별도 표시 — 이 컴포넌트는 이미지만 그림.
 */
export function EmojiIcon({
  emoji,
  size,
}: {
  emoji?: string | null;
  size: number;
}) {
  const src = (emoji && PREG_EMOJI_ICON[emoji]) || DEFAULT_PREG_ICON;
  return (
    <Image
      source={src}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
