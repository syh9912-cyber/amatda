import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { calculateSaju } from '../services/saju.calculator';
import { calculateAge } from '../services/age.calculator';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

function formatChild(child: {
  id: string;
  name: string;
  gender: string;
  birthDate: Date;
  birthTime: string;
  innateData: string;
  baseline: string | null;
  observedTraits: string | null;
}) {
  const innate = JSON.parse(child.innateData);
  const { pillars, ...publicInnate } = innate;
  return {
    id: child.id,
    name: child.name,
    gender: child.gender,
    birthDate: child.birthDate.toISOString().split('T')[0],
    birthTime: child.birthTime,
    innateData: publicInnate,
    baseline: child.baseline ? JSON.parse(child.baseline) : null,
    observedTraits: child.observedTraits ? JSON.parse(child.observedTraits) : null,
    ageInfo: calculateAge(child.birthDate),
  };
}

// GET /api/children
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const children = await prisma.child.findMany({
      where: { userId: req.userId },
    });
    success(res, children.map(formatChild));
  } catch (e) {
    error(res, '자녀 목록 조회 중 오류가 발생했습니다', 500);
  }
});

// POST /api/children
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, gender, birthDate, birthTime } = req.body;
    if (!name || !gender || !birthDate || !birthTime) {
      error(res, '이름, 성별, 생년월일, 출생시각을 모두 입력해주세요');
      return;
    }

    const innateData = calculateSaju(new Date(birthDate), birthTime);
    const child = await prisma.child.create({
      data: {
        userId: req.userId!,
        name,
        gender,
        birthDate: new Date(birthDate),
        birthTime,
        innateData: JSON.stringify(innateData),
      },
    });

    success(res, formatChild(child), 201);
  } catch (e) {
    error(res, '자녀 등록 중 오류가 발생했습니다', 500);
  }
});

// GET /api/children/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const child = await prisma.child.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }
    success(res, formatChild(child));
  } catch (e) {
    error(res, '자녀 조회 중 오류가 발생했습니다', 500);
  }
});

// PUT /api/children/:id
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const child = await prisma.child.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    const { name, gender, birthDate, birthTime } = req.body;
    if (!name && !gender && !birthDate && !birthTime) {
      error(res, '수정할 항목을 입력해주세요');
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (gender) updateData.gender = gender;

    // 생년월일 또는 출생시각 변경 시 사주 재계산
    const newBirthDate = birthDate ? new Date(birthDate) : child.birthDate;
    const newBirthTime = birthTime ?? child.birthTime;
    if (birthDate || birthTime) {
      updateData.birthDate = newBirthDate;
      updateData.birthTime = newBirthTime;
      const innateData = calculateSaju(newBirthDate, newBirthTime);
      updateData.innateData = JSON.stringify(innateData);
    }

    const updated = await prisma.child.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    success(res, formatChild(updated));
  } catch (e) {
    error(res, '자녀 정보 수정 중 오류가 발생했습니다', 500);
  }
});

// DELETE /api/children/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const child = await prisma.child.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    // Cascade: 관찰일기, 구독 삭제 후 자녀 삭제
    await prisma.observation.deleteMany({ where: { childId: child.id } });
    await prisma.subscription.deleteMany({ where: { childId: child.id } });
    await prisma.child.delete({ where: { id: child.id } });

    success(res, { id: child.id, message: '자녀가 삭제되었습니다' });
  } catch (e) {
    error(res, '자녀 삭제 중 오류가 발생했습니다', 500);
  }
});

// POST /api/children/:id/baseline
router.post('/:id/baseline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) {
      error(res, '응답 데이터가 필요합니다');
      return;
    }

    const child = await prisma.child.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    const updated = await prisma.child.update({
      where: { id: req.params.id as string },
      data: { baseline: JSON.stringify({ answers, completedAt: new Date().toISOString() }) },
    });

    success(res, formatChild(updated));
  } catch (e) {
    error(res, '베이스라인 저장 중 오류가 발생했습니다', 500);
  }
});

export default router;
