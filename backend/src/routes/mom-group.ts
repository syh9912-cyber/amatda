import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, db, genId } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';
import { distanceKm, isValidLatLng, radiusBoundingBox } from '../utils/location';

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
  // ⚠️ atomic check-then-increment — 동시 요청이 모두 read=5/limit=10 본 후 모두 통과되는 race 방지.
  // 트랜잭션으로 read+write 원자성 보장.
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? ((snap.data()?.count as number | undefined) ?? 0) : 0;
    if (count >= limit) return false;
    tx.set(ref, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
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

/**
 * POST /api/mom-group/posts
 * { groupKey, title, content, category, anonymous?, imageUrl? }
 *
 * 추가 필드 (radius 매칭용 — 사용자 위치/자녀 출생연도 자동 첨부):
 *   lat, lng (선택, users/{userId} 의 저장 위치를 자동 사용)
 *   babyBirthYear (선택, 자동 사용)
 */
router.post('/posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { groupKey, title, content, category, anonymous, imageUrl, isPinned } = req.body as {
      groupKey?: string; title?: string; content?: string; category?: string; anonymous?: boolean; imageUrl?: string; isPinned?: boolean;
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

    const userDoc = await collections.users.doc(req.userId!).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    const isAnon = Boolean(anonymous);
    let nickname: string;
    if (isAnon) {
      nickname = anonTagFor(req.userId!, groupKey);
    } else {
      const userNickname = userData?.nickname as string | undefined;
      nickname = pickNickname(userNickname, req.userId!);
    }

    const img = (typeof imageUrl === 'string' && imageUrl.startsWith('https://')) ? imageUrl : null;

    // 사용자 위치 + 자녀 출생연도 자동 첨부 (radius 매칭용)
    const lat = userData?.lat;
    const lng = userData?.lng;
    const babyBirthYear = userData?.babyBirthYear;

    // 공식 계정 여부 — 사용자 문서의 isOfficial 플래그 denormalize.
    // 운영자가 Firestore Console에서 직접 users/{uid}.isOfficial=true 설정.
    // 익명 게시글에는 노출 안 함 (정체성 노출 방지).
    const isOfficial = !isAnon && userData?.isOfficial === true;

    // 상단 고정 — 공식 계정만 가능. 비공식 시도는 무시.
    const wantsPin = isPinned === true;
    const isPinnedFinal = wantsPin && isOfficial;

    const baseDoc: Record<string, unknown> = {
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
      isOfficial,
      isPinned: isPinnedFinal,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (typeof lat === 'number' && typeof lng === 'number') {
      baseDoc.lat = lat;
      baseDoc.lng = lng;
    }
    if (typeof babyBirthYear === 'number') {
      baseDoc.babyBirthYear = babyBirthYear;
    }

    const id = genId();
    await collections.momGroupPosts.doc(id).set(baseDoc);

    success(res, { id, groupKey, nickname, category, anonymous: isAnon, title: titleText, content: body, imageUrl: img }, 201);
  } catch (err) {
    logger.error('mom-group:createPost', err, { userId: req.userId });
    error(res, '게시글 저장 중 오류가 발생했습니다', 500);
  }
});

/**
 * GET /api/mom-group/posts/radius
 *   ?radius=5|10|50|100|0   (0 = 전국)
 *   &birthYear=2024         (선택, 동갑 매칭)
 *   &category=...           (선택)
 *   &sort=recent|popular
 *   &page=1 &pageSize=20
 *   &q=검색어
 *
 * 사용자 본인 위치(users/{userId}.lat/lng)를 중심으로 반경 내 게시물 조회.
 * radius=0 → 전국 (위치 무관, birthYear 만 적용)
 */
router.get('/posts/radius', authMiddleware, async (req: Request, res: Response) => {
  try {
    const radiusKm = Math.max(0, Number(req.query.radius ?? 10));
    // birthYears: comma-separated 또는 단일 birthYear 호환
    const birthYearsRaw = (req.query.birthYears as string | undefined) ?? '';
    let birthYears: number[] | null = null;
    if (birthYearsRaw) {
      birthYears = birthYearsRaw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n >= 2010 && n <= 2050);
      if (birthYears.length === 0) birthYears = null;
      // Firestore 'in' 쿼리 최대 30
      if (birthYears && birthYears.length > 30) birthYears = birthYears.slice(0, 30);
    } else if (req.query.birthYear) {
      const single = Number(req.query.birthYear);
      if (!isNaN(single) && single >= 2010 && single <= 2050) birthYears = [single];
    }
    const category = req.query.category as string | undefined;
    const sort = (req.query.sort as string) === 'popular' ? 'popular' : 'recent';
    const searchQ = ((req.query.q as string) ?? '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE);

    // 0이면 전국 — 위치 필터 없이 birthYear만
    const isNationwide = radiusKm === 0;

    // 사용자 위치 조회 (전국 모드면 생략)
    let center: { lat: number; lng: number } | null = null;
    if (!isNationwide) {
      const userDoc = await collections.users.doc(req.userId!).get();
      const ud = userDoc.exists ? userDoc.data() : null;
      const lat = ud?.lat;
      const lng = ud?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        error(res, '먼저 위치를 등록해주세요', 412);
        return;
      }
      center = { lat, lng };
    }

    // Firestore 쿼리: hidden=false + (옵션) birthYear=X + (옵션) lat 범위
    let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = collections.momGroupPosts
      .where('hidden', '==', false);

    if (birthYears && birthYears.length > 0) {
      // 단일이면 ==, 여러개면 in
      if (birthYears.length === 1) {
        q = q.where('babyBirthYear', '==', birthYears[0]);
      } else {
        q = q.where('babyBirthYear', 'in', birthYears);
      }
    }

    if (center) {
      const bb = radiusBoundingBox(center, radiusKm);
      // Firestore 단일 필드 range 쿼리만 지원 → lat 범위만 적용, lng는 in-memory
      q = q.where('lat', '>=', bb.minLat).where('lat', '<=', bb.maxLat);
    }
    if (category && isValidCategory(category)) {
      q = q.where('category', '==', category);
    }

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
        lat: typeof data.lat === 'number' ? (data.lat as number) : null,
        lng: typeof data.lng === 'number' ? (data.lng as number) : null,
        babyBirthYear: typeof data.babyBirthYear === 'number' ? (data.babyBirthYear as number) : null,
        distanceKm: 0 as number | null,
        isOfficial: data.isOfficial === true,
        isPinned: data.isPinned === true,
        isFallback: false,
      };
    });

    // lng + 정확 거리 후처리 (전국 모드는 스킵)
    if (center) {
      const bb = radiusBoundingBox(center, radiusKm);
      posts = posts
        .filter((p) => p.lng != null && p.lng >= bb.minLng && p.lng <= bb.maxLng)
        .map((p) => {
          const d = (p.lat != null && p.lng != null)
            ? distanceKm(center as { lat: number; lng: number }, { lat: p.lat, lng: p.lng })
            : null;
          return { ...p, distanceKm: d };
        })
        .filter((p) => p.distanceKm != null && p.distanceKm <= radiusKm);
    } else {
      posts.forEach((p) => { p.distanceKm = null; });
    }

    // 검색 필터
    if (searchQ) {
      posts = posts.filter((p) =>
        p.title.toLowerCase().includes(searchQ) ||
        p.content.toLowerCase().includes(searchQ) ||
        p.nickname.toLowerCase().includes(searchQ),
      );
    }

    // 정렬
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

    // 상단 고정 — isPinned=true인 공식 글만 최상단 (최대 3개), 최신순
    // 그 외(공식이지만 핀 안 한 글, 일반 글)는 정상 정렬 유지
    const PIN_LIMIT = 3;
    {
      const pinned = posts
        .filter((p) => p.isPinned && p.isOfficial)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, PIN_LIMIT);
      const pinnedIds = new Set(pinned.map((p) => p.id));
      const rest = posts.filter((p) => !pinnedIds.has(p.id));
      posts = [...pinned, ...rest];
    }

    // 전국 인기글 폴백 — 로컬 게시글이 너무 적으면 (5개 미만) 첫 페이지에 한해 전국 인기글을 뒤에 붙임.
    // 검색어/카테고리 필터가 있으면 폴백 안 함 (검색은 정확도 우선).
    const FALLBACK_THRESHOLD = 5;
    const FALLBACK_LIMIT = 10;
    const FALLBACK_DAYS = 14;
    let isFallbackUsed = false;

    if (
      !isNationwide &&
      !searchQ &&
      !category &&
      page === 1 &&
      posts.length < FALLBACK_THRESHOLD
    ) {
      try {
        const since = new Date();
        since.setDate(since.getDate() - FALLBACK_DAYS);
        const fallbackSnap = await collections.momGroupPosts
          .where('hidden', '==', false)
          .where('createdAt', '>=', since)
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get();

        const localIds = new Set(posts.map((p) => p.id));
        const fallbackPosts = fallbackSnap.docs
          .filter((d) => !localIds.has(d.id))
          .map((d) => {
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
              hidden: false,
              isEdited: (data.isEdited as boolean | undefined) ?? false,
              createdAt: ca?.toDate?.().toISOString() ?? '',
              updatedAt: ua?.toDate?.().toISOString() ?? '',
              isMine: data.userId === req.userId,
              lat: null as number | null,
              lng: null as number | null,
              babyBirthYear: typeof data.babyBirthYear === 'number' ? (data.babyBirthYear as number) : null,
              distanceKm: null as number | null,
              isOfficial: data.isOfficial === true,
              isPinned: data.isPinned === true,
              isFallback: true,
            };
          })
          // 인기 점수 정렬 후 상위 N개만
          .sort((a, b) => (b.likeCount * 2 + b.commentCount) - (a.likeCount * 2 + a.commentCount))
          .slice(0, FALLBACK_LIMIT);

        if (fallbackPosts.length > 0) {
          posts = [...posts, ...fallbackPosts];
          // 폴백 합류 후 isPinned 재고정 (로컬·폴백의 핀 글 모두 최상단, 합쳐서 최대 3개)
          const pinnedAfter = posts
            .filter((p) => p.isPinned && p.isOfficial)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, PIN_LIMIT);
          const pinnedAfterIds = new Set(pinnedAfter.map((p) => p.id));
          const restAfter = posts.filter((p) => !pinnedAfterIds.has(p.id));
          posts = [...pinnedAfter, ...restAfter];
          isFallbackUsed = true;
        }
      } catch (fbErr) {
        logger.error('mom-group:fallback', fbErr, { userId: req.userId });
        // 폴백 실패는 무시 — 로컬 결과만 반환
      }
    }

    const total = posts.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const paged = posts.slice(start, start + pageSize);

    success(res, { posts: paged, page, pageSize, total, totalPages, radiusKm, birthYears, fallbackUsed: isFallbackUsed });
  } catch (err) {
    logger.error('mom-group:listPostsRadius', err, { userId: req.userId });
    error(res, '게시글 조회 중 오류가 발생했습니다', 500);
  }
});

// 사용 변수 경고 방지 (utility 사용)
void isValidLatLng;

/** PUT /api/mom-group/posts/:id — 본인 글 수정 { title, content, category, imageUrl? } */
router.put('/posts/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const doc = await collections.momGroupPosts.doc(id).get();
    if (!doc.exists) { error(res, '게시글을 찾을 수 없습니다', 404); return; }
    const docData = doc.data();
    if (docData?.userId !== req.userId) { error(res, '권한이 없습니다', 403); return; }

    const { title, content, category, imageUrl, isPinned } = req.body as {
      title?: string; content?: string; category?: string; imageUrl?: string | null; isPinned?: boolean;
    };

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      isEdited: true,
    };

    // 상단 고정 토글 — 공식 계정만 변경 가능
    if (isPinned !== undefined) {
      const postIsOfficial = docData?.isOfficial === true;
      if (postIsOfficial) {
        update.isPinned = isPinned === true;
      }
      // 비공식 게시글은 isPinned 변경 무시
    }

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
          isOfficial: data.isOfficial === true,
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
    let isOfficial = false;
    if (isAnon && postGroupKey) {
      nickname = anonTagFor(req.userId!, postGroupKey);
    } else {
      const userDoc = await collections.users.doc(req.userId!).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const userNickname = userData?.nickname as string | undefined;
      nickname = pickNickname(userNickname, req.userId!);
      isOfficial = userData?.isOfficial === true;
    }

    const id = genId();
    await collections.momGroupComments.doc(id).set({
      postId,
      userId: req.userId!,
      nickname,
      anonymous: isAnon,
      content: body,
      createdAt: FieldValue.serverTimestamp(),
      isOfficial,
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

/**
 * GET /api/mom-group/posts/radius/counts
 *   ?birthYear=2024
 *
 * 각 반경(5/10/50/100km/전국)마다 활동 게시글 개수 반환.
 * UI에서 "5km · 활동 3명" 같은 활성도 표시용.
 */
router.get('/posts/radius/counts', authMiddleware, async (req: Request, res: Response) => {
  try {
    // birthYears 배열 또는 단일 birthYear 호환
    const birthYearsRaw = (req.query.birthYears as string | undefined) ?? '';
    let birthYears: number[] | null = null;
    if (birthYearsRaw) {
      birthYears = birthYearsRaw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n >= 2010 && n <= 2050);
      if (birthYears.length === 0) birthYears = null;
      if (birthYears && birthYears.length > 30) birthYears = birthYears.slice(0, 30);
    } else if (req.query.birthYear) {
      const single = Number(req.query.birthYear);
      if (!isNaN(single) && single >= 2010 && single <= 2050) birthYears = [single];
    }

    const userDoc = await collections.users.doc(req.userId!).get();
    const ud = userDoc.exists ? userDoc.data() : null;
    const lat = ud?.lat;
    const lng = ud?.lng;
    const hasLoc = typeof lat === 'number' && typeof lng === 'number';

    // 전국 카운트는 항상 가능 (위치 무관)
    let nationwideQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = collections.momGroupPosts
      .where('hidden', '==', false);
    if (birthYears && birthYears.length > 0) {
      if (birthYears.length === 1) nationwideQuery = nationwideQuery.where('babyBirthYear', '==', birthYears[0]);
      else nationwideQuery = nationwideQuery.where('babyBirthYear', 'in', birthYears);
    }
    const nationwideSnap = await nationwideQuery.limit(1000).get();
    const nationwide = nationwideSnap.size;

    if (!hasLoc) {
      success(res, {
        hasLocation: false,
        counts: { '5': 0, '10': 0, '50': 0, '100': 0, '0': nationwide },
      });
      return;
    }

    // 위치 있음: 가장 큰 반경(100km) 한 번만 쿼리하고 in-memory 거리 계산으로 모든 반경 카운트
    const center = { lat: lat as number, lng: lng as number };
    const bb = radiusBoundingBox(center, 100);
    let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = collections.momGroupPosts
      .where('hidden', '==', false)
      .where('lat', '>=', bb.minLat)
      .where('lat', '<=', bb.maxLat);
    if (birthYears && birthYears.length > 0) {
      if (birthYears.length === 1) q = q.where('babyBirthYear', '==', birthYears[0]);
      else q = q.where('babyBirthYear', 'in', birthYears);
    }
    const snap = await q.limit(1000).get();

    const counts: Record<string, number> = { '5': 0, '10': 0, '50': 0, '100': 0, '0': nationwide };
    for (const doc of snap.docs) {
      const d = doc.data();
      const pLat = d.lat as number | undefined;
      const pLng = d.lng as number | undefined;
      if (typeof pLat !== 'number' || typeof pLng !== 'number') continue;
      if (pLng < bb.minLng || pLng > bb.maxLng) continue;
      const dist = distanceKm(center, { lat: pLat, lng: pLng });
      if (dist <= 5)   counts['5'] += 1;
      if (dist <= 10)  counts['10'] += 1;
      if (dist <= 50)  counts['50'] += 1;
      if (dist <= 100) counts['100'] += 1;
    }

    success(res, { hasLocation: true, counts });
  } catch (err) {
    logger.error('mom-group:radiusCounts', err, { userId: req.userId });
    error(res, '활동 카운트 조회 실패', 500);
  }
});

/**
 * POST /api/mom-group/admin/delete-region-posts
 * 일회용 정리 — 옛 region: groupKey 글들을 모두 삭제 (테스트 데이터 정리).
 *
 * 안전장치: 모든 삭제 대상의 groupKey가 'region:' 으로 시작하는 것만 처리.
 * 삭제 결과 (count)만 반환. 실데이터 손상 방지 위해 dry-run 옵션 지원.
 */
router.post('/admin/delete-region-posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dryRun = req.body?.dryRun === true || req.query.dryRun === 'true';

    // groupKey 가 'region:' 으로 시작하는 모든 post 찾기
    // Firestore prefix 쿼리 → range 쿼리로 (>= 'region:' && < 'region;')
    const snap = await collections.momGroupPosts
      .where('groupKey', '>=', 'region:')
      .where('groupKey', '<', 'region;')
      .get();

    const ids: string[] = [];
    for (const doc of snap.docs) {
      const gk = doc.data().groupKey as string | undefined;
      if (gk && gk.startsWith('region:')) ids.push(doc.id);
    }

    if (dryRun) {
      success(res, { dryRun: true, willDelete: ids.length, sample: ids.slice(0, 10) });
      return;
    }

    // 배치 삭제 (Firestore batch 한도 500)
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach((id) => batch.delete(collections.momGroupPosts.doc(id)));
      await batch.commit();
      deleted += chunk.length;
    }

    // 관련 댓글·북마크도 함께 (옵션 — 안전하게 그대로 둬도 OK)
    success(res, { deleted, totalFound: ids.length });
  } catch (err) {
    logger.error('mom-group:deleteRegionPosts', err, { userId: req.userId });
    error(res, '삭제 실패', 500);
  }
});

export default router;
