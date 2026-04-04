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
