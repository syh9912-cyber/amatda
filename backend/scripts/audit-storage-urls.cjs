/**
 * audit-storage-urls.cjs — storage.rules 닫기 전 안전성 검증
 *
 * 목적: storage.rules 의 'allow read: if true' 를 'if false' 로 닫기 전,
 *      운영 사진/PDF 가 모두 토큰 URL 형식인지 100% 확인한다.
 *
 * 검증:
 *  A) Storage 객체 — 모든 객체에 firebaseStorageDownloadTokens 메타데이터 보유?
 *     (없으면 토큰 URL 자체를 만들 수 없음 → backfill-storage-tokens.cjs --apply 재실행)
 *  B) Firestore URL  — 저장된 URL 들이 ?alt=media&token=<uuid> 형식?
 *     (token 없으면 rules 닫는 순간 403 → 사진 깨짐)
 *
 * 실행 (읽기 전용, 데이터 변경 없음):
 *   cd backend
 *   node scripts/audit-storage-urls.cjs
 *
 * 합격 기준:
 *   - A) Storage 토큰 누락 = 0
 *   - B) Firestore URL token 누락 = 0
 *   둘 다 0 이면 storage.rules 의 read 를 if false 로 닫아도 안전.
 */

const path = require('path');
const admin = require('firebase-admin');

const SA_PATH = path.resolve(__dirname, '../service-account.json');
const sa = require(SA_PATH);

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id,
  storageBucket: 'amatda-parenting.firebasestorage.app',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const STORAGE_HOST = 'firebasestorage.googleapis.com';

/** URL 문자열에서 token 파라미터 보유 여부 판정 */
function hasToken(url) {
  if (!url || typeof url !== 'string') return null; // 검사 대상 아님
  if (!url.includes(STORAGE_HOST)) return null;     // 외부 이미지(예: 카카오 프로필) 제외
  return /[?&]token=[A-Za-z0-9-]+/.test(url);
}

/** 객체의 모든 string value 를 평탄화 (URL 후보 모음) */
function collectStringFields(obj, out, fieldPath = '') {
  if (!obj) return;
  if (typeof obj === 'string') {
    out.push({ path: fieldPath, value: obj });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => collectStringFields(v, out, `${fieldPath}[${i}]`));
    return;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      collectStringFields(v, out, fieldPath ? `${fieldPath}.${k}` : k);
    }
  }
}

async function auditStorage() {
  console.log('═══ A) Storage 객체 토큰 메타데이터 검사 ═══');
  const [files] = await bucket.getFiles();
  const stats = { total: files.length, withToken: 0, withoutToken: 0, byPrefix: {} };
  const missing = [];

  for (const file of files) {
    const prefix = (file.name.split('/')[0] || '(root)');
    stats.byPrefix[prefix] = stats.byPrefix[prefix] || { total: 0, missing: 0 };
    stats.byPrefix[prefix].total += 1;

    const [metadata] = await file.getMetadata();
    const tokens = metadata.metadata && metadata.metadata.firebaseStorageDownloadTokens;
    if (tokens) {
      stats.withToken += 1;
    } else {
      stats.withoutToken += 1;
      stats.byPrefix[prefix].missing += 1;
      if (missing.length < 20) missing.push(file.name);
    }
  }

  console.log(`  총 객체: ${stats.total}`);
  console.log(`  토큰 있음: ${stats.withToken}`);
  console.log(`  토큰 누락: ${stats.withoutToken}${stats.withoutToken === 0 ? ' ✅' : ' ❌'}`);
  console.log('  경로별:');
  for (const [p, s] of Object.entries(stats.byPrefix)) {
    const flag = s.missing === 0 ? '✅' : `❌ ${s.missing}건 누락`;
    console.log(`    ${p}: ${s.total} (${flag})`);
  }
  if (missing.length > 0) {
    console.log('  누락 샘플 (최대 20):');
    missing.forEach((m) => console.log(`    - ${m}`));
    console.log('  → 해결: node scripts/backfill-storage-tokens.cjs --apply');
  }

  return stats;
}

/** 한 컬렉션의 모든 문서를 훑으며 storage URL 의 token 보유 비율 집계 */
async function auditCollection(name, opts = {}) {
  const limit = opts.limit || 5000;
  const snap = await db.collection(name).limit(limit).get();
  let total = 0;
  let withToken = 0;
  let withoutToken = 0;
  const samplesMissing = [];

  for (const doc of snap.docs) {
    const fields = [];
    collectStringFields(doc.data(), fields);
    for (const f of fields) {
      const result = hasToken(f.value);
      if (result === null) continue; // 외부 URL 또는 storage URL 아님
      total += 1;
      if (result) withToken += 1;
      else {
        withoutToken += 1;
        if (samplesMissing.length < 5) {
          samplesMissing.push({ docId: doc.id, field: f.path, urlSnippet: f.value.slice(0, 120) });
        }
      }
    }
  }

  return { name, total, withToken, withoutToken, samplesMissing, docCount: snap.docs.length };
}

async function auditFirestore() {
  console.log('\n═══ B) Firestore URL token 검사 ═══');

  // Storage URL 이 들어 있을 가능성이 높은 컬렉션 우선 검사
  const TARGETS = [
    'albumPhotos',
    'pregnancyRecords',
    'milestonePhotos',
    'posts',          // momstagram
    'postComments',
    'children',       // photoUri
    'users',          // 프로필
    'momGroupPosts',
    'momGroupComments',
    'autoDiaries',
    'observations',
    'lullabyRecordings',
  ];

  const aggregate = { total: 0, withToken: 0, withoutToken: 0 };
  const failed = [];

  for (const col of TARGETS) {
    try {
      const r = await auditCollection(col);
      aggregate.total += r.total;
      aggregate.withToken += r.withToken;
      aggregate.withoutToken += r.withoutToken;
      const flag = r.withoutToken === 0 ? '✅' : `❌ ${r.withoutToken}건 누락`;
      console.log(`  ${col} (docs ${r.docCount}, urls ${r.total}): ${flag}`);
      if (r.samplesMissing.length > 0) {
        for (const s of r.samplesMissing) {
          console.log(`    [${s.docId}].${s.field}  ${s.urlSnippet}…`);
        }
      }
    } catch (e) {
      failed.push({ col, error: e.message });
      console.log(`  ${col}: ⚠️ 검사 실패 (${e.message})`);
    }
  }

  console.log(`\n  총 storage URL: ${aggregate.total}`);
  console.log(`  토큰 있음: ${aggregate.withToken}`);
  console.log(`  토큰 누락: ${aggregate.withoutToken}${aggregate.withoutToken === 0 ? ' ✅' : ' ❌'}`);
  if (failed.length > 0) {
    console.log('\n  ⚠️ 검사 실패 컬렉션 (인덱스/권한 문제 가능):');
    failed.forEach((f) => console.log(`    - ${f.col}: ${f.error}`));
  }
  return aggregate;
}

async function main() {
  console.log(`[audit-storage-urls] project: ${sa.project_id}`);
  console.log(`[audit-storage-urls] bucket: ${bucket.name}`);
  console.log(`[audit-storage-urls] timestamp: ${new Date().toISOString()}\n`);

  const a = await auditStorage();
  const b = await auditFirestore();

  console.log('\n═══════════════════════════════════════════════');
  console.log('  최종 판정');
  console.log('═══════════════════════════════════════════════');
  const aPass = a.withoutToken === 0;
  const bPass = b.withoutToken === 0;
  console.log(`  A) Storage 토큰 100% : ${aPass ? '✅ PASS' : '❌ FAIL (' + a.withoutToken + '건 누락)'}`);
  console.log(`  B) Firestore URL 토큰 100% : ${bPass ? '✅ PASS' : '❌ FAIL (' + b.withoutToken + '건 누락)'}`);

  if (aPass && bPass) {
    console.log('\n  ✅ storage.rules 의 read 를 if false 로 닫아도 안전합니다.');
    console.log('     다음 단계: storage.rules 수정 → firebase deploy --only storage');
    process.exit(0);
  } else {
    console.log('\n  ❌ 닫으면 안 됩니다. 아래 조치 후 다시 실행하세요:');
    if (!aPass) console.log('     1) node scripts/backfill-storage-tokens.cjs --apply');
    if (!bPass) console.log('     2) Firestore URL 재작성 — 누락 컬렉션의 URL 을 토큰 형식으로 갱신');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('[audit-storage-urls] fatal:', err);
  process.exit(1);
});
