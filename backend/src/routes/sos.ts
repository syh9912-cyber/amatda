import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Symptom = 'fever' | 'vomiting' | 'seizure' | 'breathing' | 'bleeding' | 'rash' | 'consciousness';
type PregnancySymptom = 'bleeding' | 'severe_pain' | 'headache' | 'swelling' | 'vision' | 'leaking' | 'no_movement' | 'fever' | 'breathing' | 'contractions';

type UrgencyLevel = 'EMERGENCY' | 'HOSPITAL' | 'URGENT' | 'MONITOR';

interface UrgencyResult {
  urgency: UrgencyLevel;
  message: string;
  actions: string[];
  showEmergencyCall: boolean;
}

interface DoseInfo {
  doseMg: string;
  syrupMl: string;
  interval: string;
  maxDaily: string;
  ageRestriction?: string;
}

interface FeverCalcResult {
  childWeight: number;
  acetaminophen: DoseInfo;
  ibuprofen: DoseInfo;
  alternatingSchedule: string[];
  warning: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** 생년월일로부터 개월 수 계산 */
function calcAgeMonths(birthDate: string | Date): number {
  const bd = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const now = new Date();
  return (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
}

/** 개월 수로부터 한국 소아 평균 체중(kg) 추정 */
function estimateWeightFromAge(ageMonths: number): number {
  if (ageMonths <= 3) return 5;
  if (ageMonths <= 6) return 7;
  if (ageMonths <= 12) return 9;
  if (ageMonths <= 24) return 12;
  if (ageMonths <= 36) return 14;
  if (ageMonths <= 48) return 16;
  if (ageMonths <= 60) return 18;
  if (ageMonths <= 72) return 20;
  if (ageMonths <= 96) return 25;
  if (ageMonths <= 120) return 35;
  return 45;
}

/** 증상 + 온도 + 나이로 긴급도 판정 */
function assessUrgency(
  symptoms: Symptom[],
  temperature: number | undefined,
  ageMonths: number,
): UrgencyResult {
  const has = (s: Symptom) => symptoms.includes(s);
  const isInfant = ageMonths < 3;
  const temp = temperature ?? 0;

  // EMERGENCY: 경련, 호흡곤란, 의식저하
  if (has('seizure') || has('breathing') || has('consciousness')) {
    return {
      urgency: 'EMERGENCY',
      message: '즉시 119에 전화하세요!',
      actions: [
        '119에 즉시 전화하세요',
        '아이를 안전한 곳에 눕히세요',
        '기도가 막히지 않도록 옆으로 눕히세요',
        '의식이 없으면 심폐소생술을 시작하세요',
      ],
      showEmergencyCall: true,
    };
  }

  // HOSPITAL: 고열40+, 출혈+영아, 발열+경련, 지속구토
  if (temp >= 40) {
    return {
      urgency: 'HOSPITAL',
      message: '즉시 병원에 방문하세요!',
      actions: [
        '가까운 응급실로 즉시 이동하세요',
        '해열제를 투여하고 체온을 계속 확인하세요',
        '수분을 충분히 보충해주세요',
        '옷을 가볍게 입히세요',
      ],
      showEmergencyCall: true,
    };
  }
  if (has('bleeding') && isInfant) {
    return {
      urgency: 'HOSPITAL',
      message: '영아 출혈 - 즉시 병원에 방문하세요!',
      actions: [
        '깨끗한 천으로 출혈 부위를 압박하세요',
        '가까운 응급실로 즉시 이동하세요',
        '출혈량과 시간을 기록해두세요',
      ],
      showEmergencyCall: true,
    };
  }
  if (has('fever') && has('seizure')) {
    return {
      urgency: 'HOSPITAL',
      message: '열성경련 의심 - 즉시 병원에 방문하세요!',
      actions: [
        '아이를 옆으로 눕히세요',
        '입에 아무것도 넣지 마세요',
        '경련 시간을 기록하세요',
        '가까운 응급실로 즉시 이동하세요',
      ],
      showEmergencyCall: true,
    };
  }
  if (has('vomiting') && symptoms.length >= 2) {
    // 지속 구토 (다른 증상 동반)
    return {
      urgency: 'HOSPITAL',
      message: '지속적인 구토 - 병원에 방문하세요',
      actions: [
        '탈수 방지를 위해 소량의 수분을 자주 보충하세요',
        '구토 빈도와 시간을 기록하세요',
        '가까운 소아과를 방문하세요',
      ],
      showEmergencyCall: false,
    };
  }

  // URGENT: 영아 38.5+, 39+ 모든 연령, 발진+발열
  if (isInfant && temp >= 38.5) {
    return {
      urgency: 'URGENT',
      message: '3개월 미만 영아 발열 - 병원 방문을 권장합니다',
      actions: [
        '3개월 미만 영아의 발열은 반드시 진료가 필요합니다',
        '가까운 소아과 또는 응급실을 방문하세요',
        '체온을 15분 간격으로 측정하세요',
      ],
      showEmergencyCall: false,
    };
  }
  if (temp >= 39) {
    return {
      urgency: 'URGENT',
      message: '고열 - 병원 방문을 권장합니다',
      actions: [
        '해열제를 체중에 맞게 투여하세요',
        '미지근한 물로 몸을 닦아주세요',
        '수분을 충분히 보충해주세요',
        '30분 후에도 열이 안 내리면 병원에 가세요',
      ],
      showEmergencyCall: false,
    };
  }
  if (has('rash') && has('fever')) {
    return {
      urgency: 'URGENT',
      message: '발진 + 발열 - 병원 방문을 권장합니다',
      actions: [
        '발진 부위와 모양을 사진으로 기록하세요',
        '가까운 소아과를 방문하세요',
        '다른 아이들과 접촉을 피하세요',
      ],
      showEmergencyCall: false,
    };
  }

  // MONITOR: 경미한 발열, 단독 발진, 단독 구토
  if (temp >= 37.5 && temp < 38.5 && symptoms.length <= 1) {
    return {
      urgency: 'MONITOR',
      message: '미열 - 경과를 관찰하세요',
      actions: [
        '30분~1시간 간격으로 체온을 측정하세요',
        '수분을 자주 보충해주세요',
        '옷을 가볍게 입히세요',
        '38.5도 이상이면 해열제를 투여하세요',
      ],
      showEmergencyCall: false,
    };
  }
  if (has('rash') && symptoms.length === 1) {
    return {
      urgency: 'MONITOR',
      message: '발진 - 경과를 관찰하세요',
      actions: [
        '발진 부위와 모양을 사진으로 기록하세요',
        '발진이 퍼지거나 열이 동반되면 병원에 가세요',
        '긁지 않도록 주의하세요',
      ],
      showEmergencyCall: false,
    };
  }
  if (has('vomiting') && symptoms.length === 1) {
    return {
      urgency: 'MONITOR',
      message: '구토 - 경과를 관찰하세요',
      actions: [
        '30분간 음식을 주지 마세요',
        '이후 소량의 물부터 시작하세요',
        '3시간 이상 지속되면 병원에 가세요',
      ],
      showEmergencyCall: false,
    };
  }

  // 기본 MONITOR
  return {
    urgency: 'MONITOR',
    message: '증상을 관찰하세요',
    actions: [
      '증상 변화를 주의 깊게 관찰하세요',
      '악화되면 병원에 방문하세요',
      '수분을 충분히 보충해주세요',
    ],
    showEmergencyCall: false,
  };
}

/** 임산부 증상 긴급도 판정 */
function assessPregnancyUrgency(
  symptoms: PregnancySymptom[],
  temperature: number | undefined,
): UrgencyResult {
  const has = (s: PregnancySymptom) => symptoms.includes(s);
  const temp = temperature ?? 0;

  // EMERGENCY: 양수 파수, 대량 출혈, 호흡곤란, 경련급 두통+시야장애
  if (has('leaking')) {
    return {
      urgency: 'EMERGENCY',
      message: '양수 파수 의심 - 즉시 병원으로 가세요!',
      actions: [
        '움직이지 말고 누운 자세를 유지하세요',
        '깨끗한 패드나 수건을 대세요',
        '양수 색깔(투명/녹색/혈액)을 확인하세요',
        '119 또는 담당 산부인과에 즉시 연락하세요',
      ],
      showEmergencyCall: true,
    };
  }
  if (has('breathing')) {
    return {
      urgency: 'EMERGENCY',
      message: '호흡곤란 - 즉시 119에 전화하세요!',
      actions: [
        '편안한 자세(반좌위)로 앉으세요',
        '창문을 열어 환기하세요',
        '119에 즉시 전화하세요',
      ],
      showEmergencyCall: true,
    };
  }
  if (has('bleeding') && (has('severe_pain') || symptoms.length >= 3)) {
    return {
      urgency: 'EMERGENCY',
      message: '출혈 + 복통 - 즉시 응급실로 가세요!',
      actions: [
        '절대 움직이지 말고 누워 계세요',
        '출혈량과 색깔을 기록하세요',
        '119 또는 담당 산부인과에 즉시 연락하세요',
        '태반 조기 박리 가능성이 있어요',
      ],
      showEmergencyCall: true,
    };
  }

  // HOSPITAL: 출혈, 심한 복통, 두통+시야 흐림(전자간증), 태동 감소
  if (has('bleeding')) {
    return {
      urgency: 'HOSPITAL',
      message: '출혈 - 병원에 방문하세요',
      actions: [
        '패드를 대고 출혈량을 확인하세요',
        '담당 산부인과에 연락하세요',
        '움직임을 최소화하고 안정하세요',
        '선홍색 출혈이면 즉시 응급실로 가세요',
      ],
      showEmergencyCall: false,
    };
  }
  if (has('severe_pain')) {
    return {
      urgency: 'HOSPITAL',
      message: '심한 복통 - 병원에 방문하세요',
      actions: [
        '통증 위치와 간격을 기록하세요',
        '담당 산부인과에 연락하세요',
        '편안한 자세로 눕고 안정하세요',
        '규칙적 간격이면 진통일 수 있어요',
      ],
      showEmergencyCall: false,
    };
  }
  if (has('headache') && has('vision')) {
    return {
      urgency: 'HOSPITAL',
      message: '전자간증 의심 - 즉시 병원에 방문하세요!',
      actions: [
        '혈압을 측정해보세요',
        '어둡고 조용한 곳에서 안정하세요',
        '담당 산부인과에 즉시 연락하세요',
        '손발 부종이 심해지는지 확인하세요',
      ],
      showEmergencyCall: true,
    };
  }
  if (has('no_movement')) {
    return {
      urgency: 'HOSPITAL',
      message: '태동 감소 - 병원에서 확인하세요',
      actions: [
        '왼쪽으로 누워서 30분간 태동을 세어보세요',
        '차가운 음료를 마시고 다시 확인하세요',
        '2시간 내 태동 10회 미만이면 병원으로 가세요',
        '담당 산부인과에 연락하세요',
      ],
      showEmergencyCall: false,
    };
  }

  // URGENT: 규칙적 수축, 고열, 심한 부종, 심한 두통
  if (has('contractions')) {
    return {
      urgency: 'URGENT',
      message: '규칙적 수축 - 간격을 체크하세요',
      actions: [
        '수축 시작/끝 시간과 간격을 기록하세요',
        '5분 간격으로 1시간 이상 지속되면 병원으로 가세요',
        '따뜻한 물로 샤워하면 가진통은 줄어들어요',
        '양수가 터지면 즉시 병원으로 가세요',
      ],
      showEmergencyCall: false,
    };
  }
  if (temp >= 38) {
    return {
      urgency: 'URGENT',
      message: '임산부 발열 - 병원 방문을 권장합니다',
      actions: [
        '수분을 충분히 섭취하세요',
        '담당 산부인과에 연락하세요',
        '임의로 해열제를 복용하지 마세요',
        '38.5도 이상이면 즉시 병원으로 가세요',
      ],
      showEmergencyCall: false,
    };
  }
  if (has('headache')) {
    return {
      urgency: 'URGENT',
      message: '심한 두통 - 경과를 주의 깊게 관찰하세요',
      actions: [
        '어둡고 조용한 곳에서 쉬세요',
        '혈압을 측정해보세요',
        '시야 흐림이나 부종이 동반되면 즉시 병원으로 가세요',
        '담당 산부인과에 연락하세요',
      ],
      showEmergencyCall: false,
    };
  }
  if (has('swelling')) {
    return {
      urgency: 'URGENT',
      message: '심한 부종 - 병원에서 확인하세요',
      actions: [
        '발을 높이 올리고 쉬세요',
        '염분 섭취를 줄이세요',
        '얼굴/손이 갑자기 부으면 전자간증 가능성이 있어요',
        '두통이나 시야 변화가 동반되면 즉시 병원으로 가세요',
      ],
      showEmergencyCall: false,
    };
  }
  if (has('vision')) {
    return {
      urgency: 'URGENT',
      message: '시야 이상 - 병원 방문을 권장합니다',
      actions: [
        '혈압을 측정해보세요',
        '눈 앞에 별이 보이거나 번쩍이면 전자간증 신호예요',
        '담당 산부인과에 연락하세요',
      ],
      showEmergencyCall: false,
    };
  }

  // MONITOR: 경미한 증상
  return {
    urgency: 'MONITOR',
    message: '증상을 관찰하세요',
    actions: [
      '증상 변화를 주의 깊게 관찰하세요',
      '악화되면 담당 산부인과에 연락하세요',
      '수분을 충분히 섭취하고 안정하세요',
    ],
    showEmergencyCall: false,
  };
}

/* ------------------------------------------------------------------ */
/* POST /api/sos/check-symptom                                         */
/* ------------------------------------------------------------------ */

router.post('/check-symptom', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, symptoms, temperature } = req.body as {
      childId: string;
      symptoms: string[];
      temperature?: number;
    };

    if (!childId || !symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      error(res, 'childId와 symptoms 배열은 필수입니다');
      return;
    }

    // 아이 정보 조회
    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists) {
      error(res, '아이 정보를 찾을 수 없습니다', 404);
      return;
    }

    const childData = childDoc.data()!;
    const isPregnant = childData.isPregnant === true;

    // 임산부: 전용 판정 로직 사용
    if (isPregnant) {
      const result = assessPregnancyUrgency(symptoms as PregnancySymptom[], temperature);
      success(res, result);
      return;
    }

    const ageMonths = childData.birthDate
      ? calcAgeMonths(childData.birthDate as string)
      : 999;
    const result = assessUrgency(symptoms as Symptom[], temperature, ageMonths);

    success(res, result);
  } catch {
    error(res, '증상 확인 중 오류가 발생했습니다', 500);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/sos/fever-calculator                                       */
/* ------------------------------------------------------------------ */

router.get('/fever-calculator', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.query.childId as string | undefined;
    const temperatureStr = req.query.temperature as string | undefined;

    if (!childId) {
      error(res, 'childId는 필수입니다');
      return;
    }

    const temperature = temperatureStr ? parseFloat(temperatureStr) : undefined;

    // 아이 정보 조회
    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists) {
      error(res, '아이 정보를 찾을 수 없습니다', 404);
      return;
    }

    const childData = childDoc.data()!;
    const ageMonths = childData.birthDate
      ? calcAgeMonths(childData.birthDate as string)
      : 999;

    // 체중 결정: DB > 나이 기반 추정
    const childWeight: number =
      typeof childData.weight === 'number' && childData.weight > 0
        ? childData.weight
        : estimateWeightFromAge(ageMonths);

    // 아세트아미노펜 (타이레놀): 10-15 mg/kg, 32mg/ml 시럽
    const acetaminophenDoseMg = Math.round(childWeight * 12.5 * 10) / 10; // 중간값 12.5
    const acetaminophenSyrupMl = Math.round((acetaminophenDoseMg / 32) * 10) / 10;

    // 이부프로펜 (부루펜): 5-10 mg/kg, 20mg/ml 시럽
    const ibuprofenDoseMg = Math.round(childWeight * 7.5 * 10) / 10; // 중간값 7.5
    const ibuprofenSyrupMl = Math.round((ibuprofenDoseMg / 20) * 10) / 10;

    const isUnder6Months = ageMonths < 6;

    const acetaminophen: DoseInfo = {
      doseMg: `${Math.round(childWeight * 10)}-${Math.round(childWeight * 15)}mg (권장 ${acetaminophenDoseMg}mg)`,
      syrupMl: `${acetaminophenSyrupMl}ml (어린이 타이레놀 시럽 32mg/ml 기준)`,
      interval: '4-6시간 간격',
      maxDaily: '하루 최대 5회',
    };

    const ibuprofen: DoseInfo = {
      doseMg: `${Math.round(childWeight * 5)}-${Math.round(childWeight * 10)}mg (권장 ${ibuprofenDoseMg}mg)`,
      syrupMl: `${ibuprofenSyrupMl}ml (어린이 부루펜 시럽 20mg/ml 기준)`,
      interval: '6-8시간 간격',
      maxDaily: '하루 최대 3회',
      ...(isUnder6Months ? { ageRestriction: '6개월 미만 영아에게는 이부프로펜을 투여하지 마세요' } : {}),
    };

    const alternatingSchedule: string[] = isUnder6Months
      ? [
          '6개월 미만은 타이레놀만 사용하세요',
          `타이레놀 ${acetaminophenSyrupMl}ml 투여`,
          '4-6시간 후 체온 확인',
          '필요시 타이레놀 재투여',
        ]
      : [
          `타이레놀 ${acetaminophenSyrupMl}ml 투여`,
          '3시간 후 체온 확인',
          `부루펜 ${ibuprofenSyrupMl}ml 투여`,
          '3시간 후 체온 확인',
          `타이레놀 ${acetaminophenSyrupMl}ml 투여`,
          '이 패턴을 반복 (24시간 이상 지속 시 병원 방문)',
        ];

    let warning = '해열제는 체중 기준으로 용량을 계산합니다. ';
    if (typeof childData.weight !== 'number' || childData.weight <= 0) {
      warning += '체중이 등록되지 않아 나이 기반 추정치를 사용했습니다. 정확한 용량을 위해 아이 프로필에 체중을 등록해주세요. ';
    }
    if (temperature !== undefined && temperature >= 39) {
      warning += '39도 이상의 고열이면 해열제 투여 후 30분 내 병원 방문을 권장합니다. ';
    }
    warning += '반드시 제품 설명서를 확인하고, 의사의 지시를 따라주세요.';

    const result: FeverCalcResult = {
      childWeight,
      acetaminophen,
      ibuprofen,
      alternatingSchedule,
      warning,
    };

    success(res, result);
  } catch {
    error(res, '해열제 계산 중 오류가 발생했습니다', 500);
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/sos/notify-family                                         */
/* ------------------------------------------------------------------ */

router.post('/notify-family', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, situation, temperature } = req.body as {
      childId: string;
      situation: string;
      temperature?: number;
    };

    if (!childId || !situation) {
      error(res, 'childId와 situation은 필수입니다');
      return;
    }

    // 아이 정보 조회
    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists) {
      error(res, '아이 정보를 찾을 수 없습니다', 404);
      return;
    }

    const childData = childDoc.data()!;
    const childName = childData.name as string;

    // 가족 구성원 조회 (accepted 상태만)
    const membersSnap = await collections.familyMembers
      .where('childId', '==', childId)
      .where('status', '==', 'accepted')
      .get();

    const notifiedMembers: string[] = [];
    const batch = collections.pushSchedules.firestore.batch();

    for (const doc of membersSnap.docs) {
      const member = doc.data();
      const memberId = member.userId as string;

      // 본인에게는 보내지 않음
      if (memberId === req.userId) continue;

      const scheduleId = genId();
      const scheduleRef = collections.pushSchedules.doc(scheduleId);

      batch.set(scheduleRef, {
        userId: memberId,
        type: 'emergency',
        title: '긴급 알림',
        body: `${childName} 긴급: ${situation}`,
        data: {
          childId,
          ...(temperature !== undefined ? { temperature } : {}),
        },
        scheduledAt: FieldValue.serverTimestamp(),
        status: 'pending',
      });

      const nickname = (member.nickname as string) || memberId;
      notifiedMembers.push(nickname);
    }

    if (notifiedMembers.length > 0) {
      await batch.commit();
    }

    success(res, {
      notifiedCount: notifiedMembers.length,
      members: notifiedMembers,
    });
  } catch {
    error(res, '가족 알림 전송 중 오류가 발생했습니다', 500);
  }
});

export default router;
