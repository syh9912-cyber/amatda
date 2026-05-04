/**
 * AI 자동 육아일기 생성
 * - 하루의 트래킹 데이터 + AI 상담 내역을 조합
 * - AI가 따뜻한 일기체로 오늘의 기록을 자동 생성
 * - 부모는 기록만 하면 → AI가 추억을 만들어줌
 */

import { collections } from '../firestore';
import { callGeminiText, isGeminiAvailable } from './gemini.client';

export interface AutoDiary {
  date: string;
  diary: string;
  highlights: string[];
  mood: 'great' | 'good' | 'normal' | 'tough';
  shareText: string;  // 카카오/인스타 공유용 짧은 버전
  emotionScore: number;       // 0~10 감정 강도 점수
  emotionKeywords: string[];  // 감지된 감정 키워드
}

interface DayData {
  sleep: { totalHours?: number; nightWakeups?: number; napMinutes?: number } | null;
  feeding: { totalMl?: number; mealCount?: number; note?: string } | null;
  diaper: { poopCount?: number; consistency?: string; color?: string } | null;
  condition: string | null;
  temperature: number | null;
  notes: string | null;
  coachingSessions: Array<{ category: string; message: string; answer: string }>;
}

/** 오늘의 데이터를 수집하여 일기 생성 */
export async function generateAutoDiary(
  childId: string,
  childName: string,
  ageInfo: string,
  temperament: string,
  isPregnant?: boolean,
): Promise<AutoDiary | null> {
  const today = new Date().toISOString().slice(0, 10);

  // 1. 오늘 트래킹 데이터 수집
  const dayData = await collectDayData(childId, today);

  // 데이터가 없으면 생성 불가
  if (!dayData.sleep && !dayData.feeding && !dayData.diaper && !dayData.notes && dayData.coachingSessions.length === 0) {
    return null;
  }

  // 임산부: 트래킹 데이터 없어도 코칭 세션만으로 생성 가능
  if (isPregnant && !dayData.notes && dayData.coachingSessions.length === 0) {
    // 임신 기록 확인 — 새 albumPhotos에서 phase='pregnancy'만
    try {
      const recSnap = await collections.albumPhotos
        .where('childId', '==', childId)
        .where('phase', '==', 'pregnancy')
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();
      if (!recSnap.empty) {
        const recNotes = recSnap.docs.map((d) => {
          const r = d.data() as Record<string, unknown>;
          return `${r.title ?? ''}: ${(r.content as string ?? '').slice(0, 50)}`;
        }).join(', ');
        dayData.notes = recNotes;
      }
    } catch { /* ignore */ }
  }

  // 데이터가 전혀 없으면 생성 불가 (재확인)
  if (!dayData.sleep && !dayData.feeding && !dayData.diaper && !dayData.notes && dayData.coachingSessions.length === 0) {
    return null;
  }

  // 2. AI 일기 생성
  const diary = await writeDiary(childName, ageInfo, temperament, today, dayData, isPregnant);

  // 3. 감정 점수 산출 (일기 텍스트 + 원본 메모/노트에서 감정 키워드 감지)
  const textForScoring = [diary.diary, dayData.notes || '', dayData.feeding?.note || ''].join(' ');
  const { emotionScore, emotionKeywords } = scoreEmotion(textForScoring);
  diary.emotionScore = emotionScore;
  diary.emotionKeywords = emotionKeywords;

  // 4. Firestore에 저장
  const docId = `${childId}_${today}`;
  await collections.autoDiaries.doc(docId).set({
    childId,
    date: today,
    diary: diary.diary,
    highlights: diary.highlights,
    mood: diary.mood,
    shareText: diary.shareText,
    emotionScore,
    emotionKeywords,
    createdAt: new Date().toISOString(),
  });

  return diary;
}

async function collectDayData(childId: string, date: string): Promise<DayData> {
  const result: DayData = {
    sleep: null, feeding: null, diaper: null,
    condition: null, temperature: null, notes: null,
    coachingSessions: [],
  };

  // 트래킹 데이터
  try {
    const snap = await collections.dailyTracking
      .where('childId', '==', childId)
      .where('date', '==', date)
      .limit(1)
      .get();

    if (!snap.empty) {
      const d = snap.docs[0].data() as Record<string, unknown>;
      result.sleep = (d.sleep as DayData['sleep']) || null;
      result.feeding = (d.feeding as DayData['feeding']) || null;
      result.diaper = (d.diaper as DayData['diaper']) || null;
      result.condition = (d.condition as string) || null;
      result.temperature = (d.temperature as number) || null;
      result.notes = (d.notes as string) || null;
    }
  } catch { /* ignore */ }

  // 오늘의 코칭 세션
  try {
    const sessionSnap = await collections.coachingSessions
      .where('childId', '==', childId)
      .where('createdAt', '>=', new Date(`${date}T00:00:00`))
      .where('createdAt', '<=', new Date(`${date}T23:59:59`))
      .orderBy('createdAt', 'asc')
      .limit(5)
      .get();

    for (const doc of sessionSnap.docs) {
      const s = doc.data() as Record<string, unknown>;
      result.coachingSessions.push({
        category: (s.category as string) || '',
        message: ((s.message as string) || '').slice(0, 50),
        answer: ((s.answer as string) || '').slice(0, 80),
      });
    }
  } catch { /* ignore */ }

  return result;
}

async function writeDiary(
  childName: string,
  ageInfo: string,
  temperament: string,
  date: string,
  data: DayData,
  isPregnant?: boolean,
): Promise<AutoDiary> {
  // 하이라이트 추출
  const highlights: string[] = [];
  if (data.sleep?.totalHours) highlights.push(`수면 ${data.sleep.totalHours}시간`);
  if (data.feeding?.mealCount) highlights.push(`식사 ${data.feeding.mealCount}회`);
  if (data.diaper?.poopCount) highlights.push(`배변 ${data.diaper.poopCount}회`);
  if (data.coachingSessions.length > 0) highlights.push(`상담이모 ${data.coachingSessions.length}건`);
  if (data.notes) highlights.push(data.notes.slice(0, 20));

  // 무드 판단
  let mood: AutoDiary['mood'] = 'normal';
  if (data.condition === '좋음') mood = 'great';
  else if (data.condition === '보통') mood = 'good';
  else if (data.condition === '나쁨' || data.condition === '아픔') mood = 'tough';

  // AI 일기 생성
  if (isGeminiAvailable()) {
    try {
      const dataDesc = buildDataDescription(data);
      const coachingDesc = data.coachingSessions.length > 0
        ? data.coachingSessions.map((s) => `${s.category}: "${s.message}" → "${s.answer}"`).join('\n')
        : '오늘은 상담 없음';

      // CLAUDE.md: AI prompt 에 아이 실명/태명 절대 금지 → '아이'/'아가' 라벨 사용
      const prompt = isPregnant
        ? `너는 임산부 일기 작가다. 아래 데이터를 바탕으로 따뜻한 임신일기를 써라.

대상: 아가 (${ageInfo})
날짜: ${date}

오늘의 기록:
${dataDesc}

오늘의 상담:
${coachingDesc}

규칙:
- 3~5문장. 임산부 시점 일기체로.
- 데이터를 자연스러운 이야기로 녹여라. 숫자 나열 금지.
- "아가"라는 호칭을 사용하고, 임신 주수에 맞는 감성을 담아라.
- 몸이 힘든 날이면 위로를, 좋은 날이면 기쁨을 함께 나눠라.
- 마지막 문장은 아가에 대한 기대나 따뜻한 마무리로.
- 100~200자 사이.`
        : `너는 육아 일기 작가다. 아래 데이터를 바탕으로 따뜻한 육아일기를 써라.

대상: 아이 (${ageInfo}, ${temperament} 기질)
날짜: ${date}

오늘의 기록:
${dataDesc}

오늘의 상담:
${coachingDesc}

규칙:
- 3~5문장. 엄마/아빠 시점 일기체로.
- 데이터를 자연스러운 이야기로 녹여라. 숫자 나열 금지.
- 아이 이름을 사용하고, 기질 특성을 자연스럽게 언급.
- 힘든 날이면 위로를, 좋은 날이면 기쁨을 함께 나눠라.
- 마지막 문장은 내일에 대한 기대나 따뜻한 마무리로.
- 100~200자 사이.`;

      const diary = await callGeminiText(prompt, { temperature: 0.7, maxTokens: 300 });

      // 공유용 짧은 버전
      const sharePrompt = `아래 일기를 SNS 공유용으로 2문장으로 줄여라. 해시태그 2개 추가.
${diary}`;
      let shareText = `${childName}의 하루 | ${highlights.slice(0, 2).join(', ')} #아맞다 #육아기록`;
      try {
        shareText = await callGeminiText(sharePrompt, { temperature: 0.5, maxTokens: 100 });
      } catch { /* use fallback */ }

      return { date, diary: diary.trim(), highlights, mood, shareText: shareText.trim(), emotionScore: 0, emotionKeywords: [] };
    } catch { /* fall to fallback */ }
  }

  // 폴백: AI 없이 데이터 기반 간단 일기
  return {
    date,
    diary: buildFallbackDiary(childName, data, highlights),
    highlights,
    mood,
    shareText: `${childName}의 하루 | ${highlights.slice(0, 2).join(', ')} #아맞다 #육아기록`,
    emotionScore: 0,
    emotionKeywords: [],
  };
}

function buildDataDescription(data: DayData): string {
  const parts: string[] = [];
  if (data.sleep) {
    const s = data.sleep;
    if (s.totalHours) parts.push(`수면: ${s.totalHours}시간`);
    if (s.nightWakeups) parts.push(`밤중 각성: ${s.nightWakeups}회`);
    if (s.napMinutes) parts.push(`낮잠: ${s.napMinutes}분`);
  }
  if (data.feeding) {
    const f = data.feeding;
    if (f.mealCount) parts.push(`식사: ${f.mealCount}회`);
    if (f.totalMl) parts.push(`수유: ${f.totalMl}ml`);
    if (f.note) parts.push(`식사 메모: ${f.note}`);
  }
  if (data.diaper) {
    const d = data.diaper;
    if (d.poopCount) parts.push(`배변: ${d.poopCount}회`);
    if (d.consistency) parts.push(`상태: ${d.consistency}`);
  }
  if (data.condition) parts.push(`컨디션: ${data.condition}`);
  if (data.temperature && data.temperature > 0) parts.push(`체온: ${data.temperature}도`);
  if (data.notes) parts.push(`메모: ${data.notes}`);
  return parts.length > 0 ? parts.join('\n') : '상세 기록 없음';
}

/** 감정 키워드 기반 점수 산출 (regex only, no AI call) */
export function scoreEmotion(text: string): { emotionScore: number; emotionKeywords: string[] } {
  const HIGH_KEYWORDS = ['처음', '첫', '걸었', '걸음마', '말했', '엄마라고', '아빠라고', '응급', '병원', '입원', '수술'];
  const MEDIUM_KEYWORDS = ['무서웠', '걱정', '감동', '눈물', '울었', '기뻤', '뿌듯', '대견', '열이', '아파서', '밤새'];
  const LOW_KEYWORDS = ['좋았', '재미있', '신기', '예뻤', '귀여', '잘했', '성장'];

  let score = 0;
  const matched: string[] = [];

  for (const kw of HIGH_KEYWORDS) {
    if (new RegExp(kw).test(text)) {
      score += 3;
      matched.push(kw);
    }
  }
  for (const kw of MEDIUM_KEYWORDS) {
    if (new RegExp(kw).test(text)) {
      score += 2;
      matched.push(kw);
    }
  }
  for (const kw of LOW_KEYWORDS) {
    if (new RegExp(kw).test(text)) {
      score += 1;
      matched.push(kw);
    }
  }

  return {
    emotionScore: Math.min(score, 10),
    emotionKeywords: matched,
  };
}

function buildFallbackDiary(childName: string, data: DayData, highlights: string[]): string {
  if (highlights.length === 0) return `오늘도 ${childName}와 함께한 하루. 내일도 좋은 하루가 되길.`;
  const summary = highlights.join(', ');
  return `오늘 ${childName}의 하루: ${summary}. 하루하루 자라는 모습이 기특해요.`;
}
