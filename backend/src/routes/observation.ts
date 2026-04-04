import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { analyzeObservation, generateCrossReport } from '../services/ai.service';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

// POST /api/observations
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, content, type } = req.body;
    if (!childId || !content) {
      error(res, '자녀 ID와 내용을 입력해주세요');
      return;
    }

    const child = await prisma.child.findFirst({
      where: { id: childId, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    // AI 성향 추출
    const extractedTraits = await analyzeObservation(content, child.name);

    // 관찰 일기 저장
    const observation = await prisma.observation.create({
      data: {
        childId,
        type: type || 'TEXT',
        rawContent: content,
        extractedTraits: JSON.stringify(extractedTraits),
      },
    });

    // observedTraits 누적 업데이트
    const existingTraits = child.observedTraits
      ? JSON.parse(child.observedTraits)
      : { entries: [] };

    existingTraits.entries.push({
      date: new Date().toISOString(),
      traits: extractedTraits,
    });

    // 최근 10개만 유지
    if (existingTraits.entries.length > 10) {
      existingTraits.entries = existingTraits.entries.slice(-10);
    }

    await prisma.child.update({
      where: { id: childId },
      data: { observedTraits: JSON.stringify(existingTraits) },
    });

    success(res, {
      observation: {
        id: observation.id,
        type: observation.type,
        rawContent: observation.rawContent,
        extractedTraits,
        createdAt: observation.createdAt.toISOString(),
      },
    }, 201);
  } catch (e) {
    error(res, '관찰 일기 저장 중 오류가 발생했습니다', 500);
  }
});

// GET /api/observations/:childId
router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const child = await prisma.child.findFirst({
      where: { id: req.params.childId as string, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    const observations = await prisma.observation.findMany({
      where: { childId: req.params.childId as string },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    success(res, observations.map((o) => ({
      id: o.id,
      type: o.type,
      rawContent: o.rawContent,
      extractedTraits: JSON.parse(o.extractedTraits),
      createdAt: o.createdAt.toISOString(),
    })));
  } catch (e) {
    error(res, '관찰 일기 조회 중 오류가 발생했습니다', 500);
  }
});

// DELETE /api/observations/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const observation = await prisma.observation.findUnique({
      where: { id: req.params.id as string },
      include: { child: true },
    });
    if (!observation || observation.child.userId !== req.userId) {
      error(res, '관찰 일기를 찾을 수 없습니다', 404);
      return;
    }

    await prisma.observation.delete({ where: { id: observation.id } });

    success(res, { id: observation.id, message: '관찰 일기가 삭제되었습니다' });
  } catch (e) {
    error(res, '관찰 일기 삭제 중 오류가 발생했습니다', 500);
  }
});

// GET /api/children/:id/report
router.get('/report/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const child = await prisma.child.findFirst({
      where: { id: req.params.childId as string, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    const innateData = JSON.parse(child.innateData);
    const observedTraits = child.observedTraits
      ? JSON.parse(child.observedTraits)
      : null;

    // 최근 관찰에서 traits 추출
    const latestTraits = observedTraits?.entries?.length
      ? observedTraits.entries[observedTraits.entries.length - 1].traits
      : null;

    const report = generateCrossReport(innateData, latestTraits);

    success(res, {
      childName: child.name,
      innateType: innateData.dominantType,
      fiveElements: innateData.fiveElements,
      observedSummary: latestTraits?.summary ?? '관찰 데이터 없음',
      ...report,
    });
  } catch (e) {
    error(res, '리포트 생성 중 오류가 발생했습니다', 500);
  }
});

export default router;
