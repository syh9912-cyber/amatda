/**
 * Milestone 이미지를 128x128로 리사이즈 (앱 번들용 소형 버전)
 * 실행: node scripts/resize-milestones.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '..', 'frontend', 'assets', 'milestones');
const DST = path.join(__dirname, '..', 'frontend', 'assets', 'milestones-sm');
const SIZE = 128;

async function main() {
  if (!fs.existsSync(DST)) fs.mkdirSync(DST, { recursive: true });

  const files = fs.readdirSync(SRC).filter(f => f.endsWith('.png'));
  console.log(`Resizing ${files.length} images to ${SIZE}x${SIZE}...`);

  let ok = 0, fail = 0;
  for (const file of files) {
    try {
      await sharp(path.join(SRC, file))
        .resize(SIZE, SIZE, { fit: 'cover' })
        .png({ quality: 80, compressionLevel: 9 })
        .toFile(path.join(DST, file));
      ok++;
    } catch (err) {
      console.error(`  FAIL: ${file} - ${err.message}`);
      fail++;
    }
  }

  const totalSize = fs.readdirSync(DST)
    .filter(f => f.endsWith('.png'))
    .reduce((sum, f) => sum + fs.statSync(path.join(DST, f)).size, 0);

  console.log(`\nDone! ${ok} resized, ${fail} failed`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
