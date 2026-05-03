/**
 * Quick 메뉴 7개 아이콘 재생성 (gpt-image-1, 3D clay style, transparent BG)
 *
 * 대상:
 *  - quick-thermometer.png  (열나)
 *  - quick-sprout.png       (성장 통계)
 *  - quick-syringe.png      (접종달력)
 *  - quick-baby.png         (주수별 발달)
 *  - quick-blood.png        (임당 관리)
 *  - quick-water.png        (물 마시기)
 *  - quick-pill.png         (영양제)
 *
 * 실행:
 *   OPENAI_API_KEY=sk-xxx node scripts/regen-quick-icons.cjs
 */
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('OPENAI_API_KEY 필요'); process.exit(1); }

const URL = 'https://api.openai.com/v1/images/generations';
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'assets');

const STYLE = '3D clay-render style, soft matte clay texture, warm pastel colors, rounded smooth shapes, studio lighting, cute baby app icon, simple minimal composition, centered, no text, no watermarks, no background elements, bright clean colors without dark muddy tones';

const ICONS = [
  { file: 'quick-thermometer.png', prompt: 'A cute mini 3D clay digital thermometer with a red-pink rounded bulb at the bottom, white slim body with subtle scale marks, soft glossy highlight, pediatric fever icon' },
  { file: 'quick-sprout.png', prompt: 'A cute mini 3D clay green sprout with two fresh leaves growing from a small mound of soft brown soil, fresh and lively, growth icon' },
  { file: 'quick-syringe.png', prompt: 'A cute mini 3D clay vaccination syringe with a soft blue liquid inside, light gray needle, slight diagonal angle, vaccination icon' },
  { file: 'quick-baby.png', prompt: 'A cute mini 3D clay baby face with closed smiling eyes, rosy cheeks, peachy skin, tiny tuft of soft brown hair, infant development icon' },
  { file: 'quick-blood.png', prompt: 'A cute mini 3D clay glossy red blood drop, smooth pointed top, rounded bottom, soft highlight on upper-left, gestational diabetes management icon' },
  { file: 'quick-water.png', prompt: 'A cute mini 3D clay glossy bright blue water droplet, smooth pointed top, rounded bottom, soft highlight on upper-left, hydration icon' },
  { file: 'quick-pill.png', prompt: 'A cute mini 3D clay capsule pill, left half soft purple and right half soft orange, glossy highlight, slight diagonal angle, supplement icon' },
];

async function generate(item, idx, total) {
  const fullPrompt = `${STYLE}. ${item.prompt}. Render the object floating on a completely empty transparent background with nothing behind it.`;
  console.log(`  [${idx + 1}/${total}] ${item.file}...`);

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        background: 'transparent',
        output_format: 'png',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  FAILED ${item.file}: HTTP ${res.status}`, err.slice(0, 200));
      return false;
    }

    const json = await res.json();
    const data = json.data?.[0];
    if (!data) { console.error(`  No data for ${item.file}`); return false; }

    let buf;
    if (data.b64_json) {
      buf = Buffer.from(data.b64_json, 'base64');
    } else if (data.url) {
      const img = await fetch(data.url);
      buf = Buffer.from(await img.arrayBuffer());
    } else { console.error(`  Unknown format for ${item.file}`); return false; }

    fs.writeFileSync(path.join(OUT_DIR, item.file), buf);
    console.log(`  Saved ${item.file} (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    console.error(`  ERROR ${item.file}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Quick Icon Regenerator (gpt-image-1, 3D clay)');
  console.log(`Total: ${ICONS.length} icons`);
  console.log('='.repeat(60));

  let ok = 0, fail = 0;
  for (let i = 0; i < ICONS.length; i++) {
    const success = await generate(ICONS[i], i, ICONS.length);
    if (success) ok++; else fail++;
    if (i < ICONS.length - 1) {
      await new Promise(r => setTimeout(r, 13000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`DONE! ${ok} success, ${fail} failed, ${ICONS.length} total`);
  console.log('='.repeat(60));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
