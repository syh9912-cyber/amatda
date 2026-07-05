import type { TFunction } from 'i18next';

/**
 * 모유 좌/우 note 처리 유틸.
 *
 * 저장 컨벤션: TrackerRecord.note 에 "작성 당시 UI 언어의 라벨"이 그대로 저장된다
 * (수동 경로가 t('babyTracker.side.left') 값을 저장 — ko '왼쪽' / ja '左' / zh '左邊').
 * 따라서 판별·집계·표시 모두 세 언어 라벨을 전부 인식해야 한다.
 */
export type BreastSide = 'left' | 'right';

const LEFT_LABELS = ['왼쪽', '左', '左邊'];
const RIGHT_LABELS = ['오른쪽', '右', '右邊'];

/** note 문자열 → 좌/우 판별 (side 라벨이 아니면 null) */
export function sideFromNote(note?: string | null): BreastSide | null {
  if (!note) return null;
  const v = note.trim();
  if (LEFT_LABELS.includes(v)) return 'left';
  if (RIGHT_LABELS.includes(v)) return 'right';
  return null;
}

/** side → 현재 표시 언어 라벨 */
export function sideLabel(t: TFunction, side: BreastSide): string {
  return side === 'left' ? t('babyTracker.side.left') : t('babyTracker.side.right');
}

/** note 가 side 라벨이면 현재 언어로 번역해 반환, 아니면 원문 그대로 (표시용) */
export function displaySideNote(t: TFunction, note?: string | null): string {
  const side = sideFromNote(note);
  return side ? sideLabel(t, side) : (note ?? '');
}
