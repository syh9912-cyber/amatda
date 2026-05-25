/**
 * Firebase Storage 정리 헬퍼.
 *
 * 회원 탈퇴/자녀 삭제 시 Firestore 문서만 지우고 Storage 파일을 남기면
 * PIPA 21조(파기 의무) + privacy.html 의 "탈퇴 시 즉시 삭제" 고지 위반.
 * 모든 영역에 통일된 정리 로직을 제공.
 */
import * as admin from 'firebase-admin';
import { logger } from './logger';

/**
 * 사용자 격리 폴더 — 모든 업로드 라우트가 `{prefix}/{userId}/...` 패턴을 사용.
 * 신규 prefix 추가 시 이 배열에 함께 등록할 것.
 */
const STORAGE_USER_PREFIXES = [
  'pregnancy',
  'profiles',
  'momstagram',
  'diary',
  'album',
  'lullaby',
  'growth_albums',
];

/**
 * 사용자 격리 storage 폴더(`{prefix}/{userId}/`) 전체를 삭제.
 * 회원 탈퇴 시 호출. best-effort — 한 prefix 실패해도 나머지는 계속 삭제.
 */
export async function deleteUserStorageFiles(userId: string): Promise<void> {
  if (!userId) return;
  const bucket = admin.storage().bucket();
  await Promise.all(
    STORAGE_USER_PREFIXES.map(async (prefix) => {
      try {
        await bucket.deleteFiles({ prefix: `${prefix}/${userId}/`, force: true });
      } catch (err) {
        logger.error(`storageCleanup/prefix-${prefix}`, err);
      }
    }),
  );
}

/**
 * Firebase Storage download URL 또는 gs:// 경로에서 object path 추출.
 * 지원 형식:
 *   - https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
 *   - https://storage.googleapis.com/{bucket}/{path}
 *   - gs://{bucket}/{path}
 *   - {path} (bare path — 그대로 반환)
 */
function parseStoragePath(url: string, bucketName: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    if (url.startsWith('gs://')) {
      const rest = url.slice(5);
      const idx = rest.indexOf('/');
      if (idx < 0) return null;
      return rest.slice(idx + 1);
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url);
      if (u.hostname === 'firebasestorage.googleapis.com') {
        const m = u.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)$/);
        if (m) return decodeURIComponent(m[1]);
      }
      if (u.hostname === 'storage.googleapis.com') {
        const parts = u.pathname.replace(/^\//, '').split('/');
        if (parts[0] === bucketName) return parts.slice(1).join('/');
        return parts.slice(1).join('/');
      }
      return null;
    }
    // bare path (`album/uid/xxxx.jpg`)
    return url;
  } catch {
    return null;
  }
}

/**
 * URL/path 배열에서 storage object 들을 best-effort 로 삭제.
 * 자녀 삭제 시 albumPhotos/momstagram 등의 uri 들을 모아 호출.
 */
export async function deleteStorageFilesFromUrls(urls: Array<string | null | undefined>): Promise<void> {
  if (urls.length === 0) return;
  const bucket = admin.storage().bucket();
  const paths = new Set<string>();
  for (const url of urls) {
    if (!url) continue;
    const p = parseStoragePath(url, bucket.name);
    if (p) paths.add(p);
  }
  await Promise.all(
    Array.from(paths).map(async (p) => {
      try {
        await bucket.file(p).delete();
      } catch (err: unknown) {
        // 이미 삭제됐거나 존재하지 않으면 무시 (404)
        const code = (err as { code?: number })?.code;
        if (code === 404) return;
        logger.error('storageCleanup/file-delete', err);
      }
    }),
  );
}
