/**
 * 01b-upload-backup-to-storage.cjs
 * 로컬 백업 JSON 파일들을 Firebase Storage로 업로드 (이중 안전망)
 *
 * 실행: node backend/scripts/migrate-album-photos/01b-upload-backup-to-storage.cjs
 * 효과: Firebase Storage에 쓰기. Firestore는 손대지 않음.
 *
 * 업로드 위치:
 *   gs://amatda-parenting.firebasestorage.app/firestore-backup-{YYYY-MM-DD}/
 *     ├── pregnancyRecords.json
 *     ├── milestonePhotos.json
 *     └── _meta.json
 *
 * 복원 (필요시): Firebase Console > Storage에서 파일 다운로드 후
 *               admin SDK로 doc-by-doc 재삽입
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

const STORAGE_BUCKET = 'amatda-parenting.firebasestorage.app';
const bucket = admin.storage().bucket(STORAGE_BUCKET);

const today = new Date().toISOString().slice(0, 10);
const LOCAL_BACKUP_DIR = path.resolve(__dirname, `backup-${today}`);
const REMOTE_PREFIX = `firestore-backup-${today}`;

async function main() {
  console.log(`[upload] project: ${sa.project_id}`);
  console.log(`[upload] storage bucket: gs://${STORAGE_BUCKET}/`);
  console.log(`[upload] remote prefix: ${REMOTE_PREFIX}/`);
  console.log(`[upload] local source: ${LOCAL_BACKUP_DIR}\n`);

  if (!fs.existsSync(LOCAL_BACKUP_DIR)) {
    console.error(`[upload] ❌ 로컬 백업 폴더 없음. 먼저 01-backup.cjs를 실행하세요.`);
    process.exit(1);
  }

  const files = fs.readdirSync(LOCAL_BACKUP_DIR).filter((f) => f.endsWith('.json'));
  console.log(`[upload] 업로드 대상: ${files.length}개 파일`);

  for (const file of files) {
    const localPath = path.join(LOCAL_BACKUP_DIR, file);
    const remotePath = `${REMOTE_PREFIX}/${file}`;
    const stats = fs.statSync(localPath);

    console.log(`[upload] ${file} (${(stats.size / 1024).toFixed(1)} KB) → gs://${STORAGE_BUCKET}/${remotePath}`);

    await bucket.upload(localPath, {
      destination: remotePath,
      metadata: {
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
        metadata: {
          backupType: 'firestore-pre-migration',
          sourceCollections: 'pregnancyRecords,milestonePhotos',
          migrationTarget: 'albumPhotos',
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`  ✅ 업로드 완료`);
  }

  // 업로드된 파일 목록 확인
  console.log('\n[upload] 업로드 결과 검증 (gs://${STORAGE_BUCKET}/${REMOTE_PREFIX}/):');
  const [remoteFiles] = await bucket.getFiles({ prefix: `${REMOTE_PREFIX}/` });
  for (const f of remoteFiles) {
    const [metadata] = await f.getMetadata();
    console.log(`  ${f.name} (${(parseInt(metadata.size) / 1024).toFixed(1)} KB, ${metadata.timeCreated})`);
  }

  console.log(`\n[upload] ✅ 이중 백업 완료.`);
  console.log(`로컬:  ${LOCAL_BACKUP_DIR}`);
  console.log(`원격:  gs://${STORAGE_BUCKET}/${REMOTE_PREFIX}/`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[upload] 에러:', err);
  process.exit(1);
});
