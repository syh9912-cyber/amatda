#!/usr/bin/env node
/**
 * SOS 4-패널 원본 이미지 → 4장으로 슬라이스
 *
 * 패널 사이 흰 여백을 자동 감지해서 정확히 자른다.
 *  sos-cpr.png       → cpr-infant-1.png   ~ cpr-infant-4.png
 *  sos-heimlich.png  → heimlich-infant-1  ~ heimlich-infant-4.png
 *  sos-burn-fall.png → burn_fall-1.png    ~ burn_fall-4.png
 *  sos-foreign.png   → foreign-1.png      ~ foreign-4.png
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'frontend', 'assets');
const OUT_DIR = path.join(ASSETS, 'sos');

const SOURCES = [
  { src: 'sos-cpr.png',       prefix: 'cpr-infant' },
  { src: 'sos-heimlich.png',  prefix: 'heimlich-infant' },
  { src: 'sos-burn-fall.png', prefix: 'burn_fall' },
  { src: 'sos-foreign.png',   prefix: 'foreign' },
];

/** 행 평균 luminance — gap 감지용 */
function rowLum(buf, y, width, channels) {
  const rowStart = y * width * channels;
  let sumR = 0, sumG = 0, sumB = 0;
  for (let x = 0; x < width; x++) {
    const i = rowStart + x * channels;
    sumR += buf[i]; sumG += buf[i + 1]; sumB += buf[i + 2];
  }
  return (sumR + sumG + sumB) / (3 * width);
}

/** 매우 밝은(lum>248) 행 = 페이지 배경/gap. 좁은 gap(1-3px)도 검출. */
function findGaps(buf, width, height, channels) {
  const lums = new Float32Array(height);
  for (let y = 0; y < height; y++) lums[y] = rowLum(buf, y, width, channels);

  const gaps = [];
  let inGap = false, gapStart = 0;
  for (let y = 0; y < height; y++) {
    const isGap = lums[y] > 248;
    if (isGap && !inGap) { inGap = true; gapStart = y; }
    else if (!isGap && inGap) {
      inGap = false;
      gaps.push({ start: gapStart, end: y - 1, mid: Math.floor((gapStart + y - 1) / 2), height: y - gapStart });
    }
  }
  if (inGap) {
    gaps.push({ start: gapStart, end: height - 1, mid: Math.floor((gapStart + height - 1) / 2), height: height - gapStart });
  }
  return gaps;
}

async function slice(srcFile, prefix) {
  const inputPath = path.join(ASSETS, srcFile);
  if (!fs.existsSync(inputPath)) {
    console.error(`  ✗ source missing: ${srcFile}`);
    return 0;
  }

  // raw 픽셀 읽기 (RGBA)
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const channels = info.channels;

  const gaps = findGaps(data, W, H, channels);
  // 내부 gap만 (상하단 5%는 무시)
  const margin = Math.floor(H * 0.05);
  const internalGaps = gaps.filter((g) => g.start > margin && g.end < H - margin);

  // gap이 1픽셀이라도 패널 사이일 수 있음. panel 영역(0.15H~0.35H, 0.4H~0.6H, 0.65H~0.85H)에서 가장 가까운 gap을 선택.
  // 4 패널 균등 가정 시 boundary 예상 위치는 H/4, H/2, 3H/4
  const expectedBoundaries = [H * 0.25, H * 0.5, H * 0.75];
  const cuts = [0];
  let detected = 0;
  for (const expected of expectedBoundaries) {
    // expected 주변 ±H*0.10 안에 있는 gap 찾기
    const window = H * 0.10;
    const candidates = internalGaps.filter(
      (g) => Math.abs(g.mid - expected) <= window,
    );
    if (candidates.length > 0) {
      // 가장 가까운 gap 선택
      candidates.sort((a, b) => Math.abs(a.mid - expected) - Math.abs(b.mid - expected));
      cuts.push(candidates[0].mid);
      detected++;
    } else {
      // fallback: 예상 위치 그대로
      cuts.push(Math.floor(expected));
    }
  }
  cuts.push(H);

  if (detected < 3) {
    console.warn(`  ⚠️ ${srcFile}: only ${detected}/3 boundaries auto-detected, others equal-spaced`);
  } else {
    console.log(`  · cuts: ${cuts.map((c) => c).join(', ')}`);
  }

  let count = 0;
  for (let i = 0; i < 4; i++) {
    const top = cuts[i];
    const height = cuts[i + 1] - top;
    const outPath = path.join(OUT_DIR, `${prefix}-${i + 1}.png`);
    await sharp(inputPath)
      .extract({ left: 0, top, width: W, height })
      .png()
      .toFile(outPath);
    const size = fs.statSync(outPath).size;
    console.log(`  ✓ ${prefix}-${i + 1}.png (${W}×${height}, ${(size / 1024).toFixed(0)} KB)`);
    count++;
  }
  return count;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let total = 0;
  for (const { src, prefix } of SOURCES) {
    console.log(`\n→ ${src}`);
    const n = await slice(src, prefix);
    total += n;
  }

  console.log(`\nDone — ${total}/16 panels created in ${path.relative(process.cwd(), OUT_DIR)}/`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
