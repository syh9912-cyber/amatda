/**
 * milestones-sm 폴더의 실제 파일 기반으로 TypeScript require() 매핑 생성
 * 실행: node scripts/generate-milestone-map.cjs
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'frontend', 'assets', 'milestones-sm');
const OUT = path.join(__dirname, '..', 'frontend', 'constants', 'milestoneImages.ts');

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.png')).sort();

const lines = [
  '/**',
  ' * Auto-generated milestone image mapping (128x128 thumbnails)',
  ` * ${files.length} images, generated ${new Date().toISOString().slice(0, 10)}`,
  ' * Do not edit manually — run: node scripts/generate-milestone-map.cjs',
  ' */',
  "import { ImageSourcePropType } from 'react-native';",
  '',
  '/* ── Static require map (filename → image) ── */',
  'const IMG: Record<string, ImageSourcePropType> = {',
];

for (const f of files) {
  const key = f.replace('.png', '');
  lines.push(`  '${key}': require('../assets/milestones-sm/${f}'),`);
}

lines.push('};');
lines.push('');

// safeName function matching Gemini script's naming convention
lines.push('/* ── Lookup helpers ── */');
lines.push('');
lines.push('function safeName(label: string): string {');
lines.push("  // Match Gemini script naming: keep alphanumeric + Korean syllables, replace rest with _");
lines.push("  return label.replace(/[^a-zA-Z0-9\uAC00-\uD7A3]/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '');");
lines.push('}');
lines.push('');

// ageKey → prefix mapping (use actual Korean characters, no unicode escapes)
lines.push('function ageToPrefix(monthKey: string): string {');
lines.push("  if (monthKey.endsWith('\uAC1C\uC6D4')) return monthKey.replace('\uAC1C\uC6D4', 'm');");
lines.push("  if (monthKey.includes('~')) {");
lines.push("    const cleaned = monthKey.replace('\uAC1C\uC6D4', 'm').replace('~', '-');");
lines.push("    return cleaned;");
lines.push("  }");
lines.push("  if (monthKey === '4\uC138') return '4y';");
lines.push("  if (monthKey === '5\uC138') return '5y';");
lines.push("  if (monthKey === '6\uC138 \uC774\uC0C1') return '6y_';");
lines.push("  return monthKey;");
lines.push('}');

lines.push('');
lines.push('/**');
lines.push(' * Get milestone image by age key and label.');
lines.push(" * @param monthKey  e.g. '0개월', '25~27개월', '4세'");
lines.push(" * @param label     e.g. '첫 울음', '빛에 반응'");
lines.push(' * @returns ImageSourcePropType or null if not found');
lines.push(' */');
lines.push('export function getMilestoneImage(monthKey: string, label: string): ImageSourcePropType | null {');
lines.push('  const prefix = ageToPrefix(monthKey);');
lines.push('  const name = safeName(label);');
lines.push('  const key = `${prefix}-${name}`;');
lines.push('  return IMG[key] ?? null;');
lines.push('}');
lines.push('');
lines.push(`export const MILESTONE_IMAGE_COUNT = ${files.length};`);
lines.push('');
lines.push('export default IMG;');
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'), 'utf-8');
console.log(`Generated ${OUT}`);
console.log(`${files.length} images mapped`);
