#!/usr/bin/env node
/**
 * SOS 이미지 일괄 생성 스크립트 (1회용).
 *
 * 사용법:
 *   1) scripts/.env 에 OPENAI_API_KEY=sk-... 한 줄 적기
 *   2) node scripts/gen-sos-images.js test          # 1장 테스트
 *   3) node scripts/gen-sos-images.js all           # 32장 전체 생성
 *   4) node scripts/gen-sos-images.js heimlich      # 카테고리만
 *
 * 사용 끝나면 scripts/.env 삭제 + OpenAI에서 키 폐기.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

/* ── env 로드 ─────────────────────────────────────────────────── */
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('[ERROR] scripts/.env 파일이 없습니다.');
    console.error('        scripts/.env.example 참고해서 키를 넣어주세요.');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-replace-me') {
    console.error('[ERROR] OPENAI_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }
}

/* ── 공통 스타일 prefix (모든 32장에 적용) ─────────────────────── */
const STYLE_PREFIX = `Polished 3D cartoon illustration style, like Pixar / Disney 3D animation key art. Clean smooth surfaces (NOT clay or playdough texture), proper soft three-point lighting with clear key light and gentle rim light, professional cinematic 3D rendering. Slightly stylized cute proportions but realistic shading and form. Warm cream background (#FAF6F0) with subtle gradient and very soft ambient occlusion under the subject. Friendly Korean parenting first-aid guide aesthetic. NO text labels, NO watermarks, NO UI elements, NO captions, NO frames, NO speech bubbles. Consistent character design: rounded but well-proportioned friendly face with simple expressive eyes (no irises detail, just soft glossy dots), gentle smile, neutral warm skin tones with soft subsurface scattering, soft warm color palette with peach (#FF8C5A) and coral as accents. Clean composition with one clear focal subject, centered, square 1:1 framing. Soft contact shadow under subject. Calm but urgent educational tone. Premium 3D cartoon look (Pixar / Coco / Inside Out vibe — NOT claymation, NOT plasticine).`;

/* ── 32장 prompt 정의 ────────────────────────────────────────── */
const SCENES = [
  // ═════ 기도막힘 — 12개월 미만 ═════
  { file: 'heimlich-infant-1', prompt: 'A parent sitting on a chair with a small infant baby (under 12 months) placed face-down across one forearm, the parent\'s palm supporting the baby\'s jaw and chin firmly, infant\'s head positioned lower than the chest. Side profile view showing the support position before back blows. No motion lines yet. Clear and calm.' },
  { file: 'heimlich-infant-2', prompt: 'A parent\'s open palm firmly patting between an infant\'s shoulder blades on the upper back. The infant is held face-down across the parent\'s forearm, head lower than chest. Show 5 small motion lines indicating rhythmic back blows. Side view.' },
  { file: 'heimlich-infant-3', prompt: 'A parent has flipped the infant face-up, supporting the baby on the forearm with head still slightly lower than the chest. Two fingers (index + middle) pressed on the center of the infant\'s chest, just below the nipple line. Showing two-finger chest compression action.' },
  { file: 'heimlich-infant-4', prompt: 'A parent kneeling beside an unconscious infant lying on a flat surface. One hand doing two-finger CPR-style chest compressions, the other hand holding a smartphone on speaker mode with "119" visible on screen. Calm urgent expression on parent.' },

  // ═════ 기도막힘 — 만 1세~사춘기 전 ═════
  { file: 'heimlich-child-1', prompt: 'A parent kneeling behind a small child (age 5-7), arms gently positioned around the child from behind. Both facing the same direction. Side profile view showing the parent matching the child\'s height. Preparation pose for Heimlich.' },
  { file: 'heimlich-child-2', prompt: 'Close-up showing a parent\'s right fist (thumb side against body) placed on a child\'s abdomen, just above the navel and below the sternum. Left hand wrapping over the fist. Child standing upright facing forward, parent behind. Clean diagram view.' },
  { file: 'heimlich-child-3', prompt: 'A parent performing inward and upward abdominal thrust (Heimlich maneuver) on a child, shown with motion arrows pointing inward and upward. A small object visibly being expelled in motion from the child\'s mouth. Side view showing the upward thrust direction.' },
  { file: 'heimlich-child-4', prompt: 'A child lying on their back on the floor unconscious. A parent kneeling beside them performing CPR chest compressions with one hand. A smartphone on speaker nearby with "119" visible. Educational urgency.' },

  // ═════ 기도막힘 — 성인/보호자 ═════
  { file: 'heimlich-adult-1', prompt: 'An adult standing behind another standing adult (the choking victim), wrapping both arms around the victim from behind. Both upright. Showing the embrace position before thrust. Side view.' },
  { file: 'heimlich-adult-2', prompt: 'Close-up of fist placement on an adult\'s abdomen — one hand making a fist with thumb side against the body, positioned just above the navel and below the sternum. Other hand covering and reinforcing the fist. Clean educational diagram.' },
  { file: 'heimlich-adult-3', prompt: 'An adult performing Heimlich abdominal thrust on another adult, showing quick inward-and-upward arrow motion. A small object being expelled from the victim\'s mouth in motion. Side view showing the upward direction.' },
  { file: 'heimlich-adult-4', prompt: 'A solo adult performing self-Heimlich by leaning forward over the back of a sturdy wooden chair, the chair\'s top rail contacting the abdomen above the navel. Showing self-rescue position when alone. Side view.' },

  // ═════ CPR — 12개월 미만 ═════
  { file: 'cpr-infant-1', prompt: 'A small infant lying on their back on a flat firm surface. Parent\'s hand under the baby\'s neck, very gently tilting the head slightly back to open the airway. Profile view showing the airway-open position.' },
  { file: 'cpr-infant-2', prompt: 'Close-up of two fingers (index + middle) compressing the center of an infant\'s chest, just below the imaginary line between the nipples. A small downward arrow indicates compression depth (about 4cm). Top-down view.' },
  { file: 'cpr-infant-3', prompt: 'Parent leaning over an infant on a flat surface, mouth gently covering both the baby\'s nose and mouth simultaneously, giving a soft rescue breath. Soft and educational, side view, not clinical.' },
  { file: 'cpr-infant-4', prompt: 'Parent doing CPR cycle on infant — one hand visually positioned for two-finger chest compressions, with cycle indicator showing "30:2" pattern. Smartphone on speaker visible nearby with 119 dialed. Educational diagram.' },

  // ═════ CPR — 만 1세~사춘기 전 ═════
  { file: 'cpr-child-1', prompt: 'A child (age 5-8) lying on their back on the floor. Parent kneeling beside them, gently lifting the chin to tilt the head back and open the airway. Showing chin-lift airway-open position. Side view.' },
  { file: 'cpr-child-2', prompt: 'Close-up showing one open palm (heel of hand) pressed on the center of a child\'s chest at the lower half of the breastbone. Compression depth indicator showing 5cm push downward. Other hand stacked on top.' },
  { file: 'cpr-child-3', prompt: 'A parent giving mouth-to-mouth rescue breath to a child on the floor, child\'s head tilted back, parent pinching the child\'s nose closed with two fingers. Side view, soft educational style.' },
  { file: 'cpr-child-4', prompt: 'Parent performing 30:2 CPR on a child — alternating chest compressions (one or two hands) and rescue breaths. AED device visible nearby being prepared. Steady focused educational scene.' },

  // ═════ CPR — 성인/보호자 ═════
  { file: 'cpr-adult-1', prompt: 'An unconscious adult lying on their back on a flat surface. A bystander tapping the victim\'s shoulder with one hand and leaning ear over the victim\'s mouth to check for breathing. Showing responsiveness check.' },
  { file: 'cpr-adult-2', prompt: 'Close-up of two hands stacked, heels of palm placed on the lower half of an adult\'s breastbone (sternum). Arms straight, elbows locked. Body weight positioning indicator showing 5-6cm compression depth. Clean diagram.' },
  { file: 'cpr-adult-3', prompt: 'A bystander performing chest compressions on an adult on the floor — body leaning forward over the victim, full upper body weight applied through stacked hands, arms straight. Side profile showing proper compression posture.' },
  { file: 'cpr-adult-4', prompt: 'AED automated defibrillator with two electrode pads attached to an adult\'s bare chest in standard placement. A bystander stepping back during shock delivery, hand raised. Educational diagram showing AED use.' },

  // ═════ 화상/낙상 ═════
  { file: 'burn_fall-1', prompt: 'A small child\'s hand or arm under a stream of cool clean running water from a faucet, an adult helper standing nearby. Calm and clear depiction of cooling burn for an extended duration. Side view, gentle.' },
  { file: 'burn_fall-2', prompt: 'A 4-panel grid of crossed-out warning illustrations: (1) ice cube with red X, (2) toothpaste tube with red X, (3) traditional ointment jar with red X, (4) hand piercing a blister with red X. Each item clearly visible with a bold red X overlay. Educational do-not chart.' },
  { file: 'burn_fall-3', prompt: 'A child who has fallen lying still on the ground after a fall. A parent kneeling beside, NOT lifting the child but gently placing a hand near the head to assess without movement. Showing "do not move yet" stabilizing pose. Side view.' },
  { file: 'burn_fall-4', prompt: 'Parent observing a child after a head bump — sitting close, watching the child\'s eyes and behavior carefully. A clock or 24-hour visual indicator showing extended observation period. Warning signs (vomiting, seizure) symbolized as small icons in the background.' },

  // ═════ 이물질 삼킴 ═════
  { file: 'foreign-1', prompt: 'A close-up of an adult\'s index finger reaching toward a child\'s open mouth, with a large bold red X overlay across the action. Clear warning illustration that fingers can push the object deeper. Side angle showing the prohibited action.' },
  { file: 'foreign-2', prompt: 'An adult helping a small child blow forcefully out of one nostril while pressing the other nostril closed with a fingertip. A tissue ready in the other hand. Clear educational diagram for nasal foreign body removal.' },
  { file: 'foreign-3', prompt: 'Close-up of an adult hand holding a cotton swab and tweezers near an ear, with a large bold red X overlay across both tools. Below the X, an arrow pointing to a hospital cross symbol. Warning: do not try to extract from ear.' },
  { file: 'foreign-4', prompt: 'A small round button battery and a tiny magnet with bold red urgent warning indicator. Beside them, a child silhouette with the stomach area highlighted in urgent red. A hospital cross symbol with arrows showing "go immediately" direction. Critical warning illustration.' },
];

/* ── OpenAI 호출 ─────────────────────────────────────────────── */
/* gpt-image-1 (최신·디테일 정확도 높음). 환경변수 MODEL=dall-e-3 으로 fallback 가능. */
const MODEL = process.env.MODEL || 'gpt-image-1';
const QUALITY = process.env.QUALITY || (MODEL === 'gpt-image-1' ? 'high' : 'standard');
const TIMEOUT_MS = MODEL === 'gpt-image-1' ? 240000 : 120000;

function generateOne(scene) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: MODEL,
      prompt: `${STYLE_PREFIX}\n\nScene: ${scene.prompt}`,
      n: 1,
      size: '1024x1024',
      quality: QUALITY,
    };
    if (MODEL === 'dall-e-3') payload.response_format = 'b64_json';
    const body = JSON.stringify(payload);

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/images/generations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let chunks = '';
        res.setEncoding('utf-8');
        res.on('data', (d) => { chunks += d; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}: ${chunks.slice(0, 400)}`));
          }
          try {
            const json = JSON.parse(chunks);
            const b64 = json.data?.[0]?.b64_json;
            if (!b64) return reject(new Error('no b64_json in response'));
            resolve(Buffer.from(b64, 'base64'));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

/* ── runner ──────────────────────────────────────────────────── */
async function runOne(scene) {
  const outPath = path.join(__dirname, '..', 'frontend', 'assets', 'sos', `${scene.file}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`[skip] ${scene.file}.png already exists`);
    return;
  }
  console.log(`[generating] ${scene.file} ...`);
  const start = Date.now();
  try {
    const buf = await generateOne(scene);
    fs.writeFileSync(outPath, buf);
    console.log(`  ✓ saved (${(buf.length / 1024).toFixed(0)} KB, ${((Date.now() - start) / 1000).toFixed(1)}s)`);
  } catch (e) {
    console.error(`  ✗ failed: ${e.message}`);
    throw e;
  }
}

async function main() {
  loadEnv();
  const arg = process.argv[2] || 'test';

  let targets = [];
  if (arg === 'test') {
    targets = [SCENES[0]]; // heimlich-infant-1
  } else if (arg === 'all') {
    targets = SCENES;
  } else {
    targets = SCENES.filter((s) => s.file.startsWith(arg));
    if (targets.length === 0) {
      console.error(`unknown target: ${arg}. options: test | all | heimlich | cpr | burn_fall | foreign`);
      process.exit(1);
    }
  }

  console.log(`Generating ${targets.length} image(s) → frontend/assets/sos/`);
  console.log(`Model: ${MODEL} (quality=${QUALITY})`);
  console.log('Style: Polished 3D cartoon (Pixar-like), warm cream bg, consistent across all scenes\n');

  let okCount = 0, failCount = 0;
  for (const scene of targets) {
    try {
      await runOne(scene);
      okCount++;
    } catch {
      failCount++;
    }
    // 1초 간격 (rate limit 회피)
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nDone — ✓ ${okCount} created, ✗ ${failCount} failed`);
  console.log('\n⚠️  잊지 마세요:');
  console.log('   1) scripts/.env 파일 삭제');
  console.log('   2) OpenAI 콘솔에서 키 폐기 (https://platform.openai.com/api-keys)');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
