/**
 * Generate milestone category icons (128x128) for album screen
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'assets');

const icons = [
  { name: 'milestone-body', bg: '#FFE0B2', symbol: '🏃', label: '신체' },
  { name: 'milestone-talk', bg: '#C8E6C9', symbol: '💬', label: '언어' },
  { name: 'milestone-brain', bg: '#BBDEFB', symbol: '🧠', label: '인지' },
  { name: 'milestone-heart', bg: '#F8BBD0', symbol: '💕', label: '사회' },
  { name: 'milestone-hand', bg: '#D1C4E9', symbol: '✋', label: '자조' },
  { name: 'milestone-star', bg: '#FFF9C4', symbol: '⭐', label: '창의' },
  { name: 'milestone-food', bg: '#FFCCBC', symbol: '🍼', label: '식사' },
  { name: 'milestone-eye', bg: '#B2EBF2', symbol: '👀', label: '감각' },
];

async function generate() {
  for (const icon of icons) {
    const svg = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${icon.bg};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${adjustColor(icon.bg, -20)};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="url(#g)"/>
      <text x="64" y="72" font-size="52" text-anchor="middle" dominant-baseline="middle">${icon.symbol}</text>
    </svg>`;

    await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, `${icon.name}.png`));
    console.log(`  Created: ${icon.name}.png`);
  }
  console.log('Done!');
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

generate().catch(console.error);
