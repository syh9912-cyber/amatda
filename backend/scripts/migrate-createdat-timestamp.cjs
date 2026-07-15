/**
 * migrate-createdat-timestamp.cjs — users.createdAt 의 String 타입을 Timestamp 로 통일.
 *
 * 배경(2026-07-16): 과거 코드가 createdAt 을 ISO String 으로 저장한 레거시 문서가 남아
 * Timestamp/String 이 혼재. Firestore 는 값 타입별로 정렬·매칭하므로
 *   - orderBy('createdAt','desc') → String 문서가 앞서고 최신 Timestamp 가 뒤로 밀림
 *   - where('createdAt','>=',Timestamp) → String 문서를 아예 매칭 못함
 * 이 때문에 관리자 대시보드가 최신 가입자를 누락했다.
 *
 * 안전장치: 원본 문자열을 createdAtLegacyRaw 에 백업 → 문제 시 롤백 가능.
 *           String 타입인 문서만 수정(Timestamp 문서는 미접촉).
 *
 * 실행:   node scripts/migrate-createdat-timestamp.cjs          (dry-run)
 *         node scripts/migrate-createdat-timestamp.cjs --apply  (실제 쓰기)
 * 롤백:   node scripts/migrate-createdat-timestamp.cjs --rollback
 */
process.env.GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'amatda-parenting' });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const ROLLBACK = process.argv.includes('--rollback');

async function migrate() {
  const snap = await db.collection('users').get();
  const targets = [];
  snap.docs.forEach((d) => {
    const c = d.data().createdAt;
    if (typeof c !== 'string') return;
    const dt = new Date(c);
    targets.push({ ref: d.ref, id: d.id, raw: c, date: dt, valid: !Number.isNaN(dt.getTime()) });
  });

  const bad = targets.filter((t) => !t.valid);
  console.log(`대상(String createdAt): ${targets.length}건 | 파싱 실패: ${bad.length}건`);
  if (bad.length) {
    console.log('⚠️ 파싱 실패 문서는 건너뜁니다:', bad.map((b) => b.id).join(', '));
  }
  const ok = targets.filter((t) => t.valid);
  if (!ok.length) {
    console.log('변환할 문서가 없습니다. (이미 통일된 상태)');
    return;
  }

  if (!APPLY) {
    ok.forEach((t) => console.log(`  [dry-run] ${t.id}: "${t.raw}" → Timestamp(${t.date.toISOString()})`));
    console.log('\n※ DRY-RUN. 쓰기 없음. 실제 실행하려면 --apply');
    return;
  }

  const batch = db.batch();
  ok.forEach((t) => {
    batch.update(t.ref, {
      createdAt: admin.firestore.Timestamp.fromDate(t.date),
      createdAtLegacyRaw: t.raw, // 롤백용 원본 백업
    });
  });
  await batch.commit();
  console.log(`✅ ${ok.length}건 변환 완료 (원본은 createdAtLegacyRaw 에 백업)`);
}

async function rollback() {
  const snap = await db.collection('users').get();
  const targets = snap.docs.filter((d) => typeof d.data().createdAtLegacyRaw === 'string');
  console.log(`롤백 대상(createdAtLegacyRaw 보유): ${targets.length}건`);
  if (!targets.length) return;
  if (!APPLY) {
    console.log('※ DRY-RUN. 실제 롤백하려면 --rollback --apply');
    return;
  }
  const batch = db.batch();
  targets.forEach((d) => {
    batch.update(d.ref, {
      createdAt: d.data().createdAtLegacyRaw,
      createdAtLegacyRaw: admin.firestore.FieldValue.delete(),
    });
  });
  await batch.commit();
  console.log(`✅ ${targets.length}건 롤백 완료`);
}

async function verify() {
  const snap = await db.collection('users').get();
  let ts = 0, str = 0, missing = 0;
  let newest = null;
  snap.docs.forEach((d) => {
    const c = d.data().createdAt;
    if (c == null) { missing++; return; }
    if (typeof c.toDate === 'function') { ts++; const dt = c.toDate(); if (!newest || dt > newest) newest = dt; }
    else if (typeof c === 'string') { str++; }
  });
  const ordered = await db.collection('users').orderBy('createdAt', 'desc').limit(1000).get();
  console.log('\n=== 검증 ===');
  console.log(`총 ${snap.size}건 | Timestamp ${ts} | String ${str} | 없음 ${missing}`);
  console.log(`orderBy 조회 ${ordered.size}건 → 누락 ${snap.size - ordered.size}건 ${snap.size === ordered.size ? '✅' : '❌'}`);
  console.log(`타입 통일: ${str === 0 && missing === 0 ? '✅ 완료' : '❌ 미완'}`);
  const first = ordered.docs[0]?.data().createdAt;
  console.log(`orderBy 최신: ${first?.toDate ? first.toDate().toISOString().slice(0, 16).replace('T', ' ') : '?'}`);
  console.log(`실제 최신:   ${newest ? newest.toISOString().slice(0, 16).replace('T', ' ') : '?'}`);
}

(async () => {
  if (ROLLBACK) await rollback();
  else await migrate();
  await verify();
})().catch((e) => { console.error('실패:', e); process.exit(1); });
