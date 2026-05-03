import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections } from '../../services/firestore';
import { buildChildContext } from '../../services/coaching/context.builder';
import { getChildIfAccessible } from '../../utils/childAccess';
import { logger } from '../../utils/logger';

// ─── 성장 마일스톤 데이터 ───

const MILESTONES: Array<{ months: number; label: string; items: string[] }> = [
  {
    months: 1, label: '1개월', items: [
      '엎드리면 잠깐 머리를 들어요',
      '손에 닿는 물건을 반사적으로 쥐어요',
      '큰 소리에 깜짝 놀라는 반응을 보여요',
      '움직이는 물체를 눈으로 잠깐 따라봐요',
      '엄마 목소리를 들으면 조용해져요',
      '배고프거나 불편하면 울음으로 표현해요',
    ],
  },
  {
    months: 2, label: '2개월', items: [
      '엎드린 자세에서 머리를 45도 들어요',
      '손을 펴고 쥐는 동작을 반복해요',
      '옹알이를 시작하며 "아~", "우~" 소리를 내요',
      '얼굴을 바라보며 눈을 맞춰요',
      '사회적 미소를 짓기 시작해요',
      '소리가 나는 쪽으로 고개를 돌려요',
    ],
  },
  {
    months: 3, label: '3개월', items: [
      '엎드려서 머리를 90도로 들 수 있어요',
      '양손을 모아 잡으며 손을 탐색해요',
      '소리 내어 웃기 시작해요',
      '"구~", "까~" 등 다양한 옹알이를 해요',
      '눈앞의 물건을 손으로 잡으려고 시도해요',
      '익숙한 사람을 보면 반가워하며 웃어요',
      '180도 범위로 물체를 눈으로 추적해요',
    ],
  },
  {
    months: 4, label: '4개월', items: [
      '도움 없이 머리를 안정적으로 가눠요',
      '누워서 뒤집기를 시도하기 시작해요',
      '손에 잡힌 딸랑이를 흔들 수 있어요',
      '소리를 듣고 옹알이로 대답하듯 반응해요',
      '관심 있는 물건에 손을 뻗어요',
      '거울 속 자신의 모습에 흥미를 보여요',
      '낯선 사람과 익숙한 사람을 구별하기 시작해요',
    ],
  },
  {
    months: 5, label: '5개월', items: [
      '혼자 뒤집기를 능숙하게 해요',
      '앉혀주면 손을 짚고 잠깐 앉아 있어요',
      '물건을 한 손에서 다른 손으로 옮겨요',
      '자기 이름을 부르면 반응해요',
      '"마마", "바바" 같은 자음 소리를 내요',
      '까꿍 놀이에 즐거워해요',
      '장난감이 떨어지면 눈으로 찾아봐요',
    ],
  },
  {
    months: 6, label: '6개월', items: [
      '도움 없이 혼자 앉기 시작해요',
      '양손으로 물건을 잡고 탐색해요',
      '입에 물건을 넣어 탐색하는 시기예요',
      '"다다다", "바바바" 반복 옹알이를 해요',
      '낯가림이 시작되어요',
      '물건이 사라져도 찾으려는 모습을 보여요',
      '좋아하는 장난감에 대한 선호를 보여요',
      '이유식을 시작하며 숟가락에 적응해요',
    ],
  },
  {
    months: 8, label: '8개월', items: [
      '배밀이나 기기를 시작해요',
      '엄지와 검지로 작은 물건을 집으려 해요',
      '가구를 잡고 일어서려고 시도해요',
      '간단한 말("안 돼")의 톤을 이해해요',
      '"맘마", "빠빠" 등 의미 있는 소리를 내요',
      '사물이 가려져도 존재한다는 것을 알아요',
      '분리 불안이 나타나기 시작해요',
      '박수 따라 치기 등 모방 행동을 해요',
    ],
  },
  {
    months: 10, label: '10개월', items: [
      '가구를 잡고 옆으로 이동해요',
      '엄지와 검지로 작은 물건을 정교하게 집어요',
      '컵을 잡고 마시려는 시도를 해요',
      '"엄마", "아빠"를 의미 있게 말해요',
      '손가락으로 원하는 것을 가리켜요',
      '간단한 지시("줘", "주세요")를 이해해요',
      '짝짜꿍, 잼잼 등 동작 모방을 해요',
      '숨긴 물건을 찾을 수 있어요',
    ],
  },
  {
    months: 12, label: '12개월', items: [
      '한두 발짝 혼자 걸으려고 시도해요',
      '혼자 서서 균형을 잡을 수 있어요',
      '블록 두 개를 쌓을 수 있어요',
      '의미 있는 단어 2~3개를 말해요',
      '손가락으로 원하는 것을 가리키며 표현해요',
      '"안 돼"라는 말의 의미를 이해해요',
      '어른의 행동을 모방하려고 해요',
      '간단한 요청에 반응해요 (예: "공 줘")',
    ],
  },
  {
    months: 15, label: '15개월', items: [
      '혼자 걸을 수 있어요',
      '블록 2~3개를 쌓을 수 있어요',
      '크레용을 쥐고 끄적거리기 시작해요',
      '의미 있는 단어 4~6개를 사용해요',
      '원하는 것을 가리키거나 소리로 표현해요',
      '숟가락을 사용하려고 시도해요',
      '그림책에서 익숙한 그림을 가리켜요',
      '혼자 놀이에 집중하는 시간이 늘어나요',
    ],
  },
  {
    months: 18, label: '18개월', items: [
      '능숙하게 걷고 빠르게 걸으려 해요',
      '계단을 손잡고 올라갈 수 있어요',
      '블록 3~4개를 쌓을 수 있어요',
      '단어 5~10개를 사용하기 시작해요',
      '컵으로 혼자 마실 수 있어요',
      '숟가락 사용이 점점 능숙해져요',
      '자기 몸의 부위를 가리킬 수 있어요',
      '간단한 지시 두 가지를 따를 수 있어요',
      '장난감을 가지고 상상놀이를 시작해요',
    ],
  },
  {
    months: 21, label: '21개월', items: [
      '뛰기 시작하며 움직임이 활발해져요',
      '공을 앞으로 차려는 시도를 해요',
      '블록 5~6개를 쌓을 수 있어요',
      '두 단어를 조합하기 시작해요 (예: "엄마 줘")',
      '20~30개의 단어를 이해하고 사용해요',
      '그림책을 보면서 아는 것을 가리켜요',
      '다른 아이에게 관심을 보이기 시작해요',
      '좋고 싫음을 분명하게 표현해요',
    ],
  },
  {
    months: 24, label: '24개월', items: [
      '계단을 혼자 오를 수 있어요 (한 발씩)',
      '제자리에서 두 발로 점프해요',
      '수직선과 원 모양을 따라 그려요',
      '두 단어 문장을 자주 사용해요 (예: "아빠 가")',
      '50개 이상의 단어를 사용해요',
      '간단한 지시 두 가지를 연속으로 따라요',
      '또래 아이들에게 관심을 보여요',
      '상상놀이(소꿉놀이 등)를 즐겨요',
      '자기 이름을 말할 수 있어요',
    ],
  },
  {
    months: 30, label: '30개월', items: [
      '한 발로 잠깐 서기를 시도해요',
      '점프가 더 능숙해지고 높이 뛸 수 있어요',
      '가위 사용에 관심을 보이기 시작해요',
      '세 단어 이상의 문장을 말해요',
      '자기 이름과 나이를 말할 수 있어요',
      '"왜?"라는 질문을 자주 시작해요',
      '간단한 옷 벗기를 혼자 할 수 있어요',
      '큰 것과 작은 것의 크기 차이를 이해해요',
      '친구와 나란히 놀이를 할 수 있어요',
    ],
  },
  {
    months: 36, label: '36개월', items: [
      '세발자전거 페달을 밟아 탈 수 있어요',
      '한 발로 2~3초 서 있을 수 있어요',
      '가위로 종이를 자르기 시작해요',
      '원과 십자 모양을 따라 그릴 수 있어요',
      '세 단어 이상 문장으로 대화할 수 있어요',
      '"왜?", "어디?"등 질문을 자주 해요',
      '친구와 함께 노는 것을 좋아해요',
      '색깔 2~3가지를 구별하고 말할 수 있어요',
      '간단한 역할놀이를 즐겨요',
      '화장실 사용을 배우기 시작해요',
    ],
  },
  {
    months: 42, label: '42개월', items: [
      '한 발로 5초 이상 서 있을 수 있어요',
      '계단을 번갈아 발을 내디디며 내려와요',
      '사람 형태의 그림을 그리기 시작해요',
      '가위질이 점점 정교해져요',
      '과거에 있었던 일을 이야기할 수 있어요',
      '4~5개 단어로 이루어진 문장을 사용해요',
      '숫자 1~5까지 셀 수 있어요',
      '차례를 기다리는 것을 배우기 시작해요',
      '다른 사람의 감정을 인식하기 시작해요',
    ],
  },
  {
    months: 48, label: '48개월', items: [
      '한 발로 뛰기(깽깽이)를 할 수 있어요',
      '공을 던지고 받기가 가능해져요',
      '가위로 직선을 따라 자를 수 있어요',
      '사각형과 간단한 도형을 따라 그려요',
      '긴 문장으로 자신의 경험을 이야기해요',
      '혼자 옷을 입고 벗을 수 있어요',
      '간단한 규칙이 있는 놀이를 이해해요',
      '상상과 현실을 구별하기 시작해요',
      '친구와 협동 놀이를 할 수 있어요',
      '자기 이름의 글자를 인식하기 시작해요',
    ],
  },
  {
    months: 54, label: '54개월', items: [
      '앞으로 재주넘기를 시도해요',
      '그네를 혼자 탈 수 있어요',
      '연필을 바르게 쥐고 글자를 따라 써요',
      '자기 이름을 쓸 수 있어요',
      '이야기를 순서대로 말할 수 있어요',
      '숫자 1~10까지 세고 간단한 더하기를 시도해요',
      '시간 개념(어제, 오늘, 내일)을 이해해요',
      '친구와의 갈등을 말로 해결하려고 노력해요',
      '간단한 보드게임의 규칙을 따를 수 있어요',
    ],
  },
  {
    months: 60, label: '60개월', items: [
      '줄넘기나 스킵 동작을 시도해요',
      '균형 잡기 운동을 잘 할 수 있어요',
      '가위로 복잡한 모양을 오릴 수 있어요',
      '간단한 글자를 읽기 시작해요',
      '숫자를 세고 간단한 덧셈을 이해해요',
      '자기 생각과 느낌을 자세히 말할 수 있어요',
      '차례를 지키고 규칙을 이해하며 놀아요',
      '다른 사람의 감정에 공감하고 위로해요',
      '혼자서 간단한 일상 활동을 할 수 있어요',
      '그림으로 이야기를 표현할 수 있어요',
    ],
  },
  {
    months: 72, label: '72개월', items: [
      '자전거 보조바퀴 없이 타기를 시작해요',
      '공 던지기와 받기가 정확해져요',
      '또박또박 글자를 쓸 수 있어요',
      '간단한 문장을 읽고 이해할 수 있어요',
      '10 이상의 덧셈과 뺄셈을 할 수 있어요',
      '시간(시계)을 읽기 시작해요',
      '자기 의견을 논리적으로 설명하려고 해요',
      '친구 관계에서 협동과 양보를 이해해요',
      '스스로 숙제나 과제를 하려고 노력해요',
    ],
  },
  {
    months: 84, label: '7세', items: [
      '수영, 달리기 등 체계적인 운동이 가능해요',
      '글씨를 바르게 쓰고 공책 정리를 해요',
      '긴 문장을 읽고 내용을 파악할 수 있어요',
      '두 자릿수 덧셈과 뺄셈을 할 수 있어요',
      '시간과 요일 개념을 이해해요',
      '스스로 학용품과 가방을 챙길 수 있어요',
      '친구와 깊은 우정을 맺기 시작해요',
      '규칙을 이해하고 공정함에 관심을 보여요',
      '자신의 실수를 인정하고 고치려 노력해요',
    ],
  },
  {
    months: 96, label: '8세', items: [
      '줄넘기, 수영 등 복합적인 운동이 능숙해져요',
      '세밀한 그리기와 만들기 활동을 즐겨요',
      '긴 글을 읽고 요약할 수 있어요',
      '곱셈과 나눗셈 개념을 배우기 시작해요',
      '문제를 스스로 분석하고 해결하려고 해요',
      '일기나 짧은 글을 쓸 수 있어요',
      '또래 집단에서의 소속감을 중요시해요',
      '다른 사람의 입장을 이해하려고 노력해요',
      '자기 관리(위생, 정리정돈)를 스스로 해요',
    ],
  },
  {
    months: 108, label: '9세', items: [
      '팀 스포츠에 참여하며 전략을 이해해요',
      '정교한 손동작(뜨개질, 모형 만들기 등)이 가능해요',
      '독서를 즐기고 다양한 장르에 관심을 보여요',
      '분수와 소수 개념을 배우기 시작해요',
      '자기 주장을 논리적으로 펼칠 수 있어요',
      '계획을 세우고 실행하는 능력이 발달해요',
      '우정에서 신뢰와 약속을 중요시해요',
      '사회적 규범과 도덕적 판단을 이해해요',
      '자기 감정을 조절하는 능력이 향상돼요',
    ],
  },
  {
    months: 120, label: '10세', items: [
      '복잡한 운동 기술(농구, 축구 등)을 익혀요',
      '세밀한 글씨체가 자리 잡히기 시작해요',
      '비유와 은유가 포함된 글을 이해해요',
      '복잡한 수학 문제 풀이에 도전해요',
      '추상적 사고가 발달하기 시작해요',
      '자기 주도적으로 학습 계획을 세워요',
      '깊은 우정과 또래 관계를 중시해요',
      '공정함과 정의에 대해 깊이 생각해요',
      '자아 정체성에 대해 고민하기 시작해요',
      '책임감을 가지고 맡은 일을 해내려 해요',
    ],
  },
  {
    months: 132, label: '11세', items: [
      '체력과 지구력이 크게 향상돼요',
      '예술적 표현(악기, 미술 등)이 정교해져요',
      '복잡한 문학 작품을 읽고 비평할 수 있어요',
      '비례와 비율 등 고급 수학 개념을 배워요',
      '논리적 사고와 비판적 사고가 발달해요',
      '미래의 꿈과 목표에 대해 생각하기 시작해요',
      '또래 압력을 인식하고 대처하는 법을 배워요',
      '가족과 사회에서의 역할을 이해해요',
      '자기 감정을 글이나 대화로 표현할 수 있어요',
    ],
  },
  {
    months: 144, label: '12세', items: [
      '성인에 가까운 운동 능력을 갖추어 가요',
      '정교하고 창의적인 작품 활동이 가능해요',
      '다양한 장르의 글을 비판적으로 읽어요',
      '방정식 등 추상적 수학 개념을 이해해요',
      '가설을 세우고 검증하는 사고를 할 수 있어요',
      '장기적인 목표를 세우고 계획할 수 있어요',
      '다양한 관점을 이해하고 존중해요',
      '자아 정체성이 더욱 확립되어 가요',
      '사회적 이슈에 관심을 갖기 시작해요',
      '독립적인 의사결정 능력이 발달해요',
    ],
  },
];

export function registerHistoryHandlers(router: Router): void {
  // ─── GET /api/coaching/history/:childId ───

  router.get('/history/:childId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const childId = req.params.childId as string;

      // 소유자 OR viewCoaching 권한 확인
      const access = await getChildIfAccessible(childId, req.userId, 'viewCoaching', res);
      if (!access) return;

      // orderBy 없이 조회 후 코드에서 정렬 (복합 인덱스 미생성 시에도 안전)
      const snap = await collections.coachingSessions
        .where('childId', '==', childId)
        .limit(100)
        .get();

      const toTimeStr = (v: unknown): string => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object' && 'toDate' in v) {
          return (v as { toDate: () => Date }).toDate().toISOString();
        }
        return '';
      };

      const sessions: Record<string, unknown>[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
      sessions.sort((a, b) => toTimeStr(b['createdAt']).localeCompare(toTimeStr(a['createdAt'])));
      const limited = sessions.slice(0, 50);

      success(res, limited);
    } catch (err) {
      logger.error('coaching/history', err);
      error(res, '코칭 기록 조회 중 오류가 발생했습니다', 500);
    }
  });

  // ─── GET /api/coaching/followups/:childId ───

  router.get('/followups/:childId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId } = req.params;
      const now = new Date().toISOString();

      const snap = await collections.followups
        .where('userId', '==', req.userId)
        .where('childId', '==', childId)
        .where('status', '==', 'pending')
        .orderBy('dueDate', 'asc')
        .get();

      const allFollowups: Array<Record<string, unknown>> = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return { id: d.id, ...data };
      });
      const dueFollowups = allFollowups.filter((f) => {
        const due = f.dueDate as string | undefined;
        return due ? due <= now : false;
      });

      success(res, dueFollowups);
    } catch (err) {
      logger.error('coaching/followups', err);
      error(res, '팔로업 조회 중 오류가 발생했습니다', 500);
    }
  });

  // ─── GET /api/coaching/milestones/:childId ───

  router.get('/milestones/:childId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const childId = req.params.childId as string;
      const child = await buildChildContext(childId, req.userId!);
      if (!child) { error(res, '자녀 정보 없음', 404); return; }

      // 현재 월령에 해당하는 마일스톤 + 다음 마일스톤
      const current = MILESTONES.filter((m) => m.months <= child.ageMonths).pop();
      const next = MILESTONES.find((m) => m.months > child.ageMonths);

      success(res, {
        childName: child.name,
        ageMonths: child.ageMonths,
        ageInfo: child.ageInfo,
        temperament: child.temperament,
        current: current ? {
          label: `${current.label} 발달 체크`,
          items: current.items,
        } : null,
        next: next ? {
          label: `다음 목표: ${next.label}`,
          monthsUntil: next.months - child.ageMonths,
          items: next.items,
        } : null,
      });
    } catch {
      error(res, '마일스톤 조회 중 오류', 500);
    }
  });
}
