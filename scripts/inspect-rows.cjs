// Quick inspector to figure out panel boundaries
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

(async () => {
  const inp = path.join(__dirname, '..', 'frontend', 'assets', 'sos-cpr.png');
  const { data, info } = await sharp(inp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  console.log(`Image: ${W}x${H}, ${ch} channels`);

  // Sample every 20 rows
  for (let y = 0; y < H; y += 20) {
    let sumR = 0, sumG = 0, sumB = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2];
    }
    const r = Math.round(sumR / W), g = Math.round(sumG / W), b = Math.round(sumB / W);
    const lum = (r + g + b) / 3;
    const isLight = lum > 248 ? '★' : lum > 240 ? '·' : '';
    console.log(`y=${String(y).padStart(4)}: rgb(${r},${g},${b}) lum=${lum.toFixed(0)} ${isLight}`);
  }
})();
