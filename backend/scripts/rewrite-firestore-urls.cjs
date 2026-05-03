/**
 * rewrite-firestore-urls.cjs
 *
 * 목적: Firestore에 저장된 storage URL 중 token 파라미터가 없는 것을
 *      ?alt=media&token=<UUID> 형식으로 재작성한다.
 *      Storage 객체 메타데이터의 firebaseStorageDownloadTokens 값을 읽어 사용.
 *
 * 전제:
 *   - 모든 Storage 객체에 firebaseStorageDownloadTokens 메타가 있어야 함
 *     (audit-storage-urls.cjs A 단계 PASS 후 실행)
 *
 * 안전:
 *   - 기본값은 --dry (변경 없이 어떻게 바뀔지 출력)
 *   - --apply 명시 시에만 실제 Firestore update
 *
 * 동작:
 *   1) 대상 컬렉션 docs 순회
 *   2) 모든 string 필드에서 firebasestorage.googleapis.com URL 추출
 *   3) ?token= 없으면:
 *      - URL 의 object path 추출
 *      - Storage 메타에서 firebaseStorageDownloadTokens 조회
 *      - URL 뒤에 ?alt=media&token=<token> 부착 (기존 쿼리 보존)
 *   4) 수정된 필드 모아서 doc.update()
 *
 * 실행:
 *   cd backend
 *   node scripts/rewrite-firestore-urls.cjs           # dry
 *   node scripts/rewrite-firestore-urls.cjs --apply   # 적용
 */

const path = require('path');
const admin = require('firebase-admin');

const SA_PATH = path.resolve(__dirname, '../service-account.json');
const sa = require(SA_PATH);

const APPLY = process.argv.includes('--apply');

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id,
  storageBucket: 'amatda-parenting.firebasestorage.app',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const STORAGE_HOST = 'firebasestorage.googleapis.com';

// 대상 컬렉션 (audit 결과에서 누락 발견된 곳 + 보수적으로 같은 류 컬렉션 모두 포함)
const TARGET_COLLECTIONS = [
  'albumPhotos',
  'milestonePhotos',
  'pregnancyRecords',
  'posts',
  'postComments',
  'children',
  'users',
  'momGroupPosts',
  'momGroupComments',
  'autoDiaries',
  'observations',
  'lullabyRecordings',
];

/** URL 에 token 파라미터 있는지 */
function hasToken(url) {
  return /[?&]token=[A-Za-z0-9-]+/.test(url);
}

/** URL 이 우리 storage bucket 인지 */
function isOurStorageUrl(url) {
  return typeof url === 'string' && url.includes(STORAGE_HOST);
}

/** storage URL 에서 object path 추출 (decodeURIComponent) */
function extractObjectPath(url) {
  const m = url.match(/\/o\/([^?]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

const tokenCache = new Map(); // path → token (Storage 호출 캐시)

async function getTokenForPath(objectPath) {
  if (tokenCache.has(objectPath)) return tokenCache.get(objectPath);
  const file = bucket.file(objectPath);
  let token = null;
  try {
    const [meta] = await file.getMetadata();
    token = (meta.metadata && meta.metadata.firebaseStorageDownloadTokens) || null;
  } catch (e) {
    // 객체가 없거나 권한 부족 — null 캐싱해서 재호출 방지
    token = null;
  }
  tokenCache.set(objectPath, token);
  return token;
}

/** URL 끝에 ?alt=media&token=<t> 부착. 기존 쿼리 있으면 & 로 연결. */
function appendToken(url, token) {
  // 안전: 이미 token 이 있으면 그대로
  if (hasToken(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  // 기존 쿼리에 alt= 가 없으면 함께 추가
  if (!/[?&]alt=/.test(url)) {
    return `${url}${sep}alt=media&token=${token}`;
  }
  return `${url}${sep}token=${token}`;
}

/** 객체 안 모든 string 을 평탄화하여 path 와 함께 수집 */
function collectStrings(obj, out, basePath = '') {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') {
    out.push({ path: basePath, value: obj });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => collectStrings(v, out, `${basePath}[${i}]`));
    return;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const next = basePath ? `${basePath}.${k}` : k;
      collectStrings(v, out, next);
    }
  }
}

/** dot path 따라 객체 깊숙이 set (배열 인덱스 [N] 지원) */
function setByPath(target, dotPath, value) {
  const tokens = [];
  // a.b[0].c → ['a', 'b', 0, 'c']
  let buf = '';
  for (let i = 0; i < dotPath.length; i++) {
    const ch = dotPath[i];
    if (ch === '.') {
      if (buf) { tokens.push(buf); buf = ''; }
    } else if (ch === '[') {
      if (buf) { tokens.push(buf); buf = ''; }
      const end = dotPath.indexOf(']', i);
      tokens.push(parseInt(dotPath.slice(i + 1, end), 10));
      i = end;
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);

  let obj = target;
  for (let i = 0; i < tokens.length - 1; i++) {
    obj = obj[tokens[i]];
  }
  obj[tokens[tokens.length - 1]] = value;
}

async function processCollection(name) {
  console.log(`\n── ${name} ──`);
  const snap = await db.collection(name).get();
  let touched = 0;
  let urlsRewritten = 0;
  let urlsTokenMissing = 0;
  let docsFailed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const fields = [];
    collectStrings(data, fields);

    const fieldUpdates = {};
    let docChanged = false;
    let cloned = null;

    for (const f of fields) {
      if (!isOurStorageUrl(f.value)) continue;
      if (hasToken(f.value)) continue;

      const objectPath = extractObjectPath(f.value);
      if (!objectPath) continue;

      const token = await getTokenForPath(objectPath);
      if (!token) {
        urlsTokenMissing += 1;
        console.log(`  [${doc.id}] ${f.path} — Storage 메타 토큰 없음, 건너뜀`);
        continue;
      }

      const newUrl = appendToken(f.value, token);
      urlsRewritten += 1;

      // top-level 단순 필드 (a, b)면 fieldUpdates 에 직접
      if (!f.path.includes('.') && !f.path.includes('[')) {
        fieldUpdates[f.path] = newUrl;
        docChanged = true;
      } else {
        // 중첩/배열 — 전체 데이터 클론 후 set, 마지막에 한 번에 update
        if (!cloned) cloned = JSON.parse(JSON.stringify(data));
        setByPath(cloned, f.path, newUrl);
        docChanged = true;
      }
    }

    if (!docChanged) continue;
    touched += 1;

    if (APPLY) {
      try {
        if (cloned) {
          // 중첩 변경이 있으면 전체 set (merge: true 로 다른 필드 보존)
          // — 그러나 set merge:true 는 array 를 지우지 않으므로 그냥 update + 클론된 nested key 만 명시
          // 단순화: 전체 data 를 set (merge 없이) — 모든 필드 그대로 + URL 만 새 값
          await doc.ref.set(cloned);
        } else {
          await doc.ref.update(fieldUpdates);
        }
      } catch (e) {
        docsFailed += 1;
        console.log(`  [${doc.id}] update 실패: ${e.message}`);
        continue;
      }
    }

    const fieldList = cloned
      ? '(중첩 필드 변경)'
      : Object.keys(fieldUpdates).join(', ');
    console.log(`  [${doc.id}] ${APPLY ? '✓ 갱신' : 'WOULD UPDATE'}: ${fieldList}`);
  }

  console.log(`  소계 — docs touched: ${touched}, URLs rewritten: ${urlsRewritten}, missing tokens: ${urlsTokenMissing}, failed: ${docsFailed}`);
  return { touched, urlsRewritten, urlsTokenMissing, docsFailed };
}

async function main() {
  console.log(`[rewrite-firestore-urls] project: ${sa.project_id}`);
  console.log(`[rewrite-firestore-urls] mode: ${APPLY ? 'APPLY (실제 변경)' : 'DRY (변경 없음)'}`);
  console.log(`[rewrite-firestore-urls] timestamp: ${new Date().toISOString()}`);

  const total = { touched: 0, urlsRewritten: 0, urlsTokenMissing: 0, docsFailed: 0 };

  for (const col of TARGET_COLLECTIONS) {
    try {
      const r = await processCollection(col);
      total.touched += r.touched;
      total.urlsRewritten += r.urlsRewritten;
      total.urlsTokenMissing += r.urlsTokenMissing;
      total.docsFailed += r.docsFailed;
    } catch (e) {
      console.log(`  ${col}: 처리 실패 — ${e.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  ${APPLY ? '적용 완료' : 'DRY 결과'}`);
  console.log('═══════════════════════════════════════════════');
  console.log(`  변경된 문서 수: ${total.touched}`);
  console.log(`  재작성된 URL : ${total.urlsRewritten}`);
  console.log(`  Storage 토큰 누락 : ${total.urlsTokenMissing}`);
  console.log(`  실패 문서 : ${total.docsFailed}`);
  if (!APPLY) {
    console.log('\n  실제 적용하려면: node scripts/rewrite-firestore-urls.cjs --apply');
  } else {
    console.log('\n  다음 단계: node scripts/audit-storage-urls.cjs (재검증)');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('[rewrite-firestore-urls] fatal:', e);
  process.exit(1);
});
