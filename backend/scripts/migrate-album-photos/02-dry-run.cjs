/**
 * 02-dry-run.cjs — 마이그레이션 시뮬레이션 (쓰기 없음, 콘솔 출력만)
 *
 * 실행: node backend/scripts/migrate-album-photos/02-dry-run.cjs
 * 효과: 읽기 전용. Firestore 쓰기 없음. 새 컬렉션 albumPhotos에 들어갈 모양만 출력.
 *
 * 검증 포인트:
 *  1. 각 컬렉션 변환 결과가 albumPhotos 스키마에 맞는가?
 *  2. emoji null이 ALL_MILESTONES 매핑으로 잘 백필되는가?
 *  3. date 형식 정규화(점→하이픈)가 잘 되는가?
 *  4. 사진 없는 pregnancyRecords(memo 등) 처리가 OK인가?
 *
 * 사용자 검토 후 03-migrate.cjs 실행
 */

const path = require('path');
const admin = require('firebase-admin');

const SA_PATH = path.resolve(__dirname, '../../service-account.json');
const sa = require(SA_PATH);

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id,
});

const db = admin.firestore();

// frontend pregnancy.tsx의 ALL_MILESTONES 매핑 (milestoneType → emoji)
const MILESTONE_EMOJI = {
  positive_test: '🤰',
  prenatal_vitamins: '💊',
  first_visit: '🏥',
  first_ultrasound: '📸',
  first_heartbeat: '💓',
  nt_test: '🔬',
  stable_period: '🌿',
  quad_test: '🧪',
  gender_reveal: '🎀',
  first_kick: '🦶',
  detailed_ultrasound: '📋',
  name_decided: '📝',
  gct_test: '🩸',
  nursery_start: '🏠',
  birth_class: '📚',
  gbs_test: '🔬',
  hospital_bag: '🧳',
  maternity_photo: '📷',
  baby_shower: '🎉',
  d_day: '👶',
  // 백엔드 AUTO_MILESTONES에만 있던 것
  first_kick_b: '🦶',  // alias
  nursery_ready: '🏠', // backend AUTO_MILESTONES
};

// 임신 type → 기본 emoji (milestoneType 없을 때 fallback)
const PREG_TYPE_EMOJI = {
  ultrasound: '📸',
  heartbeat: '💓',
  doctor_note: '🏥',
  milestone: '🤰',
  memo: '📝',
};

// date 정규화: 'YYYY.MM.DD' → 'YYYY-MM-DD'
function normalizeDate(d) {
  if (!d || typeof d !== 'string') return null;
  return d.replace(/\./g, '-').slice(0, 10);
}

/**
 * milestonePhotos 문서 → albumPhotos (baby phase)
 */
function transformMilestonePhoto(id, src) {
  const date = normalizeDate(src.date) || '';
  const monthKey = src.monthKey || (date ? date.slice(0, 7) : '');
  return {
    _sourceId: id,
    _source: 'milestonePhotos',
    userId: src.userId,
    childId: src.childId,
    phase: 'baby',
    uri: src.uri || null,
    printUrl: src.printUrl || src.uri || null,
    mediaType: 'photo',
    title: src.milestone || '추억',
    content: src.memo || null,
    milestoneType: null, // 옛 milestonePhotos엔 milestoneType 없음 (자유 텍스트만)
    milestoneEmoji: src.milestoneEmoji || null,
    milestoneColor: src.milestoneColor || null,
    date: date,
    monthKey: monthKey,
    createdAt: src.createdAt, // ISO string → 마이그레이션 시 Timestamp로 변환
    week: null,
    pregnancyType: null,
  };
}

/**
 * pregnancyRecords 문서 → albumPhotos (pregnancy phase)
 * emoji null이면 milestoneType → MILESTONE_EMOJI → type → PREG_TYPE_EMOJI 순으로 백필
 */
function transformPregnancyRecord(id, src) {
  // emoji 백필 우선순위: 기존 emoji → milestoneType 매핑 → type 매핑 → null
  let emoji = src.milestoneEmoji;
  if (!emoji && src.milestoneType) {
    emoji = MILESTONE_EMOJI[src.milestoneType] || null;
  }
  if (!emoji && src.type) {
    emoji = PREG_TYPE_EMOJI[src.type] || null;
  }

  // createdAt → date 변환 (Timestamp이면 ISO 문자열의 앞 10자)
  let date = '';
  let monthKey = '';
  if (src.createdAt) {
    if (typeof src.createdAt.toDate === 'function') {
      const iso = src.createdAt.toDate().toISOString();
      date = iso.slice(0, 10);
      monthKey = iso.slice(0, 7);
    } else if (typeof src.createdAt === 'string') {
      date = src.createdAt.slice(0, 10);
      monthKey = src.createdAt.slice(0, 7);
    }
  }

  return {
    _sourceId: id,
    _source: 'pregnancyRecords',
    userId: src.userId,
    childId: src.childId,
    phase: 'pregnancy',
    uri: src.mediaUri || null,
    printUrl: src.mediaUri || null, // pregnancyRecords엔 printUrl 없음, mediaUri 재사용
    mediaType: src.mediaType || (src.mediaUri ? 'photo' : null),
    title: src.title || src.type || '임신기록',
    content: src.content || null,
    milestoneType: src.milestoneType || null,
    milestoneEmoji: emoji,
    milestoneColor: '#E91E63', // 임신 핑크 (album.ts에서 쓰던 값)
    date: date,
    monthKey: monthKey,
    createdAt: src.createdAt,
    week: src.week ?? null,
    pregnancyType: src.type || null,
  };
}

async function main() {
  console.log(`[dry-run] project: ${sa.project_id}`);
  console.log(`[dry-run] timestamp: ${new Date().toISOString()}`);
  console.log('[dry-run] ⚠️ 쓰기 없음. 변환 결과만 출력.\n');

  const stats = {
    milestonePhotos: { total: 0, ok: 0, missingDate: 0, missingUri: 0 },
    pregnancyRecords: { total: 0, ok: 0, emojiBackfilled: 0, missingMedia: 0, byType: {} },
  };

  // ── milestonePhotos ──
  console.log('═══════════════════════════════════════════════════════');
  console.log('  milestonePhotos → albumPhotos (phase: baby)');
  console.log('═══════════════════════════════════════════════════════');
  const mpSnap = await db.collection('milestonePhotos').get();
  stats.milestonePhotos.total = mpSnap.size;

  let shown = 0;
  for (const d of mpSnap.docs) {
    const transformed = transformMilestonePhoto(d.id, d.data());
    if (transformed.date) stats.milestonePhotos.ok += 1;
    else stats.milestonePhotos.missingDate += 1;
    if (!transformed.uri) stats.milestonePhotos.missingUri += 1;

    if (shown < 3) {
      console.log(`\n[샘플 ${shown + 1}/${Math.min(3, mpSnap.size)}] doc id: ${d.id}`);
      console.log(JSON.stringify(redact(transformed), null, 2));
      shown += 1;
    }
  }

  // ── pregnancyRecords ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  pregnancyRecords → albumPhotos (phase: pregnancy)');
  console.log('═══════════════════════════════════════════════════════');
  const pregSnap = await db.collection('pregnancyRecords').get();
  stats.pregnancyRecords.total = pregSnap.size;

  shown = 0;
  for (const d of pregSnap.docs) {
    const src = d.data();
    const transformed = transformPregnancyRecord(d.id, src);
    if (transformed.date) stats.pregnancyRecords.ok += 1;
    if (!transformed.uri) stats.pregnancyRecords.missingMedia += 1;
    // emoji 백필 발생 카운트
    if (!src.milestoneEmoji && transformed.milestoneEmoji) {
      stats.pregnancyRecords.emojiBackfilled += 1;
    }
    stats.pregnancyRecords.byType[transformed.pregnancyType] =
      (stats.pregnancyRecords.byType[transformed.pregnancyType] || 0) + 1;

    if (shown < 3) {
      console.log(`\n[샘플 ${shown + 1}/${Math.min(3, pregSnap.size)}] doc id: ${d.id}`);
      console.log('원본:', JSON.stringify({
        type: src.type,
        milestoneType: src.milestoneType,
        milestoneEmoji: src.milestoneEmoji,
        title: src.title,
        week: src.week,
      }, null, 2));
      console.log('→ 변환 결과:');
      console.log(JSON.stringify(redact(transformed), null, 2));
      shown += 1;
    }
  }

  // ── 통계 요약 ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  변환 통계');
  console.log('═══════════════════════════════════════════════════════');
  console.log('milestonePhotos:');
  console.log(`  총: ${stats.milestonePhotos.total}`);
  console.log(`  date 있음: ${stats.milestonePhotos.ok}`);
  console.log(`  date 없음: ${stats.milestonePhotos.missingDate}`);
  console.log(`  uri 없음: ${stats.milestonePhotos.missingUri}`);

  console.log('\npregnancyRecords:');
  console.log(`  총: ${stats.pregnancyRecords.total}`);
  console.log(`  date 있음: ${stats.pregnancyRecords.ok}`);
  console.log(`  사진 없음 (uri null): ${stats.pregnancyRecords.missingMedia}`);
  console.log(`  emoji 백필 성공: ${stats.pregnancyRecords.emojiBackfilled}`);
  console.log(`  type 분포:`, stats.pregnancyRecords.byType);

  console.log(`\n[dry-run] 변환 시뮬레이션 완료. 합계 ${stats.milestonePhotos.total + stats.pregnancyRecords.total} docs.`);
  console.log('[dry-run] ✅ 실 쓰기 없음. 사용자 검토 후 03-migrate.cjs 실행.');
  process.exit(0);
}

function redact(obj) {
  const r = { ...obj };
  if (r.userId) r.userId = String(r.userId).slice(0, 6) + '***';
  if (r.uri) r.uri = '<uri:' + String(r.uri).length + 'chars>';
  if (r.printUrl) r.printUrl = '<printUrl:' + String(r.printUrl).length + 'chars>';
  if (r.createdAt && typeof r.createdAt.toDate === 'function') {
    r.createdAt = '<Timestamp:' + r.createdAt.toDate().toISOString() + '>';
  }
  return r;
}

main().catch((err) => {
  console.error('[dry-run] 에러:', err);
  process.exit(1);
});
