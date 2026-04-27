/**
 * 성장 앨범 사진 업로드 유틸리티
 *
 * 업로드 흐름:
 *   1. expo-image-manipulator로 두 버전 생성 (디바이스에서 처리, 모바일 데이터 절약)
 *      - thumb:  400px, JPEG 75%  → 앱 피드/타임라인 표시 (~50KB)
 *      - print: 1800px, JPEG 88%  → A4 인쇄용 (~500KB)
 *   2. thumb 업로드 → Firebase Storage growth_thumb/{childId}/
 *   3. print 업로드 → Firebase Storage growth_print/{childId}/
 *   4. 두 URL 반환 → 메타데이터 저장 시 사용
 *
 * 화질: 1800px는 A4 2×2 그리드 한 칸(9cm×9cm) 300DPI 인쇄에 충분
 * 원본(4000px+) → 인쇄에 필요한 것보다 2배 이상 → 줄여도 육안 차이 없음
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { API_URL } from './api';
import { useAuthStore } from '../stores/authStore';

export interface UploadedPhotoUrls {
  thumbUrl: string;   // 400px — 앱 표시용
  printUrl: string;   // 1800px — 인쇄용
}

// ─── 단일 버전 업로드 ────────────────────────────────────────────
async function uploadResized(uri: string, folder: string): Promise<string> {
  const token = useAuthStore.getState().accessToken;
  const filename = `photo_${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append('file', {
    uri,
    name: filename,
    type: 'image/jpeg',
  } as unknown as Blob);
  formData.append('folder', folder);

  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).error || '업로드 실패');
  }

  const json = await res.json() as { data?: { url?: string } };
  const url = json.data?.url;
  if (!url) throw new Error('URL을 받지 못했습니다');
  return url;
}

/**
 * 사진 한 장 → thumb + print 두 버전 생성 후 업로드
 * @param localUri   카메라/갤러리에서 선택한 로컬 URI
 * @param childId    아이 ID (Storage 경로 분리용)
 */
export async function uploadGrowthPhoto(
  localUri: string,
  childId: string,
): Promise<UploadedPhotoUrls> {
  // ── 1. 두 버전 리사이즈 (병렬) ────────────────────────────────
  const [thumbResult, printResult] = await Promise.all([
    ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 400 } }],       // 가로 400px, 세로 비율 유지
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    ),
    ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1800 } }],      // 가로 1800px, 세로 비율 유지
      { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
    ),
  ]);

  // ── 2. 두 버전 업로드 (병렬) ──────────────────────────────────
  const [thumbUrl, printUrl] = await Promise.all([
    uploadResized(thumbResult.uri, `growth_thumb/${childId}`),
    uploadResized(printResult.uri, `growth_print/${childId}`),
  ]);

  return { thumbUrl, printUrl };
}
