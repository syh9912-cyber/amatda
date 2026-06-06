import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getChildIfAccessible } from '../utils/childAccess';

const router = Router();

/* ================================================================== */
/*  대한민국 국가 표준 예방접종 스케줄 (질병관리청 2024 기준)           */
/*  ageMonths = 접종 권장 월령, rangeStart~rangeEnd = 허용 범위        */
/* ================================================================== */

interface VaccineEntry {
  id: string;            // 고유 키
  name: string;          // 백신명
  disease: string;       // 예방 질환
  dose: string;          // 차수 (1차, 2차 등)
  ageMonths: number;     // 권장 월령
  rangeStart: number;    // 접종 가능 시작 월령
  rangeEnd: number;      // 접종 가능 종료 월령
  required: boolean;     // 필수/선택
  notes: string;         // 참고사항
  preparation: string;   // 준비물·주의사항
}

const NATIONAL_VACCINES: VaccineEntry[] = [
  // ── 0개월 (출생) ──
  { id: 'bcg-1', name: 'BCG(피내용)', disease: '결핵', dose: '1회', ageMonths: 0, rangeStart: 0, rangeEnd: 1, required: true, notes: '출생 후 4주 이내 접종', preparation: '준비물: 모자보건수첩, 아이 보험증\n주의: 접종 부위 화농·딱지는 정상 반응 (2~3개월 지속)' },
  { id: 'hepb-1', name: 'B형간염', disease: 'B형간염', dose: '1차', ageMonths: 0, rangeStart: 0, rangeEnd: 0, required: true, notes: '출생 후 12시간 이내 접종', preparation: '준비물: 모자보건수첩\n주의: 산모 B형간염 보균 시 면역글로블린 동시 접종' },

  // ── 1개월 ──
  { id: 'hepb-2', name: 'B형간염', disease: 'B형간염', dose: '2차', ageMonths: 1, rangeStart: 1, rangeEnd: 1, required: true, notes: '1차 접종 후 1개월 뒤', preparation: '준비물: 모자보건수첩, 1차 접종 기록\n주의: 접종 당일 목욕 가능, 격한 운동 피하기' },

  // ── 2개월 ──
  { id: 'dtap-1', name: 'DTaP', disease: '디프테리아/파상풍/백일해', dose: '1차', ageMonths: 2, rangeStart: 2, rangeEnd: 2, required: true, notes: '기초접종 시작', preparation: '준비물: 모자보건수첩\n주의: 접종 후 발열(38.5도 이하)은 정상, 해열제 준비\n접종 후 30분 병원 대기' },
  { id: 'ipv-1', name: 'IPV', disease: '폴리오', dose: '1차', ageMonths: 2, rangeStart: 2, rangeEnd: 2, required: true, notes: 'DTaP와 동시 접종 가능', preparation: '준비물: 모자보건수첩\n주의: 같은 날 DTaP과 함께 접종 가능 (다른 부위)' },
  { id: 'hib-1', name: 'Hib', disease: '뇌수막염(b형)', dose: '1차', ageMonths: 2, rangeStart: 2, rangeEnd: 2, required: true, notes: '뇌수막염 예방', preparation: '준비물: 모자보건수첩\n주의: 접종 부위 발적·부종 2~3일 내 소실' },
  { id: 'pcv-1', name: 'PCV', disease: '폐렴구균', dose: '1차', ageMonths: 2, rangeStart: 2, rangeEnd: 2, required: true, notes: '폐렴 예방', preparation: '준비물: 모자보건수첩\n주의: 발열 시 미온수 마사지, 수분 보충' },
  { id: 'rv-1', name: 'RV(로타바이러스)', disease: '로타바이러스', dose: '1차', ageMonths: 2, rangeStart: 2, rangeEnd: 2, required: true, notes: '경구 투여 (먹는 백신)', preparation: '준비물: 모자보건수첩\n주의: 먹는 백신이라 주사 안 맞음\n접종 전후 30분 수유 피하기' },

  // ── 4개월 ──
  { id: 'dtap-2', name: 'DTaP', disease: '디프테리아/파상풍/백일해', dose: '2차', ageMonths: 4, rangeStart: 4, rangeEnd: 4, required: true, notes: '기초접종 2차', preparation: '준비물: 모자보건수첩, 해열제(타이레놀시럽)\n주의: 1차보다 발열 반응 클 수 있음' },
  { id: 'ipv-2', name: 'IPV', disease: '폴리오', dose: '2차', ageMonths: 4, rangeStart: 4, rangeEnd: 4, required: true, notes: 'DTaP와 동시 접종 가능', preparation: '준비물: 모자보건수첩\n주의: 이전 접종 이상 반응 있었으면 의사에게 알리기' },
  { id: 'hib-2', name: 'Hib', disease: '뇌수막염(b형)', dose: '2차', ageMonths: 4, rangeStart: 4, rangeEnd: 4, required: true, notes: '기초접종 2차', preparation: '준비물: 모자보건수첩' },
  { id: 'pcv-2', name: 'PCV', disease: '폐렴구균', dose: '2차', ageMonths: 4, rangeStart: 4, rangeEnd: 4, required: true, notes: '기초접종 2차', preparation: '준비물: 모자보건수첩\n주의: 접종 후 보채거나 식욕 저하는 정상' },
  { id: 'rv-2', name: 'RV(로타바이러스)', disease: '로타바이러스', dose: '2차', ageMonths: 4, rangeStart: 4, rangeEnd: 4, required: true, notes: '경구 투여 2차', preparation: '준비물: 모자보건수첩\n주의: 구토 시 재접종 불필요' },

  // ── 6개월 ──
  { id: 'dtap-3', name: 'DTaP', disease: '디프테리아/파상풍/백일해', dose: '3차', ageMonths: 6, rangeStart: 6, rangeEnd: 6, required: true, notes: '기초접종 3차 완료', preparation: '준비물: 모자보건수첩, 해열제\n주의: 기초접종 마지막! 접종 후 2~3일 쉬어주기' },
  { id: 'hepb-3', name: 'B형간염', disease: 'B형간염', dose: '3차', ageMonths: 6, rangeStart: 6, rangeEnd: 6, required: true, notes: '기초접종 완료', preparation: '준비물: 모자보건수첩\n주의: 3차까지 맞아야 항체 완성' },
  { id: 'hib-3', name: 'Hib', disease: '뇌수막염(b형)', dose: '3차', ageMonths: 6, rangeStart: 6, rangeEnd: 6, required: true, notes: '기초접종 3차', preparation: '준비물: 모자보건수첩' },
  { id: 'pcv-3', name: 'PCV', disease: '폐렴구균', dose: '3차', ageMonths: 6, rangeStart: 6, rangeEnd: 6, required: true, notes: '기초접종 3차', preparation: '준비물: 모자보건수첩' },
  { id: 'rv-3', name: 'RV(로타바이러스)', disease: '로타바이러스', dose: '3차', ageMonths: 6, rangeStart: 6, rangeEnd: 8, required: true, notes: '경구 투여 3차 (제품따라 2~3차)', preparation: '준비물: 모자보건수첩\n주의: 로타릭스는 2차로 완료, 로타텍은 3차 필요' },
  { id: 'flu-1', name: '인플루엔자', disease: '독감', dose: '1차 (매년)', ageMonths: 6, rangeStart: 6, rangeEnd: 12, required: true, notes: '최초 접종 시 4주 간격 2회, 이후 매년 1회', preparation: '준비물: 모자보건수첩\n주의: 계란 알레르기 있으면 의사에게 반드시 알리기\n매년 9~10월 접종 권장' },

  // ── 12개월 ──
  { id: 'mmr-1', name: 'MMR', disease: '홍역/볼거리/풍진', dose: '1차', ageMonths: 12, rangeStart: 12, rangeEnd: 15, required: true, notes: '생백신 — 접종 후 4주간 다른 생백신 불가', preparation: '준비물: 모자보건수첩\n주의: 접종 후 7~12일 뒤 미열·발진 가능 (정상)\n생백신이라 면역저하 아이 주의' },
  { id: 'var-1', name: '수두', disease: '수두', dose: '1차', ageMonths: 12, rangeStart: 12, rangeEnd: 15, required: true, notes: 'MMR과 동시 접종 가능', preparation: '준비물: 모자보건수첩\n주의: 접종 후 수두 유사 발진 소수 나올 수 있음' },
  { id: 'hepa-1', name: 'A형간염', disease: 'A형간염', dose: '1차', ageMonths: 12, rangeStart: 12, rangeEnd: 23, required: true, notes: '6~18개월 후 2차 접종', preparation: '준비물: 모자보건수첩\n주의: 2차까지 맞아야 면역 완성 (6~18개월 뒤)' },
  { id: 'pcv-4', name: 'PCV', disease: '폐렴구균', dose: '추가', ageMonths: 12, rangeStart: 12, rangeEnd: 15, required: true, notes: '추가접종으로 면역 완성', preparation: '준비물: 모자보건수첩' },
  { id: 'hib-4', name: 'Hib', disease: '뇌수막염(b형)', dose: '추가', ageMonths: 12, rangeStart: 12, rangeEnd: 15, required: true, notes: '추가접종', preparation: '준비물: 모자보건수첩' },

  // ── 15~18개월 ──
  { id: 'dtap-4', name: 'DTaP', disease: '디프테리아/파상풍/백일해', dose: '추가 4차', ageMonths: 15, rangeStart: 15, rangeEnd: 18, required: true, notes: '추가접종 (기초 3회 + 추가 1회)', preparation: '준비물: 모자보건수첩, 해열제\n주의: 팔 전체가 부을 수 있으나 2~3일 내 소실' },

  // ── 18개월 ──
  { id: 'hepa-2', name: 'A형간염', disease: 'A형간염', dose: '2차', ageMonths: 18, rangeStart: 18, rangeEnd: 36, required: true, notes: '1차 접종 후 6~18개월 뒤', preparation: '준비물: 모자보건수첩, A형간염 1차 접종일 확인\n주의: 2차 완료해야 장기 면역' },

  // ── 24개월 ──
  { id: 'je-1', name: '일본뇌염(불활성화)', disease: '일본뇌염', dose: '1차', ageMonths: 12, rangeStart: 12, rangeEnd: 24, required: true, notes: '1~2주 간격 2회 접종', preparation: '준비물: 모자보건수첩\n주의: 1~2주 간격으로 2차까지 접종\n여름철(6~10월) 전 완료 권장' },
  { id: 'je-2', name: '일본뇌염(불활성화)', disease: '일본뇌염', dose: '2차', ageMonths: 12, rangeStart: 12, rangeEnd: 24, required: true, notes: '1차 후 1~2주 뒤', preparation: '준비물: 모자보건수첩\n주의: 1차 후 7~14일 사이 접종' },
  { id: 'je-3', name: '일본뇌염(불활성화)', disease: '일본뇌염', dose: '3차', ageMonths: 24, rangeStart: 24, rangeEnd: 36, required: true, notes: '2차 후 12개월 뒤', preparation: '준비물: 모자보건수첩\n주의: 기초접종 완료' },

  // ── 4~6세 ──
  { id: 'dtap-5', name: 'DTaP', disease: '디프테리아/파상풍/백일해', dose: '추가 5차', ageMonths: 48, rangeStart: 48, rangeEnd: 72, required: true, notes: '만 4~6세 추가접종', preparation: '준비물: 모자보건수첩\n주의: 초등학교 입학 전 필수 확인' },
  { id: 'ipv-3', name: 'IPV', disease: '폴리오', dose: '추가', ageMonths: 48, rangeStart: 48, rangeEnd: 72, required: true, notes: '만 4~6세 추가접종', preparation: '준비물: 모자보건수첩\n주의: 입학 전 접종 완료 확인' },
  { id: 'mmr-2', name: 'MMR', disease: '홍역/볼거리/풍진', dose: '2차', ageMonths: 48, rangeStart: 48, rangeEnd: 72, required: true, notes: '만 4~6세 추가접종', preparation: '준비물: 모자보건수첩\n주의: 초등 입학 전 완료 필수' },

  // ── 6세 ──
  { id: 'je-4', name: '일본뇌염(불활성화)', disease: '일본뇌염', dose: '4차', ageMonths: 72, rangeStart: 72, rangeEnd: 72, required: true, notes: '만 6세 추가접종', preparation: '준비물: 모자보건수첩' },

  // ── 11~12세 ──
  { id: 'tdap', name: 'Tdap', disease: '디프테리아/파상풍/백일해', dose: '6차', ageMonths: 132, rangeStart: 132, rangeEnd: 144, required: true, notes: '만 11~12세', preparation: '준비물: 모자보건수첩\n주의: 성인용 백신으로 전환' },
  { id: 'hpv-1', name: 'HPV', disease: '자궁경부암', dose: '1차', ageMonths: 132, rangeStart: 132, rangeEnd: 144, required: true, notes: '만 11~12세 (남녀 모두)', preparation: '준비물: 모자보건수첩\n주의: 6~12개월 간격 2회 접종\n국가무료접종 대상' },
  { id: 'je-5', name: '일본뇌염(불활성화)', disease: '일본뇌염', dose: '5차', ageMonths: 144, rangeStart: 144, rangeEnd: 144, required: true, notes: '만 12세 마지막 추가접종', preparation: '준비물: 모자보건수첩' },
];

/* ================================================================== */
/*  접종일 계산 유틸                                                    */
/* ================================================================== */

/**
 * Date 에 monthsToAdd 개월을 더하되, 일자(day)가 해당 월에 존재하지 않으면 그 달의 마지막 일로 보정.
 * 예: 2026-01-31 + 1month → setMonth 단순 사용 시 2026-03-03 으로 자동 오버플로우.
 *      이 함수는 2026-02-28 (또는 윤년 02-29) 로 안전하게 보정.
 */
function addMonthsSafe(d: Date, monthsToAdd: number): Date {
  const targetTotalMonths = d.getFullYear() * 12 + d.getMonth() + monthsToAdd;
  const targetYear = Math.floor(targetTotalMonths / 12);
  const targetMonth = ((targetTotalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(d.getDate(), lastDayOfTargetMonth);
  const result = new Date(d);
  result.setFullYear(targetYear, targetMonth, safeDay);
  return result;
}

function calcVaccineDates(birthDate: string): Array<VaccineEntry & { scheduledDate: string; dDay: number }> {
  const birth = new Date(birthDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return NATIONAL_VACCINES.map((v) => {
    // ⚠️ setMonth(getMonth() + n) 직접 사용 시 day 오버플로우 (예: 1/31 + 1m = 3/3).
    //   addMonthsSafe 로 월말 보정.
    const scheduled = addMonthsSafe(birth, v.ageMonths);
    scheduled.setHours(0, 0, 0, 0);

    const dDay = Math.ceil((scheduled.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...v,
      scheduledDate: scheduled.toISOString().split('T')[0],
      dDay,
    };
  });
}

/* ================================================================== */
/*  Firestore: vaccinations 컬렉션 (접종 완료 기록)                    */
/* ================================================================== */

import { db } from '../services/firestore';
const vaccinationsCol = collections.vaccinations;

/* ================================================================== */
/*  API Routes                                                         */
/* ================================================================== */

/**
 * GET /api/vaccination/schedule?childId=xxx
 * 아이 생일 기반 전체 접종 스케줄 + 완료 여부
 */
router.get('/schedule', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.query.childId as string;
    if (!childId) { error(res, 'childId는 필수입니다'); return; }

    // 공동육아: 소유자 OR viewRecords 권한 멤버 (BOLA 방어 + 공유 멤버 조회 허용)
    const access = await getChildIfAccessible(childId, req.userId, 'viewRecords', res);
    if (!access) return;
    const childData = access.data;
    const birthDate = childData.birthDate as string | null;
    if (!birthDate) {
      error(res, '출생일이 등록되지 않은 아이입니다 (임신 중에는 사용 불가)');
      return;
    }

    // 접종 스케줄 계산
    const schedule = calcVaccineDates(birthDate);

    // 완료 기록 조회
    const doneSnap = await vaccinationsCol
      .where('childId', '==', childId)
      .get();

    const doneMap: Record<string, { completedAt: string; hospitalName?: string }> = {};
    for (const d of doneSnap.docs) {
      const data = d.data();
      doneMap[data.vaccineId as string] = {
        completedAt: data.completedAt?.toDate?.()?.toISOString?.() ?? (data.completedAt as string),
        hospitalName: (data.hospitalName as string) || undefined,
      };
    }

    // 병합
    const result = schedule.map((v) => ({
      ...v,
      completed: !!doneMap[v.id],
      completedAt: doneMap[v.id]?.completedAt ?? null,
      hospitalName: doneMap[v.id]?.hospitalName ?? null,
    }));

    // 아이 월령
    const birth = new Date(birthDate);
    const now = new Date();
    const ageMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

    success(res, { ageMonths, schedule: result });
  } catch {
    error(res, '접종 스케줄 조회 중 오류가 발생했습니다', 500);
  }
});

/**
 * POST /api/vaccination/complete — 접종 완료 기록
 * body: { childId, vaccineId, completedAt?, hospitalName? }
 */
router.post('/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, vaccineId, completedAt, hospitalName } = req.body as {
      childId: string;
      vaccineId: string;
      completedAt?: string;
      hospitalName?: string;
    };

    if (!childId || !vaccineId) {
      error(res, 'childId와 vaccineId는 필수입니다');
      return;
    }

    // 유효한 vaccineId 확인
    const valid = NATIONAL_VACCINES.find((v) => v.id === vaccineId);
    if (!valid) { error(res, '유효하지 않은 접종 ID입니다'); return; }

    // 공동육아: 소유자 OR editRecords 권한 멤버 (공유 멤버도 접종 완료 기록 가능)
    if (!await getChildIfAccessible(childId, req.userId, 'editRecords', res)) return;

    // 중복 확인
    const existing = await vaccinationsCol
      .where('childId', '==', childId)
      .where('vaccineId', '==', vaccineId)
      .limit(1)
      .get();

    if (!existing.empty) {
      error(res, '이미 접종 완료 기록이 있습니다');
      return;
    }

    const id = genId();
    const data: Record<string, unknown> = {
      childId,
      userId: req.userId!,
      vaccineId,
      vaccineName: valid.name,
      disease: valid.disease,
      dose: valid.dose,
      completedAt: completedAt ? new Date(completedAt) : FieldValue.serverTimestamp(),
      hospitalName: hospitalName || null,
      createdAt: FieldValue.serverTimestamp(),
    };

    await vaccinationsCol.doc(id).set(data);
    success(res, { id, vaccineId, vaccineName: valid.name, dose: valid.dose }, 201);
  } catch {
    error(res, '접종 완료 기록 중 오류가 발생했습니다', 500);
  }
});

/**
 * DELETE /api/vaccination/complete/:id — 접종 완료 취소
 */
router.delete('/complete/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const recordId = req.params.id;
    const doc = await vaccinationsCol.doc(recordId).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) {
      error(res, '기록을 찾을 수 없습니다', 404);
      return;
    }
    await vaccinationsCol.doc(recordId).delete();
    success(res, { deleted: true });
  } catch {
    error(res, '접종 기록 삭제 중 오류가 발생했습니다', 500);
  }
});

/**
 * POST /api/vaccination/schedule-alerts — 접종 알림 예약 (2일전 + 1일전)
 * body: { childId }
 * 다가오는 접종에 대해 D-2, D-1 알림을 pushSchedules에 등록
 */
router.post('/schedule-alerts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId } = req.body as { childId: string };
    if (!childId) { error(res, 'childId는 필수입니다'); return; }

    // 공동육아: 소유자 OR editRecords 권한 멤버 (공유 멤버도 접종 알림 예약 가능)
    const access = await getChildIfAccessible(childId, req.userId, 'editRecords', res);
    if (!access) return;
    const childData = access.data;
    const birthDate = childData.birthDate as string | null;
    if (!birthDate) { error(res, '출생일이 등록되지 않은 아이입니다'); return; }

    const childName = childData.name as string;
    const schedule = calcVaccineDates(birthDate);

    // 완료 기록
    const doneSnap = await vaccinationsCol.where('childId', '==', childId).get();
    const doneIds = new Set(doneSnap.docs.map((d) => d.data().vaccineId as string));

    // 기존 접종 알림 삭제 (재스케줄링)
    const oldAlerts = await collections.pushSchedules
      .where('userId', '==', req.userId!)
      .where('type', '==', 'vaccination_reminder')
      .where('data.childId', '==', childId)
      .get();

    const deleteBatch = db.batch();
    for (const d of oldAlerts.docs) deleteBatch.delete(d.ref);
    if (!oldAlerts.empty) await deleteBatch.commit();

    // 다가오는 미완료 접종에 대해 알림 생성
    const upcoming = schedule.filter((v) => !doneIds.has(v.id) && v.dDay >= 1);

    const batch = db.batch();
    let alertCount = 0;

    for (const v of upcoming) {
      // ⚠️ 타임존 명시 필수 — 'T09:00:00' 만 쓰면 Cloud Run UTC 서버에서 9시 UTC(=18시 KST)로 해석됨.
      // KST 9시에 알림 가도록 +09:00 명시.
      const scheduledDate = new Date(v.scheduledDate + 'T09:00:00+09:00');

      // D-2 알림
      const d2 = new Date(scheduledDate);
      d2.setDate(d2.getDate() - 2);
      if (d2.getTime() > Date.now()) {
        const id2 = genId();
        batch.set(collections.pushSchedules.doc(id2), {
          userId: req.userId!,
          type: 'vaccination_reminder',
          title: `${v.name} ${v.dose} 접종 D-2`,
          body: `${childName}의 ${v.disease} 예방접종이 모레예요!\n${v.preparation.split('\n')[0]}`,
          data: { childId, vaccineId: v.id, dDay: 2 },
          scheduledAt: d2.toISOString(),
          status: 'pending',
        });
        alertCount++;
      }

      // D-1 알림
      const d1 = new Date(scheduledDate);
      d1.setDate(d1.getDate() - 1);
      if (d1.getTime() > Date.now()) {
        const id1 = genId();
        batch.set(collections.pushSchedules.doc(id1), {
          userId: req.userId!,
          type: 'vaccination_reminder',
          title: `${v.name} ${v.dose} 접종 내일!`,
          body: `${childName}의 ${v.disease} 예방접종이 내일이에요!\n${v.preparation}`,
          data: { childId, vaccineId: v.id, dDay: 1 },
          scheduledAt: d1.toISOString(),
          status: 'pending',
        });
        alertCount++;
      }
    }

    if (alertCount > 0) await batch.commit();

    success(res, { alertCount, upcomingVaccines: upcoming.length });
  } catch {
    error(res, '접종 알림 예약 중 오류가 발생했습니다', 500);
  }
});

export default router;
