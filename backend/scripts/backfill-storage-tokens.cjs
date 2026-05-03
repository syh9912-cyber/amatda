/**
 * backfill-storage-tokens.cjs
 *
 * 목적: Firebase Storage의 모든 기존 파일에 firebaseStorageDownloadTokens 메타데이터를
 *      추가하여 토큰 기반 다운로드 URL이 동작하게 한다.
 *      이를 통해 storage.rules에서 anonymous public read를 제거해도
 *      기존 URL이 깨지지 않게 만든다.
 *
 * 단계:
 *  1. 버킷의 모든 객체 나열
 *  2. 각 객체에 토큰 메타데이터 있는지 확인
 *  3. 없으면 새 UUID 토큰 발급 후 메타데이터 갱신
 *  4. Firestore 안에 저장된 기존 URL은 ?alt=media 형식 그대로지만,
 *     storage.rules에서 본인(authenticated) 접근 허용 시 작동.
 *     단, 모바일 <Image source={{uri:url}}>는 인증 헤더가 없어서 깨짐 →
 *     이 스크립트는 토큰을 발급해두고, 별도 단계에서 Firestore 안 URL을
 *     ?alt=media&token=<uuid> 형식으로 갱신해야 함 (다음 스크립트).
 *
 * 실행:
 *   cd backend
 *   node scripts/backfill-storage-tokens.cjs --dry        # 카운트만
 *   node scripts/backfill-storage-tokens.cjs --apply      # 실제 적용
 *
 * 효과: --apply 시 Storage 메타데이터에 토큰 추가. 객체 데이터는 변경 없음.
 *       Firestore는 변경 없음 (분리된 단계).
 */

const path = require('path');
const admin = require('firebase-admin');
const crypto = require('crypto');

const SA_PATH = path.resolve(__dirname, '../service-account.json');
const sa = require(SA_PATH);

const APPLY = process.argv.includes('--apply');
const DRY = !APPLY;

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id,
  storageBucket: 'amatda-parenting.firebasestorage.app',
});

const bucket = admin.storage().bucket();

function uuid() {
  return crypto.randomUUID();
}

async function main() {
  console.log(`[backfill] project: ${sa.project_id}`);
  console.log(`[backfill] mode: ${APPLY ? 'APPLY (실제 변경)' : 'DRY-RUN (카운트만)'}`);
  console.log(`[backfill] bucket: ${bucket.name}`);

  const [files] = await bucket.getFiles();
  console.log(`[backfill] 총 객체 수: ${files.length}`);

  const stats = {
    total: files.length,
    alreadyHasToken: 0,
    needsToken: 0,
    updated: 0,
    failed: 0,
    byPrefix: {},
  };

  for (const file of files) {
    const name = file.name;
    const prefix = name.split('/')[0] || '(root)';
    stats.byPrefix[prefix] = (stats.byPrefix[prefix] || 0) + 1;

    const [metadata] = await file.getMetadata();
    const customMeta = metadata.metadata || {};
    const existingToken = customMeta.firebaseStorageDownloadTokens;

    if (existingToken) {
      stats.alreadyHasToken += 1;
      continue;
    }

    stats.needsToken += 1;

    if (DRY) continue;

    try {
      const newToken = uuid();
      await file.setMetadata({
        metadata: {
          ...customMeta,
          firebaseStorageDownloadTokens: newToken,
        },
      });
      stats.updated += 1;
      if (stats.updated % 50 === 0) {
        console.log(`[backfill] 진행: ${stats.updated}/${stats.needsToken}`);
      }
    } catch (err) {
      stats.failed += 1;
      console.error(`[backfill] 실패: ${name} - ${err.message}`);
    }
  }

  console.log('\n=== 결과 ===');
  console.log(`총 객체: ${stats.total}`);
  console.log(`토큰 이미 있음: ${stats.alreadyHasToken}`);
  console.log(`토큰 필요: ${stats.needsToken}`);
  if (APPLY) {
    console.log(`✅ 갱신 완료: ${stats.updated}`);
    if (stats.failed > 0) console.log(`❌ 실패: ${stats.failed}`);
  } else {
    console.log(`(dry-run) --apply 추가하면 ${stats.needsToken}개 갱신됩니다.`);
  }
  console.log(`\n경로별 분포:`);
  for (const [prefix, count] of Object.entries(stats.byPrefix)) {
    console.log(`  ${prefix}: ${count}`);
  }

  console.log('\n[backfill] 완료.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] 에러:', err.message);
  console.error(err.stack);
  process.exit(1);
});
