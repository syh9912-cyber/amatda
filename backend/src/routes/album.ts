/**
 * GET /api/album/photos/:childId        — 사진 목록 조회
 * POST /api/album/photos               — 사진 메타데이터 저장 (thumb+print URL)
 * DELETE /api/album/photos/:id         — 사진 삭제
 *
 * POST /api/album/generate             — 앨범 PDF 생성 시작 (백그라운드)
 * GET  /api/album/albums/:childId      — 생성된 앨범 목록
 * GET  /api/album/albums/:albumId/status — 생성 상태 폴링
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { logger } from '../utils/logger';
import {
  generateGrowthAlbumPDF,
  uploadAlbumPDF,
  updateAlbumStatus,
  getMilestoneImageBuffer,
  AlbumPhoto,
} from '../services/album.pdf.service';

const router = Router();

// ─── 소유권 확인 헬퍼 ────────────────────────────────────────────
async function verifyChildOwnership(childId: string, userId: string): Promise<boolean> {
  if (!childId || typeof childId !== 'string') return false;
  const doc = await collections.children.doc(childId).get();
  return doc.exists && (doc.data() as Record<string, unknown>).userId === userId;
}

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0] : p;
}

// ════════════════════════════════════════════════════════════════
// 사진 CRUD
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/album/photos
 * 사진 메타데이터 저장
 * body: { childId, uri (thumb URL), printUrl, milestone?, milestoneEmoji?, memo?, date? }
 */
router.post('/photos', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { childId, uri, printUrl, milestone, milestoneEmoji, milestoneColor, memo, date } = req.body as {
      childId: string;
      uri: string;        // thumbUrl (표시용)
      printUrl?: string;  // 1800px 인쇄용 (없으면 uri 사용)
      milestone?: string;
      milestoneEmoji?: string;
      milestoneColor?: string; // 카테고리 색상 (#RRGGBB)
      memo?: string;
      date?: string;
    };

    if (!childId || !uri) {
      error(res, 'childId와 uri는 필수입니다');
      return;
    }

    if (!await verifyChildOwnership(childId, userId)) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    const id = genId();
    const now = new Date().toISOString();
    const photoDate = date || now.slice(0, 10);
    // 월 인덱스 (YYYY-MM): 앨범 생성 시 월별 정렬에 사용
    const monthKey = photoDate.slice(0, 7);

    const photo = {
      userId,
      childId,
      uri,                                      // thumbUrl (앱 표시용)
      printUrl: printUrl || uri,                // print 없으면 thumb fallback
      milestone: milestone || null,
      milestoneEmoji: milestoneEmoji || null,
      milestoneColor: milestoneColor || null,   // 카테고리 색상 (PDF 배지용)
      memo: memo || null,
      date: photoDate,
      monthKey,
      createdAt: now,
    };

    await collections.milestonePhotos.doc(id).set(photo);
    success(res, { id, ...photo }, 201);
  } catch (err) {
    logger.error('album', err);
    error(res, '사진 저장 중 오류가 발생했습니다', 500);
  }
});

/**
 * GET /api/album/photos/:childId
 * 아이별 사진 목록 (최신순, 최대 1000장)
 */
router.get('/photos/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const childId = param(req.params.childId);

    if (!await verifyChildOwnership(childId, userId)) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    // orderBy 없이 childId 단일 필드 인덱스만 사용 → JS에서 정렬
    // (복합 인덱스 의존 시 빌드 중 에러로 사진 목록이 비어 보이는 문제 방지)
    const snap = await collections.milestonePhotos
      .where('childId', '==', childId)
      .limit(1000)
      .get();

    const photos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const da = ((a as Record<string, unknown>).date as string) ?? '';
        const db = ((b as Record<string, unknown>).date as string) ?? '';
        return db.localeCompare(da); // 최신순
      });
    success(res, photos);
  } catch (err) {
    logger.error('album', err);
    error(res, '사진 목록 조회 중 오류가 발생했습니다', 500);
  }
});

/**
 * DELETE /api/album/photos/:id
 * 사진 삭제 (소유권 확인)
 */
router.delete('/photos/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const photoId = param(req.params.id);

    const doc = await collections.milestonePhotos.doc(photoId).get();
    if (!doc.exists || (doc.data() as Record<string, unknown>).userId !== userId) {
      error(res, '사진을 찾을 수 없습니다', 404);
      return;
    }

    await collections.milestonePhotos.doc(photoId).delete();
    success(res, { deleted: true });
  } catch (err) {
    logger.error('album', err);
    error(res, '사진 삭제 중 오류가 발생했습니다', 500);
  }
});

// ════════════════════════════════════════════════════════════════
// 앨범 PDF 생성
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/album/generate
 * 앨범 PDF 생성 시작 (백그라운드 비동기)
 * body: { childId, title, dateFrom, dateTo }
 *   dateFrom/dateTo: "YYYY-MM" 형식
 *
 * 즉시 { albumId, status: "generating" } 반환
 * → 프론트는 GET /albums/:albumId/status 로 폴링
 */
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { childId, title, dateFrom, dateTo } = req.body as {
      childId: string;
      title?: string;
      dateFrom: string; // "2024-01"
      dateTo: string;   // "2024-12"
    };

    if (!childId || !dateFrom || !dateTo) {
      error(res, 'childId, dateFrom, dateTo는 필수입니다');
      return;
    }

    if (!await verifyChildOwnership(childId, userId)) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    // 날짜 범위 검증
    // 최대 84개월(7년, 초등 입학 전까지) — 사진은 최대 400장으로 제한하므로 PDF 크기 안전
    const [fromYear, fromMon] = dateFrom.split('-').map(Number);
    const [toYear, toMon] = dateTo.split('-').map(Number);
    const monthDiff = (toYear - fromYear) * 12 + (toMon - fromMon);
    if (monthDiff < 0 || monthDiff > 84) {
      error(res, '기간은 최대 84개월(7년)까지 설정 가능합니다');
      return;
    }

    // 아이 이름 조회
    const childDoc = await collections.children.doc(childId).get();
    const childName = (childDoc.data() as Record<string, unknown>)?.name as string || '아이';

    // 앨범 문서 생성 (상태: generating)
    const albumId = genId();
    const now = new Date().toISOString();
    await collections.growthAlbums.doc(albumId).set({
      userId,
      childId,
      childName,
      title: title || `${childName} 성장앨범 ${dateFrom}~${dateTo}`,
      dateFrom,
      dateTo,
      status: 'generating',
      pdfUrl: null,
      pageCount: null,
      photoCount: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    // 즉시 응답 — 생성은 백그라운드
    success(res, { albumId, status: 'generating' });

    // ── 백그라운드 PDF 생성 (응답 후 실행) ──────────────────────
    setImmediate(() => {
      generateAlbumInBackground(albumId, userId, childId, childName, dateFrom, dateTo, monthDiff + 1)
        .catch((err) => {
          console.error('[Album] Background generation failed:', err);
          updateAlbumStatus(albumId, 'error', {
            errorMessage: err instanceof Error ? err.message : '알 수 없는 오류',
          }).catch(() => {});
        });
    });
  } catch (err) {
    logger.error('album', err);
    error(res, '앨범 생성 시작 중 오류가 발생했습니다', 500);
  }
});

/**
 * 백그라운드 앨범 생성 로직
 * - Firestore에서 해당 기간 사진 조회
 * - PDF 생성
 * - Storage 업로드
 * - 상태 업데이트
 */
async function generateAlbumInBackground(
  albumId: string,
  userId: string,
  childId: string,
  childName: string,
  dateFrom: string,
  dateTo: string,
  totalMonths: number,
): Promise<void> {
  // 기간 내 사진 조회 (printUrl 있는 것 우선, date 오름차순)
  // dateFrom: "2024-01" → "2024-01-01", dateTo: "2024-12" → 실제 마지막 날 (2024-12-31)
  const fromDate = `${dateFrom}-01`;
  // 해당 월의 실제 마지막 날 계산 (2월 28/29일, 30일 월 등 정확히 처리)
  const [toYear, toMon] = dateTo.split('-').map(Number);
  const lastDay = new Date(toYear, toMon, 0).getDate(); // day 0 = 전월 마지막날
  const toDate = `${dateTo}-${String(lastDay).padStart(2, '0')}`;

  // childId 단일 필드 인덱스만 사용 → JS에서 날짜 필터+정렬
  // 이유1: 복합 인덱스 빌드 중 에러 방지
  // 이유2: "YYYY.MM.DD"(점) 포맷 구버전 사진도 포함
  const snap = await collections.milestonePhotos
    .where('childId', '==', childId)
    .limit(1000)
    .get();

  // 날짜 정규화 헬퍼: "YYYY.MM.DD" → "YYYY-MM-DD"
  function normDate(d: string): string {
    return d.replace(/\./g, '-');
  }

  const milestonePhotos: AlbumPhoto[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      printUrl: (data.printUrl as string) || (data.uri as string),
      thumbUrl: (data.uri as string),
      date: normDate((data.date as string) || ''),
      milestone: data.milestone as string | undefined,
      milestoneEmoji: data.milestoneEmoji as string | undefined,
      milestoneColor: data.milestoneColor as string | undefined,
      memo: data.memo as string | undefined,
    };
  }).filter((p) => {
    if (!p.printUrl || !p.date) return false;
    return p.date >= fromDate && p.date <= toDate;
  });

  // ── 임신기록 자동 병합: pregnancyRecords의 사진을 앨범에 포함 ──
  // 출산 후에도 임신 시절 기록이 이어져 하나의 앨범이 되게 함
  const pregSnap = await collections.pregnancyRecords
    .where('childId', '==', childId)
    .limit(500)
    .get();

  const pregnancyPhotos: AlbumPhoto[] = [];
  for (const d of pregSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    const mediaUri = data.mediaUri as string | undefined;
    const mediaType = data.mediaType as string | undefined;
    if (!mediaUri || mediaType === 'video') continue;

    let dateStr = '';
    const ca = data.createdAt as { toDate?: () => Date } | string | undefined;
    if (typeof ca === 'string') dateStr = ca.slice(0, 10);
    else if (ca && typeof ca.toDate === 'function') dateStr = ca.toDate().toISOString().slice(0, 10);
    if (!dateStr || dateStr < fromDate || dateStr > toDate) continue;

    const week = data.week as number | undefined;
    const title = (data.title as string | undefined) ?? '';
    const content = data.content as string | undefined;

    pregnancyPhotos.push({
      printUrl: mediaUri,
      thumbUrl: mediaUri,
      date: dateStr,
      milestone: week ? `임신 ${week}주차` : (title || '임신기록'),
      milestoneEmoji: (data.milestoneEmoji as string | undefined) || '🤰',
      milestoneColor: '#E91E63',
      memo: content || title || undefined,
    });
  }

  // 병합 + 날짜순 정렬 (임신 → 출산 → 성장 자연스럽게 이어짐)
  const photos: AlbumPhoto[] = [...pregnancyPhotos, ...milestonePhotos]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 400);

  if (photos.length === 0) {
    await updateAlbumStatus(albumId, 'error', { errorMessage: '해당 기간에 저장된 사진이 없습니다' });
    return;
  }

  // PDF 생성 (표지 + 본문 + 마지막 페이지)
  const pdfBuffer = await generateGrowthAlbumPDF({
    childName,
    dateFrom,
    dateTo,
    photos,
    totalMonths,
  });

  // Storage 업로드
  const pdfUrl = await uploadAlbumPDF(userId, childId, albumId, pdfBuffer);

  // 페이지 수 계산: 표지 + 본문 + 마지막 = ceil(photos/4) + 2
  const pageCount = Math.ceil(photos.length / 4) + 2;

  // 완료 상태 업데이트
  await updateAlbumStatus(albumId, 'ready', {
    pdfUrl,
    pageCount,
    photoCount: photos.length,
    completedAt: new Date().toISOString(),
  });

  console.log(`[Album] Generated albumId=${albumId}, ${photos.length} photos, ${pageCount} pages`);
}

/**
 * GET /api/album/albums/:childId
 * 아이별 생성된 앨범 목록 (최신순)
 */
router.get('/albums/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const childId = param(req.params.childId);

    if (!await verifyChildOwnership(childId, userId)) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    // orderBy 없이 JS 정렬 (복합 인덱스 의존 방지)
    const snap = await collections.growthAlbums
      .where('childId', '==', childId)
      .limit(50)
      .get();

    const albums = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const da = ((a as Record<string, unknown>).createdAt as string) ?? '';
        const db = ((b as Record<string, unknown>).createdAt as string) ?? '';
        return db.localeCompare(da); // 최신순
      });
    success(res, albums);
  } catch (err) {
    logger.error('album', err);
    error(res, '앨범 목록 조회 중 오류가 발생했습니다', 500);
  }
});

/**
 * DELETE /api/album/albums/:albumId
 * 앨범 삭제 (소유권 확인)
 */
router.delete('/albums/:albumId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const albumId = param(req.params.albumId);

    const doc = await collections.growthAlbums.doc(albumId).get();
    if (!doc.exists || (doc.data() as Record<string, unknown>).userId !== userId) {
      error(res, '앨범을 찾을 수 없습니다', 404);
      return;
    }

    await collections.growthAlbums.doc(albumId).delete();
    success(res, { deleted: true });
  } catch (err) {
    logger.error('album', err);
    error(res, '앨범 삭제 중 오류가 발생했습니다', 500);
  }
});

/**
 * GET /api/album/albums/:albumId/status
 * 앨범 생성 상태 폴링 (프론트에서 3~5초마다 호출)
 * 응답: { status: 'generating' | 'ready' | 'error', pdfUrl?, pageCount?, photoCount? }
 */
router.get('/albums/:albumId/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const albumId = param(req.params.albumId);

    const doc = await collections.growthAlbums.doc(albumId).get();
    if (!doc.exists || (doc.data() as Record<string, unknown>).userId !== userId) {
      error(res, '앨범을 찾을 수 없습니다', 404);
      return;
    }

    const data = doc.data() as Record<string, unknown>;
    success(res, {
      albumId,
      status: data.status,
      pdfUrl: data.pdfUrl || null,
      pageCount: data.pageCount || null,
      photoCount: data.photoCount || null,
      title: data.title,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      completedAt: data.completedAt || null,
      errorMessage: data.errorMessage || null,
    });
  } catch (err) {
    logger.error('album', err);
    error(res, '앨범 상태 조회 중 오류가 발생했습니다', 500);
  }
});

/**
 * GET /api/album/milestone-image?label=첫_울음
 * 마일스톤 PNG 이미지 서비스 (인증 불필요 — 정적 에셋, 개인정보 없음)
 * expo-print HTML 내 <img> src 로 직접 사용
 */
router.get('/milestone-image', async (req: Request, res: Response) => {
  const label = req.query.label;
  if (!label || typeof label !== 'string' || label.length > 100) {
    res.status(400).end();
    return;
  }
  const buf = getMilestoneImageBuffer(label);
  if (!buf) {
    res.status(404).end();
    return;
  }
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.end(buf);
});

export default router;
