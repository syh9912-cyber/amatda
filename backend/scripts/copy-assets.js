/* eslint-disable */
/**
 * tsc 후 .cer / .json 같은 non-TS 자원 파일을 dist/ 로 복사.
 *
 * Firebase Functions 는 dist/ 의 컴파일된 .js 만 실행하므로, runtime 에서 fs.readFileSync
 * 하는 .cer 파일이 dist 트리에 함께 있어야 함.
 */
const fs = require('fs');
const path = require('path');

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dst, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, entry.name);
    const dp = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copied += copyDir(sp, dp);
    } else {
      fs.copyFileSync(sp, dp);
      copied++;
    }
  }
  return copied;
}

const root = path.join(__dirname, '..');
const pairs = [
  // Apple Root CA 인증서들 — apple-jws-verifier 가 runtime 에 읽음
  [
    path.join(root, 'src/services/payment/apple-root-cas'),
    path.join(root, 'dist/src/services/payment/apple-root-cas'),
  ],
];

let total = 0;
for (const [src, dst] of pairs) {
  const n = copyDir(src, dst);
  if (n > 0) console.log(`[copy-assets] ${n} files → ${path.relative(root, dst)}`);
  total += n;
}
console.log(`[copy-assets] DONE total=${total}`);
