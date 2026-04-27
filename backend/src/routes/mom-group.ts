import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, db, genId } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

const router = Router();

/* ================================================================== */
/*  출산맘방 — 예정월별 그룹 게시판                                    */
/*  groupKey = YYYY-MM (출산예정일 또는 출생월)                        */
/* ================================================================== */

const MAX_TITLE_LEN = 50;
const MAX_CONTENT_LEN = 1000;
const MAX_COMMENT_LEN = 300;
const POSTS_PER_DAY = 10;
const COMMENTS_PER_DAY = 30;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 30;

type Category = 'question' | 'chat' | 'info' | 'worry' | 'celebration';
const VALID_CATEGORIES: readonly Category[] = ['question', 'chat', 'info', 'worry', 'celebration'] as const;
function isValidCategory(c: unknown): c is Category {
  return typeof c === 'string' && (VALID_CATEGORIES as readonly string[]).includes(c);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickNickname(displayName: string | undefined | null, userId: string): string {
  const base = (displayName ?? '').trim();
  if (base) return base.length > 10 ? base.slice(0, 10) + '…' : base;
  return `엄마${userId.slice(-4)}`;
}

/** 같은 그룹 내에서 같은 사용자는 항상 같은 4자리 익명번호를 갖도록 */
function anonTagFor(userId: string, groupKey: string): string {
  const h = createHash('sha256').update(`${userId}:${groupKey}`).digest('hex');
  return `익명맘#${h.slice(0, 4).toUpperCase()}`;
}

async function checkRateLimit(userId: string, kind: 'post' | 'comment'): Promise<boolean> {
  const limit = kind === 'post' ? POSTS_PER_DAY : COMMENTS_PER_DAY;
  const docId = `momgroup_${kind}_${userId}_${todayKey()}`;
  const ref = collections.rateLimits.doc(docId);
  const snap = await ref.get();
  const count = snap.exists ? ((snap.data()?.count as number | undefined) ?? 0) : 0;
  if (count >= limit) return false;
  await ref.set({ count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return true;
}

const REGION_KEYS = new Set([
  'seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan', 'sejong',
  'gyeonggi', 'gangwon', 'chungbuk', 'chungnam',
  'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju',
]);
const TOPIC_KEYS = new Set(['breastfeeding', 'weaning', 'sleep', 'working']);

function isValidGroupKey(key: string): boolean {
  if (/^\d{4}-\d{2}$/.test(key)) return true;
  if (key.startsWith('region:')) return REGION_KEYS.has(key.slice(7));
  if (key.startsWith('topic:')) return TOPIC_KEYS.has(key.slice(6));
  return false;
}

/**
 * GET /api/mom-group/posts
 *   ?groupKey=2026-08           (필수, mine=true 일 땐 optional)
 *   &category=question
 *   &sort=popular|recent
 *   &page=1                     (1-indexed)
 *   &pageSize=20                (<=30)
 *   &q=검색어                    (제목/내용/닉네임)
 *   &mine=true                  (본인 글만)
 *   &limit=30                   (legacy, page/pageSize 없을 때)
 *
 *   Response: { posts: Post[], page, pageSize, total, totalPages }
 *   Legacy mode (limit only): Post[]
 */
router.get('/posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const groupKey = (req.query.groupKey as string) ?? '';
    const mine = req.query.mine === 'true';

    if (!mine && !isValidGroupKey(groupKey)) {
      error(res, 'groupKey 형식이 올바르지 않습니다');
      return;
    }

    const category = req.query.category as string | undefined;
    const sort = (req.query.sort as string) === 'popular' ? 'popular' : 'recent';
    const searchQ = ((req.query.q as string) ?? '').trim().toLowerCase();
    const qFieldRaw = (req.query.qField as string) ?? 'all';
    const qField: 'all' | 'title' | 'content' | 'nickname' =
      qFieldRaw === 'title' || qFieldRaw === 'content' || qFieldRaw === 'nickname'
        ? qFieldRaw
        : 'all';

    const hasPagination = req.query.page !== undefined || req.query.pageSize !== undefined;
    const legacyLimit = Math.min(Number(req.query.limit ?? 30), 50);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE);

    // Firestore query — 'mine'이면 userId 필터, 아니면 groupKey 필터
    let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    if (mine) {
      q = collections.momGroupPosts.where('userId', '==', req.userId!);
    } else {
      q = collections.momGroupPosts
        .where('groupKey', '==', groupKey)
        .where('hidden', '==', false);
    }
    if (category && isValidCategory(category)) {
      q = q.where('category', '==', category);
    }

    // 검색/페이징을 위해 충분히 로드 (최대 500개)
    const snap = await q.limit(500).get();

    let posts = snap.docs.map((d) => {
      const data = d.data();
      const ca = data.createdAt as { toDate?: () => Date } | undefined;
      const ua = data.updatedAt as { toDate?: () => Date } | undefined;
      return {
        id: d.id,
        groupKey: data.groupKey as string,
        userId: data.userId as string,
        nickname: data.nickname as string,
        category: (data.category as Category | undefined) ?? 'chat',
        anonymous: (data.anonymous as boolean | undefined) ?? false,
        title: (data.title as string | undefined) ?? '',
        content: data.content as string,
        imageUrl: (data.imageUrl as string | null | undefined) ?? null,
        likeCount: (data.likeCount as number | undefined) ?? 0,
        commentCount: (data.commentCount as number | undefined) ?? 0,
        viewCount: (data.viewCount as number | undefined) ?? 0,
        hidden: (data.hidden as boolean | undefined) ?? false,
        isEdited: (data.isEdited as boolean | undefined) ?? false,
        createdAt: ca?.toDate?.().toISOString() ?? '',
        updatedAt: ua?.toDate?.().toISOString() ?? '',
        isMine: data.userId === req.userId,
      };
    });

    // mine 모드에선 hidden도 보여줌 (내 글 숨겨져도 확인 가능)
    if (!mine) posts = posts.filter((p) => !p.hidden);

    // 검색 필터 (제목/내용/작성자, 또는 전체)
    if (searchQ) {
      posts = posts.filter((p) => {
        if (qField === 'title') return p.title.toLowerCase().includes(searchQ);
        if (qField === 'content') return p.content.toLowerCase().includes(searchQ);
        if (qField === 'nickname') return p.nickname.toLowerCase().includes(searchQ);
        return (
          p.title.toLowerCase().includes(searchQ) ||
          p.content.toLowerCase().includes(searchQ) ||
          p.nickname.toLowerCase().includes(searchQ)
        );
      });
    }

    if (sort === 'popular') {
      posts.sort((a, b) => {
        const pb = b.likeCount * 2 + b.commentCount;
        const pa = a.likeCount * 2 + a.commentCount;
        if (pb !== pa) return pb - pa;
        return b.createdAt.localeCompare(a.createdAt);
      });
    } else {
      posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    if (!hasPagination) {
      success(res, posts.slice(0, legacyLimit));
      return;
    }

    const total = posts.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const paged = posts.slice(start, start + pageSize);

    success(res, { posts: paged, page, pageSize, total, totalPages });
  } catch (err) {
    logger.error('mom-group:listPosts', err, { userId: req.userId, groupKey: req.query.groupKey });
    error(res, '게시글 조회 중 오류가 발생했습니다', 500);
  }
});

/** POST /api/mom-group/posts { groupKey, title, content, category, anonymous?, imageUrl? } */
router.post('/posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { groupKey, title, content, category, anonymous, imageUrl } = req.body as {
      groupKey?: string; title?: string; content?: string; category?: string; anonymous?: boolean; imageUrl?: string;
    };
    if (!groupKey || !isValidGroupKey(groupKey)) {
      error(res, 'groupKey가 필요합니다');
      return;
    }
    if (!category || !isValidCategory(category)) {
      error(res, '카테고리를 선택해주세요 (질문·수다·정보·고민·축하)');
      return;
    }
    const titleText = (title ?? '').trim();
    if (!titleText) { error(res, '제목을 입력해주세요'); return; }
    if (titleText.length > MAX_TITLE_LEN) { error(res, `제목은 ${MAX_TITLE_LEN}자 이하로 작성해주세요`); return; }

    const body = (content ?? '').trim();
    if (!body) { error(res, '내용을 입력해주세요'); return; }
    if (body.length > MAX_CONTENT_LEN) { error(res, `내용은 ${MAX_CONTENT_LEN}자 이하로 작성해주세요`); return; }

    const ok = await checkRateLimit(req.userId!, 'post');
    if (!ok) { error(res, `하루 게시글은 ${POSTS_PER_DAY}개까지 작성할 수 있어요`, 429); return; }

    const isAnon = Boolean(anonymous);
    let nickname: string;
    if (isAnon) {
      nickname = anonTagFor(req.userId!, groupKey);
    } else {
      const userDoc = await collections.users.doc(req.userId!).get();
      const userNickname = userDoc.exists ? (userDoc.data()?.nickname as string | undefined) : undefined;
      nickname = pickNickname(userNickname, req.userId!);
    }

    const img = (typeof imageUrl === 'string' && imageUrl.startsWith('https://')) ? imageUrl : null;

    const id = genId();
    await collections.momGroupPosts.doc(id).set({
      groupKey,
      userId: req.userId!,
      nickname,
      category,
      anonymous: isAnon,
      title: titleText,
      content: body,
      imageUrl: img,
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      reportCount: 0,
      hidden: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    success(res, { id, groupKey, nickname, category, anonymous: isAnon, title: titleText, content: body, imageUrl: img }, 201);
  } catch (err) {
    logger.error('mom-group:createPost', err, { userId: req.userId });
    error(res, '게시글 저장 중 오류가 발생했습니다', 500);
  }
});

/** PUT /api/mom-group/posts/:id — 본인 글 수정 { title, content, category, imageUrl? } */
router.put('/posts/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const doc = await collections.momGroupPosts.doc(id).get();
    if (!doc.exists) { error(res, '게시글을 찾을 수 없습니다', 404); return; }
    if (doc.data()?.userId !== req.userId) { error(res, '권한이 없습니다', 403); return; }

    const { title, content, category, imageUrl } = req.body as {
      title?: string; content?: string; category?: string; imageUrl?: string | null;
    };

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      isEdited: true,
    };

    if (title !== undefined) {
      const t = title.trim();
      if (!t) { error(res, '제목을 입력해주세요'); return; }
      if (t.length > MAX_TITLE_LEN) { error(res, `제목은 ${MAX_TITLE_LEN}자 이하로 작성해주세요`); return; }
      update.title = t;
    }
    if (content !== undefined) {
      const c = content.trim();
      if (!c) { error(res, '내용을 입력해주세요'); return; }
      if (c.length > MAX_CONTENT_LEN) { error(res, `내용은 ${MAX_CONTENT_LEN}자 이하로 작성해주세요`); return; }
      update.content = c;
    }
    if (category !== undefined) {
      if (!isValidCategory(category)) { error(res, '카테고리가 올바르지 않습니다'); return; }
      update.category = category;
    }
    if (imageUrl !== undefined) {
      if (imageUrl === null) {
        update.imageUrl = null;
      } else if (typeof imageUrl === 'string' && imageUrl.startsWith('https://')) {
        update.imageUrl = imageUrl;
      }
    }

    await collections.momGroupPosts.doc(id).update(update);
    success(res, { id, updated: true });
  } catch (err) {
    logger.error('mom-group:updatePost', err, { userId: req.userId, postId: req.params.id });
    error(res, '게시글 수정 중 오류가 발생했습니다', 500);
  }
});

/** DELETE /api/mom-group/posts/:id — 본인 글 삭제 */
router.delete('/posts/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const doc = await collections.momGroupPosts.doc(id).get();
    if (!doc.exists) { error(res, '게시글을 찾을 수 없습니다', 404); return; }
    if (doc.data()?.userId !== req.userId) { error(res, '권한이 없습니다', 403); return; }
    await collections.momGroupPosts.doc(id).delete();
    success(res, { deleted: true });
  } catch (err) {
    logger.error('mom-group:deletePost', err, { userId: req.userId, postId: req.params.id });
    error(res, '삭제 중 오류가 발생했습니다', 500);
  }
});

/** POST /api/mom-group/posts/:id/like — 좋아요 토글 */
router.post('/posts/:id/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const likeDocId = `${id}_${req.userId}`;
    const likeRef = collections.momGroupPosts.doc(id).collection('likes').doc(likeDocId);
    const postRef = collections.momGroupPosts.doc(id);

    const likeSnap = await likeRef.get();
    if (likeSnap.exists) {
      await likeRef.delete();
      await postRef.update({ likeCount: FieldValue.increment(-1) });
      success(res, { liked: false });
    } else {
      await likeRef.set({ userId: req.userId!, createdAt: FieldValue.serverTimestamp() });
      await postRef.update({ likeCount: FieldValue.increment(1) });
      success(res, { liked: true });
    }
  } catch (err) {
    logger.error('mom-group:toggleLike', err, { userId: req.userId, postId: req.params.id });
    error(res, '좋아요 처리 중 오류가 발생했습니다', 500);
  }
});

/** GET /api/mom-group/posts/:id/comments */
router.get('/posts/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // 조회수 증가 (fire-and-forget, 응답 지연 방지)
    collections.momGroupPosts.doc(id).update({
      viewCount: FieldValue.increment(1),
    }).catch((err) => {
      logger.warn('mom-group:listComments.viewCount', 'viewCount increment failed', {
        postId: id,
        err: err instanceof Error ? err.message : String(err),
      });
    });

    const snap = await collections.momGroupComments
      .where('postId', '==', id)
      .limit(200)
      .get();

    const comments = snap.docs
      .map((d) => {
        const data = d.data();
        const ca = data.createdAt as { toDate?: () => Date } | undefined;
        return {
          id: d.id,
          postId: data.postId as string,
          userId: data.userId as string,
          nickname: data.nickname as string,
          anonymous: (data.anonymous as boolean | undefined) ?? false,
          content: data.content as string,
          createdAt: ca?.toDate?.().toISOString() ?? '',
          isMine: data.userId === req.userId,
        };
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    success(res, comments);
  } catch (err) {
    logger.error('mom-group:listComments', err, { userId: req.userId, postId: req.params.id });
    error(res, '댓글 조회 중 오류가 발생했습니다', 500);
  }
});

/** POST /api/mom-group/posts/:id/comments { content, anonymous? } */
router.post('/posts/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const postId = req.params.id as string;
    const { content, anonymous } = req.body as { content?: string; anonymous?: boolean };
    const body = (content ?? '').trim();
    if (!body) { error(res, '내용을 입력해주세요'); return; }
    if (body.length > MAX_COMMENT_LEN) { error(res, `댓글은 ${MAX_COMMENT_LEN}자 이하로 작성해주세요`); return; }

    const postDoc = await collections.momGroupPosts.doc(postId).get();
    if (!postDoc.exists) { error(res, '게시글을 찾을 수 없습니다', 404); return; }
    const postGroupKey = (postDoc.data()?.groupKey as string | undefined) ?? '';

    const ok = await checkRateLimit(req.userId!, 'comment');
    if (!ok) { error(res, `하루 댓글은 ${COMMENTS_PER_DAY}개까지 작성할 수 있어요`, 429); return; }

    const isAnon = Boolean(anonymous);
    let nickname: string;
    if (isAnon && postGroupKey) {
      nickname = anonTagFor(req.userId!, postGroupKey);
    } else {
      const userDoc = await collections.users.doc(req.userId!).get();
      const userNickname = userDoc.exists ? (userDoc.data()?.nickname as string | undefined) : undefined;
      nickname = pickNickname(userNickname, req.userId!);
    }

    const id = genId();
    await collections.momGroupComments.doc(id).set({
      postId,
      userId: req.userId!,
      nickname,
      anonymous: isAnon,
      content: body,
      createdAt: FieldValue.serverTimestamp(),
    });

    await collections.momGroupPosts.doc(postId).update({
      commentCount: FieldValue.increment(1),
    });

    success(res, { id, postId, nickname, content: body }, 201);
  } catch (err) {
    logger.error('mom-group:createComment', err, { userId: req.userId, postId: req.params.id });
    error(res, '댓글 저장 중 오류가 발생했습니다', 500);
  }
});

/** DELETE /api/mom-group/comments/:id — 본인 댓글 삭제 */
router.delete('/comments/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const doc = await collections.momGroupComments.doc(id).get();
    if (!doc.exists) { error(res, '댓글을 찾을 수 없습니다', 404); return; }
    const data = doc.data()!;
    if (data.userId !== req.userId) { error(res, '권한이 없습니다', 403); return; }
    const postId = data.postId as string;
    await collections.momGroupComments.doc(id).delete();
    await collections.momGroupPosts.doc(postId).update({
      commentCount: FieldValue.increment(-1),
    }).catch((err) => { logger.warn('mom-group:deleteComment.decrement', 'commentCount decrement failed', { err: err instanceof Error ? err.message : String(err) }); });
    success(res, { deleted: true });
  } catch (err) {
    logger.error('mom-group:deleteComment', err, { userId: req.userId, commentId: req.params.id });
    error(res, '삭제 중 오류가 발생했습니다', 500);
  }
});

const REPORT_REASONS = ['abuse', 'ad', 'privacy', 'spam', 'other'] as const;
type ReportReason = typeof REPORT_REASONS[number];
function isValidReason(r: unknown): r is ReportReason {
  return typeof r === 'string' && (REPORT_REASONS as readonly string[]).includes(r);
}

/** POST /api/mom-group/posts/:id/report { reason } — 신고 (3회 이상이면 자동 숨김) */
router.post('/posts/:id/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body as { reason?: string };
    const finalReason: ReportReason = isValidReason(reason) ? reason : 'other';

    const reportRef = collections.momGroupPosts.doc(id).collection('reports').doc(req.userId!);
    const reportSnap = await reportRef.get();
    if (reportSnap.exists) {
      success(res, { alreadyReported: true });
      return;
    }
    await reportRef.set({
      userId: req.userId!,
      reason: finalReason,
      createdAt: FieldValue.serverTimestamp(),
    });

    const postRef = collections.momGroupPosts.doc(id);
    await postRef.update({ reportCount: FieldValue.increment(1) });

    const updated = await postRef.get();
    const count = (updated.data()?.reportCount as number | undefined) ?? 0;
    if (count >= 3) {
      await postRef.update({ hidden: true });
    }
    success(res, { reported: true, hidden: count >= 3, reason: finalReason });
  } catch (err) {
    logger.error('mom-group:reportPost', err, { userId: req.userId, postId: req.params.id });
    error(res, '신고 처리 중 오류가 발생했습니다', 500);
  }
});

/** POST /api/mom-group/posts/:id/bookmark — 북마크 토글 */
router.post('/posts/:id/bookmark', authMiddleware, async (req: Request, res: Response) => {
  try {
    const postId = req.params.id as string;
    const postSnap = await collections.momGroupPosts.doc(postId).get();
    if (!postSnap.exists) { error(res, '게시글을 찾을 수 없습니다', 404); return; }

    const bookmarkId = `${req.userId}_${postId}`;
    const ref = collections.momGroupBookmarks.doc(bookmarkId);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.delete();
      success(res, { bookmarked: false });
    } else {
      await ref.set({
        userId: req.userId!,
        postId,
        groupKey: postSnap.data()?.groupKey ?? '',
        createdAt: FieldValue.serverTimestamp(),
      });
      success(res, { bookmarked: true });
    }
  } catch (err) {
    logger.error('mom-group:toggleBookmark', err, { userId: req.userId, postId: req.params.id });
    error(res, '북마크 처리 중 오류가 발생했습니다', 500);
  }
});

/** GET /api/mom-group/bookmarks — 내 북마크 목록 (최신순) */
router.get('/bookmarks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const snap = await collections.momGroupBookmarks
      .where('userId', '==', req.userId!)
      .limit(100)
      .get();

    const bookmarks = snap.docs
      .map((d) => {
        const data = d.data();
        const ca = data.createdAt as { toDate?: () => Date } | undefined;
        return {
          postId: data.postId as string,
          createdAt: ca?.toDate?.().toISOString() ?? '',
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (bookmarks.length === 0) { success(res, []); return; }

    // 각 게시글 배치 로드 (getAll N+1 제거, 단일 RPC)
    const postRefs = bookmarks.map((b) => collections.momGroupPosts.doc(b.postId));
    const postDocs = postRefs.length > 0 ? await db.getAll(...postRefs) : [];

    const posts = postDocs
      .filter((d) => d.exists)
      .map((d) => {
        const data = d.data()!;
        const ca = data.createdAt as { toDate?: () => Date } | undefined;
        const ua = data.updatedAt as { toDate?: () => Date } | undefined;
        return {
          id: d.id,
          groupKey: data.groupKey as string,
          userId: data.userId as string,
          nickname: data.nickname as string,
          category: (data.category as Category | undefined) ?? 'chat',
          anonymous: (data.anonymous as boolean | undefined) ?? false,
          title: (data.title as string | undefined) ?? '',
          content: data.content as string,
          imageUrl: (data.imageUrl as string | null | undefined) ?? null,
          likeCount: (data.likeCount as number | undefined) ?? 0,
          commentCount: (data.commentCount as number | undefined) ?? 0,
          viewCount: (data.viewCount as number | undefined) ?? 0,
          hidden: (data.hidden as boolean | undefined) ?? false,
          isEdited: (data.isEdited as boolean | undefined) ?? false,
          createdAt: ca?.toDate?.().toISOString() ?? '',
          updatedAt: ua?.toDate?.().toISOString() ?? '',
          isMine: data.userId === req.userId,
        };
      })
      .filter((p) => !p.hidden);

    success(res, posts);
  } catch (err) {
    logger.error('mom-group:listBookmarks', err, { userId: req.userId });
    error(res, '북마크 조회 중 오류가 발생했습니다', 500);
  }
});

export default router;
