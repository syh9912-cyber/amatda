import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { isGeminiAvailable, callGeminiJSON } from '../services/coaching/gemini.client';

const router = Router();

/* ================================================================== */
/*  1. 임신 기록 CRUD (초음파사진, 심장소리, 의사상담, 마일스톤, 메모)  */
/* ================================================================== */

type RecordType = 'ultrasound' | 'heartbeat' | 'doctor_note' | 'milestone' | 'memo';

// 자동 마일스톤 키워드 → 타이틀 매핑
const AUTO_MILESTONES: Record<string, { title: string; emoji: string }> = {
  first_ultrasound: { title: '첫 초음파', emoji: '📸' },
  first_heartbeat: { title: '첫 심장소리', emoji: '💓' },
  gender_reveal: { title: '성별 확인', emoji: '🎀' },
  first_kick: { title: '첫 태동', emoji: '🦶' },
  name_decided: { title: '이름/태명 결정', emoji: '📝' },
  nursery_ready: { title: '아기방 준비', emoji: '🏠' },
  baby_shower: { title: '베이비 샤워', emoji: '🎉' },
  maternity_photo: { title: '만삭 사진', emoji: '📷' },
  hospital_bag: { title: '출산가방 준비', emoji: '🧳' },
  d_day: { title: '출산 D-day', emoji: '👶' },
};

/** POST /api/pregnancy/records — 기록 생성 */
router.post('/records', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, type, title, content, mediaUri, mediaType, milestoneType, week } = req.body as {
      childId: string;
      type: RecordType;
      title?: string;
      content?: string;
      mediaUri?: string;
      mediaType?: 'photo' | 'video';
      milestoneType?: string;
      week?: number;
    };

    if (!childId || !type) {
      error(res, 'childId와 type은 필수입니다');
      return;
    }

    // 아이 확인
    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '아이를 찾을 수 없습니다', 404);
      return;
    }

    // 주수 결정: 명시 or 자동 계산
    let recordWeek = week ?? null;
    if (!recordWeek && childDoc.data()!.dueDate) {
      const due = new Date(childDoc.data()!.dueDate as string);
      const now = new Date();
      const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      recordWeek = Math.max(1, Math.floor((280 - daysUntilDue) / 7));
    }

    // 마일스톤 자동 타이틀
    const autoMs = milestoneType ? AUTO_MILESTONES[milestoneType] : null;
    const finalTitle = title || autoMs?.title || type;

    const id = genId();
    const data: Record<string, unknown> = {
      childId,
      userId: req.userId!,
      type,
      title: finalTitle,
      content: content || null,
      mediaUri: mediaUri || null,
      mediaType: mediaType || null,
      milestoneType: milestoneType || null,
      milestoneEmoji: autoMs?.emoji || null,
      week: recordWeek,
      createdAt: FieldValue.serverTimestamp(),
    };

    await collections.pregnancyRecords.doc(id).set(data);

    // 가족피드에 자동 공유 (사진/영상이 있는 기록만)
    if (mediaUri) {
      try {
        const userDoc = await collections.users.doc(req.userId!).get();
        const userData = userDoc.exists ? (userDoc.data() as Record<string, unknown>) : undefined;
        const nick = (userData?.nickname as string | undefined) ?? '';
        const email = (userData?.email as string | undefined) ?? '';
        const userName = nick || (email ? (email.split('@')[0]?.slice(0, 3) + '***') : '익명');
        const childData = childDoc.data() as Record<string, unknown>;

        const postContent = autoMs
          ? `${autoMs.emoji} ${autoMs.title}\n임신 ${recordWeek ?? ''}주차 기록`
          : `${finalTitle}\n임신 ${recordWeek ?? ''}주차 기록`;

        const postId = genId();
        await collections.posts.doc(postId).set({
          userId: req.userId!,
          userName,
          childAge: `임신 ${recordWeek ?? ''}주차`,
          childGender: (childData.gender as string) || '',
          dominantType: '',
          content: content ? `${postContent}\n${content}` : postContent,
          imageUrl: mediaUri,
          thumbnailUrl: null,
          videoUrl: mediaType === 'video' ? mediaUri : null,
          mediaType: mediaType || 'image',
          sourceType: 'album',
          likes: 0,
          commentCount: 0,
          createdAt: new Date().toISOString(),
          isPublic: true,
        });
      } catch {
        // 가족피드 공유 실패해도 기록 저장은 성공
      }
    }

    success(res, { id, ...data, createdAt: new Date().toISOString() }, 201);
  } catch {
    error(res, '임신 기록 저장 중 오류가 발생했습니다', 500);
  }
});

/** GET /api/pregnancy/records?childId=xxx — 기록 목록 (주수별 그룹) */
router.get('/records', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.query.childId as string;
    if (!childId) { error(res, 'childId는 필수입니다'); return; }

    const snap = await collections.pregnancyRecords
      .where('childId', '==', childId)
      .limit(200)
      .get();

    const records = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        title: data.title,
        content: data.content,
        mediaUri: data.mediaUri,
        mediaType: data.mediaType,
        milestoneType: data.milestoneType,
        milestoneEmoji: data.milestoneEmoji,
        week: data.week,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt,
      };
    });

    success(res, records);
  } catch {
    error(res, '임신 기록 조회 중 오류가 발생했습니다', 500);
  }
});

/** DELETE /api/pregnancy/records/:id */
router.delete('/records/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const recordId = req.params.id;
    const doc = await collections.pregnancyRecords.doc(recordId).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) {
      error(res, '기록을 찾을 수 없습니다', 404);
      return;
    }
    await collections.pregnancyRecords.doc(recordId).delete();
    success(res, { deleted: true });
  } catch {
    error(res, '기록 삭제 중 오류가 발생했습니다', 500);
  }
});

/* ================================================================== */
/*  2. 엄마 상태 체크 (증상 기록 + AI 팔로업)                          */
/* ================================================================== */

const MOM_SYMPTOM_PRESETS = [
  { id: 'nausea', label: '입덧/메스꺼움', emoji: '🤢' },
  { id: 'fatigue', label: '심한 피로', emoji: '😴' },
  { id: 'back_pain', label: '허리/골반통', emoji: '🔥' },
  { id: 'swelling', label: '부종', emoji: '🦶' },
  { id: 'itching', label: '가려움', emoji: '😣' },
  { id: 'headache', label: '두통', emoji: '🤕' },
  { id: 'heartburn', label: '속쓰림', emoji: '🫠' },
  { id: 'insomnia', label: '불면', emoji: '🌙' },
  { id: 'cramp', label: '배 뭉침/경련', emoji: '😖' },
  { id: 'mood', label: '감정기복', emoji: '😢' },
  { id: 'constipation', label: '변비', emoji: '💩' },
  { id: 'bleeding', label: '출혈/분비물', emoji: '🩸' },
];

/** GET /api/pregnancy/mom-symptoms/presets — 증상 프리셋 */
router.get('/mom-symptoms/presets', authMiddleware, (_req: Request, res: Response) => {
  success(res, MOM_SYMPTOM_PRESETS);
});

/** POST /api/pregnancy/mom-health — 상태 체크 기록 */
router.post('/mom-health', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, symptoms, severity, memo } = req.body as {
      childId: string;
      symptoms: string[];
      severity: number; // 1~5
      memo?: string;
    };

    if (!childId || !symptoms || symptoms.length === 0) {
      error(res, 'childId와 symptoms는 필수입니다');
      return;
    }

    // 주수 계산
    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '아이를 찾을 수 없습니다', 404);
      return;
    }
    let week: number | null = null;
    if (childDoc.data()!.dueDate) {
      const due = new Date(childDoc.data()!.dueDate as string);
      const now = new Date();
      const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      week = Math.max(1, Math.floor((280 - daysUntilDue) / 7));
    }

    const id = genId();
    const data: Record<string, unknown> = {
      childId,
      userId: req.userId!,
      symptoms,
      severity: Math.min(5, Math.max(1, severity || 3)),
      memo: memo || null,
      week,
      createdAt: FieldValue.serverTimestamp(),
      followupSent: false,
    };

    await collections.momHealthChecks.doc(id).set(data);

    const symptomLabels = symptoms
      .map((sid: string) => MOM_SYMPTOM_PRESETS.find((p) => p.id === sid)?.label ?? sid)
      .join(', ');

    const childName = childDoc.data()!.name as string;

    // 증상별 간단 해결책
    const SYMPTOM_TIPS: Record<string, string> = {
      nausea: '소량씩 자주 먹기, 레몬/생강차, 찬 음식 추천',
      fatigue: '충분한 수면, 철분 보충, 가벼운 산책',
      back_pain: '따뜻한 찜질, 임산부 쿠션 사용, 스트레칭',
      swelling: '다리 높이 올려 쉬기, 소금 줄이기, 가벼운 마사지',
      itching: '보습제 충분히 바르기, 뜨거운 물 피하기, 면 옷 입기',
      headache: '충분한 수분, 어둡고 조용한 곳에서 휴식, 목/어깨 마사지',
      heartburn: '식후 바로 눕지 않기, 소량씩 자주 먹기, 기름진 음식 피하기',
      insomnia: '임산부 바디필로우, 카페인 줄이기, 잠자리 루틴 만들기',
      cramp: '편히 눕기, 따뜻한 물 마시기, 심하면 병원 방문',
      mood: '충분한 대화, 산책/명상, 무리하지 않기',
      constipation: '수분/섬유질 섭취, 가벼운 운동, 유산균',
      bleeding: '즉시 안정, 심하면 응급실 방문, 절대 무리 금지',
    };

    const tips = symptoms
      .map((sid: string) => SYMPTOM_TIPS[sid])
      .filter(Boolean)
      .join(' | ');

    // 1) AI 팔로업 스케줄 (24시간 후) — 엄마에게
    const followupId = genId();
    await collections.pushSchedules.doc(followupId).set({
      userId: req.userId!,
      type: 'mom_health_followup',
      title: '엄마 상태 확인',
      body: `어제 ${symptomLabels} 증상이 있으셨는데, 오늘은 좀 나아지셨나요? ${childName} 맘 건강이 제일 중요해요.`,
      data: { childId, healthCheckId: id },
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    });

    // 2) 공동육아 가족(아빠 등)에게 즉시 알림
    let notifiedFamily = 0;
    try {
      const membersSnap = await collections.familyMembers
        .where('childId', '==', childId)
        .where('status', '==', 'accepted')
        .get();

      const sevLabel = (data.severity as number) >= 4 ? '많이 힘들어해요' : (data.severity as number) >= 3 ? '불편해하고 있어요' : '약간 불편해요';
      const batch = collections.momHealthChecks.firestore.batch();

      for (const memberDoc of membersSnap.docs) {
        const member = memberDoc.data();
        const memberId = member.userId as string;
        if (memberId === req.userId) continue;

        const scheduleId = genId();
        batch.set(collections.pushSchedules.doc(scheduleId), {
          userId: memberId,
          type: 'mom_health_alert',
          title: `${childName} 엄마 상태 알림`,
          body: `${symptomLabels} 증상으로 ${sevLabel}\n도움 방법: ${tips || '옆에서 챙겨주세요'}`,
          data: { childId, healthCheckId: id, symptoms, severity: data.severity },
          scheduledAt: FieldValue.serverTimestamp(),
          status: 'pending',
        });
        notifiedFamily++;
      }

      if (notifiedFamily > 0) await batch.commit();
    } catch { /* 가족 알림 실패해도 본 기록은 유지 */ }

    success(res, {
      id,
      symptoms,
      severity: data.severity,
      week,
      tips,
      followupScheduled: true,
      notifiedFamily,
    }, 201);
  } catch {
    error(res, '엄마 상태 기록 중 오류가 발생했습니다', 500);
  }
});

/** GET /api/pregnancy/mom-health?childId=xxx — 상태 기록 목록 */
router.get('/mom-health', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.query.childId as string;
    if (!childId) { error(res, 'childId는 필수입니다'); return; }

    const snap = await collections.momHealthChecks
      .where('childId', '==', childId)
      .limit(50)
      .get();

    const records = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        symptoms: data.symptoms,
        severity: data.severity,
        memo: data.memo,
        week: data.week,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt,
      };
    });

    // 최신순 정렬 (코드에서)
    records.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    success(res, records);
  } catch {
    error(res, '엄마 상태 기록 조회 중 오류가 발생했습니다', 500);
  }
});

/* ================================================================== */
/*  3. 주수별 태아 발달 정보 (정적 데이터)                              */
/* ================================================================== */

interface WeekDevelopment {
  week: number;
  size: string;       // 크기 비유 (과일 등)
  length: string;     // cm
  weight: string;     // g
  features: string[]; // 주요 발달 특징
  momTip: string;     // 엄마 팁
}

const WEEKLY_DEVELOPMENT: WeekDevelopment[] = [
  // ─── 1분기 (1~13주) ───
  { week: 4, size: '양귀비씨', length: '0.1cm', weight: '1g 미만', features: [
    '수정란이 자궁벽에 착상 완료',
    '태반과 양막 형성 시작',
    '심장 원시 박동이 시작됨 (분당 약 65회)',
    '배아가 3개 세포층(외배엽/중배엽/내배엽)으로 분화',
    '신경관(뇌+척수 원형) 형성 시작',
  ], momTip: '엽산 400~800mcg을 매일 복용하세요. 카페인을 하루 200mg 이하로 줄이세요' },

  { week: 5, size: '참깨', length: '0.2cm', weight: '1g 미만', features: [
    '심장이 본격적으로 뛰기 시작 (2개의 방)',
    '뇌와 척수가 빠르게 발달',
    '탯줄이 형성되어 영양 공급 시작',
    '눈/코/입 자리가 잡히기 시작',
    '팔다리의 아주 작은 싹이 돋아남',
  ], momTip: '입덧이 시작될 수 있어요. 소량씩 자주 드세요' },

  { week: 6, size: '렌즈콩', length: '0.5cm', weight: '1g 미만', features: [
    '얼굴 윤곽이 형성되기 시작',
    '팔다리 싹이 더 뚜렷해짐',
    '심장 박동을 초음파로 확인 가능 (분당 100~160회)',
    '내이(균형감각 기관) 형성 시작',
    '폐의 기초 구조(기관지 싹) 발달',
    '간에서 혈액 세포 생산 시작',
  ], momTip: '첫 산부인과 방문을 계획하세요. 임신 확인 초음파 시기예요' },

  { week: 7, size: '블루베리', length: '1cm', weight: '1g', features: [
    '뇌가 분당 100개의 신경세포를 생성하며 급속 성장',
    '손가락과 발가락 형성 시작 (아직 물갈퀴 형태)',
    '간과 콩팥이 기능을 시작',
    '입술과 혀가 형성됨',
    '팔꿈치 관절이 생기기 시작',
    '망막(눈)에 색소가 침착 시작',
  ], momTip: '수분을 하루 2L 이상 섭취하세요. 변비 예방에도 도움돼요' },

  { week: 8, size: '라즈베리', length: '1.6cm', weight: '1g', features: [
    '모든 주요 장기의 기초가 완성됨 (배아→태아 전환기)',
    '손가락과 발가락이 구분되기 시작',
    '얼굴의 이목구비가 뚜렷해짐',
    '윗입술과 코끝이 형성',
    '귀의 외부 형태가 잡히기 시작',
    '꼬리뼈가 줄어들기 시작',
  ], momTip: '첫 초음파 검사로 심장 박동을 확인하세요' },

  { week: 9, size: '체리', length: '2.3cm', weight: '2g', features: [
    '꼬리가 완전히 사라지고 사람 형태를 갖춤',
    '근육이 형성되어 미세한 움직임 시작',
    '생식기 발달 시작 (아직 외부 구분 불가)',
    '눈꺼풀이 형성되어 눈을 덮기 시작',
    '이자(췌장)에서 인슐린 생산 준비',
    '손목/발목 관절이 형성됨',
  ], momTip: '극심한 피로감이 올 수 있어요. 무리하지 말고 충분히 쉬세요' },

  { week: 10, size: '대추', length: '3.1cm', weight: '4g', features: [
    '뼈와 연골이 형성되기 시작',
    '치아의 기초(치배)가 잇몸 안에서 형성',
    '손톱과 발톱이 자라기 시작',
    '위장이 소화액을 생산하기 시작',
    '뇌에서 뇌파 활동 시작',
    '콩팥이 소변을 만들어 양수로 배출',
  ], momTip: '11~14주 사이 NT 검사(목투명대)를 예약하세요' },

  { week: 11, size: '무화과', length: '4.1cm', weight: '7g', features: [
    '손가락을 펴고 오므릴 수 있게 됨',
    '횡격막이 형성되어 호흡 연습 시작',
    '소변을 생산하여 양수량에 기여',
    '얼굴 근육이 발달하여 표정 변화 가능',
    '머리가 전체 길이의 약 절반을 차지',
    '외부 생식기가 분화되기 시작',
  ], momTip: '입덧이 서서히 줄어들 수 있어요. 조금만 참으세요!' },

  { week: 12, size: '라임', length: '5.4cm', weight: '14g', features: [
    '반사 반응이 시작됨 (자극에 움츠림)',
    '성대가 형성됨',
    '장이 복강 안으로 이동 완료',
    '골수에서 백혈구 생산 시작 (면역 기초)',
    '뇌하수체에서 호르몬 분비 시작',
    '손가락에 고유한 지문 패턴이 잡히기 시작',
  ], momTip: '12주 정밀 초음파(1차 기형아 검사) 시기예요. 유산 위험이 크게 줄어들어요' },

  { week: 13, size: '완두콩 꼬투리', length: '7.4cm', weight: '23g', features: [
    '지문이 형성됨',
    '뼈가 점점 단단해짐 (석회화 진행)',
    '성별 구분이 가능해지기 시작',
    '성대와 후두가 완성되어 울음 준비',
    '장에서 태변(첫 대변) 형성 시작',
    '몸 전체에 솜털이 자라기 시작',
  ], momTip: '안정기에 접어들어요! 입덧이 줄고 에너지가 돌아올 거예요' },

  // ─── 2분기 (14~27주) ───
  { week: 14, size: '레몬', length: '8.7cm', weight: '43g', features: [
    '얼굴 표정을 지을 수 있게 됨 (찡그림/미소)',
    '온몸에 솜털(라누고)이 자라기 시작',
    '갑상선에서 호르몬을 분비하기 시작',
    '목이 길어져 머리를 돌릴 수 있음',
    '적혈구를 비장에서 생산하기 시작',
    '입천장(구개)이 완성됨',
  ], momTip: '철분이 풍부한 음식(시금치, 소고기)을 챙겨 드세요' },

  { week: 15, size: '사과', length: '10cm', weight: '70g', features: [
    '눈이 빛에 반응하기 시작 (눈꺼풀은 닫힌 상태)',
    '양수를 마시고 배출하는 연습 시작',
    '다리 길이가 팔보다 길어짐',
    '귓속 뼈(이소골)가 경화되어 소리 전달 준비',
    '두피에 머리카락 패턴이 결정됨',
    '관절이 유연해져 활발한 움직임',
  ], momTip: '태교 음악이나 아빠의 목소리를 들려주세요. 청각이 발달 중이에요' },

  { week: 16, size: '아보카도', length: '11.6cm', weight: '100g', features: [
    '손가락 빨기 시작 (초음파에서 확인 가능)',
    '다양한 표정 연습 (찡그림, 눈살 찌푸림)',
    '청각이 발달하여 엄마 심장 소리를 들음',
    '눈이 정면을 향하도록 위치 이동',
    '발톱이 형성됨',
    '태반이 완성되어 본격적 영양/산소 공급',
  ], momTip: '16~18주 트리플/쿼드 검사(2차 기형아 검사) 시기예요' },

  { week: 17, size: '배', length: '13cm', weight: '140g', features: [
    '피부 아래 지방(갈색지방) 축적 시작',
    '탯줄이 두꺼워지고 강해짐',
    '뼈 석회화가 진행됨 (X선에 보이기 시작)',
    '땀샘이 형성됨',
    '엄마 항체(IgG)가 태반을 통해 전달 시작',
    '움직임이 활발해져 경산부는 태동을 느낄 수 있음',
  ], momTip: '처음으로 태동을 느낄 수 있어요! 나비가 날개짓하는 듯한 느낌이에요' },

  { week: 18, size: '고구마', length: '14.2cm', weight: '190g', features: [
    '하품과 딸꾹질을 시작',
    '초산부도 태동을 느끼기 시작',
    '귀의 외부 형태가 완성됨',
    '수초화(신경 전달 속도 향상) 시작',
    '양수 속에서 회전하며 자세를 바꿈',
    '맥박이 청진기로 들릴 수 있음',
  ], momTip: '18~22주 정밀 초음파(중기 정밀) 시기예요. 모든 장기를 자세히 봐요' },

  { week: 19, size: '망고', length: '15.3cm', weight: '240g', features: [
    '피부에 태지(흰 보호막)가 형성 시작',
    '오감(시각/청각/미각/후각/촉각) 발달 가속',
    '뇌에서 감각 전담 영역이 분화',
    '영구치의 치배가 유치 뒤에서 형성',
    '팔다리 비율이 신생아에 가까워짐',
    '여아: 난소에 원시 난포 약 600만 개 형성',
  ], momTip: '잠잘 때 왼쪽으로 눕는 습관을 들이세요 (자궁 혈류 개선)' },

  { week: 20, size: '바나나', length: '25cm', weight: '300g', features: [
    '삼킴 연습이 활발해짐 (하루 양수 약 500ml 삼킴)',
    '손톱이 손끝까지 자람',
    '머리카락이 자라기 시작',
    '감각신경이 성숙하여 촉각에 민감하게 반응',
    '남아: 고환이 복강에서 하강 준비',
    '태동 패턴이 뚜렷해짐 (활동/수면 주기)',
  ], momTip: '임신 절반 왔어요! 성별 확인이 가능한 시기예요. 중기 초음파를 꼭 하세요' },

  { week: 21, size: '큰 바나나', length: '26.7cm', weight: '360g', features: [
    '양수를 통해 엄마가 먹은 음식 맛을 경험',
    '눈꺼풀과 눈썹이 완성됨',
    '피부가 반투명에서 불투명으로 변하기 시작',
    '소장에서 영양분 흡수 연습 시작',
    '뼈에서 혈소판을 생산하기 시작',
    '움직임이 더 힘차져 밖에서도 배가 움직이는 게 보일 수 있음',
  ], momTip: '배가 눈에 띄게 나오기 시작해요. 임부복이 필요할 수 있어요' },

  { week: 22, size: '파파야', length: '27.8cm', weight: '430g', features: [
    '눈썹과 속눈썹이 뚜렷하게 형성',
    '외부 소리에 놀라는 반응을 보임',
    '미각이 발달하여 단맛/쓴맛 구분 시작',
    '뇌의 주름(이랑과 고랑)이 형성되기 시작',
    '피부에 주름이 많음 (아직 피하지방 부족)',
    '남아: 고환에서 테스토스테론 분비',
  ], momTip: '칼슘 섭취를 충분히 하세요 (하루 1000mg). 유제품, 멸치, 두부가 좋아요' },

  { week: 23, size: '큰 망고', length: '28.9cm', weight: '500g', features: [
    '빠른 안구 운동(REM)이 시작됨',
    '폐에서 계면활성제(서팩턴트) 소량 생산 시작',
    '피부가 붉고 주름져 보임',
    '청각이 거의 완성 — 음악/목소리에 반응',
    '손바닥 잡기(파악 반사) 연습',
    '균형감각(전정기관)이 발달하여 자세 인식',
  ], momTip: '태교 음악이나 동화책 읽어주기를 시작해보세요. 아기가 듣고 있어요!' },

  { week: 24, size: '옥수수', length: '30cm', weight: '600g', features: [
    '폐 발달이 가속화 (폐포 형성 시작)',
    '눈을 뜰 수 있게 됨 (아직 시야 흐릿)',
    '생존 가능 시기 진입 (NICU 치료 시)',
    '피부 세포에서 멜라닌 생산 시작',
    '내이(달팽이관) 완성으로 균형 감각 향상',
    '규칙적인 수면-각성 주기가 형성',
  ], momTip: '24~28주 임신성 당뇨 검사(GCT/OGTT) 시기예요. 꼭 받으세요' },

  { week: 25, size: '큰 옥수수', length: '34.6cm', weight: '660g', features: [
    '콧구멍이 열리기 시작',
    '척수 신경이 성숙하여 복잡한 움직임 가능',
    '피하지방이 쌓이면서 피부 주름이 펴지기 시작',
    '대뇌 피질 층이 형성됨',
    '부신에서 스테로이드 호르몬 생산',
    '손을 꽉 쥐었다 펴는 동작을 반복',
  ], momTip: '소변이 자주 마려울 수 있어요. 자궁이 커지면서 방광을 눌러요' },

  { week: 26, size: '양배추', length: '35.6cm', weight: '760g', features: [
    '눈을 깜빡일 수 있게 됨',
    '폐에서 계면활성제 생산이 증가',
    '뇌파 활동이 활발해짐 (청각/시각 자극 반응)',
    '면역체계가 발달하여 감염 방어 준비',
    '허파꽈리(폐포)에 모세혈관 네트워크 형성',
    '엄마 목소리와 다른 소리를 구분할 수 있음',
  ], momTip: '태동 횟수를 체크하세요. 2시간에 10회 이상이면 건강한 신호예요' },

  { week: 27, size: '콜리플라워', length: '36.6cm', weight: '875g', features: [
    '맛과 냄새를 구별하는 능력 향상',
    '눈의 망막 층이 형성 완료',
    '뇌가 매우 활발하게 성장 (표면적 증가)',
    '딸꾹질이 빈번해짐 (횡격막 훈련)',
    '근육과 폐가 더 성숙해짐',
    '빛에 반응하여 고개를 돌릴 수 있음',
  ], momTip: '2분기가 끝나가요! 출산 준비 교실을 알아보세요' },

  // ─── 3분기 (28~40주) ───
  { week: 28, size: '큰 가지', length: '37.6cm', weight: '1kg', features: [
    '꿈을 꾸기 시작 (REM 수면 확인)',
    '맛을 구별하고 선호도가 생김',
    '체온 조절 능력 발달 시작',
    '뇌 표면 주름(뇌회)이 뚜렷해짐',
    '눈동자가 빛의 방향으로 움직임',
    '엄마에게서 받은 항체로 면역 강화',
  ], momTip: '3분기 시작! Rh- 혈액형이면 항D글로불린 주사 시기예요' },

  { week: 29, size: '버터넛 호박', length: '38.6cm', weight: '1.15kg', features: [
    '뼈가 단단해지며 칼슘을 많이 흡수',
    '근육과 폐가 계속 성숙',
    '뇌에서 수십억 개의 뉴런이 발달 중',
    '피하지방이 늘어 체온 유지 향상',
    '부신에서 에스트로겐 유사 물질 분비',
    '태아가 머리를 아래로 하는 두정위 시도',
  ], momTip: '등과 허리 통증이 심해질 수 있어요. 바른 자세와 스트레칭이 도움돼요' },

  { week: 30, size: '양상추', length: '39.9cm', weight: '1.3kg', features: [
    '골수에서 적혈구를 생산하기 시작 (간→골수 전환)',
    '머리카락이 풍성해짐',
    '체지방 비율 증가 (3.5%→8%)',
    '폐 발달이 빠르게 진행',
    '눈동자가 빛/어둠을 구분하여 반응',
    '그립(쥐기) 반사가 강해짐',
  ], momTip: '출산 준비를 서서히 시작하세요. 분만법, 산후조리원을 알아보세요' },

  { week: 31, size: '코코넛', length: '41.1cm', weight: '1.5kg', features: [
    '뇌 연결(시냅스)이 급격히 증가',
    '홍채가 빛에 따라 수축/확장 가능',
    '5가지 감각이 모두 기능함',
    '피부가 덜 붉어지고 분홍빛으로 변화',
    '양수량이 최대치에 가까워짐 (약 800ml)',
    '수면 중 눈동자가 빠르게 움직임 (활발한 REM)',
  ], momTip: '잠들기 어려울 수 있어요. 베개로 배를 받치고 옆으로 누우세요' },

  { week: 32, size: '큰 코코넛', length: '42.4cm', weight: '1.7kg', features: [
    '폐가 거의 완성 (계면활성제 충분)',
    '피부 주름이 펴지며 통통해짐',
    '엄마에게서 면역 항체(IgG) 대량 전달',
    '발톱이 발가락 끝까지 자람',
    '빈혈 방지를 위해 간에 철분 저장',
    '태아가 하루 약 500ml 양수를 삼킴',
  ], momTip: 'NST(비수축검사) 시작 시기예요. 태동이 줄면 바로 병원에 가세요' },

  { week: 33, size: '파인애플', length: '43.7cm', weight: '1.9kg', features: [
    '뼈가 단단해지지만 두개골은 유연함 유지 (산도 통과 위해)',
    '면역 체계가 더 강화됨',
    '양수를 통한 호흡 연습이 규칙적',
    '동공이 빛에 반응하여 수축 가능',
    '남아: 고환이 음낭으로 하강 중',
    '뇌의 무게가 빠르게 증가',
  ], momTip: '가슴이 답답하거나 숨이 찰 수 있어요. 자궁이 횡격막을 밀어 올려요' },

  { week: 34, size: '멜론', length: '45cm', weight: '2.1kg', features: [
    '폐 성숙이 거의 완료 (34주 이후 생존율 매우 높음)',
    '뇌가 급속 성장 (대뇌 피질 확장)',
    '손톱이 손끝을 넘어감',
    '태지가 두꺼워져 피부 보호 강화',
    '면역 글로불린 전달 가속',
    '수면-각성 주기가 신생아와 비슷해짐',
  ], momTip: '출산가방을 준비하세요. 산모수첩, 속옷, 수유패드, 아기 옷을 챙기세요' },

  { week: 35, size: '큰 멜론', length: '46.2cm', weight: '2.4kg', features: [
    '신장(콩팥)이 완전히 성숙',
    '간에서 일부 노폐물을 처리 가능',
    '팔다리가 통통해짐 (피하지방 급증)',
    '반사 반응이 대부분 완성 (빨기/잡기/놀람)',
    '태아 자세가 점점 웅크린 형태로',
    '청각이 출생 후와 거의 같은 수준',
  ], momTip: '부종이 심해질 수 있어요. 다리를 높이 올리고 염분을 줄이세요' },

  { week: 36, size: '큰 파인애플', length: '47.4cm', weight: '2.6kg', features: [
    '태지가 줄어들기 시작',
    '대부분 머리가 아래를 향함 (두정위)',
    '피하지방이 완성되어 통통한 모습',
    '솜털(라누고)이 빠지기 시작',
    '소화계가 완성되어 모유 소화 준비',
    '이슬(점액 마개)이 나올 수 있음',
  ], momTip: '35~37주 GBS(B군 연쇄상구균) 검사를 받으세요' },

  { week: 37, size: '겨울호박', length: '48.6cm', weight: '2.9kg', features: [
    '만삭 기준 진입 (37주부터 조산 아님)',
    '폐와 뇌의 최종 성숙 단계',
    '면역 체계가 출생 후 독립 가능 수준',
    '지방이 하루 약 14g씩 증가',
    '태아의 머리 둘레와 배 둘레가 비슷해짐',
    '장내에 태변(첫 대변)이 가득 참',
  ], momTip: '이슬(피 묻은 점액)이나 불규칙 수축은 출산이 가까운 신호예요' },

  { week: 38, size: '참외', length: '49.8cm', weight: '3.1kg', features: [
    '태지가 거의 사라짐 (접힌 부분만 남음)',
    '장내 태변이 진한 녹색으로 완성',
    '모든 장기가 독립적으로 기능 가능',
    '쥐기 반사가 매우 강함',
    '폐포에 충분한 계면활성제 비축',
    '뇌 무게가 출생 시의 약 70%에 도달',
  ], momTip: '분만 징후(이슬, 규칙적 진통, 양수 파수)를 잘 관찰하세요' },

  { week: 39, size: '작은 수박', length: '50.7cm', weight: '3.3kg', features: [
    '피부 색소 형성 완료 (출생 후에도 변할 수 있음)',
    '반사 신경 80가지 이상 완성',
    '모든 출생 준비 완료',
    '탯줄 길이 약 50cm로 최종',
    '뇌가 매 초 수백만 개의 연결을 만드는 중',
    '자궁 안 공간이 좁아 움직임이 줄지만 힘차게 발차기',
  ], momTip: '곧 만나요! 마음의 준비를 하세요. 호흡법을 연습하세요' },

  { week: 40, size: '수박', length: '51.2cm', weight: '3.5kg', features: [
    '출산 예정일!',
    '모든 장기 발달 완료 — 세상에 나올 준비',
    '두개골 봉합선이 유연해 산도 통과 가능',
    '폐가 첫 호흡을 위한 준비 완료',
    '뇌는 출생 후에도 수년간 계속 발달',
    '예정일 ±2주는 정상 범위',
  ], momTip: '예정일이에요! 40주 2일까지 안 오면 유도분만을 상의하세요' },
];

/** GET /api/pregnancy/weekly-development?week=20 */
router.get('/weekly-development', authMiddleware, (req: Request, res: Response) => {
  const weekStr = req.query.week as string;
  const week = weekStr ? parseInt(weekStr, 10) : undefined;

  if (week) {
    // 정확한 주수 or 가장 가까운 주수
    const exact = WEEKLY_DEVELOPMENT.find((w) => w.week === week);
    if (exact) {
      success(res, exact);
      return;
    }
    const closest = WEEKLY_DEVELOPMENT.reduce((prev, curr) =>
      Math.abs(curr.week - week) < Math.abs(prev.week - week) ? curr : prev,
    );
    success(res, closest);
    return;
  }

  // 전체 목록
  success(res, WEEKLY_DEVELOPMENT);
});

/** GET /api/pregnancy/timeline?childId=xxx — 타임라인 (기록 + 마일스톤 합산) */
router.get('/timeline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.query.childId as string;
    if (!childId) { error(res, 'childId는 필수입니다'); return; }

    // 임신기록 조회 (인덱스 불필요하도록 orderBy 제거, 코드에서 정렬)
    const recSnap = await collections.pregnancyRecords
      .where('childId', '==', childId)
      .limit(500)
      .get();

    // 엄마상태 기록 조회
    const healthSnap = await collections.momHealthChecks
      .where('childId', '==', childId)
      .limit(500)
      .get();

    // 주수별 그룹핑
    const timeline: Record<number, Array<{
      id: string;
      source: 'record' | 'health' | 'development';
      type: string;
      title: string;
      emoji?: string;
      content?: string;
      mediaUri?: string;
      mediaType?: string;
      createdAt: string;
    }>> = {};

    for (const d of recSnap.docs) {
      const data = d.data();
      const w = (data.week as number) ?? 0;
      if (!timeline[w]) timeline[w] = [];
      timeline[w].push({
        id: d.id,
        source: 'record',
        type: data.type as string,
        title: data.title as string,
        emoji: (data.milestoneEmoji as string) || undefined,
        content: (data.content as string) || undefined,
        mediaUri: (data.mediaUri as string) || undefined,
        mediaType: (data.mediaType as string) || undefined,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? '',
      });
    }

    for (const d of healthSnap.docs) {
      const data = d.data();
      const w = (data.week as number) ?? 0;
      if (!timeline[w]) timeline[w] = [];
      const symptomLabels = (data.symptoms as string[])
        .map((sid) => MOM_SYMPTOM_PRESETS.find((p) => p.id === sid)?.label ?? sid)
        .join(', ');
      timeline[w].push({
        id: d.id,
        source: 'health',
        type: 'mom_health',
        title: `엄마 상태: ${symptomLabels}`,
        emoji: '🤰',
        content: (data.memo as string) || undefined,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? '',
      });
    }

    // 주수별 발달 정보도 포함
    const childDoc = await collections.children.doc(childId).get();
    if (childDoc.exists && childDoc.data()!.dueDate) {
      const due = new Date(childDoc.data()!.dueDate as string);
      const now = new Date();
      const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const currentWeek = Math.max(1, Math.floor((280 - daysUntilDue) / 7));

      for (const dev of WEEKLY_DEVELOPMENT) {
        if (dev.week <= currentWeek) {
          if (!timeline[dev.week]) timeline[dev.week] = [];
          timeline[dev.week].unshift({
            id: `dev-${dev.week}`,
            source: 'development',
            type: 'weekly_development',
            title: `${dev.week}주차 — ${dev.size} 크기`,
            emoji: '🫒',
            content: dev.features.join(' / '),
            createdAt: '',
          });
        }
      }
    }

    // 주수 내림차순 정렬
    const sorted = Object.entries(timeline)
      .map(([w, items]) => ({ week: parseInt(w, 10), items }))
      .sort((a, b) => b.week - a.week);

    success(res, sorted);
  } catch {
    error(res, '타임라인 조회 중 오류가 발생했습니다', 500);
  }
});

/* ================================================================== */
/*  6. 임신성 당뇨 (GDM) 관리                                         */
/* ================================================================== */

/** POST /api/pregnancy/gdm — 혈당 기록 저장 */
router.post('/gdm', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, glucoseLevel, mealType, memo, measuredAt } = req.body as {
      childId: string;
      glucoseLevel: number;   // mg/dL
      mealType: 'fasting' | 'before_meal' | 'after_meal_1h' | 'after_meal_2h' | 'bedtime';
      memo?: string;
      measuredAt?: string;    // ISO date-time (선택, 없으면 now)
    };

    if (!childId || typeof glucoseLevel !== 'number' || !mealType) {
      error(res, 'childId, glucoseLevel(숫자), mealType은 필수입니다');
      return;
    }

    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '아이를 찾을 수 없습니다', 404);
      return;
    }

    // 위험 수치 판별
    const THRESHOLDS: Record<string, { normal: number; warning: number }> = {
      fasting:        { normal: 95,  warning: 105 },
      before_meal:    { normal: 95,  warning: 105 },
      after_meal_1h:  { normal: 140, warning: 180 },
      after_meal_2h:  { normal: 120, warning: 150 },
      bedtime:        { normal: 120, warning: 140 },
    };
    const threshold = THRESHOLDS[mealType] ?? THRESHOLDS.fasting;
    let status: 'normal' | 'caution' | 'warning' = 'normal';
    if (glucoseLevel > threshold.warning) status = 'warning';
    else if (glucoseLevel > threshold.normal) status = 'caution';

    const id = genId();
    const now = measuredAt || new Date().toISOString();
    const data = {
      childId,
      userId: req.userId!,
      glucoseLevel,
      mealType,
      status,
      memo: memo || null,
      measuredAt: now,
      date: now.slice(0, 10),
      createdAt: FieldValue.serverTimestamp(),
    };

    await collections.gdmRecords.doc(id).set(data);
    success(res, { id, ...data, createdAt: now }, 201);
  } catch {
    error(res, '혈당 기록 저장 중 오류가 발생했습니다', 500);
  }
});

/** GET /api/pregnancy/gdm?childId=xxx&days=30 — 혈당 기록 조회 */
router.get('/gdm', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.query.childId as string;
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string, 10) || 30));
    if (!childId) { error(res, 'childId 필요'); return; }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const snap = await collections.gdmRecords
      .where('childId', '==', childId)
      .where('date', '>=', since.toISOString().slice(0, 10))
      .orderBy('date', 'desc')
      .limit(200)
      .get();

    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 통계 계산
    const levels = snap.docs.map((d) => d.data().glucoseLevel as number);
    const avg = levels.length > 0 ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 0;
    const max = levels.length > 0 ? Math.max(...levels) : 0;
    const min = levels.length > 0 ? Math.min(...levels) : 0;
    const cautionCount = snap.docs.filter((d) => d.data().status === 'caution').length;
    const warningCount = snap.docs.filter((d) => d.data().status === 'warning').length;

    success(res, {
      records,
      stats: { total: levels.length, avg, max, min, cautionCount, warningCount, days },
    });
  } catch {
    error(res, '혈당 기록 조회 중 오류가 발생했습니다', 500);
  }
});

/** DELETE /api/pregnancy/gdm/:id — 혈당 기록 삭제 */
router.delete('/gdm/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const gdmId = req.params.id as string;
    const doc = await collections.gdmRecords.doc(gdmId).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) {
      error(res, '기록을 찾을 수 없습니다', 404);
      return;
    }
    await collections.gdmRecords.doc(gdmId).delete();
    success(res, { id: gdmId, message: '삭제되었습니다' });
  } catch {
    error(res, '삭제 중 오류가 발생했습니다', 500);
  }
});

/* ================================================================== */
/*  7. 임당 식단 기록 + AI 사진 분석                                   */
/* ================================================================== */

type FoodMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

async function getUserTierForFood(userId: string): Promise<'free' | 'paid'> {
  try {
    const doc = await collections.users.doc(userId).get();
    if (!doc.exists) return 'free';
    const data = doc.data() as Record<string, unknown>;
    if ((data.subscriptionTier as string) === 'PAID') {
      const exp = data.premiumExpiresAt as string | undefined;
      if (exp && new Date(exp) > new Date()) return 'paid';
    }
    const trial = data.trialStartedAt as string | undefined;
    if (trial) {
      const end = new Date(trial);
      end.setDate(end.getDate() + 7);
      if (new Date() < end) return 'paid';
    }
    return 'free';
  } catch { return 'free'; }
}

const FOOD_ANALYZE_LIMITS = { free: 2, paid: 10 } as const;

async function checkAndIncrementFoodAnalyze(
  userId: string,
  tier: 'free' | 'paid',
): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
  const limit = FOOD_ANALYZE_LIMITS[tier];
  const today = new Date().toISOString().slice(0, 10);
  const docId = `food_${userId}_${today}`;
  const ref = collections.rateLimits.doc(docId);
  const doc = await ref.get();
  const used = doc.exists ? (((doc.data() as Record<string, unknown>).count as number) ?? 0) : 0;
  if (used >= limit) {
    return { allowed: false, used, limit, remaining: 0 };
  }
  await ref.set({
    count: admin.firestore.FieldValue.increment(1),
    userId,
    date: today,
    tier,
    kind: 'food_analyze',
    lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { allowed: true, used: used + 1, limit, remaining: limit - used - 1 };
}

/** POST /api/pregnancy/gdm/food — 식단 기록 저장 */
router.post('/gdm/food', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, foodName, mealType, eatenAt, carbs, calories, photoUrl, memo, linkedGlucoseId } = req.body as {
      childId: string;
      foodName: string;
      mealType: FoodMealType;
      eatenAt?: string;
      carbs?: number;
      calories?: number;
      photoUrl?: string;
      memo?: string;
      linkedGlucoseId?: string;
    };

    if (!childId || !foodName || !mealType) {
      error(res, 'childId, foodName, mealType은 필수입니다');
      return;
    }

    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '아이를 찾을 수 없습니다', 404);
      return;
    }

    const id = genId();
    const now = eatenAt || new Date().toISOString();
    const data = {
      childId,
      userId: req.userId!,
      foodName,
      mealType,
      eatenAt: now,
      date: now.slice(0, 10),
      carbs: typeof carbs === 'number' ? carbs : null,
      calories: typeof calories === 'number' ? calories : null,
      photoUrl: photoUrl || null,
      memo: memo || null,
      linkedGlucoseId: linkedGlucoseId || null,
      createdAt: FieldValue.serverTimestamp(),
    };

    await collections.gdmFoodLogs.doc(id).set(data);
    success(res, { id, ...data, createdAt: now }, 201);
  } catch {
    error(res, '식단 기록 저장 중 오류가 발생했습니다', 500);
  }
});

/** GET /api/pregnancy/gdm/food?childId=xxx&days=30 — 식단 기록 조회 */
router.get('/gdm/food', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.query.childId as string;
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string, 10) || 30));
    if (!childId) { error(res, 'childId 필요'); return; }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const snap = await collections.gdmFoodLogs
      .where('childId', '==', childId)
      .where('date', '>=', since.toISOString().slice(0, 10))
      .limit(300)
      .get();

    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    records.sort((a, b) => ((b as { eatenAt?: string }).eatenAt ?? '').localeCompare((a as { eatenAt?: string }).eatenAt ?? ''));

    success(res, { records });
  } catch {
    error(res, '식단 기록 조회 중 오류가 발생했습니다', 500);
  }
});

/** DELETE /api/pregnancy/gdm/food/:id — 식단 기록 삭제 */
router.delete('/gdm/food/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const foodId = req.params.id as string;
    const doc = await collections.gdmFoodLogs.doc(foodId).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) {
      error(res, '기록을 찾을 수 없습니다', 404);
      return;
    }
    await collections.gdmFoodLogs.doc(foodId).delete();
    success(res, { id: foodId, message: '삭제되었습니다' });
  } catch {
    error(res, '삭제 중 오류가 발생했습니다', 500);
  }
});

/** POST /api/pregnancy/gdm/food/analyze — AI 사진 분석 (참고용, 의료 진단 아님) */
router.post('/gdm/food/analyze', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { mediaBase64, mediaMimeType } = req.body as {
      mediaBase64?: string;
      mediaMimeType?: string;
    };

    if (!mediaBase64 || !mediaMimeType) {
      error(res, '사진 파일이 필요합니다');
      return;
    }

    const tier = await getUserTierForFood(req.userId!);
    const usage = await checkAndIncrementFoodAnalyze(req.userId!, tier);
    if (!usage.allowed) {
      const msg = tier === 'free'
        ? `오늘의 사진 분석 횟수를 모두 사용했어요 (무료 하루 ${usage.limit}장). 프리미엄 구독 시 하루 10장까지 이용 가능합니다.`
        : `오늘의 사진 분석 횟수를 모두 사용했어요 (프리미엄 하루 ${usage.limit}장). 내일 다시 이용해주세요.`;
      res.status(429).json({
        success: false,
        error: msg,
        usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining, tier },
      });
      return;
    }

    if (!isGeminiAvailable()) {
      success(res, {
        foodName: '분석 불가',
        carbs: null,
        calories: null,
        notes: 'AI 분석을 사용할 수 없습니다. 수동으로 입력해주세요.',
        disclaimer: '이 결과는 참고용이며 의료 진단이 아닙니다.',
        usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining, tier },
      });
      return;
    }

    const prompt = `당신은 임신성 당뇨 식단 관리를 돕는 영양 분석 보조입니다.
첨부된 음식 사진을 분석해 다음 정보를 추정해주세요. 정확한 의료/영양 수치가 아니라 참고용 추정치입니다.

반드시 아래 JSON 형식만 출력하세요:
{
  "foodName": "음식 이름 (가장 대표적인 음식 1~3개, 한국어)",
  "carbs": 탄수화물 추정 그램 수 (숫자),
  "calories": 칼로리 추정 (숫자),
  "notes": "임당 관점에서 간단 코멘트 (1~2문장, 혈당 영향/섭취 팁)"
}

주의:
- 사진이 음식이 아니면 foodName을 "음식 아님"으로, 수치는 0으로
- 사람/배경만 있다면 인식 불가를 표시
- 추정치는 일반적인 한국 식단 기준
- 의료적 진단이나 처방은 절대 하지 말 것`;

    try {
      const parsed = await callGeminiJSON<{
        foodName?: string;
        carbs?: number;
        calories?: number;
        notes?: string;
      }>(prompt, {
        temperature: 0.2,
        maxTokens: 400,
        mediaData: { mimeType: mediaMimeType, base64: mediaBase64 },
      });

      success(res, {
        foodName: parsed.foodName || '알 수 없음',
        carbs: typeof parsed.carbs === 'number' ? parsed.carbs : null,
        calories: typeof parsed.calories === 'number' ? parsed.calories : null,
        notes: parsed.notes || '',
        disclaimer: 'AI 분석 결과는 참고용 추정치이며, 의료 진단이나 영양 처방이 아닙니다. 정확한 임당 관리는 담당 의료진과 상담해주세요.',
        usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining, tier },
      });
    } catch {
      success(res, {
        foodName: '분석 실패',
        carbs: null,
        calories: null,
        notes: '사진 분석에 실패했어요. 수동으로 입력해주세요.',
        disclaimer: 'AI 분석 결과는 참고용이며 의료 진단이 아닙니다.',
        usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining, tier },
      });
    }
  } catch {
    error(res, '사진 분석 중 오류가 발생했습니다', 500);
  }
});

export default router;
