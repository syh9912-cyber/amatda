import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { parseBody } from '../utils/validate';

const MAX_POST_CONTENT = 2000;
const MAX_COMMENT_CONTENT = 500;

const PostBodySchema = z.object({
  content: z.string().min(1, '필수입니다').max(MAX_POST_CONTENT, `최대 ${MAX_POST_CONTENT}자`),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  thumbnailUrl: z.string().url().max(2048).nullable().optional(),
  videoUrl: z.string().url().max(2048).nullable().optional(),
  mediaType: z.enum(['image', 'video', 'none']).optional(),
  sourceType: z.enum(['album', 'diary', 'manual']),
  childAge: z.string().max(64).optional(),
  childGender: z.enum(['', 'M', 'F', 'U']).optional(),
  dominantType: z.enum(['', '활동형', '탐구형', '조화형', '분석형', '감성형']).optional(),
  // 마일스톤 정보 — 가족 피드 카드에 일러스트로 표시 (앞에 '🌿' 같은 emoji + 라벨)
  milestone: z.string().max(100).optional(),
  milestoneEmoji: z.string().max(8).optional(),
  // 가족피드 글이 임신앨범/성장앨범의 어떤 record 에서 공유된 건지 역참조용 (cascade delete).
  // album/pregnancy 에서 record 삭제 시 posts.where('linkedAlbumId', '==', recordId) 로 정리.
  linkedAlbumId: z.string().min(1).max(128).optional(),
});

const CommentBodySchema = z.object({
  content: z.string().min(1, '필수입니다').max(MAX_COMMENT_CONTENT, `최대 ${MAX_COMMENT_CONTENT}자`),
});

const router = Router();

/** 유저 문서에서 표시 이름 추출: nickname > 이메일 앞부분 > '익명' */
function getDisplayName(userData: Record<string, unknown> | undefined): string {
  if (!userData) return '익명';
  const nick = userData.nickname as string | undefined;
  if (nick && nick.trim().length > 0) return nick.trim();
  const email = userData.email as string | undefined;
  if (email) {
    const local = email.split('@')[0] || '익명';
    if (local.length <= 3) return local + '***';
    return local.slice(0, 3) + '***';
  }
  return '익명';
}

// POST /posts - 게시글 작성
router.post('/posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const body = parseBody(req, res, PostBodySchema);
    if (!body) return;
    const { content, imageUrl, thumbnailUrl, videoUrl, mediaType, sourceType, childAge, childGender, dominantType, milestone, milestoneEmoji, linkedAlbumId } = body;

    const userDoc = await collections.users.doc(userId).get();
    const userName = getDisplayName(userDoc.exists ? (userDoc.data() as Record<string, unknown>) : undefined);

    const id = genId();
    const now = new Date().toISOString();

    const post = {
      userId,
      userName,
      childAge: childAge || '',
      childGender: childGender || '',
      dominantType: dominantType || '',
      content,
      imageUrl: imageUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      videoUrl: videoUrl || null,
      mediaType: mediaType || (videoUrl ? 'video' : imageUrl ? 'image' : 'none'),
      sourceType,
      // 마일스톤 정보 — PostCard 가 emoji 매핑 일러스트로 표시 (한글 텍스트 fallback 방지)
      milestone: milestone || null,
      milestoneEmoji: milestoneEmoji || null,
      // album/pregnancy 원본 record 와의 연결 — record 삭제 시 cascade 정리에 사용
      linkedAlbumId: linkedAlbumId || null,
      likes: 0,
      commentCount: 0,
      reportCount: 0,
      hidden: false,
      createdAt: now,
      isPublic: true,
    };

    await collections.posts.doc(id).set(post);
    success(res, { id, ...post }, 201);
  } catch (err: unknown) {
    logger.error('route', err);
    error(res, '게시글 작성 중 오류가 발생했습니다', 500);
  }
});

// GET /feed - 가족 피드 (나 + 공동육아 멤버의 게시글만)
router.get('/feed', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const page = Math.max(0, parseInt(req.query.page as string, 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    // 가족 멤버 userId 수집 (나 + 공동육아 초대된 멤버)
    const familyUserIds = [userId];
    try {
      const memberSnap = await collections.familyMembers
        .where('invitedBy', '==', userId)
        .where('status', '==', 'accepted')
        .get();
      memberSnap.docs.forEach((d) => {
        // familyMembers 스키마: 수락자 식별자는 inviteeUserId (userId 필드는 존재하지 않음)
        const memberId = d.data().inviteeUserId as string;
        if (memberId && !familyUserIds.includes(memberId)) familyUserIds.push(memberId);
      });
      // 내가 초대받은 경우도 포함 (내가 inviteeUserId 인 연결)
      const invitedSnap = await collections.familyMembers
        .where('inviteeUserId', '==', userId)
        .where('status', '==', 'accepted')
        .get();
      invitedSnap.docs.forEach((d) => {
        const inviter = d.data().invitedBy as string;
        if (inviter && !familyUserIds.includes(inviter)) familyUserIds.push(inviter);
      });
    } catch { /* familyMembers 없어도 본인 게시글은 표시 */ }

    // 차단된 사용자 목록 — 피드에서 해당 글 제외 (UGC 정책)
    const blockedUserIds = new Set<string>();
    try {
      const blockSnap = await collections.userBlocks
        .where('userId', '==', userId)
        .get();
      blockSnap.docs.forEach((d) => {
        const target = d.data().blockedUserId as string;
        if (target) blockedUserIds.add(target);
      });
    } catch { /* 차단 목록 없어도 진행 */ }

    // 가족 멤버의 게시글만 조회 (Firestore 'in' 최대 30)
    const userChunks: string[][] = [];
    for (let i = 0; i < familyUserIds.length; i += 30) {
      userChunks.push(familyUserIds.slice(i, i + 30));
    }

    // 청크당 최대 200건 hard cap — 페이지가 깊어져도 메모리/Firestore 비용 폭증 방지.
    // page * limit 이 200 을 넘는 영역은 "옛 글" 영역이라 cursor pagination 이 정석이지만
    // 출시 단계에서는 hard cap 으로 안전하게 제한 (출시 후 cursor 도입 별도 작업).
    const FEED_PER_CHUNK_HARD_CAP = 200;
    const fetchPerChunk = Math.min(limit * (page + 1), FEED_PER_CHUNK_HARD_CAP);
    const allDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (const chunk of userChunks) {
      const snap = await collections.posts
        .where('userId', 'in', chunk)
        .orderBy('createdAt', 'desc')
        .limit(fetchPerChunk)
        .get();
      allDocs.push(...snap.docs);
    }

    // 정렬 + 페이지네이션
    allDocs.sort((a, b) => {
      const aTime = a.data().createdAt as string;
      const bTime = b.data().createdAt as string;
      return bTime.localeCompare(aTime);
    });
    // 모더레이션 필터: hidden=true(3회 이상 신고 누적) + 차단된 사용자 제외
    const visibleDocs = allDocs.filter((d) => {
      const data = d.data();
      if (data.hidden === true) return false;
      const authorId = data.userId as string;
      if (blockedUserIds.has(authorId)) return false;
      return true;
    });
    const paginated = visibleDocs.slice(page * limit, (page + 1) * limit);
    const posts = paginated.map((d) => ({ id: d.id, ...d.data() }));

    // 현재 사용자의 좋아요 여부 확인
    const postIds = posts.map((p) => p.id);
    const likedSet = new Set<string>();

    if (postIds.length > 0) {
      // Firestore 'in' 쿼리는 최대 30개까지 지원
      const chunks: string[][] = [];
      for (let i = 0; i < postIds.length; i += 30) {
        chunks.push(postIds.slice(i, i + 30));
      }
      for (const chunk of chunks) {
        const likeSnap = await collections.postLikes
          .where('userId', '==', userId)
          .where('postId', 'in', chunk)
          .get();
        likeSnap.docs.forEach((d) => {
          likedSet.add(d.data().postId as string);
        });
      }
    }

    const feedPosts = posts.map((p) => ({
      ...p,
      isLiked: likedSet.has(p.id),
    }));

    success(res, { posts: feedPosts, page, limit });
  } catch (err: unknown) {
    logger.error('route', err);
    error(res, '피드 조회 중 오류가 발생했습니다', 500);
  }
});

// POST /posts/:id/like - 좋아요 토글
router.post('/posts/:id/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id as string;

    const postRef = collections.posts.doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) {
      error(res, '게시글을 찾을 수 없습니다', 404);
      return;
    }

    // 이미 좋아요 했는지 확인
    const existingLike = await collections.postLikes
      .where('postId', '==', postId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingLike.empty) {
      // 좋아요 취소 — atomic decrement (race-safe)
      const likeDocId = existingLike.docs[0].id;
      await collections.postLikes.doc(likeDocId).delete();
      await postRef.update({ likes: FieldValue.increment(-1) });
      // 응답용 표시값 (UI fallback) — 정확값은 다음 fetch 시 동기화
      const currentLikes = (postDoc.data()!.likes as number) || 0;
      success(res, { liked: false, likes: Math.max(0, currentLikes - 1) });
    } else {
      // 좋아요 — atomic increment (race-safe)
      const likeId = genId();
      await collections.postLikes.doc(likeId).set({
        postId,
        userId,
        createdAt: FieldValue.serverTimestamp(),
      });
      await postRef.update({ likes: FieldValue.increment(1) });
      const currentLikes = (postDoc.data()!.likes as number) || 0;
      success(res, { liked: true, likes: currentLikes + 1 });
    }
  } catch (err: unknown) {
    logger.error('route', err);
    error(res, '좋아요 처리 중 오류가 발생했습니다', 500);
  }
});

// GET /posts/:id/comments - 댓글 조회 (cursor 기반)
router.get('/posts/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const postId = req.params.id as string;
    const page = Math.max(0, parseInt(req.query.page as string, 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const cursor = (req.query.cursor as string | undefined) || undefined;

    const postDoc = await collections.posts.doc(postId).get();
    if (!postDoc.exists) {
      error(res, '게시글을 찾을 수 없습니다', 404);
      return;
    }

    let q = collections.postComments
      .where('postId', '==', postId)
      .orderBy('createdAt', 'asc')
      .limit(limit);

    // cursor = 마지막 문서의 createdAt 값. 있으면 startAfter, 없고 page=0이면 처음부터.
    // legacy offset-page>0 호출은 1페이지로 fallback (offset은 Firestore에서 비효율).
    if (cursor) {
      q = q.startAfter(cursor);
    }

    const snap = await q.get();
    const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc
      ? (lastDoc.data().createdAt as string | undefined) ?? null
      : null;
    success(res, { comments, page, limit, nextCursor });
  } catch (err: unknown) {
    logger.error('route', err);
    error(res, '댓글 조회 중 오류가 발생했습니다', 500);
  }
});

// POST /posts/:id/comments - 댓글 작성
router.post('/posts/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id as string;
    const body = parseBody(req, res, CommentBodySchema);
    if (!body) return;
    const { content } = body;

    const postRef = collections.posts.doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) {
      error(res, '게시글을 찾을 수 없습니다', 404);
      return;
    }

    const userDoc = await collections.users.doc(userId).get();
    const userName = getDisplayName(userDoc.exists ? (userDoc.data() as Record<string, unknown>) : undefined);

    const commentId = genId();
    const now = new Date().toISOString();

    const comment = {
      postId,
      userId,
      userName,
      content,
      createdAt: now,
    };

    await collections.postComments.doc(commentId).set(comment);

    // atomic increment — 동시 댓글 작성 시 카운트 drift 방지
    await postRef.update({ commentCount: FieldValue.increment(1) });
    const currentCount = (postDoc.data()!.commentCount as number) || 0;

    success(res, { id: commentId, ...comment }, 201);
  } catch (err) {
    logger.error('momstagram/comment-create', err);
    error(res, '댓글 작성 중 오류가 발생했습니다', 500);
  }
});

// DELETE /posts/:id - 본인 게시글 삭제
// PATCH /posts/:id - 본인 게시글 수정 (content/category만)
router.patch('/posts/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id as string;
    const { content, category, imageUrl } = req.body as {
      content?: string;
      category?: string;
      imageUrl?: string | null;
    };

    const postDoc = await collections.posts.doc(postId).get();
    if (!postDoc.exists) {
      error(res, '게시글을 찾을 수 없습니다', 404);
      return;
    }
    if (postDoc.data()!.userId !== userId) {
      error(res, '본인의 게시글만 수정할 수 있습니다', 403);
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof content === 'string') updates.content = content;
    if (typeof category === 'string') updates.category = category;
    if (imageUrl !== undefined) {
      if (imageUrl === null) {
        updates.imageUrl = null;
        updates.thumbnailUrl = null;
        updates.mediaType = 'none';
      } else if (typeof imageUrl === 'string' && imageUrl.startsWith('https://')) {
        updates.imageUrl = imageUrl;
        updates.thumbnailUrl = imageUrl;
        updates.mediaType = 'image';
      }
    }

    if (Object.keys(updates).length === 1) {
      error(res, '수정할 내용이 없습니다');
      return;
    }

    await collections.posts.doc(postId).update(updates);
    const updated = await collections.posts.doc(postId).get();
    success(res, { id: postId, ...updated.data() });
  } catch (err: unknown) {
    logger.error('route', err);
    error(res, '게시글 수정 중 오류가 발생했습니다', 500);
  }
});

router.delete('/posts/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id as string;

    const postDoc = await collections.posts.doc(postId).get();
    if (!postDoc.exists) {
      error(res, '게시글을 찾을 수 없습니다', 404);
      return;
    }
    if (postDoc.data()!.userId !== userId) {
      error(res, '본인의 게시글만 삭제할 수 있습니다', 403);
      return;
    }

    // 게시글 관련 좋아요 삭제
    const likesSnap = await collections.postLikes
      .where('postId', '==', postId)
      .get();
    const likeBatch = likesSnap.docs.map((d) =>
      collections.postLikes.doc(d.id).delete()
    );

    // 게시글 관련 댓글 삭제
    const commentsSnap = await collections.postComments
      .where('postId', '==', postId)
      .get();
    const commentBatch = commentsSnap.docs.map((d) =>
      collections.postComments.doc(d.id).delete()
    );

    await Promise.all([...likeBatch, ...commentBatch]);
    await collections.posts.doc(postId).delete();

    success(res, { id: postId, message: '게시글이 삭제되었습니다' });
  } catch (err: unknown) {
    logger.error('route', err);
    error(res, '게시글 삭제 중 오류가 발생했습니다', 500);
  }
});

// GET /my-posts - 내 게시글 조회 (cursor 기반)
router.get('/my-posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const page = Math.max(0, parseInt(req.query.page as string, 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const cursor = (req.query.cursor as string | undefined) || undefined;

    let q = collections.posts
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    // cursor = 마지막 문서의 createdAt 값 (ISO string).
    // legacy offset-page>0은 1페이지로 fallback (Firestore offset 비효율).
    if (cursor) {
      q = q.startAfter(cursor);
    }

    const snap = await q.get();
    const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc
      ? (lastDoc.data().createdAt as string | undefined) ?? null
      : null;
    success(res, { posts, page, limit, nextCursor });
  } catch (err: unknown) {
    logger.error('route', err);
    error(res, '내 게시글 조회 중 오류가 발생했습니다', 500);
  }
});

// ─── UGC 모더레이션 (Apple 1.2 / Google UGC 정책) ───

const REPORT_REASONS = ['abuse', 'ad', 'privacy', 'spam', 'sexual', 'other'] as const;
type ReportReason = typeof REPORT_REASONS[number];
const ReportBodySchema = z.object({
  reason: z.enum(REPORT_REASONS).optional(),
});

/**
 * POST /posts/:id/report — 게시글 신고
 * 같은 사용자 1회만, 누적 3회 → hidden=true 자동 처리.
 */
router.post('/posts/:id/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id as string;
    const body = parseBody(req, res, ReportBodySchema);
    if (!body) return;
    const finalReason: ReportReason = body.reason ?? 'other';

    const postRef = collections.posts.doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) {
      error(res, '게시글을 찾을 수 없습니다', 404);
      return;
    }

    const reportRef = postRef.collection('reports').doc(userId);
    const reportSnap = await reportRef.get();
    if (reportSnap.exists) {
      success(res, { alreadyReported: true });
      return;
    }
    await reportRef.set({
      userId,
      reason: finalReason,
      createdAt: FieldValue.serverTimestamp(),
    });

    await postRef.update({ reportCount: FieldValue.increment(1) });

    const updated = await postRef.get();
    const count = (updated.data()?.reportCount as number | undefined) ?? 0;
    if (count >= 3) {
      await postRef.update({ hidden: true });
    }
    success(res, { reported: true, hidden: count >= 3, reason: finalReason });
  } catch (err) {
    logger.error('momstagram/report', err);
    error(res, '신고 처리 중 오류가 발생했습니다', 500);
  }
});

/**
 * POST /users/:uid/block — 특정 사용자 차단 (해당 사용자 글이 피드에서 제외됨)
 */
router.post('/users/:uid/block', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const blockedUserId = req.params.uid as string;
    if (!blockedUserId || blockedUserId === userId) {
      error(res, '잘못된 요청입니다');
      return;
    }
    const docId = `${userId}_${blockedUserId}`;
    await collections.userBlocks.doc(docId).set({
      userId,
      blockedUserId,
      createdAt: FieldValue.serverTimestamp(),
    });
    success(res, { blocked: true, blockedUserId });
  } catch (err) {
    logger.error('momstagram/block', err);
    error(res, '차단 처리 중 오류가 발생했습니다', 500);
  }
});

/**
 * DELETE /users/:uid/block — 차단 해제
 */
router.delete('/users/:uid/block', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const blockedUserId = req.params.uid as string;
    const docId = `${userId}_${blockedUserId}`;
    await collections.userBlocks.doc(docId).delete();
    success(res, { unblocked: true, blockedUserId });
  } catch (err) {
    logger.error('momstagram/unblock', err);
    error(res, '차단 해제 중 오류가 발생했습니다', 500);
  }
});

/**
 * GET /users/blocked — 내가 차단한 사용자 목록
 */
router.get('/users/blocked', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const snap = await collections.userBlocks.where('userId', '==', userId).get();
    const blocked = snap.docs.map((d) => d.data().blockedUserId as string).filter(Boolean);
    success(res, { blocked });
  } catch (err) {
    logger.error('momstagram/blocked-list', err);
    error(res, '차단 목록 조회 중 오류가 발생했습니다', 500);
  }
});

export default router;
