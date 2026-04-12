/**
 * 성장 타임캡슐
 * - 부모가 미래의 자신에게 편지를 씀
 * - AI가 현재 상황(아이 월령, 고민, 기질 정보)을 함께 저장
 * - 설정한 날짜에 푸시로 알림 → 앱에서 열어봄
 * - 감정적 유대 → 앱 삭제 방지 + 장기 리텐션
 */

import { collections, genId } from '../firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { callGeminiText, isGeminiAvailable } from './gemini.client';

export interface TimeCapsule {
  id: string;
  userId: string;
  childId: string;
  childName: string;
  ageInfoAtCreation: string;
  temperament: string;
  parentMessage: string;      // 부모가 쓴 편지
  aiContext: string;           // AI가 추가한 현재 상황 요약
  currentStruggles: string;   // AI가 감지한 현재 고민
  openDate: string;            // 열리는 날짜 (ISO)
  isOpened: boolean;
  createdAt: string;
  openedAt: string | null;
}

/**
 * 타임캡슐 생성
 * @param months 몇 개월 후 열 것인지 (3, 6, 12)
 */
export async function createTimeCapsule(
  userId: string,
  childId: string,
  childName: string,
  ageInfo: string,
  temperament: string,
  parentMessage: string,
  months: 3 | 6 | 12,
): Promise<TimeCapsule> {
  const id = genId();
  const now = new Date();
  const openDate = new Date(now);
  openDate.setMonth(openDate.getMonth() + months);

  // AI가 현재 상황을 요약 (나중에 읽을 때 맥락 제공)
  const aiContext = await generateAIContext(childName, ageInfo, temperament, childId);
  const currentStruggles = await detectCurrentStruggles(childId, userId);

  const capsule: TimeCapsule = {
    id,
    userId,
    childId,
    childName,
    ageInfoAtCreation: ageInfo,
    temperament,
    parentMessage,
    aiContext,
    currentStruggles,
    openDate: openDate.toISOString().slice(0, 10),
    isOpened: false,
    createdAt: now.toISOString(),
    openedAt: null,
  };

  await collections.timeCapsules.doc(id).set({
    ...capsule,
    serverCreatedAt: FieldValue.serverTimestamp(),
  });

  return capsule;
}

/** 열 수 있는 캡슐 목록 조회 */
export async function getOpenableCapsules(userId: string): Promise<TimeCapsule[]> {
  const today = new Date().toISOString().slice(0, 10);
  const snap = await collections.timeCapsules
    .where('userId', '==', userId)
    .where('isOpened', '==', false)
    .where('openDate', '<=', today)
    .get();

  return snap.docs.map((doc) => doc.data() as TimeCapsule);
}

/** 캡슐 열기 */
export async function openTimeCapsule(capsuleId: string, userId: string): Promise<TimeCapsule | null> {
  const doc = await collections.timeCapsules.doc(capsuleId).get();
  if (!doc.exists) return null;

  const capsule = doc.data() as TimeCapsule;
  if (capsule.userId !== userId) return null;

  // 아직 열 날짜가 안 됐으면
  const today = new Date().toISOString().slice(0, 10);
  if (capsule.openDate > today) return null;

  await collections.timeCapsules.doc(capsuleId).update({
    isOpened: true,
    openedAt: new Date().toISOString(),
  });

  return { ...capsule, isOpened: true, openedAt: new Date().toISOString() };
}

/** 전체 캡슐 목록 (열린 것 포함) */
export async function listTimeCapsules(userId: string, childId: string): Promise<TimeCapsule[]> {
  const snap = await collections.timeCapsules
    .where('userId', '==', userId)
    .where('childId', '==', childId)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  return snap.docs.map((doc) => doc.data() as TimeCapsule);
}

async function generateAIContext(
  childName: string,
  ageInfo: string,
  temperament: string,
  childId: string,
): Promise<string> {
  if (!isGeminiAvailable()) {
    return `${childName}(${ageInfo}, ${temperament} 기질)의 성장 기록`;
  }

  try {
    // 최근 트래킹 요약 가져오기
    const snap = await collections.dailyTracking
      .where('childId', '==', childId)
      .orderBy('date', 'desc')
      .limit(3)
      .get();

    const recentNotes = snap.docs
      .map((d) => (d.data() as Record<string, unknown>).notes as string)
      .filter(Boolean)
      .slice(0, 2);

    const prompt = `${childName}(${ageInfo}, ${temperament} 기질) 아이의 현재 상황을 2~3문장으로 요약해라.
최근 메모: ${recentNotes.join(', ') || '없음'}
이 요약은 ${ageInfo}에서 6~12개월 뒤에 부모가 다시 읽을 것이다. "그때 이랬었구나" 느낌이 나도록 구체적으로.
50~80자.`;

    return await callGeminiText(prompt, { temperature: 0.5, maxTokens: 120 });
  } catch {
    return `${childName}(${ageInfo}, ${temperament} 기질)의 성장 기록`;
  }
}

async function detectCurrentStruggles(childId: string, userId: string): Promise<string> {
  try {
    // 최근 코칭 세션에서 고민 추출
    const snap = await collections.coachingSessions
      .where('childId', '==', childId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (snap.empty) return '아직 상담 기록이 없어요';

    const categories = snap.docs
      .map((d) => (d.data() as Record<string, unknown>).category as string)
      .filter(Boolean);

    const topCategory = categories.length > 0
      ? categories.reduce((a, b, _i, arr) =>
          arr.filter((v) => v === a).length >= arr.filter((v) => v === b).length ? a : b)
      : '일반';

    const messages = snap.docs
      .map((d) => ((d.data() as Record<string, unknown>).message as string)?.slice(0, 30))
      .filter(Boolean)
      .slice(0, 2);

    return `주로 ${topCategory} 관련 고민 (${messages.join(', ')})`;
  } catch {
    return '기록 수집 중';
  }
}
