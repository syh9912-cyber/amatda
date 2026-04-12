import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';

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
    const { content, imageUrl, thumbnailUrl, videoUrl, mediaType, sourceType, childAge, childGender, dominantType } = req.body;

    if (!content) {
      error(res, '내용을 입력해주세요');
      return;
    }
    if (!sourceType || !['album', 'diary', 'manual'].includes(sourceType)) {
      error(res, '올바른 sourceType을 입력해주세요 (album, diary, manual)');
      return;
    }

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
      likes: 0,
      commentCount: 0,
      createdAt: now,
      isPublic: true,
    };

    await collections.posts.doc(id).set(post);
    success(res, { id, ...post }, 201);
  } catch {
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
        const memberId = d.data().userId as string;
        if (memberId && !familyUserIds.includes(memberId)) familyUserIds.push(memberId);
      });
      // 내가 초대받은 경우도 포함
      const invitedSnap = await collections.familyMembers
        .where('userId', '==', userId)
        .where('status', '==', 'accepted')
        .get();
      invitedSnap.docs.forEach((d) => {
        const inviter = d.data().invitedBy as string;
        if (inviter && !familyUserIds.includes(inviter)) familyUserIds.push(inviter);
      });
    } catch { /* familyMembers 없어도 본인 게시글은 표시 */ }

    // 가족 멤버의 게시글만 조회 (Firestore 'in' 최대 30)
    const userChunks: string[][] = [];
    for (let i = 0; i < familyUserIds.length; i += 30) {
      userChunks.push(familyUserIds.slice(i, i + 30));
    }

    const allDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (const chunk of userChunks) {
      const snap = await collections.posts
        .where('userId', 'in', chunk)
        .orderBy('createdAt', 'desc')
        .limit(limit * (page + 1))
        .get();
      allDocs.push(...snap.docs);
    }

    // 정렬 + 페이지네이션
    allDocs.sort((a, b) => {
      const aTime = a.data().createdAt as string;
      const bTime = b.data().createdAt as string;
      return bTime.localeCompare(aTime);
    });
    const paginated = allDocs.slice(page * limit, (page + 1) * limit);
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
  } catch {
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
      // 좋아요 취소
      const likeDocId = existingLike.docs[0].id;
      await collections.postLikes.doc(likeDocId).delete();
      const currentLikes = (postDoc.data()!.likes as number) || 0;
      await postRef.update({ likes: Math.max(0, currentLikes - 1) });
      success(res, { liked: false, likes: Math.max(0, currentLikes - 1) });
    } else {
      // 좋아요
      const likeId = genId();
      await collections.postLikes.doc(likeId).set({
        postId,
        userId,
        createdAt: new Date().toISOString(),
      });
      const currentLikes = (postDoc.data()!.likes as number) || 0;
      await postRef.update({ likes: currentLikes + 1 });
      success(res, { liked: true, likes: currentLikes + 1 });
    }
  } catch {
    error(res, '좋아요 처리 중 오류가 발생했습니다', 500);
  }
});

// GET /posts/:id/comments - 댓글 조회
router.get('/posts/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const postId = req.params.id as string;
    const page = Math.max(0, parseInt(req.query.page as string, 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    const postDoc = await collections.posts.doc(postId).get();
    if (!postDoc.exists) {
      error(res, '게시글을 찾을 수 없습니다', 404);
      return;
    }

    const snap = await collections.postComments
      .where('postId', '==', postId)
      .orderBy('createdAt', 'asc')
      .offset(page * limit)
      .limit(limit)
      .get();

    const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    success(res, { comments, page, limit });
  } catch {
    error(res, '댓글 조회 중 오류가 발생했습니다', 500);
  }
});

// POST /posts/:id/comments - 댓글 작성
router.post('/posts/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id as string;
    const { content } = req.body;

    if (!content) {
      error(res, '댓글 내용을 입력해주세요');
      return;
    }

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

    const currentCount = (postDoc.data()!.commentCount as number) || 0;
    await postRef.update({ commentCount: currentCount + 1 });

    success(res, { id: commentId, ...comment }, 201);
  } catch {
    error(res, '댓글 작성 중 오류가 발생했습니다', 500);
  }
});

// DELETE /posts/:id - 본인 게시글 삭제
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
  } catch {
    error(res, '게시글 삭제 중 오류가 발생했습니다', 500);
  }
});

// GET /my-posts - 내 게시글 조회
router.get('/my-posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const page = Math.max(0, parseInt(req.query.page as string, 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    const snap = await collections.posts
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .offset(page * limit)
      .limit(limit)
      .get();

    const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    success(res, { posts, page, limit });
  } catch {
    error(res, '내 게시글 조회 중 오류가 발생했습니다', 500);
  }
});

export default router;
