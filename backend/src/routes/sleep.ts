import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getPatternForMonth, generateDbPrediction } from '../services/sleep.knowledge';
import { callGeminiText } from '../services/coaching/gemini.client';
import { maskChildName } from '../utils/masking';
import { getChildIfAccessible } from '../utils/childAccess';

const router = Router();

/* ------------------------------------------------------------------ */
/* POST /api/sleep/predict — DB 우선, AI 보조                          */
/* ------------------------------------------------------------------ */

router.post('/predict', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.body as { childId: string };
    const userId = (req as unknown as Record<string, string>).userId;

    if (!childId) {
      error(res, 'childId는 필수입니다');
      return;
    }

    // 1. 아이 정보 가져오기 + 권한 확인
    const access = await getChildIfAccessible(childId, req.userId, 'viewRecords', res);
    if (!access) return;
    const child = access.data;
    const birthDate = child.birthDate as string | undefined;
    const months = birthDate
      ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      : 12;

    // 2. 사용자 수면 기록 확인 (최근 7일)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const trackingSnap = await collections.dailyTracking
      .where('childId', '==', childId)
      .where('date', '>=', sevenDaysAgo.toISOString().split('T')[0])
      .orderBy('date', 'desc')
      .limit(7)
      .get();

    const trackingDocs = trackingSnap.docs.map((d) => d.data());
    const sleepLogs = trackingDocs.filter((d) => d.sleepStart || d.sleepEnd || d.sleepHours);
    const dataCount = sleepLogs.length;

    // 3. 데이터 부족 시 — DB 패턴만 반환
    if (dataCount === 0) {
      const pattern = getPatternForMonth(months);
      success(res, {
        insufficient: true,
        message: `아직 수면 기록이 없어요. 육아기록에서 수면 시작/종료를 기록하면 ${child.name ?? '아이'}만의 맞춤 수면 예측을 제공합니다.`,
        recommendation: {
          ageLabel: pattern.ageLabel,
          totalSleep: pattern.totalSleep,
          nightSleep: pattern.nightSleep,
          napCount: pattern.napCount,
          bedtime: pattern.bedtime,
          wakeTime: pattern.wakeTime,
          tips: pattern.tips,
          commonIssues: pattern.commonIssues,
        },
        dataCount: 0,
        requiredCount: 3,
      });
      return;
    }

    // 4. 사용자 수면 통계 계산
    let totalHours = 0;
    let bedtimeMinutes = 0;
    let validBedtimes = 0;
    for (const log of sleepLogs) {
      if (log.sleepHours) totalHours += Number(log.sleepHours);
      if (log.sleepStart) {
        const parts = String(log.sleepStart).split(':');
        if (parts.length === 2) {
          let h = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (h < 12) h += 24; // 새벽 시간 보정
          bedtimeMinutes += h * 60 + m;
          validBedtimes++;
        }
      }
    }
    const avgSleepHours = dataCount > 0 ? totalHours / dataCount : undefined;
    const avgBedtimeMin = validBedtimes > 0 ? Math.round(bedtimeMinutes / validBedtimes) : undefined;
    const avgBedtime = avgBedtimeMin
      ? `${String(avgBedtimeMin >= 24 * 60 ? Math.floor(avgBedtimeMin / 60) - 24 : Math.floor(avgBedtimeMin / 60)).padStart(2, '0')}:${String(avgBedtimeMin % 60).padStart(2, '0')}`
      : undefined;

    // 5. 캐시 확인 — 같은 월령대 + 비슷한 데이터면 캐시 사용
    const ageKey = months <= 12 ? String(months) : months <= 24 ? `${Math.floor(months / 3) * 3}` : `${Math.floor(months / 6) * 6}`;
    const cacheDoc = await collections.sleepKnowledgeCache.doc(`age_${ageKey}`).get();
    const cacheData = cacheDoc.exists ? cacheDoc.data() : null;
    const cacheAge = cacheData?.updatedAt
      ? (Date.now() - new Date(cacheData.updatedAt as string).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // 6. DB 예측 생성
    const dbResult = generateDbPrediction(months, {
      avgSleepHours,
      avgBedtime,
      dataCount,
    });

    // 데이터가 3일 미만이면 DB 예측만 반환 (AI 불필요)
    if (dataCount < 3) {
      success(res, {
        insufficient: false,
        prediction: dbResult.prediction,
        dataCount,
        source: 'db',
        message: `${dataCount}일치 기록이 있어요. 3일 이상 기록하면 더 정확한 예측을 해드려요.`,
      });
      return;
    }

    // 7. 캐시가 유효하면 캐시 사용 (7일 이내)
    if (cacheData && cacheAge < 7 && cacheData.prediction) {
      // 개인화 데이터 병합
      const cached = cacheData.prediction as Record<string, unknown>;
      if (avgBedtime && (cached.bedtime as Record<string, unknown>)) {
        (cached.bedtime as Record<string, unknown>).time = avgBedtime;
        (cached.bedtime as Record<string, unknown>).reason = `최근 ${dataCount}일 취침 기록 평균`;
        (cached.bedtime as Record<string, unknown>).confidence = dataCount >= 7 ? 'high' : 'medium';
      }
      if (avgSleepHours) {
        cached.avgSleepHours = `약 ${avgSleepHours.toFixed(1)}시간`;
      }

      success(res, {
        insufficient: false,
        prediction: cached,
        dataCount,
        source: 'cache',
      });
      return;
    }

    // 8. AI 예측 (데이터 3일 이상 + 캐시 만료 시에만)
    const rawName = String(child.name ?? '아이');
    const childName = maskChildName(rawName, rawName);
    const pattern = dbResult.pattern;
    const prompt = `${childName}(${months}개월)의 수면 데이터:
- 최근 ${dataCount}일 평균 수면: ${avgSleepHours?.toFixed(1) ?? '미상'}시간
- 평균 취침: ${avgBedtime ?? '미상'}
- 권장 총 수면: ${pattern.totalSleep}
- 권장 낮잠: ${pattern.napCount}, ${pattern.napDuration}

현재 시각: ${new Date().getHours()}시

아래 JSON 형식으로만 답변하세요:
{"nextNap":{"label":"다음 낮잠","time":"시간","confidence":"high/medium/low","reason":"이유"},"bedtime":{"label":"취침 시간","time":"시간","confidence":"high/medium/low","reason":"이유"},"tips":["팁1","팁2","팁3"],"avgSleepHours":"시간","pattern":"패턴설명"}`;

    try {
      const aiText = await callGeminiText(prompt, { temperature: 0.3, maxTokens: 800 });
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const aiPrediction = JSON.parse(jsonMatch[0]);

        // 캐시에 저장 (다른 같은 월령 유저에게 재활용)
        await collections.sleepKnowledgeCache.doc(`age_${ageKey}`).set({
          prediction: aiPrediction,
          ageKey,
          months,
          updatedAt: new Date().toISOString(),
        });

        // 개인 예측 기록 저장
        await collections.sleepPredictions.doc(genId()).set({
          userId,
          childId,
          months,
          prediction: aiPrediction,
          trackingData: { avgSleepHours, avgBedtime, dataCount },
          createdAt: FieldValue.serverTimestamp(),
        });

        success(res, {
          insufficient: false,
          prediction: aiPrediction,
          dataCount,
          source: 'ai',
        });
        return;
      }
    } catch {
      // AI 실패 시 DB 예측으로 폴백
    }

    // 9. AI 실패 시 DB 예측 반환
    success(res, {
      insufficient: false,
      prediction: dbResult.prediction,
      dataCount,
      source: 'db',
    });

  } catch (err) {
    console.error('Sleep predict error:', err);
    error(res, '수면 예측 중 오류가 발생했습니다');
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/sleep/history — 저장된 예측 기록                            */
/* ------------------------------------------------------------------ */

router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.query.childId as string;
    if (!childId) {
      error(res, 'childId는 필수입니다');
      return;
    }

    const snap = await collections.sleepPredictions
      .where('childId', '==', childId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const history = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
    }));

    success(res, { history });
  } catch (err) {
    console.error('Sleep history error:', err);
    error(res, '수면 기록 조회 중 오류가 발생했습니다');
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/sleep/pattern — 월령별 DB 수면 패턴 조회                    */
/* ------------------------------------------------------------------ */

router.get('/pattern', authMiddleware, async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string, 10);
    if (isNaN(months)) {
      error(res, 'months는 필수입니다');
      return;
    }
    const pattern = getPatternForMonth(months);
    success(res, { pattern });
  } catch (err) {
    error(res, '패턴 조회 오류');
  }
});

export default router;
