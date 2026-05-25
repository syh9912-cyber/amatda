/**
 * 자장가 / 태교음악 전용 아이콘 생성
 * 스타일: 3D 클레이 + 파스텔톤 + 원형
 * sound-*.png  /  p-*.png  만 생성 (다른 아이콘 건드리지 않음)
 */
const sharp = require('sharp');
const path = require('path');

const outDir = path.join(__dirname, '..', 'assets');
const SIZE = 192;
const HALF = SIZE / 2;
const R = HALF - 8; // 원 반지름 (패딩 포함)

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function darken(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * 3D 클레이 스타일 SVG 생성
 * - 원형 베이스 (파스텔 radial gradient → 3D 입체감)
 * - 상단 좌측 specular highlight (점토 광택)
 * - 하단 soft drop shadow (부유감)
 */
function clayIconSvg(base, emoji) {
  const light  = lighten(base, 60);
  const mid    = lighten(base, 20);
  const dark   = darken(base, 35);
  const shadow = darken(base, 50);

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 3D 입체 gradient: 중심 밝음 → 가장자리 어두움 -->
    <radialGradient id="clay" cx="0.38" cy="0.30" r="0.76">
      <stop offset="0%"   stop-color="${light}"/>
      <stop offset="42%"  stop-color="${mid}"/>
      <stop offset="80%"  stop-color="${base}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </radialGradient>
    <!-- 클레이 광택: 상단 좌측 하이라이트 -->
    <radialGradient id="shine" cx="0.30" cy="0.24" r="0.42">
      <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.72"/>
      <stop offset="45%"  stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <!-- 하단 ambient 음영: 더 입체적으로 -->
    <radialGradient id="ambient" cx="0.50" cy="0.85" r="0.55">
      <stop offset="0%"   stop-color="${dark}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${dark}" stop-opacity="0"/>
    </radialGradient>
    <!-- 드롭 섀도 -->
    <filter id="shadow" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="10"
        flood-color="${shadow}" flood-opacity="0.22"/>
    </filter>
  </defs>
  <!-- 베이스 원 (그림자 포함) -->
  <circle cx="${HALF}" cy="${HALF}" r="${R}" fill="url(#clay)" filter="url(#shadow)"/>
  <!-- 하단 ambient 음영 오버레이 -->
  <circle cx="${HALF}" cy="${HALF}" r="${R}" fill="url(#ambient)"/>
  <!-- 광택 오버레이 -->
  <circle cx="${HALF}" cy="${HALF}" r="${R}" fill="url(#shine)"/>
  <!-- 이모티콘 (약간 살짝 그림자로 팝업 효과) -->
  <text x="${HALF}" y="${HALF + 7}"
    font-size="92"
    text-anchor="middle"
    dominant-baseline="central"
    style="filter:drop-shadow(0px 3px 4px rgba(0,0,0,0.18))">${emoji}</text>
</svg>`;
}

const SOUND_ICONS = [
  // ─── 자장가 화면 ─────────────────────────────────────────────────
  // 백색소음
  { name: 'sound-womb',      base: '#FFCDD2', emoji: '👶' },
  { name: 'sound-vacuum',    base: '#CFD8DC', emoji: '🌀' },
  { name: 'sound-hairdryer', base: '#FFE0B2', emoji: '💨' },
  { name: 'sound-fan',       base: '#BBDEFB', emoji: '🌬' },
  // 자연의 소리
  { name: 'sound-rain',      base: '#B3E5FC', emoji: '🌧' },
  { name: 'sound-wave',      base: '#B2EBF2', emoji: '🌊' },
  { name: 'sound-forest',    base: '#C8E6C9', emoji: '🌲' },
  { name: 'sound-stream',    base: '#B3E5FC', emoji: '💧' },
  // 자장가
  { name: 'sound-twinkle',   base: '#FFF9C4', emoji: '⭐' },
  { name: 'sound-brahms',    base: '#E1BEE7', emoji: '🎵' },
  { name: 'sound-mozart',    base: '#D1C4E9', emoji: '🎶' },
  { name: 'sound-orgel',     base: '#F8BBD0', emoji: '🎼' },

  // ─── 태교음악 화면 ───────────────────────────────────────────────
  // 클래식
  { name: 'p-mozart',        base: '#D1C4E9', emoji: '🎼' },
  { name: 'p-vivaldi',       base: '#F8BBD0', emoji: '🌸' },
  { name: 'p-bach',          base: '#C5CAE9', emoji: '🎻' },
  { name: 'p-pachelbel',     base: '#B3E5FC', emoji: '🎵' },
  { name: 'p-debussy',       base: '#C8E6C9', emoji: '🌙' },
  // 자궁·심장박동
  { name: 'p-womb-heart',    base: '#F8BBD0', emoji: '💗' },
  { name: 'p-mom-heart',     base: '#FFCDD2', emoji: '❤️' },
  // 자연
  { name: 'p-ocean',         base: '#B2EBF2', emoji: '🌊' },
  { name: 'p-rain',          base: '#BBDEFB', emoji: '🌧' },
  { name: 'p-forest',        base: '#C8E6C9', emoji: '🌳' },
  // 명상·힐링
  { name: 'p-meditation',    base: '#D1C4E9', emoji: '🧘' },
  { name: 'p-singing-bowl',  base: '#FFF9C4', emoji: '🔔' },
];

async function generate() {
  console.log(`Generating ${SOUND_ICONS.length} 3D clay icons...`);
  for (const icon of SOUND_ICONS) {
    const svg = clayIconSvg(icon.base, icon.emoji);
    await sharp(Buffer.from(svg)).png().toFile(
      path.join(outDir, `${icon.name}.png`)
    );
    console.log(`  ✓ ${icon.name}.png`);
  }
  console.log(`\nDone! ${SOUND_ICONS.length} icons generated.`);
}

generate().catch(console.error);
