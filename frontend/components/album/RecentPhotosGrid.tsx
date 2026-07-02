/**
 * RecentPhotosGrid — 시스템 사진 선택 도구 래퍼.
 *
 * Google Play 정책(READ_MEDIA_IMAGES 비핵심/일회성 사용 금지) 준수를 위해
 * 갤러리 직접 접근(expo-media-library)을 제거하고, OS 사진 선택 도구
 * (Android Photo Picker / iOS PHPicker)만 사용한다. 별도 미디어 권한 불필요.
 *
 * 호출부 인터페이스(visible/onClose/onPicked)는 그대로 유지 — album.tsx 무변경.
 *  - 사진 선택됨 → onPicked(uris)  (호출부가 그리드 닫고 후속 처리)
 *  - 취소/없음   → onClose()
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { pickMultipleFromLibrary } from '../../utils/imagePicker';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPicked: (uris: string[]) => void;
}

export function RecentPhotosGrid({ visible, onClose, onPicked }: Props) {
  const { t } = useTranslation();
  // visible 가 false→true 로 바뀔 때 1회만 피커를 연다 (재진입 방지).
  const openedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;

    (async () => {
      try {
        const picked = await pickMultipleFromLibrary(t, { quality: 0.9, selectionLimit: 20 });
        if (picked.length > 0) onPicked(picked.map((p) => p.uri));
        else onClose();
      } catch {
        onClose();
      }
    })();
  }, [visible, onPicked, onClose, t]);

  return null;
}
