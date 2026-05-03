/**
 * 임신앨범 + 진통체크용 일러스트 12개 (gpt-image-1, 3D clay, 투명 배경)
 *
 * 진통체크:
 *  - contraction-clock.png  알람시계 + 분홍 하트 (시간 측정)
 *
 * 임신 마일스톤 (8) — 기존 quick-pill / quick-baby / quick-blood / icon-heart / icon-camera 재사용 외 신규:
 *  - preg-test.png          임신 테스트 (분홍 두줄)
 *  - preg-stethoscope.png   청진기 (산부인과)
 *  - preg-ultrasound.png    초음파 모니터
 *  - preg-leaf.png          잎 (안정기)
 *  - preg-ribbon.png        리본 (성별 확인)
 *  - preg-foot.png          작은 발 (태동)
 *  - preg-bag.png           출산 가방
 *
 * 임신 증상 무드 (4):
 *  - preg-mood-good.png     컨디션 좋음 (스마일)
 *  - preg-mood-tired.png    피로
 *  - preg-mood-nausea.png   입덧
 *  - preg-mood-pain.png     통증
 *
 * 실행:  OPENAI_API_KEY=sk-xxx node scripts/regen-pregnancy-icons.cjs
 */
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('OPENAI_API_KEY 필요'); process.exit(1); }

const URL = 'https://api.openai.com/v1/images/generations';
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'assets');

const STYLE = '3D clay-render style, soft matte clay texture, warm pastel colors, rounded smooth shapes, studio lighting, cute baby app icon, simple minimal composition, centered, no text, no watermarks, no background elements, bright clean colors without dark muddy tones';

const ICONS = [
  // 진통체크
  { file: 'contraction-clock.png', prompt: 'A cute mini 3D clay round alarm clock in soft cream-pink color with two bells on top, with a small soft pink glossy heart attached on the front face, contraction timer icon for pregnant moms, friendly and reassuring' },

  // 임신 마일스톤
  { file: 'preg-test.png',         prompt: 'A cute mini 3D clay pregnancy test stick lying horizontally, white body with two pink stripes in the result window, soft glossy highlight, positive pregnancy test icon' },
  { file: 'preg-stethoscope.png',  prompt: 'A cute mini 3D clay stethoscope curled into a heart-like shape, soft baby-blue tubing and silver chest piece, obstetrics clinic visit icon' },
  { file: 'preg-ultrasound.png',   prompt: 'A cute mini 3D clay rounded monitor screen showing a soft pastel pink baby silhouette in fetal position, ultrasound icon, friendly' },
  { file: 'preg-leaf.png',         prompt: 'A cute mini 3D clay single fresh green leaf with soft glossy highlight, gentle pastel green, stable trimester icon' },
  { file: 'preg-ribbon.png',       prompt: 'A cute mini 3D clay tied bow ribbon, half soft pink and half soft baby blue, glossy satin texture, gender reveal icon' },
  { file: 'preg-foot.png',         prompt: 'A cute mini 3D clay tiny baby foot print, soft peach-pink color, glossy highlight, kick movement icon' },
  { file: 'preg-bag.png',          prompt: 'A cute mini 3D clay small rounded duffel travel bag in soft cream-pink with a tiny heart tag, hospital go-bag icon' },

  // 임신 증상 (무드 카테고리)
  { file: 'preg-mood-good.png',    prompt: 'A cute mini 3D clay round happy face, big smile, rosy cheeks, warm yellow color, feeling great pregnancy icon' },
  { file: 'preg-mood-tired.png',   prompt: 'A cute mini 3D clay round sleepy face, half-closed eyes, tiny Zzz floating, soft lavender color, fatigue icon' },
  { file: 'preg-mood-nausea.png',  prompt: 'A cute mini 3D clay round queasy face with greenish pale tint, slightly puffed cheeks, tiny squiggle near mouth, morning sickness icon' },
  { file: 'preg-mood-pain.png',    prompt: 'A cute mini 3D clay round wincing face, knit eyebrows, tiny red sparkle on the side of head, soft pink color, body pain icon' },
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
  console.log('Pregnancy Icon Regenerator (gpt-image-1, 3D clay)');
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
