/**
 * 1회용 — quick-bottle.png 생성 (3D clay 분유병)
 *
 * 실행:
 *   OPENAI_API_KEY=sk-xxx node scripts/gen-bottle-icon.cjs
 *
 * ⚠️ 끝나면 키를 즉시 폐기하고 새 키 발급받을 것.
 */
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('OPENAI_API_KEY 필요'); process.exit(1); }

const URL = 'https://api.openai.com/v1/images/generations';
const OUT_PATH = path.join(__dirname, '..', 'frontend', 'assets', 'quick-bottle.png');

const STYLE = '3D clay-render style, soft matte clay texture, warm pastel colors, rounded smooth shapes, studio lighting, cute baby app icon, simple minimal composition, centered, no text, no watermarks, no background elements, bright clean colors without dark muddy tones';

const PROMPT = `${STYLE}. A cute mini 3D clay baby feeding bottle with a soft cream-colored body filled with white milk, a peachy-pink silicone nipple top, subtle measurement marks on the side, soft glossy highlight, infant feeding icon. Render the object floating on a completely empty transparent background with nothing behind it.`;

(async () => {
  console.log('[gen-bottle] Generating quick-bottle.png...');

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: PROMPT,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        background: 'transparent',
        output_format: 'png',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[gen-bottle] API 실패:', res.status, err);
      process.exit(1);
    }

    const json = await res.json();
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      console.error('[gen-bottle] 응답에 이미지 없음:', json);
      process.exit(1);
    }

    fs.writeFileSync(OUT_PATH, Buffer.from(b64, 'base64'));
    const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
    console.log(`[gen-bottle] ✅ ${OUT_PATH} (${sizeKb} KB)`);
  } catch (err) {
    console.error('[gen-bottle] 에러:', err.message);
    process.exit(1);
  }
})();
