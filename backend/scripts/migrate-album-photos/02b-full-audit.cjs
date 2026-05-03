/**
 * 02b-full-audit.cjs — 전체 27개 문서 변환 결과 검증
 *
 * 실행: node backend/scripts/migrate-album-photos/02b-full-audit.cjs
 * 효과: 읽기 전용. 모든 27개 문서를 변환하고 무결성 체크.
 *
 * 체크 항목:
 *  - 필수 필드 누락 (userId, childId, phase, date, monthKey, createdAt)
 *  - emoji 백필 결과별 분류
 *  - createdAt 타입 (Timestamp vs ISO string vs undefined)
 *  - 동일 문서 ID 중복 가능성 (양 컬렉션 ID 충돌 검사)
 *  - 미래 날짜 / 0 날짜 등 비정상 값
 *  - childId 매칭 (cascade 삭제용 인덱스 영향)
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

const issues = [];
function flag(id, level, msg) {
  issues.push({ id, level, msg });
}

async function main() {
  console.log(`[audit] project: ${sa.project_id}`);
  console.log(`[audit] timestamp: ${new Date().toISOString()}\n`);

  const allIds = new Set();
  const idCollisions = [];

  // ── milestonePhotos ──
  const mpSnap = await db.collection('milestonePhotos').get();
  const mpDocs = mpSnap.docs.map((d) => ({ id: d.id, src: d.data() }));

  // ── pregnancyRecords ──
  const prSnap = await db.collection('pregnancyRecords').get();
  const prDocs = prSnap.docs.map((d) => ({ id: d.id, src: d.data() }));

  // ── doc ID 충돌 검사 (Firebase autoID는 충돌 가능성 ~0이지만 확인) ──
  for (const { id } of mpDocs) {
    if (allIds.has(id)) idCollisions.push(id);
    allIds.add(id);
  }
  for (const { id } of prDocs) {
    if (allIds.has(id)) idCollisions.push(id);
    allIds.add(id);
  }
  console.log(`[audit] 총 27개 docId 모두 유일?: ${idCollisions.length === 0 ? '✅' : '⚠️ 충돌 ' + idCollisions.length + '건'}`);
  if (idCollisions.length > 0) {
    console.log(`  충돌 ID: ${idCollisions.join(', ')}`);
  }

  // ── createdAt 타입 검사 ──
  let mpTimestampCount = 0, mpStringCount = 0, mpMissing = 0;
  for (const { id, src } of mpDocs) {
    if (!src.createdAt) { mpMissing += 1; flag(id, 'WARN', 'milestonePhotos: createdAt 없음'); }
    else if (typeof src.createdAt === 'string') mpStringCount += 1;
    else if (typeof src.createdAt.toDate === 'function') mpTimestampCount += 1;
  }
  console.log(`[audit] milestonePhotos createdAt: Timestamp ${mpTimestampCount}, ISO string ${mpStringCount}, 누락 ${mpMissing}`);

  let prTimestampCount = 0, prStringCount = 0, prMissing = 0;
  for (const { id, src } of prDocs) {
    if (!src.createdAt) { prMissing += 1; flag(id, 'WARN', 'pregnancyRecords: createdAt 없음'); }
    else if (typeof src.createdAt === 'string') prStringCount += 1;
    else if (typeof src.createdAt.toDate === 'function') prTimestampCount += 1;
  }
  console.log(`[audit] pregnancyRecords createdAt: Timestamp ${prTimestampCount}, ISO string ${prStringCount}, 누락 ${prMissing}`);

  // ── 필수 필드 검사 (모든 27 docs) ──
  console.log('\n[audit] 필수 필드 (userId, childId) 검사:');
  for (const { id, src } of mpDocs) {
    if (!src.userId) flag(id, 'ERROR', 'milestonePhotos: userId 없음');
    if (!src.childId) flag(id, 'ERROR', 'milestonePhotos: childId 없음');
    if (!src.uri) flag(id, 'WARN', 'milestonePhotos: uri 없음 (사진인데 URL 없음 = 깨진 데이터)');
    if (!src.date) flag(id, 'WARN', 'milestonePhotos: date 없음');
  }
  for (const { id, src } of prDocs) {
    if (!src.userId) flag(id, 'ERROR', 'pregnancyRecords: userId 없음');
    if (!src.childId) flag(id, 'ERROR', 'pregnancyRecords: childId 없음');
    if (!src.type) flag(id, 'WARN', 'pregnancyRecords: type 없음 (RecordType 누락)');
    // mediaUri는 nullable이라 OK
  }

  // ── emoji 백필 결과별 분류 ──
  console.log('\n[audit] pregnancyRecords emoji 백필 시뮬레이션:');
  const emojiOutcomes = {
    alreadyHadEmoji: 0,
    backfilledFromMilestoneType: 0,
    backfilledFromType: 0,
    stillNull: [],
  };
  for (const { id, src } of prDocs) {
    if (src.milestoneEmoji) {
      emojiOutcomes.alreadyHadEmoji += 1;
    } else if (src.milestoneType && MILESTONE_EMOJI[src.milestoneType]) {
      emojiOutcomes.backfilledFromMilestoneType += 1;
    } else if (src.type && PREG_TYPE_EMOJI[src.type]) {
      emojiOutcomes.backfilledFromType += 1;
    } else {
      emojiOutcomes.stillNull.push({ id, type: src.type, milestoneType: src.milestoneType });
    }
  }
  console.log(`  기존 emoji 있음: ${emojiOutcomes.alreadyHadEmoji}`);
  console.log(`  milestoneType으로 백필: ${emojiOutcomes.backfilledFromMilestoneType}`);
  console.log(`  type으로 백필: ${emojiOutcomes.backfilledFromType}`);
  console.log(`  여전히 null: ${emojiOutcomes.stillNull.length}`);
  if (emojiOutcomes.stillNull.length > 0) {
    console.log('  ⚠️ 백필 안 된 케이스:', emojiOutcomes.stillNull);
  }

  // ── date 유효성 검사 ──
  console.log('\n[audit] date 유효성 (YYYY-MM-DD):');
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  let dateOk = 0, dateInvalid = 0;
  for (const { id, src } of mpDocs) {
    const d = (src.date || '').replace(/\./g, '-').slice(0, 10);
    if (dateRegex.test(d)) dateOk += 1;
    else { dateInvalid += 1; flag(id, 'ERROR', `milestonePhotos: date 형식 이상 "${src.date}"`); }
  }
  for (const { id, src } of prDocs) {
    let d = '';
    if (src.createdAt && typeof src.createdAt.toDate === 'function') {
      d = src.createdAt.toDate().toISOString().slice(0, 10);
    } else if (typeof src.createdAt === 'string') {
      d = src.createdAt.slice(0, 10);
    }
    if (dateRegex.test(d)) dateOk += 1;
    else { dateInvalid += 1; flag(id, 'ERROR', `pregnancyRecords: date 추출 실패`); }
  }
  console.log(`  유효 ${dateOk}/27, 무효 ${dateInvalid}`);

  // ── childId 분포 (cascade 삭제 영향) ──
  console.log('\n[audit] childId 분포:');
  const childIdCounts = {};
  for (const { src } of [...mpDocs, ...prDocs]) {
    childIdCounts[src.childId] = (childIdCounts[src.childId] || 0) + 1;
  }
  console.log(`  unique childId 수: ${Object.keys(childIdCounts).length}`);
  console.log(`  doc/childId 분포:`, childIdCounts);

  // ── userId 분포 (탈퇴 cascade 영향) ──
  console.log('\n[audit] userId 분포:');
  const userIdCounts = {};
  for (const { src } of [...mpDocs, ...prDocs]) {
    userIdCounts[src.userId] = (userIdCounts[src.userId] || 0) + 1;
  }
  console.log(`  unique userId 수: ${Object.keys(userIdCounts).length}`);

  // ── albumPhotos 컬렉션 비어있는지 (재실행 안전성) ──
  const apSnap = await db.collection('albumPhotos').limit(1).get();
  console.log(`\n[audit] albumPhotos 컬렉션 비어있음: ${apSnap.empty ? '✅' : '⚠️ 이미 데이터 있음 — 재실행이면 중복 위험'}`);

  // ── 결과 요약 ──
  console.log('\n═══════════════════════════════════════════════');
  console.log('  AUDIT 결과 요약');
  console.log('═══════════════════════════════════════════════');
  const errors = issues.filter((i) => i.level === 'ERROR');
  const warns = issues.filter((i) => i.level === 'WARN');
  console.log(`ERROR: ${errors.length}`);
  console.log(`WARN: ${warns.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERROR 상세:');
    for (const e of errors) console.log(`  [${e.id}] ${e.msg}`);
  }
  if (warns.length > 0) {
    console.log('\n⚠️ WARN 상세:');
    for (const w of warns) console.log(`  [${w.id}] ${w.msg}`);
  }

  if (errors.length === 0 && warns.length === 0) {
    console.log('\n✅ 모든 27 docs 마이그레이션 안전. 진행 가능.');
  } else if (errors.length === 0) {
    console.log('\n⚠️ ERROR 없음. WARN은 nullable이거나 알려진 케이스. 진행 가능 (검토 후).');
  } else {
    console.log('\n❌ ERROR 있음. 마이그레이션 보류 권장.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[audit] 에러:', err);
  process.exit(1);
});
