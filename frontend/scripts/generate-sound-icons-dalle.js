/**
 * DALL-E 3 API로 자장가/태교음악 아이콘 생성
 * 스타일: 3D 클레이 파스텔톤 (기존 마스코트 동일 컨셉)
 *
 * 사용법:
 *   OPENAI_API_KEY=sk-xxxx node scripts/generate-sound-icons-dalle.js
 *
 * 또는 .env.local 에 OPENAI_API_KEY 설정 후 실행
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경변수를 설정해주세요.');
  console.error('   예: OPENAI_API_KEY=sk-xxxx node scripts/generate-sound-icons-dalle.js');
  process.exit(1);
}

const outDir = path.join(__dirname, '..', 'assets');

// 기존 마스코트와 동일한 3D 클레이 스타일 베이스 프롬프트
const BASE_STYLE = [
  '3D clay toy style illustration',
  'matte clay texture with soft pastel colors',
  'cute chibi proportions',
  'soft studio lighting from above',
  'white or very light cream background',
  'professional 3D render',
  'no text no letters',
  'single centered object',
  'rounded soft shapes',
  'kawaii aesthetic',
].join(', ');

const ICONS = [
  // ─── 자장가 - 백색소음 ─────────────────────────────────
  {
    name: 'sound-womb',
    subject: 'a tiny cute baby sleeping peacefully inside a soft pink heart-shaped womb, pastel pink tones',
  },
  {
    name: 'sound-vacuum',
    subject: 'a cute mini vacuum cleaner with a happy face, pastel gray and blue tones',
  },
  {
    name: 'sound-hairdryer',
    subject: 'a cute mini hair dryer blowing gentle wind swirls, pastel peach and cream tones',
  },
  {
    name: 'sound-fan',
    subject: 'a cute small electric fan with spinning blades and a smiling face, pastel sky blue tones',
  },
  // ─── 자장가 - 자연의 소리 ──────────────────────────────
  {
    name: 'sound-rain',
    subject: 'cute soft rain drops falling with a tiny smiling cloud, pastel light blue tones',
  },
  {
    name: 'sound-wave',
    subject: 'a cute gentle ocean wave with a happy expression, pastel aqua and teal tones',
  },
  {
    name: 'sound-forest',
    subject: 'a cute chubby green tree with a smiling face and little birds, pastel mint green tones',
  },
  {
    name: 'sound-stream',
    subject: 'cute sparkling water drops flowing gently like a tiny stream, pastel sky blue tones',
  },
  // ─── 자장가 - 자장가 멜로디 ───────────────────────────
  {
    name: 'sound-twinkle',
    subject: 'a cute glowing star with a smiling face and sparkles around it, pastel yellow and gold tones',
  },
  {
    name: 'sound-brahms',
    subject: 'cute soft musical notes floating with a tiny lullaby moon and stars, pastel lavender tones',
  },
  {
    name: 'sound-mozart',
    subject: 'a cute mini grand piano with musical notes floating around, pastel purple and lilac tones',
  },
  {
    name: 'sound-orgel',
    subject: 'a cute small music box with a spinning ballerina and musical notes, pastel pink and rose tones',
  },
  // ─── 태교음악 - 클래식 ────────────────────────────────
  {
    name: 'p-mozart',
    subject: 'a cute mini classical piano with golden musical notes, pastel purple and cream tones',
  },
  {
    name: 'p-vivaldi',
    subject: 'cute soft cherry blossoms falling with a tiny violin, pastel pink and sakura tones',
  },
  {
    name: 'p-bach',
    subject: 'a cute small violin with a bow and musical notes, pastel periwinkle blue tones',
  },
  {
    name: 'p-pachelbel',
    subject: 'cute tiny harp with golden strings and soft musical notes, pastel sky blue tones',
  },
  {
    name: 'p-debussy',
    subject: 'a cute glowing crescent moon with soft clouds and gentle moonbeams, pastel mint and cream tones',
  },
  // ─── 태교음악 - 자궁·심장박동 ─────────────────────────
  {
    name: 'p-womb-heart',
    subject: 'a cute tiny baby curled up peacefully inside a glowing soft heart, pastel rose pink tones',
  },
  {
    name: 'p-mom-heart',
    subject: 'a cute glowing red heart with soft pulse lines and warmth glow, pastel red and cream tones',
  },
  // ─── 태교음악 - 자연 ──────────────────────────────────
  {
    name: 'p-ocean',
    subject: 'a cute calm ocean wave with tiny bubbles and a peaceful expression, pastel aqua tones',
  },
  {
    name: 'p-rain',
    subject: 'a cute soft rain shower with gentle drops and a smiling cloud, pastel periwinkle blue tones',
  },
  {
    name: 'p-forest',
    subject: 'cute lush green trees with morning light rays and little birds, pastel green tones',
  },
  // ─── 태교음악 - 명상·힐링 ─────────────────────────────
  {
    name: 'p-meditation',
    subject: 'a cute small figure sitting in meditation pose with glowing aura and lotus flower, pastel purple tones',
  },
  {
    name: 'p-singing-bowl',
    subject: 'a cute golden singing bowl with soft vibration rings and sparkles around it, pastel warm gold tones',
  },
];

function downloadImage(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

function generateImage(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
          } else {
            resolve(json.data[0].url);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// sharp로 1024x1024 → 192x192 리사이즈
async function resizeImage(inputPath, outputPath) {
  const sharp = require('sharp');
  await sharp(inputPath)
    .resize(192, 192)
    .png()
    .toFile(outputPath);
}

async function generate() {
  // 시작 아이콘 인덱스 (중간부터 재시작할 때 사용)
  const startFrom = parseInt(process.env.START_FROM || '0', 10);

  console.log(`\n🎨 DALL-E 3로 3D 클레이 아이콘 생성 시작`);
  console.log(`   총 ${ICONS.length}개, ${startFrom}번부터 시작\n`);

  for (let i = startFrom; i < ICONS.length; i++) {
    const icon = ICONS[i];
    const prompt = `${icon.subject}, ${BASE_STYLE}`;
    const tmpPath = path.join(outDir, `_tmp_${icon.name}.png`);
    const finalPath = path.join(outDir, `${icon.name}.png`);

    console.log(`[${i + 1}/${ICONS.length}] ${icon.name}`);

    try {
      // 1. DALL-E API 호출
      const url = await generateImage(prompt);

      // 2. 이미지 다운로드
      await downloadImage(url, tmpPath);

      // 3. 192×192 리사이즈
      await resizeImage(tmpPath, finalPath);
      fs.unlinkSync(tmpPath);

      console.log(`  ✓ 저장됨 → ${icon.name}.png`);

      // API rate limit 대비 딜레이 (1초)
      if (i < ICONS.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    } catch (err) {
      console.error(`  ✗ 실패: ${err.message}`);
      console.error(`  → START_FROM=${i} 으로 재시작 가능`);
      process.exit(1);
    }
  }

  console.log(`\n✅ 완료! ${ICONS.length}개 아이콘 생성됨`);
}

generate();
