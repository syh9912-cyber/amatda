import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

/* ------------------------------------------------------------------ */
/* Permission Types                                                    */
/* ------------------------------------------------------------------ */

/**
 * 권한 정의:
 * - viewRecords:    육아 기록 열람 (수유/수면/기저귀)
 * - editRecords:    육아 기록 작성/수정
 * - viewCoaching:   AI 코칭 내역 열람
 * - useCoaching:    AI 코칭 직접 사용
 * - viewGrowth:     성장 통계/분석 열람
 * - viewTimeline:   성장 타임라인 열람
 * - editTimeline:   타임라인 사진 추가
 * - viewProfile:    아이 프로필 열람
 * - editProfile:    아이 프로필 수정
 * - manageFamily:   가족 구성원 관리 (초대/삭제)
 */

const ALL_PERMISSIONS = [
  'viewRecords', 'editRecords',
  'viewCoaching', 'useCoaching',
  'viewGrowth', 'viewTimeline', 'editTimeline',
  'viewProfile', 'editProfile',
  'manageFamily',
] as const;

type Permission = typeof ALL_PERMISSIONS[number];

// 역할별 기본 권한 프리셋
const ROLE_PRESETS: Record<string, Permission[]> = {
  parent: [...ALL_PERMISSIONS],
  grandparent: ['viewRecords', 'viewCoaching', 'viewGrowth', 'viewTimeline', 'viewProfile'],
  helper: ['viewRecords', 'editRecords', 'viewProfile'],
  viewer: ['viewRecords', 'viewGrowth', 'viewTimeline', 'viewProfile'],
};

/* ------------------------------------------------------------------ */
/* POST /api/coparenting/invite — 가족 초대                            */
/* ------------------------------------------------------------------ */

router.post('/invite', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, role, nickname, permissions, phone } = req.body as {
      childId: string;
      role: string;
      nickname: string;
      permissions?: string[];
      phone?: string;
    };

    if (!childId || !role || !nickname) {
      error(res, 'childId, role, nickname은 필수입니다');
      return;
    }

    // 아이 소유자 확인
    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '권한이 없습니다', 403);
      return;
    }

    // 권한 결정: 직접 지정 or 프리셋
    const perms: string[] = permissions && permissions.length > 0
      ? permissions.filter((p) => ALL_PERMISSIONS.includes(p as Permission))
      : ROLE_PRESETS[role] ?? ROLE_PRESETS['viewer'];

    const inviteCode = genId().slice(0, 8).toUpperCase();
    const id = genId();

    await collections.familyMembers.doc(id).set({
      childId,
      invitedBy: req.userId,
      inviteeUserId: null, // 아직 수락 전
      role,
      nickname,
      permissions: perms,
      phone: phone ?? null,
      inviteCode,
      status: 'pending', // pending | accepted | declined
      createdAt: FieldValue.serverTimestamp(),
    });

    success(res, { id, inviteCode, permissions: perms }, 201);
  } catch {
    error(res, '초대 중 오류가 발생했습니다', 500);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/coparenting/accept — 초대 수락                            */
/* ------------------------------------------------------------------ */

router.post('/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.body as { inviteCode: string };
    if (!inviteCode) {
      error(res, '초대 코드가 필요합니다');
      return;
    }

    const snap = await collections.familyMembers
      .where('inviteCode', '==', inviteCode.toUpperCase())
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (snap.empty) {
      error(res, '유효하지 않은 초대 코드입니다', 404);
      return;
    }

    const doc = snap.docs[0];

    // 자기 자신 초대 방지
    if (doc.data().invitedBy === req.userId) {
      error(res, '자신을 초대할 수 없습니다');
      return;
    }

    await doc.ref.update({
      inviteeUserId: req.userId,
      status: 'accepted',
      acceptedAt: FieldValue.serverTimestamp(),
    });

    success(res, {
      id: doc.id,
      childId: doc.data().childId,
      role: doc.data().role,
      permissions: doc.data().permissions,
    });
  } catch {
    error(res, '초대 수락 중 오류가 발생했습니다', 500);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/coparenting/members/:childId — 가족 구성원 목록              */
/* ------------------------------------------------------------------ */

router.get('/members/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;

    // 소유자이거나 구성원인지 확인
    const childDoc = await collections.children.doc(childId).get();
    const isOwner = childDoc.exists && childDoc.data()!.userId === req.userId;

    if (!isOwner) {
      const memberCheck = await collections.familyMembers
        .where('childId', '==', childId)
        .where('inviteeUserId', '==', req.userId)
        .where('status', '==', 'accepted')
        .limit(1)
        .get();
      if (memberCheck.empty) {
        error(res, '권한이 없습니다', 403);
        return;
      }
    }

    const snap = await collections.familyMembers
      .where('childId', '==', childId)
      .get();

    const members = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? null,
      acceptedAt: d.data().acceptedAt?.toDate?.()?.toISOString?.() ?? null,
    }));

    success(res, { members, isOwner });
  } catch {
    error(res, '구성원 조회 중 오류가 발생했습니다', 500);
  }
});

/* ------------------------------------------------------------------ */
/* PUT /api/coparenting/permissions/:memberId — 권한 수정               */
/* ------------------------------------------------------------------ */

router.put('/permissions/:memberId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const { permissions } = req.body as { permissions: string[] };

    if (!permissions || !Array.isArray(permissions)) {
      error(res, 'permissions 배열이 필요합니다');
      return;
    }

    const memberDoc = await collections.familyMembers.doc(memberId).get();
    if (!memberDoc.exists) {
      error(res, '구성원을 찾을 수 없습니다', 404);
      return;
    }

    // 소유자만 권한 수정 가능
    const childDoc = await collections.children.doc(memberDoc.data()!.childId as string).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '권한이 없습니다', 403);
      return;
    }

    const validPerms = permissions.filter((p) => ALL_PERMISSIONS.includes(p as Permission));
    await memberDoc.ref.update({ permissions: validPerms });

    success(res, { id: memberId, permissions: validPerms });
  } catch {
    error(res, '권한 수정 중 오류가 발생했습니다', 500);
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /api/coparenting/members/:memberId — 구성원 삭제              */
/* ------------------------------------------------------------------ */

router.delete('/members/:memberId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;

    const memberDoc = await collections.familyMembers.doc(memberId).get();
    if (!memberDoc.exists) {
      error(res, '구성원을 찾을 수 없습니다', 404);
      return;
    }

    // 소유자이거나 본인 탈퇴
    const data = memberDoc.data()!;
    const childDoc = await collections.children.doc(data.childId as string).get();
    const isOwner = childDoc.exists && childDoc.data()!.userId === req.userId;
    const isSelf = data.inviteeUserId === req.userId;

    if (!isOwner && !isSelf) {
      error(res, '권한이 없습니다', 403);
      return;
    }

    await memberDoc.ref.delete();
    success(res, { id: memberId, message: '삭제되었습니다' });
  } catch {
    error(res, '구성원 삭제 중 오류가 발생했습니다', 500);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/coparenting/my-permissions/:childId — 내 권한 확인           */
/* ------------------------------------------------------------------ */

router.get('/my-permissions/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;

    // 소유자는 모든 권한
    const childDoc = await collections.children.doc(childId).get();
    if (childDoc.exists && childDoc.data()!.userId === req.userId) {
      success(res, { role: 'owner', permissions: [...ALL_PERMISSIONS] });
      return;
    }

    // 구성원 권한 조회
    const snap = await collections.familyMembers
      .where('childId', '==', childId)
      .where('inviteeUserId', '==', req.userId)
      .where('status', '==', 'accepted')
      .limit(1)
      .get();

    if (snap.empty) {
      error(res, '권한이 없습니다', 403);
      return;
    }

    const member = snap.docs[0].data();
    success(res, {
      role: member.role,
      permissions: member.permissions ?? [],
      nickname: member.nickname,
    });
  } catch {
    error(res, '권한 조회 중 오류가 발생했습니다', 500);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/coparenting/presets — 역할별 기본 권한 프리셋                 */
/* ------------------------------------------------------------------ */

router.get('/presets', authMiddleware, async (_req: Request, res: Response) => {
  success(res, {
    allPermissions: ALL_PERMISSIONS,
    presets: Object.entries(ROLE_PRESETS).map(([role, perms]) => ({ role, permissions: perms })),
    permissionLabels: {
      viewRecords: '육아 기록 열람',
      editRecords: '육아 기록 작성/수정',
      viewCoaching: '상담이모 열람',
      useCoaching: '상담이모 사용',
      viewGrowth: '성장 통계 열람',
      viewTimeline: '타임라인 열람',
      editTimeline: '타임라인 사진 추가',
      viewProfile: '아이 프로필 열람',
      editProfile: '아이 프로필 수정',
      manageFamily: '가족 구성원 관리',
    },
  });
});

export default router;
