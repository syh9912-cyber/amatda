/**
 * 01-backup.cjs — pregnancyRecords + milestonePhotos 전체 로컬 백업
 *
 * 실행: node backend/scripts/migrate-album-photos/01-backup.cjs
 * 효과: 읽기 전용. 쓰기 없음.
 * 출력: backup-{YYYY-MM-DD}/{컬렉션이름}.json
 *
 * 복원 방법 (필요시):
 *   const dump = require('./backup-2026-05-01/pregnancyRecords.json');
 *   for (const { id, data } of dump) {
 *     await db.collection('pregnancyRecords').doc(id).set(data);
 *   }
 */

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const SA_PATH = path.resolve(__dirname, '../../service-account.json');
const sa = require(SA_PATH);

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id,
});

const db = admin.firestore();

// 백업 폴더 (날짜 기반, 재실행시 덮어씀)
const today = new Date().toISOString().slice(0, 10);
const BACKUP_DIR = path.resolve(__dirname, `backup-${today}`);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Firestore Timestamp / DocumentReference 등을 JSON 직렬화 가능한 형태로 변환
 */
function serializeData(data) {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(serializeData);

  // Firestore Timestamp
  if (data._seconds !== undefined && data._nanoseconds !== undefined) {
    return {
      __type__: 'Timestamp',
      _seconds: data._seconds,
      _nanoseconds: data._nanoseconds,
    };
  }
  if (typeof data.toDate === 'function') {
    return {
      __type__: 'Timestamp',
      iso: data.toDate().toISOString(),
      _seconds: data._seconds,
      _nanoseconds: data._nanoseconds,
    };
  }

  // 일반 객체
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = serializeData(v);
  }
  return out;
}

async function backupCollection(name) {
  console.log(`[backup] dumping ${name}...`);
  const snap = await db.collection(name).get();
  const dump = snap.docs.map((d) => ({
    id: d.id,
    data: serializeData(d.data()),
  }));
  const outPath = path.join(BACKUP_DIR, `${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`[backup] ${name}: ${dump.length} docs → ${outPath}`);
  return dump.length;
}

async function main() {
  console.log(`[backup] project: ${sa.project_id}`);
  console.log(`[backup] backup dir: ${BACKUP_DIR}`);
  console.log(`[backup] timestamp: ${new Date().toISOString()}`);

  const pregCount = await backupCollection('pregnancyRecords');
  const mpCount = await backupCollection('milestonePhotos');

  // 메타데이터 기록
  const meta = {
    backupAt: new Date().toISOString(),
    projectId: sa.project_id,
    counts: {
      pregnancyRecords: pregCount,
      milestonePhotos: mpCount,
    },
    serviceAccountClient: sa.client_email,
  };
  fs.writeFileSync(
    path.join(BACKUP_DIR, '_meta.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  );

  console.log(`\n[backup] 완료. 총 ${pregCount + mpCount} docs 백업됨.`);
  console.log(`[backup] 위치: ${BACKUP_DIR}`);
  console.log(`\n다음 단계: node backend/scripts/migrate-album-photos/02-dry-run.cjs`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[backup] 에러:', err);
  process.exit(1);
});
