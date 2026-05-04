// Convert SOS PNG assets to WebP.
// - assets/sos/*.png  (16개 step 이미지)
// - assets/sos-*.png  (4개 메인 이미지)
// 원본 dimension 유지, quality 85.
// 변환 후 원본 PNG 보존(이 스크립트에서는 삭제 X) — git rm은 별도.
//
// Usage: node scripts/convert-sos-webp.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const SOS_SUB = path.join(ASSETS, 'sos');

function fmt(bytes) {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + 'MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

async function convertOne(srcAbs) {
  const dstAbs = srcAbs.replace(/\.png$/i, '.webp');
  const beforeBytes = fs.statSync(srcAbs).size;
  const meta = await sharp(srcAbs).metadata();

  await sharp(srcAbs)
    .webp({ quality: 85, effort: 6, alphaQuality: 90 })
    .toFile(dstAbs);

  const afterBytes = fs.statSync(dstAbs).size;
  const rel = path.relative(ROOT, srcAbs);
  return {
    rel,
    before: beforeBytes,
    after: afterBytes,
    saved: beforeBytes - afterBytes,
    width: meta.width,
    height: meta.height,
    aspect: (meta.width / meta.height).toFixed(3),
  };
}

(async () => {
  const targets = [];

  // assets/sos/*.png
  for (const f of fs.readdirSync(SOS_SUB)) {
    if (f.toLowerCase().endsWith('.png')) {
      targets.push(path.join(SOS_SUB, f));
    }
  }

  // assets/sos-*.png (메인 4개)
  for (const f of fs.readdirSync(ASSETS)) {
    if (/^sos-.+\.png$/i.test(f)) {
      targets.push(path.join(ASSETS, f));
    }
  }

  console.log(`Converting ${targets.length} PNG → WebP\n`);
  console.log('file'.padEnd(40) + ' before  →  after   saved   dimension     aspect');
  console.log('-'.repeat(95));

  let totalBefore = 0;
  let totalAfter = 0;
  for (const src of targets) {
    try {
      const r = await convertOne(src);
      totalBefore += r.before;
      totalAfter += r.after;
      const pct = ((1 - r.after / r.before) * 100).toFixed(0);
      console.log(
        `${r.rel.padEnd(40)} ${fmt(r.before).padStart(7)} → ${fmt(r.after).padStart(7)}  -${pct.padStart(2)}%  ${(r.width + 'x' + r.height).padEnd(13)} ${r.aspect}`,
      );
    } catch (e) {
      console.error(`✗ ${src}: ${e.message}`);
    }
  }
  console.log('-'.repeat(95));
  console.log(`TOTAL:  ${fmt(totalBefore)} → ${fmt(totalAfter)}  (saved ${fmt(totalBefore - totalAfter)}, -${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%)`);
})();
