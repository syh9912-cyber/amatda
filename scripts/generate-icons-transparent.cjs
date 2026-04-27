/**
 * 아이콘류 투명 배경 재생성 (gpt-image-1 background: transparent)
 * 실행: OPENAI_API_KEY=sk-xxx node scripts/generate-icons-transparent.cjs
 */
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('OPENAI_API_KEY 필요'); process.exit(1); }

const URL = 'https://api.openai.com/v1/images/generations';
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'assets');

const STYLE = '3D clay-render style, soft matte clay texture, warm pastel colors, rounded smooth shapes, studio lighting, cute baby app icon, simple minimal composition, centered, no text, no watermarks, no background elements';

const ICONS = [
  // 퀵메뉴 (9)
  { file: 'quick-learning.png', prompt: 'A cute mini 3D clay notebook with pencil, simple icon' },
  { file: 'quick-report.png', prompt: 'A cute mini 3D clay bar chart with upward arrow, simple icon' },
  { file: 'quick-timeline.png', prompt: 'A cute mini 3D clay photo album with a heart, simple icon' },
  { file: 'quick-lullaby.png', prompt: 'A cute mini 3D clay music note with moon, simple icon' },
  { file: 'quick-sleep.png', prompt: 'A cute mini 3D clay crescent moon with Zzz, simple icon' },
  { file: 'quick-coparenting.png', prompt: 'Two cute mini 3D clay parent figures holding a heart, simple icon' },
  { file: 'quick-parent-level.png', prompt: 'A cute mini 3D clay sprout growing from soil, simple icon' },
  { file: 'quick-diary.png', prompt: 'A cute mini 3D clay open diary with a star, simple icon' },
  { file: 'quick-trait.png', prompt: 'A cute mini 3D clay crystal ball with sparkles, simple icon' },

  // 카테고리 (8)
  { file: 'cat-eating.png', prompt: 'A cute mini 3D clay baby bottle and spoon with bowl, warm colors icon' },
  { file: 'cat-growth.png', prompt: 'A cute mini 3D clay height ruler with upward arrow and star, green icon' },
  { file: 'cat-social.png', prompt: 'A cute mini 3D clay ABC blocks with graduation cap, blue icon' },
  { file: 'cat-sleep.png', prompt: 'A cute mini 3D clay pillow with crescent moon and stars, purple icon' },
  { file: 'cat-poop.png', prompt: 'A cute mini 3D clay diaper with sparkle, green icon' },
  { file: 'cat-crying.png', prompt: 'A cute mini 3D clay teardrop with baby face, blue icon' },
  { file: 'cat-behavior.png', prompt: 'A cute mini 3D clay baby hand reaching for toy, warm icon' },
  { file: 'cat-etc.png', prompt: 'A cute mini 3D clay toolbox with small items, neutral icon' },

  // 학원 (8)
  { file: 'academy-art.png', prompt: 'A cute mini 3D clay paint palette with brush and colors, icon' },
  { file: 'academy-coding.png', prompt: 'A cute mini 3D clay laptop with code on screen, icon' },
  { file: 'academy-dance.png', prompt: 'A cute mini 3D clay ballet shoes with music notes, icon' },
  { file: 'academy-english.png', prompt: 'A cute mini 3D clay globe with ABC letters orbiting, icon' },
  { file: 'academy-math.png', prompt: 'A cute mini 3D clay calculator with numbers, icon' },
  { file: 'academy-music.png', prompt: 'A cute mini 3D clay piano keys with floating notes, icon' },
  { file: 'academy-science.png', prompt: 'A cute mini 3D clay beaker with colorful bubbles, icon' },
  { file: 'academy-sports.png', prompt: 'A cute mini 3D clay soccer ball with sneaker, icon' },

  // 탭 (8)
  { file: 'tab-home.png', prompt: 'A minimal clean single-color house icon, simple geometric, thin line stroke, gray color, 128px' },
  { file: 'tab-home-active.png', prompt: 'A minimal solid filled house icon, simple geometric, coral orange color, 128px' },
  { file: 'tab-diary.png', prompt: 'A minimal clean single-color open book icon, simple geometric, thin line stroke, gray color, 128px' },
  { file: 'tab-diary-active.png', prompt: 'A minimal solid filled open book icon, simple geometric, coral orange color, 128px' },
  { file: 'tab-chat.png', prompt: 'A minimal clean single-color chat bubble with heart icon, simple geometric, thin line stroke, gray color, 128px' },
  { file: 'tab-chat-active.png', prompt: 'A minimal solid filled chat bubble with heart icon, simple geometric, coral orange color, 128px' },
  { file: 'tab-more.png', prompt: 'A minimal clean single-color person profile icon, simple geometric, thin line stroke, gray color, 128px' },
  { file: 'tab-more-active.png', prompt: 'A minimal solid filled person profile icon, simple geometric, coral orange color, 128px' },

  // UI 아이콘 (11)
  { file: 'icon-bell.png', prompt: 'A minimal 3D clay notification bell, soft golden, simple icon' },
  { file: 'icon-camera.png', prompt: 'A minimal 3D clay camera, soft gray, simple icon' },
  { file: 'icon-comment.png', prompt: 'A minimal 3D clay speech bubble, soft white with outline, simple icon' },
  { file: 'icon-heart.png', prompt: 'A minimal 3D clay heart, soft coral pink, simple icon' },
  { file: 'icon-lock.png', prompt: 'A minimal 3D clay padlock, soft gray silver, simple icon' },
  { file: 'icon-mic.png', prompt: 'A minimal 3D clay microphone, soft dark gray, simple icon' },
  { file: 'icon-send.png', prompt: 'A minimal 3D clay paper airplane, soft blue white, simple icon' },
  { file: 'icon-settings.png', prompt: 'A minimal 3D clay gear cog, soft gray, simple icon' },
  { file: 'icon-share.png', prompt: 'A minimal 3D clay share arrow, soft blue, simple icon' },
  { file: 'icon-redflag.png', prompt: 'A minimal 3D clay warning triangle with exclamation, soft red coral, simple icon' },
  { file: 'icon-hospital.png', prompt: 'A minimal 3D clay medical cross, soft red on white, simple icon' },

  // 성장 (4)
  { file: 'growth-cognitive.png', prompt: 'A cute mini 3D clay brain with lightbulb, glowing, simple icon' },
  { file: 'growth-language.png', prompt: 'A cute mini 3D clay speech bubble with ABC, simple icon' },
  { file: 'growth-physical.png', prompt: 'A cute mini 3D clay flexing arm with star, simple icon' },
  { file: 'growth-social.png', prompt: 'Two cute mini 3D clay faces smiling with heart between, simple icon' },

  // 날씨 (5)
  { file: 'weather-sunny.png', prompt: 'A cute 3D clay smiling sun with rays, warm golden, simple icon' },
  { file: 'weather-cloudy.png', prompt: 'A cute 3D clay fluffy cloud with gentle face, soft gray, simple icon' },
  { file: 'weather-rainy.png', prompt: 'A cute 3D clay cloud with raindrops, slightly sad, blue, simple icon' },
  { file: 'weather-snowy.png', prompt: 'A cute 3D clay cloud with snowflakes, peaceful, white blue, simple icon' },
  { file: 'weather-night.png', prompt: 'A cute 3D clay crescent moon with stars, dark blue gold, simple icon' },

  // 기분 (3)
  { file: 'mood-good.png', prompt: 'A cute 3D clay happy face circle, big smile, rosy cheeks, warm yellow, icon' },
  { file: 'mood-normal.png', prompt: 'A cute 3D clay neutral face circle, slight smile, calm green, icon' },
  { file: 'mood-bad.png', prompt: 'A cute 3D clay slightly sad face circle, gentle pout, soft blue purple, icon' },

  // 기질 small (5)
  { file: 'trait-active-small.png', prompt: 'A simple 3D clay baby face with excited expression, tiny lightning bolt, energetic, 256px icon' },
  { file: 'trait-analyst-small.png', prompt: 'A simple 3D clay baby face with curious thoughtful expression, tiny magnifying glass, 256px icon' },
  { file: 'trait-explorer-small.png', prompt: 'A simple 3D clay baby face with adventurous expression, tiny compass, 256px icon' },
  { file: 'trait-harmony-small.png', prompt: 'A simple 3D clay baby face with gentle smile, tiny heart, warm social, 256px icon' },
  { file: 'trait-sensitive-small.png', prompt: 'A simple 3D clay baby face with gentle observant expression, tiny butterfly, 256px icon' },

  // 기타 소형
  { file: 'badge-ai.png', prompt: 'A small badge with sparkle wand and AI text, modern clean, 128px icon' },
  { file: 'badge-db.png', prompt: 'A small badge with book and checkmark, trustworthy, 128px icon' },
  { file: 'premium-badge.png', prompt: 'An elegant 3D clay golden crown with sparkle diamond, premium, 256px icon' },
  { file: 'play-activity.png', prompt: 'A cute mini 3D clay toy blocks with ball, playful fun, 256px icon' },
  { file: 'play-complete.png', prompt: 'A cute mini 3D clay trophy with confetti, celebration, 256px icon' },
  { file: 'support-faq.png', prompt: 'A cute mini 3D clay question mark with lightbulb, helpful, 256px icon' },
  { file: 'support-inquiry.png', prompt: 'A cute mini 3D clay envelope with heart seal, friendly, 256px icon' },

  // 마일스톤 카테고리 아이콘 (8)
  { file: 'milestone-body.png', prompt: 'A cute mini 3D clay baby body/torso growing strong, physical development icon, 256px' },
  { file: 'milestone-talk.png', prompt: 'A cute mini 3D clay speech bubble with baby sound waves, language icon, 256px' },
  { file: 'milestone-brain.png', prompt: 'A cute mini 3D clay brain with sparkle, cognitive development icon, 256px' },
  { file: 'milestone-heart.png', prompt: 'A cute mini 3D clay heart with tiny hands holding it, social emotional icon, 256px' },
  { file: 'milestone-hand.png', prompt: 'A cute mini 3D clay baby hand reaching out, self-help skill icon, 256px' },
  { file: 'milestone-star.png', prompt: 'A cute mini 3D clay shining star with creative sparkles, creativity play icon, 256px' },
  { file: 'milestone-food.png', prompt: 'A cute mini 3D clay baby spoon with food bowl, eating nutrition icon, 256px' },
  { file: 'milestone-eye.png', prompt: 'A cute mini 3D clay eye with sparkle, sensory development icon, 256px' },
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
      console.error(`  FAILED ${item.file}: HTTP ${res.status}`, err.slice(0, 150));
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
  console.log('=' .repeat(60));
  console.log('Transparent Icon Generator (gpt-image-1)');
  console.log(`Total: ${ICONS.length} icons`);
  console.log('=' .repeat(60));

  let ok = 0, fail = 0;
  for (let i = 0; i < ICONS.length; i++) {
    const success = await generate(ICONS[i], i, ICONS.length);
    if (success) ok++; else fail++;
    if (i < ICONS.length - 1) {
      await new Promise(r => setTimeout(r, 13000));
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`DONE! ${ok} success, ${fail} failed, ${ICONS.length} total`);
  console.log('=' .repeat(60));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
