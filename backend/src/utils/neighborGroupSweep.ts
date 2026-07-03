/**
 * 동네 또래맘 커뮤니티 유도 푸시 sweep.
 *
 * Cloud Scheduler (화·금 19:00 KST = 주 2회) 에서 호출.
 * 위치(동네)를 등록한 사용자에게 "우리 동네 N개월 또래맘들과 소통해요" 형태의
 * 맘그룹(맘스톡) 참여 유도 알림을 보낸다.
 *
 * 타깃팅:
 *   - users 문서에 locationLabel(동네) 이 있는 사용자
 *   - 소유 자녀 중 출생일이 있는(비임신) 아이의 개월수로 또래 표현
 *   - locationLabel 에서 행정구역(구/군/시) 추출 → "광산구" 같은 지역명으로 노출
 *
 * 빈도:
 *   - 스케줄 자체가 주 2회(화·금)라 자연스럽게 빈도 제한됨
 *   - lastNeighborPushAt 가드(최근 2일 내 발송 skip)로 재시도 시 중복 발송 차단(멱등성)
 *
 * 비용: Expo Push 무료. (CLAUDE.md — FCM/Expo 무료 티어만 사용)
 */
import { Timestamp } from 'firebase-admin/firestore';
import { collections } from '../services/firestore';
import { sendExpoPush } from './expoPush';
import { calculateAge } from '../services/age.calculator';
import { neighborGroupPush, normalizePushLocale } from './pushI18n';
import { logger } from './logger';

const DAY_MS = 24 * 60 * 60 * 1000;

const SWEEP_BATCH_SIZE = 100; // 한 회차 처리 상한 (안전장치)
const RECENT_PUSH_GUARD_DAYS = 2; // 최근 N일 내 발송했으면 skip (멱등성 가드)
const MAX_AGE_MONTHS = 200; // 비정상 birthDate 방어 상한

interface NeighborSweepStats {
  sent: number;
  skipped: number;
  errors: number;
}

/**
 * locationLabel 에서 행정구역명 추출.
 * 예) "광산구 신창동" → "광산구", "수원시 영통구" → "영통구", "마포구 홍대" → "마포구"
 * 구/군 우선, 없으면 시, 그래도 없으면 첫 토큰(또는 라벨 전체).
 */
export function extractDistrict(label: string): string {
  const tokens = label.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return label.trim();
  const guGun = tokens.find((t) => /(구|군)$/.test(t));
  if (guGun) return guGun;
  const si = tokens.find((t) => /시$/.test(t));
  if (si) return si;
  return tokens[0] as string;
}

/**
 * 사용자의 소유 자녀 중 푸시 대상 아이의 개월수 선정.
 * - 출생일 있는 비임신 아이만 후보
 * - babyBirthYear(사용자가 선택한 자녀 출생연도) 매칭 우선, 없으면 가장 어린 아이
 * - 후보 없으면 null
 */
async function pickChildMonths(userId: string, babyBirthYear: unknown): Promise<number | null> {
  const snap = await collections.children.where('userId', '==', userId).get();
  const cands: { months: number; year: number }[] = [];
  for (const d of snap.docs) {
    const cd = d.data() as Record<string, unknown>;
    if (cd.isPregnant === true) continue;
    const bd = typeof cd.birthDate === 'string' ? cd.birthDate : null;
    if (!bd) continue;
    const date = new Date(bd);
    if (Number.isNaN(date.getTime())) continue;
    const { months } = calculateAge(date);
    if (months < 0 || months > MAX_AGE_MONTHS) continue;
    cands.push({ months, year: date.getFullYear() });
  }
  if (cands.length === 0) return null;
  if (typeof babyBirthYear === 'number') {
    const match = cands.find((c) => c.year === babyBirthYear);
    if (match) return match.months;
  }
  cands.sort((a, b) => a.months - b.months);
  return (cands[0] as { months: number }).months;
}

/**
 * 사용자의 모든 유효 Expo push token 수집 (중복 제거).
 */
async function collectUserTokens(userId: string): Promise<{ tokens: string[]; locale: unknown }> {
  const snap = await collections.pushSchedules.where('userId', '==', userId).limit(20).get();
  const tokens = new Set<string>();
  let locale: unknown;
  snap.docs.forEach((d) => {
    const data = d.data() as { pushToken?: unknown; locale?: unknown };
    const t = data.pushToken;
    if (typeof t === 'string' && /^ExponentPushToken\[/.test(t)) {
      tokens.add(t);
      if (locale === undefined && data.locale !== undefined) locale = data.locale;
    }
  });
  return { tokens: Array.from(tokens), locale };
}

/**
 * 동네 또래맘 유도 푸시 sweep 메인 진입점.
 * 멱등성 — 같은 날 두 번 호출돼도 lastNeighborPushAt 가드로 중복 발송 안 됨.
 */
export async function runNeighborGroupSweep(): Promise<NeighborSweepStats> {
  const stats: NeighborSweepStats = { sent: 0, skipped: 0, errors: 0 };
  const startedAt = Date.now();
  logger.info('neighborSweep', 'started');

  // 위치를 등록한 사용자만 대상 — locationUpdatedAt 존재 = orderBy 로 자연 필터.
  // (단일 필드 orderBy 라 복합 인덱스 불필요)
  let candidates;
  try {
    candidates = await collections.users
      .orderBy('locationUpdatedAt', 'desc')
      .limit(SWEEP_BATCH_SIZE)
      .get();
  } catch (err) {
    logger.error('neighborSweep/query', err);
    return stats;
  }

  const guardMs = Date.now() - RECENT_PUSH_GUARD_DAYS * DAY_MS;

  for (const userDoc of candidates.docs) {
    const data = userDoc.data() as Record<string, unknown>;
    const userId = userDoc.id;
    try {
      const label = typeof data.locationLabel === 'string' ? data.locationLabel.trim() : '';
      if (!label) {
        stats.skipped += 1;
        continue;
      }

      // 빈도/중복 가드 — 최근 2일 내 발송했으면 skip
      const last = data.lastNeighborPushAt;
      if (last instanceof Timestamp && last.toMillis() > guardMs) {
        stats.skipped += 1;
        continue;
      }

      const months = await pickChildMonths(userId, data.babyBirthYear);
      if (months == null) {
        stats.skipped += 1;
        continue;
      }

      const { tokens, locale } = await collectUserTokens(userId);
      if (tokens.length === 0) {
        stats.skipped += 1;
        continue;
      }

      const district = extractDistrict(label);
      const { title, body } = neighborGroupPush(district, months, normalizePushLocale(locale));
      await sendExpoPush(
        tokens.map((to) => ({
          to,
          title,
          body,
          data: { type: 'neighbor-group', screen: 'mom-group' },
        })),
      );

      await collections.users.doc(userId).update({
        lastNeighborPushAt: Timestamp.now(),
      });
      stats.sent += 1;
    } catch (err) {
      stats.errors += 1;
      logger.error('neighborSweep/user', err);
    }
  }

  logger.info(
    'neighborSweep',
    `done sent=${stats.sent} skipped=${stats.skipped} errors=${stats.errors} elapsedMs=${Date.now() - startedAt}`,
  );
  return stats;
}
