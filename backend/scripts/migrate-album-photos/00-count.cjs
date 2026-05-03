/**
 * 00-count.cjs — 연결 테스트 + 양 컬렉션 카운트
 *
 * 실행: node backend/scripts/migrate-album-photos/00-count.cjs
 * 효과: 읽기 전용. 쓰기 없음.
 *
 * 출력:
 *  - pregnancyRecords 총 개수
 *  - milestonePhotos 총 개수
 *  - 각 컬렉션 첫 1개 샘플 문서 (구조 파악용)
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

async function main() {
  console.log(`[count] project_id: ${sa.project_id}`);
  console.log(`[count] timestamp: ${new Date().toISOString()}`);

  // ── pregnancyRecords ──
  console.log('\n=== pregnancyRecords ===');
  const pregSnap = await db.collection('pregnancyRecords').get();
  console.log(`총 문서 수: ${pregSnap.size}`);

  const pregByType = {};
  const pregNoMedia = { count: 0 };
  const pregNullEmoji = { count: 0 };
  for (const d of pregSnap.docs) {
    const r = d.data();
    pregByType[r.type] = (pregByType[r.type] || 0) + 1;
    if (!r.mediaUri) pregNoMedia.count += 1;
    if (!r.milestoneEmoji) pregNullEmoji.count += 1;
  }
  console.log('type 분포:', pregByType);
  console.log(`  사진 없는 (mediaUri null): ${pregNoMedia.count}`);
  console.log(`  emoji null: ${pregNullEmoji.count}`);

  if (pregSnap.size > 0) {
    const sample = pregSnap.docs[0].data();
    console.log('샘플 문서 (id=' + pregSnap.docs[0].id + '):');
    console.log(JSON.stringify(redact(sample), null, 2));
  }

  // ── milestonePhotos ──
  console.log('\n=== milestonePhotos ===');
  const mpSnap = await db.collection('milestonePhotos').get();
  console.log(`총 문서 수: ${mpSnap.size}`);

  let mpDateOldFmt = 0;
  let mpNoMonthKey = 0;
  let mpNullEmoji = 0;
  for (const d of mpSnap.docs) {
    const r = d.data();
    if (typeof r.date === 'string' && r.date.includes('.')) mpDateOldFmt += 1;
    if (!r.monthKey) mpNoMonthKey += 1;
    if (!r.milestoneEmoji) mpNullEmoji += 1;
  }
  console.log(`  date 점표기 (구버전): ${mpDateOldFmt}`);
  console.log(`  monthKey 없음: ${mpNoMonthKey}`);
  console.log(`  emoji null: ${mpNullEmoji}`);

  if (mpSnap.size > 0) {
    const sample = mpSnap.docs[0].data();
    console.log('샘플 문서 (id=' + mpSnap.docs[0].id + '):');
    console.log(JSON.stringify(redact(sample), null, 2));
  }

  // ── albumPhotos (이미 있는지 확인 — 없어야 정상) ──
  console.log('\n=== albumPhotos (목적 컬렉션) ===');
  const apSnap = await db.collection('albumPhotos').limit(1).get();
  console.log(`존재 여부: ${apSnap.size > 0 ? '⚠️ 있음 (재실행?)' : '✅ 없음 (정상)'}`);

  console.log('\n[count] 완료. 쓰기 없음. 안전.');
  process.exit(0);
}

// userId, mediaUri 같은 식별자/URL은 마스킹해서 출력
function redact(obj) {
  const r = { ...obj };
  if (r.userId) r.userId = String(r.userId).slice(0, 6) + '***';
  if (r.uri) r.uri = '<uri:' + String(r.uri).length + 'chars>';
  if (r.printUrl) r.printUrl = '<printUrl:' + String(r.printUrl).length + 'chars>';
  if (r.mediaUri) r.mediaUri = '<mediaUri:' + String(r.mediaUri).length + 'chars>';
  if (r.createdAt && typeof r.createdAt.toDate === 'function') {
    r.createdAt = '<Timestamp:' + r.createdAt.toDate().toISOString() + '>';
  }
  return r;
}

main().catch((err) => {
  console.error('[count] 에러:', err.message);
  process.exit(1);
});
