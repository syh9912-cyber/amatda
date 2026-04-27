// Optimize PNG assets in-place using sharp.
// - Resize to sensible max dimensions based on filename category
// - Re-encode PNG with max compression + palette quantization when alpha-safe
// Usage: node scripts/optimize-assets.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Max dimension caps per category (long edge in pixels).
// These are generous — icons display at 40~80px, mascots at 320px,
// so 2x-3x headroom for high-DPI displays.
function maxDimFor(name) {
  // OS-required: keep native size
  if (name === 'icon' || name === 'adaptive-icon') return 1024;
  if (name === 'splash-icon' || name === 'favicon') return 512;

  // Small icons (tab-*, icon-*, cat-*, mood-*, quick-*, academy-*, weather-*, trait-*-small)
  if (/^(tab-|icon-|cat-|mood-|quick-|academy-|weather-|pay-|badge-)/.test(name)) return 192;
  if (/-small$/.test(name)) return 160;

  // Avatars (120px usage)
  if (/^(avatar-|coach-avatar)/.test(name)) return 240;

  // Mascots / trait characters (320-400px usage)
  if (/^(mascot-|trait-|cat-)/.test(name)) return 640;

  // Feature cards / onboarding / headers (320-750px usage)
  if (/^(feature-|onboarding-|report-header|baby-tracker-bg|store-banner|premium-)/.test(name)) return 1024;

  // Empty states (320px usage)
  if (/^empty-/.test(name)) return 512;

  // Support illustrations
  if (/^support-/.test(name)) return 512;

  // Album / misc
  if (name === 'album-cover' || name === 'analyzing') return 800;

  // Default cap
  return 512;
}

async function optimize(file) {
  const full = path.join(ASSETS_DIR, file);
  const name = path.basename(file, path.extname(file));
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.png') return null;

  const beforeBytes = fs.statSync(full).size;
  const maxDim = maxDimFor(name);

  const img = sharp(full, { failOn: 'none' });
  const meta = await img.metadata();
  const longEdge = Math.max(meta.width || 0, meta.height || 0);

  let pipeline = img;
  if (longEdge > maxDim) {
    pipeline = pipeline.resize({
      width: meta.width > meta.height ? maxDim : undefined,
      height: meta.height >= meta.width ? maxDim : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const buf = await pipeline
    .png({
      compressionLevel: 9,
      adaptiveFilter: true,
      palette: true, // quantize to 256 colors (huge savings, alpha preserved)
      quality: 80,
      effort: 10,
    })
    .toBuffer();

  // Only overwrite if new file is actually smaller
  if (buf.length < beforeBytes) {
    fs.writeFileSync(full, buf);
    return {
      file,
      before: beforeBytes,
      after: buf.length,
      saved: beforeBytes - buf.length,
      dim: `${meta.width}x${meta.height}→cap${maxDim}`,
    };
  }
  return { file, before: beforeBytes, after: beforeBytes, saved: 0, dim: 'skipped (no gain)' };
}

function fmt(bytes) {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + 'MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

(async () => {
  const files = fs.readdirSync(ASSETS_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  console.log(`Optimizing ${files.length} PNG files...\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  const results = [];

  for (const f of files) {
    try {
      const r = await optimize(f);
      if (!r) continue;
      totalBefore += r.before;
      totalAfter += r.after;
      results.push(r);
      const pct = r.before > 0 ? ((1 - r.after / r.before) * 100).toFixed(0) : 0;
      console.log(`${r.saved > 0 ? '✓' : '·'} ${f.padEnd(32)} ${fmt(r.before).padStart(8)} → ${fmt(r.after).padStart(8)}  (-${pct}%)  ${r.dim}`);
    } catch (err) {
      console.error(`✗ ${f}: ${err.message}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total before: ${fmt(totalBefore)}`);
  console.log(`Total after : ${fmt(totalAfter)}`);
  console.log(`Saved       : ${fmt(totalBefore - totalAfter)} (${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%)`);
})();
