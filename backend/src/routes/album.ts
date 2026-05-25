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
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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
import { z } from 'zod';
import { parseBody } from '../utils/validate';

const PhotoBodySchema = z.object({
  childId: z.string().min(1).max(128),
  uri: z.string().url().max(2048),
  printUrl: z.string().url().max(2048).optional(),
  milestone: z.string().max(100).optional(),
  milestoneEmoji: z.string().max(8).optional(),
  milestoneColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  memo: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다').optional(),
});

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
    const body = parseBody(req, res, PhotoBodySchema);
    if (!body) return;
    const { childId, uri, printUrl, milestone, milestoneEmoji, milestoneColor, memo, date } = body;

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

    // dual-write: 옛 milestonePhotos + 새 albumPhotos (같은 doc ID)
    // 옛 컬렉션은 dual-read fallback 안전망. 검증 후 단계적 제거.
    const albumDoc = {
      userId,
      childId,
      phase: 'baby' as const,
      uri,
      printUrl: printUrl || uri,
      mediaType: 'photo' as const,
      title: milestone || '추억',
      content: memo || null,
      milestoneType: null,
      milestoneEmoji: milestoneEmoji || null,
      milestoneColor: milestoneColor || null,
      date: photoDate,
      monthKey,
      createdAt: Timestamp.fromDate(new Date(now)),
      week: null,
      pregnancyType: null,
    };

    const batch = collections.children.firestore.batch();
    batch.set(collections.milestonePhotos.doc(id), photo);
    batch.set(collections.albumPhotos.doc(id), albumDoc);
    await batch.commit();

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
    // dual-read: 새 albumPhotos에서 phase='baby'만 읽음 (출생 후 사진)
    // 응답 형식은 옛 milestonePhotos 호환 유지 (uri/milestone/memo 필드명)
    const snap = await collections.albumPhotos
      .where('childId', '==', childId)
      .limit(1000)
      .get();

    const photos = snap.docs
      .filter((d) => (d.data() as Record<string, unknown>).phase === 'baby')
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        const ca = data.createdAt;
        let createdAtIso: string | undefined;
        if (typeof ca === 'string') createdAtIso = ca;
        else if (ca && typeof (ca as { toDate?: () => Date }).toDate === 'function') {
          createdAtIso = (ca as { toDate: () => Date }).toDate().toISOString();
        }
        return {
          id: d.id,
          userId: data.userId,
          childId: data.childId,
          uri: data.uri,
          printUrl: data.printUrl,
          milestone: data.title,                 // 새 title → 옛 milestone 매핑
          milestoneEmoji: data.milestoneEmoji,
          milestoneColor: data.milestoneColor,
          memo: data.content,                    // 새 content → 옛 memo 매핑
          date: data.date,
          monthKey: data.monthKey,
          createdAt: createdAtIso,
        };
      })
      .sort((a, b) => {
        const da = (a.date as string) ?? '';
        const db = (b.date as string) ?? '';
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

    // 소유권 확인: 새 albumPhotos 우선, 없으면 옛 milestonePhotos에서
    const albumDoc = await collections.albumPhotos.doc(photoId).get();
    const oldDoc = await collections.milestonePhotos.doc(photoId).get();

    const ownerInAlbum = albumDoc.exists
      ? (albumDoc.data() as Record<string, unknown>).userId
      : null;
    const ownerInOld = oldDoc.exists
      ? (oldDoc.data() as Record<string, unknown>).userId
      : null;

    if (!albumDoc.exists && !oldDoc.exists) {
      error(res, '사진을 찾을 수 없습니다', 404);
      return;
    }
    if ((ownerInAlbum && ownerInAlbum !== userId) || (ownerInOld && ownerInOld !== userId)) {
      error(res, '사진을 찾을 수 없습니다', 404);
      return;
    }

    // dual-delete: 양쪽 컬렉션에서 삭제 (atomic)
    const batch = collections.children.firestore.batch();
    if (albumDoc.exists) batch.delete(collections.albumPhotos.doc(photoId));
    if (oldDoc.exists) batch.delete(collections.milestonePhotos.doc(photoId));
    await batch.commit();

    // cascade: 가족피드(posts)에 공유된 글 정리. linkedAlbumId 로 역참조.
    // best-effort — 실패해도 본 사진 삭제는 완료된 상태로 응답.
    try {
      const linkedPosts = await collections.posts
        .where('linkedAlbumId', '==', photoId)
        .limit(50)
        .get();
      if (!linkedPosts.empty) {
        const cascadeBatch = collections.children.firestore.batch();
        linkedPosts.docs.forEach((d) => cascadeBatch.delete(d.ref));
        await cascadeBatch.commit();
        logger.info('album/deletePhoto', `cascade posts deleted=${linkedPosts.size} photoId=${photoId}`);
      }
    } catch (cascadeErr) {
      logger.warn(
        'album/deletePhoto/cascade',
        cascadeErr instanceof Error ? cascadeErr.message : String(cascadeErr),
      );
    }

    success(res, { deleted: true });
  } catch (err) {
    logger.error('album', err);
    error(res, '사진 삭제 중 오류가 발생했습니다', 500);
  }
});

router.patch('/photos/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const photoId = param(req.params.id);
    const { memo, milestone, milestoneEmoji, uri, printUrl } = req.body as {
      memo?: string;
      milestone?: string;
      milestoneEmoji?: string;
      uri?: string;       // 이미지 URL 교체
      printUrl?: string;  // 고화질 URL 교체 (없으면 uri로 대체)
    };

    const albumDoc = await collections.albumPhotos.doc(photoId).get();
    const oldDoc = await collections.milestonePhotos.doc(photoId).get();

    if (!albumDoc.exists && !oldDoc.exists) {
      error(res, '사진을 찾을 수 없습니다', 404);
      return;
    }
    const ownerInAlbum = albumDoc.exists ? (albumDoc.data() as Record<string, unknown>).userId : null;
    const ownerInOld = oldDoc.exists ? (oldDoc.data() as Record<string, unknown>).userId : null;
    if ((ownerInAlbum && ownerInAlbum !== userId) || (ownerInOld && ownerInOld !== userId)) {
      error(res, '권한이 없습니다', 403);
      return;
    }

    // albumPhotos는 content/title 필드명 사용 (milestonePhotos와 다름)
    const albumUpdates: Record<string, unknown> = {};
    if (memo !== undefined) albumUpdates['content'] = memo;
    if (milestone !== undefined) albumUpdates['title'] = milestone;
    if (milestoneEmoji !== undefined) albumUpdates['milestoneEmoji'] = milestoneEmoji;
    if (uri !== undefined) { albumUpdates['uri'] = uri; albumUpdates['printUrl'] = printUrl ?? uri; }

    // milestonePhotos (구 컬렉션)는 memo/milestone 필드명 사용
    const oldUpdates: Record<string, unknown> = {};
    if (memo !== undefined) oldUpdates['memo'] = memo;
    if (milestone !== undefined) oldUpdates['milestone'] = milestone;
    if (milestoneEmoji !== undefined) oldUpdates['milestoneEmoji'] = milestoneEmoji;
    if (uri !== undefined) { oldUpdates['uri'] = uri; oldUpdates['printUrl'] = printUrl ?? uri; }

    if (Object.keys(albumUpdates).length === 0) {
      success(res, { updated: false });
      return;
    }

    const batch = collections.children.firestore.batch();
    if (albumDoc.exists) batch.update(collections.albumPhotos.doc(photoId), albumUpdates);
    if (oldDoc.exists && Object.keys(oldUpdates).length > 0) batch.update(collections.milestonePhotos.doc(photoId), oldUpdates);
    await batch.commit();

    success(res, { updated: true });
  } catch (err) {
    logger.error('album', err);
    error(res, '사진 수정 중 오류가 발생했습니다', 500);
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
          logger.error('album/background-generation', err);
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

  // 통합 컬렉션 albumPhotos에서 단일 쿼리로 읽음 (임신 + 출생후 모두 포함)
  // childId 단일 필드 인덱스만 사용 → JS에서 날짜 필터+정렬
  const snap = await collections.albumPhotos
    .where('childId', '==', childId)
    .limit(1000)
    .get();

  // 날짜 정규화 헬퍼: "YYYY.MM.DD" → "YYYY-MM-DD" (구버전 호환)
  function normDate(d: string): string {
    return d.replace(/\./g, '-');
  }

  const photos: AlbumPhoto[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const isPregnancy = data.phase === 'pregnancy';

    // 사진 없는 것 + 영상은 제외
    const uri = data.uri as string | null;
    const printUrl = (data.printUrl as string | null) || uri;
    if (!uri || !printUrl || data.mediaType === 'video') continue;

    // date 추출 (저장 형식 통일됨, 정규화는 안전망)
    const date = normDate((data.date as string) || '');
    if (!date || date < fromDate || date > toDate) continue;

    // 임신 phase는 milestone 텍스트에 주차 추가
    const week = data.week as number | undefined;
    const title = (data.title as string | undefined) ?? '';
    const content = data.content as string | undefined;

    const photo: AlbumPhoto = {
      printUrl,
      thumbUrl: uri,
      date,
    };
    const milestone = isPregnancy
      ? (week ? `임신 ${week}주차` : (title || '임신기록'))
      : (title || '');
    if (milestone) photo.milestone = milestone;

    const emoji = (data.milestoneEmoji as string | undefined) || (isPregnancy ? '🤰' : undefined);
    if (emoji) photo.milestoneEmoji = emoji;

    const color = (data.milestoneColor as string | undefined) || (isPregnancy ? '#E91E63' : undefined);
    if (color) photo.milestoneColor = color;

    const memo = isPregnancy ? (content || title || '') : (content || '');
    if (memo) photo.memo = memo;

    photos.push(photo);
  }

  // 날짜순 정렬 (임신 → 출산 → 성장 자연스러운 시간순) + 400장 제한
  photos.sort((a, b) => a.date.localeCompare(b.date));
  if (photos.length > 400) photos.length = 400;

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
