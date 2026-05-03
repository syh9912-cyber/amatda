/**
 * 03-migrate.cjs — pregnancyRecords + milestonePhotos → albumPhotos 실 마이그레이션
 *
 * 실행: node backend/scripts/migrate-album-photos/03-migrate.cjs
 * 효과: ⚠️ Firestore에 쓰기 발생. albumPhotos에 새 문서 27개 생성.
 *
 * 안전장치:
 *  - 옛 doc ID 그대로 사용 (충돌 없음, audit에서 확인됨) → DELETE 라우트 호환
 *  - _sourceCollection, _sourceId 필드로 출처 추적 (rollback용)
 *  - albumPhotos가 비어있을 때만 실행 (재실행 방지)
 *  - Firestore batch (500건/배치) — atomic
 *  - 실행 후 count 검증
 *
 * 옛 컬렉션은 그대로 유지 — Phase 5(dual-read) 단계에서 fallback으로 사용
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
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const MILESTONE_EMOJI = {
  positive_test: '🤰', prenatal_vitamins: '💊', first_visit: '🏥',
  first_ultrasound: '📸', first_heartbeat: '💓', nt_test: '🔬',
  stable_period: '🌿', quad_test: '🧪', gender_reveal: '🎀',
  first_kick: '🦶', detailed_ultrasound: '📋', name_decided: '📝',
  gct_test: '🩸', nursery_start: '🏠', birth_class: '📚',
  gbs_test: '🔬', hospital_bag: '🧳', maternity_photo: '📷',
  baby_shower: '🎉', d_day: '👶', nursery_ready: '🏠',
};
const PREG_TYPE_EMOJI = {
  ultrasound: '📸', heartbeat: '💓', doctor_note: '🏥',
  milestone: '🤰', memo: '📝',
};

function normalizeDate(d) {
  if (!d || typeof d !== 'string') return null;
  return d.replace(/\./g, '-').slice(0, 10);
}

/**
 * milestonePhotos 문서 → albumPhotos (baby phase)
 * 옛 doc ID 그대로 사용
 */
function transformMilestonePhoto(srcId, src) {
  const date = normalizeDate(src.date) || '';
  const monthKey = src.monthKey || (date ? date.slice(0, 7) : '');

  // createdAt: ISO string → Timestamp 변환
  let createdAt = src.createdAt;
  if (typeof createdAt === 'string') {
    createdAt = Timestamp.fromDate(new Date(createdAt));
  } else if (!createdAt) {
    createdAt = FieldValue.serverTimestamp();
  }

  return {
    userId: src.userId,
    childId: src.childId,
    phase: 'baby',
    uri: src.uri || null,
    printUrl: src.printUrl || src.uri || null,
    mediaType: 'photo',
    title: src.milestone || '추억',
    content: src.memo || null,
    milestoneType: null, // 옛 milestonePhotos엔 milestoneType 없음
    milestoneEmoji: src.milestoneEmoji || null,
    milestoneColor: src.milestoneColor || null,
    date: date,
    monthKey: monthKey,
    createdAt: createdAt,
    week: null,
    pregnancyType: null,
    // 마이그레이션 메타 (rollback / 디버깅용)
    _sourceCollection: 'milestonePhotos',
    _sourceId: srcId,
    _migratedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * pregnancyRecords 문서 → albumPhotos (pregnancy phase)
 * emoji 백필 + 옛 doc ID 그대로 사용
 */
function transformPregnancyRecord(srcId, src) {
  // emoji 백필 우선순위
  let emoji = src.milestoneEmoji;
  if (!emoji && src.milestoneType) emoji = MILESTONE_EMOJI[src.milestoneType] || null;
  if (!emoji && src.type) emoji = PREG_TYPE_EMOJI[src.type] || null;

  // createdAt → date 변환
  let date = '', monthKey = '';
  let createdAt = src.createdAt;
  if (createdAt && typeof createdAt.toDate === 'function') {
    const iso = createdAt.toDate().toISOString();
    date = iso.slice(0, 10);
    monthKey = iso.slice(0, 7);
  } else if (typeof createdAt === 'string') {
    date = createdAt.slice(0, 10);
    monthKey = createdAt.slice(0, 7);
    createdAt = Timestamp.fromDate(new Date(createdAt));
  }

  return {
    userId: src.userId,
    childId: src.childId,
    phase: 'pregnancy',
    uri: src.mediaUri || null,
    printUrl: src.mediaUri || null,
    mediaType: src.mediaType || (src.mediaUri ? 'photo' : null),
    title: src.title || src.type || '임신기록',
    content: src.content || null,
    milestoneType: src.milestoneType || null,
    milestoneEmoji: emoji,
    milestoneColor: '#E91E63',
    date: date,
    monthKey: monthKey,
    createdAt: createdAt,
    week: src.week ?? null,
    pregnancyType: src.type || null,
    _sourceCollection: 'pregnancyRecords',
    _sourceId: srcId,
    _migratedAt: FieldValue.serverTimestamp(),
  };
}

async function main() {
  console.log(`[migrate] project: ${sa.project_id}`);
  console.log(`[migrate] timestamp: ${new Date().toISOString()}\n`);

  // ── 안전장치: albumPhotos가 비어있는지 확인 ──
  const existingSnap = await db.collection('albumPhotos').limit(1).get();
  if (!existingSnap.empty) {
    console.error('[migrate] ❌ albumPhotos 컬렉션이 이미 비어있지 않습니다.');
    console.error('  재실행이라면 먼저 컬렉션을 비우거나 04-rollback.cjs를 실행하세요.');
    process.exit(1);
  }

  // ── 양 컬렉션 읽기 ──
  const [mpSnap, prSnap] = await Promise.all([
    db.collection('milestonePhotos').get(),
    db.collection('pregnancyRecords').get(),
  ]);
  console.log(`[migrate] milestonePhotos: ${mpSnap.size}개`);
  console.log(`[migrate] pregnancyRecords: ${prSnap.size}개`);
  console.log(`[migrate] 합계: ${mpSnap.size + prSnap.size}개 → albumPhotos\n`);

  // ── Firestore batch 작성 (500건/배치) ──
  const BATCH_SIZE = 500;
  const allOps = [];

  for (const d of mpSnap.docs) {
    const data = transformMilestonePhoto(d.id, d.data());
    allOps.push({ id: d.id, data });
  }
  for (const d of prSnap.docs) {
    const data = transformPregnancyRecord(d.id, d.data());
    allOps.push({ id: d.id, data });
  }

  // ── ID 충돌 최종 확인 (audit에서 0건이지만 한 번 더) ──
  const seenIds = new Set();
  for (const op of allOps) {
    if (seenIds.has(op.id)) {
      console.error(`[migrate] ❌ doc ID 충돌: ${op.id}`);
      process.exit(1);
    }
    seenIds.add(op.id);
  }

  // ── Batch 실행 ──
  let written = 0;
  for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
    const slice = allOps.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const op of slice) {
      batch.set(db.collection('albumPhotos').doc(op.id), op.data);
    }
    await batch.commit();
    written += slice.length;
    console.log(`[migrate] batch ${Math.floor(i / BATCH_SIZE) + 1}: ${slice.length}개 쓰기 완료 (누적 ${written})`);
  }

  // ── 검증: 새 컬렉션 count 일치 ──
  const verifySnap = await db.collection('albumPhotos').get();
  const expectedCount = mpSnap.size + prSnap.size;
  if (verifySnap.size !== expectedCount) {
    console.error(`[migrate] ❌ count 불일치. 예상 ${expectedCount}, 실제 ${verifySnap.size}`);
    process.exit(1);
  }

  // ── phase별 분류 검증 ──
  const phaseCounts = { pregnancy: 0, baby: 0 };
  let emojiBackfilledTotal = 0;
  for (const d of verifySnap.docs) {
    const data = d.data();
    phaseCounts[data.phase] = (phaseCounts[data.phase] || 0) + 1;
    if (data._sourceCollection === 'pregnancyRecords' && data.milestoneEmoji) {
      // 원본에 emoji 있었는지 추적은 _sourceId로 다시 안 봐도, 카운트만
    }
  }

  console.log(`\n[migrate] ✅ 마이그레이션 완료`);
  console.log(`  albumPhotos 총 docs: ${verifySnap.size}`);
  console.log(`  pregnancy phase: ${phaseCounts.pregnancy}`);
  console.log(`  baby phase: ${phaseCounts.baby}`);

  // ── 옛 컬렉션은 그대로 유지 (dual-read fallback용) ──
  console.log(`\n[migrate] 옛 컬렉션 그대로 유지:`);
  console.log(`  pregnancyRecords: ${prSnap.size}개 (보존)`);
  console.log(`  milestonePhotos: ${mpSnap.size}개 (보존)`);
  console.log(`\n다음 단계: backend 라우트에 dual-read 구현 → 배포 → 검증`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate] 에러:', err);
  process.exit(1);
});
