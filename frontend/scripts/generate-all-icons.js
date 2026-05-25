/**
 * Generate ALL app icons with upgraded visuals
 * - quick-action icons (home shortcuts)
 * - category icons (coaching categories)
 * - icon-* (UI icons)
 * - milestone-* (album milestones)
 * - badge-* (source badges)
 *
 * 192x192 PNG, rounded rect, gradient + inner glow + shadow symbol
 */
const sharp = require('sharp');
const path = require('path');

const outDir = path.join(__dirname, '..', 'assets');
const SIZE = 192;
const R = 48; // corner radius

function darker(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) + amt);
  const g = Math.max(0, ((n >> 8) & 0xff) + amt);
  const b = Math.max(0, (n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lighter(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function iconSvg(bg1, bg2, emoji, label) {
  const bg1L = lighter(bg1, 40);
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1L}"/>
      <stop offset="100%" stop-color="${bg1}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.25" r="0.7">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${bg2}" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="${R}" fill="url(#bg)"/>
  <rect width="${SIZE}" height="${SIZE}" rx="${R}" fill="url(#glow)"/>
  <text x="${SIZE / 2}" y="${label ? SIZE / 2 - 6 : SIZE / 2 + 8}" font-size="${label ? 64 : 80}" text-anchor="middle" dominant-baseline="central" filter="url(#shadow)">${emoji}</text>
  ${label ? `<text x="${SIZE / 2}" y="${SIZE - 36}" font-size="22" font-weight="bold" font-family="sans-serif" text-anchor="middle" fill="${bg2}">${label}</text>` : ''}
</svg>`;
}

const ALL_ICONS = [
  // Quick action icons (home shortcuts)
  { name: 'quick-trait', bg1: '#FFCCBC', bg2: '#E64A19', emoji: '🧒', label: '기질 요약' },
  { name: 'quick-report', bg1: '#C8E6C9', bg2: '#2E7D32', emoji: '📊', label: '성장 기록' },
  { name: 'quick-sleep', bg1: '#D1C4E9', bg2: '#5E35B1', emoji: '🌙', label: '수면 예측' },
  { name: 'quick-learning', bg1: '#B3E5FC', bg2: '#0277BD', emoji: '📝', label: '육아 기록' },
  { name: 'quick-diary', bg1: '#FFF9C4', bg2: '#F57F17', emoji: '📖', label: '일기' },
  { name: 'quick-lullaby', bg1: '#E1BEE7', bg2: '#7B1FA2', emoji: '🎵', label: '자장가' },
  { name: 'quick-timeline', bg1: '#FFECB3', bg2: '#FF8F00', emoji: '📸', label: '타임라인' },
  { name: 'quick-coparenting', bg1: '#B2EBF2', bg2: '#00838F', emoji: '👨‍👩‍👦', label: '가족육아' },
  { name: 'quick-parent-level', bg1: '#F8BBD0', bg2: '#C2185B', emoji: '🏅', label: '부모 레벨' },

  // Coaching category icons
  { name: 'cat-eating', bg1: '#FFCCBC', bg2: '#BF360C', emoji: '🍽', label: '' },
  { name: 'cat-growth', bg1: '#C8E6C9', bg2: '#1B5E20', emoji: '📈', label: '' },
  { name: 'cat-sleep', bg1: '#D1C4E9', bg2: '#4527A0', emoji: '😴', label: '' },
  { name: 'cat-crying', bg1: '#FFCDD2', bg2: '#B71C1C', emoji: '😢', label: '' },
  { name: 'cat-poop', bg1: '#D7CCC8', bg2: '#4E342E', emoji: '💩', label: '' },
  { name: 'cat-behavior', bg1: '#BBDEFB', bg2: '#1565C0', emoji: '🧠', label: '' },
  { name: 'cat-social', bg1: '#F8BBD0', bg2: '#AD1457', emoji: '👫', label: '' },
  { name: 'cat-etc', bg1: '#CFD8DC', bg2: '#37474F', emoji: '💡', label: '' },

  // UI icons
  { name: 'icon-camera', bg1: '#BBDEFB', bg2: '#1565C0', emoji: '📷', label: '' },
  { name: 'icon-send', bg1: '#C8E6C9', bg2: '#2E7D32', emoji: '📤', label: '' },
  { name: 'icon-mic', bg1: '#FFCDD2', bg2: '#C62828', emoji: '🎤', label: '' },
  { name: 'icon-hospital', bg1: '#FFCDD2', bg2: '#B71C1C', emoji: '🏥', label: '' },
  { name: 'icon-redflag', bg1: '#FFCDD2', bg2: '#D32F2F', emoji: '🚨', label: '' },
  { name: 'icon-settings', bg1: '#CFD8DC', bg2: '#455A64', emoji: '⚙️', label: '' },
  { name: 'icon-heart', bg1: '#F8BBD0', bg2: '#C2185B', emoji: '❤️', label: '' },
  { name: 'icon-bell', bg1: '#FFF9C4', bg2: '#F57F17', emoji: '🔔', label: '' },
  { name: 'icon-lock', bg1: '#D1C4E9', bg2: '#4527A0', emoji: '🔒', label: '' },
  { name: 'icon-share', bg1: '#B3E5FC', bg2: '#0277BD', emoji: '🔗', label: '' },
  { name: 'icon-comment', bg1: '#C8E6C9', bg2: '#388E3C', emoji: '💬', label: '' },

  // Milestone category icons
  { name: 'milestone-body', bg1: '#FFCCBC', bg2: '#BF360C', emoji: '🏃', label: '신체' },
  { name: 'milestone-talk', bg1: '#C8E6C9', bg2: '#1B5E20', emoji: '💬', label: '언어' },
  { name: 'milestone-brain', bg1: '#BBDEFB', bg2: '#0D47A1', emoji: '🧠', label: '인지' },
  { name: 'milestone-heart', bg1: '#F8BBD0', bg2: '#880E4F', emoji: '💕', label: '사회' },
  { name: 'milestone-hand', bg1: '#D1C4E9', bg2: '#4527A0', emoji: '✋', label: '자조' },
  { name: 'milestone-star', bg1: '#FFF9C4', bg2: '#F57F17', emoji: '⭐', label: '창의' },
  { name: 'milestone-food', bg1: '#FFCCBC', bg2: '#D84315', emoji: '🍼', label: '식사' },
  { name: 'milestone-eye', bg1: '#B2EBF2', bg2: '#006064', emoji: '👀', label: '감각' },

  // Badge icons
  { name: 'badge-ai', bg1: '#E1BEE7', bg2: '#6A1B9A', emoji: '🤖', label: 'AI' },
  { name: 'badge-db', bg1: '#B3E5FC', bg2: '#01579B', emoji: '📚', label: 'DB' },

  // Lullaby / Sound icons — 백색소음
  { name: 'sound-womb',      bg1: '#EDE7F6', bg2: '#6A1B9A', emoji: '👶', label: '' },
  { name: 'sound-vacuum',    bg1: '#ECEFF1', bg2: '#546E7A', emoji: '🌀', label: '' },
  { name: 'sound-hairdryer', bg1: '#FFF8E1', bg2: '#EF6C00', emoji: '💨', label: '' },
  { name: 'sound-fan',       bg1: '#E3F2FD', bg2: '#1565C0', emoji: '🌬', label: '' },
  // 자연의 소리
  { name: 'sound-rain',      bg1: '#E1F5FE', bg2: '#01579B', emoji: '🌧', label: '' },
  { name: 'sound-wave',      bg1: '#E0F7FA', bg2: '#00695C', emoji: '🌊', label: '' },
  { name: 'sound-forest',    bg1: '#E8F5E9', bg2: '#2E7D32', emoji: '🌲', label: '' },
  { name: 'sound-stream',    bg1: '#E3F2FD', bg2: '#0277BD', emoji: '💧', label: '' },
  // 자장가
  { name: 'sound-twinkle',   bg1: '#FFF9C4', bg2: '#F9A825', emoji: '⭐', label: '' },
  { name: 'sound-brahms',    bg1: '#F3E5F5', bg2: '#7B1FA2', emoji: '🎵', label: '' },
  { name: 'sound-mozart',    bg1: '#EDE7F6', bg2: '#5E35B1', emoji: '🎶', label: '' },
  { name: 'sound-orgel',     bg1: '#FCE4EC', bg2: '#C2185B', emoji: '🎼', label: '' },

  // Prenatal music icons — 클래식
  { name: 'p-mozart',        bg1: '#EDE7F6', bg2: '#5E35B1', emoji: '🎼', label: '' },
  { name: 'p-vivaldi',       bg1: '#FCE4EC', bg2: '#AD1457', emoji: '🌸', label: '' },
  { name: 'p-bach',          bg1: '#E8EAF6', bg2: '#3949AB', emoji: '🎻', label: '' },
  { name: 'p-pachelbel',     bg1: '#E1F5FE', bg2: '#0288D1', emoji: '🎵', label: '' },
  { name: 'p-debussy',       bg1: '#E8F5E9', bg2: '#2E7D32', emoji: '🌙', label: '' },
  // 자궁·심장박동
  { name: 'p-womb-heart',    bg1: '#FCE4EC', bg2: '#C2185B', emoji: '💗', label: '' },
  { name: 'p-mom-heart',     bg1: '#FFEBEE', bg2: '#E53935', emoji: '❤️', label: '' },
  // 자연
  { name: 'p-ocean',         bg1: '#E0F7FA', bg2: '#006064', emoji: '🌊', label: '' },
  { name: 'p-rain',          bg1: '#E3F2FD', bg2: '#1976D2', emoji: '🌧', label: '' },
  { name: 'p-forest',        bg1: '#E8F5E9', bg2: '#388E3C', emoji: '🌳', label: '' },
  // 명상
  { name: 'p-meditation',    bg1: '#EDE7F6', bg2: '#7E57C2', emoji: '🧘', label: '' },
  { name: 'p-singing-bowl',  bg1: '#FFF8E1', bg2: '#F9A825', emoji: '🔔', label: '' },
];

async function generate() {
  console.log(`Generating ${ALL_ICONS.length} icons (${SIZE}x${SIZE})...`);
  for (const icon of ALL_ICONS) {
    const svg = iconSvg(icon.bg1, icon.bg2, icon.emoji, icon.label);
    await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, `${icon.name}.png`));
    console.log(`  ${icon.name}.png`);
  }
  console.log(`Done! ${ALL_ICONS.length} icons generated.`);
}

generate().catch(console.error);
