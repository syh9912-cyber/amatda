/**
 * 누락된 마일스톤만 재생성 (Gemini 2.5 Flash)
 * 실행: GEMINI_API_KEY=xxx node scripts/generate-milestones-retry.cjs
 */
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('GEMINI_API_KEY required'); process.exit(1); }

const MODEL = 'gemini-2.5-flash-image';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'assets', 'milestones');
const MASTER_STYLE = '3D clay-render style, soft matte clay texture, warm pastel colors (cream, peach, mint, soft pink), rounded smooth shapes, studio lighting with soft shadows, clean cream-white background, cute baby app icon style, very simple and minimal composition, centered, no text, 256x256 icon size';

function safeName(s) {
  return s.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
}

// Read the full MILESTONES array from the main script
const mainScript = fs.readFileSync(path.join(__dirname, 'generate-milestones-gemini.cjs'), 'utf-8');
const matches = [...mainScript.matchAll(/\{ age: '([^']+)', label: '([^']+)', emoji: '([^']*)', prompt: '([^']+)' \}/g)];

// Find missing
const existing = new Set(
  fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).map(f => f.replace('.png', ''))
);

const missing = [];
matches.forEach((m, i) => {
  const key = `${m[1]}-${safeName(m[2])}`;
  if (!existing.has(key)) {
    missing.push({ age: m[1], label: m[2], emoji: m[3], prompt: m[4], key });
  }
});

async function generate(item, idx, total) {
  const fullPrompt = `${MASTER_STYLE}. ${item.prompt}. Render as a single cute icon on clean background.`;
  const filename = `${item.key}.png`;
  console.log(`  [${idx + 1}/${total}] ${item.age} ${item.label}...`);

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.4,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  FAIL HTTP ${res.status}: ${err.slice(0, 120)}`);
      return false;
    }

    const json = await res.json();
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imgPart) {
      console.error(`  No image data for ${item.label}`);
      return false;
    }

    const buf = Buffer.from(imgPart.inlineData.data, 'base64');
    fs.writeFileSync(path.join(OUT_DIR, filename), buf);
    console.log(`  Saved ${filename} (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`Missing: ${missing.length} milestones`);
  if (missing.length === 0) { console.log('All done!'); return; }

  let ok = 0, fail = 0;
  for (let i = 0; i < missing.length; i++) {
    const success = await generate(missing[i], i, missing.length);
    if (success) ok++; else fail++;
    if (i < missing.length - 1) {
      await new Promise(r => setTimeout(r, 7000));
    }
  }

  console.log(`\nDone! ${ok} success, ${fail} failed out of ${missing.length}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
