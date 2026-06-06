#!/usr/bin/env node
/**
 * 일괄 LinearGradient 제거 스크립트.
 *
 * 패턴:
 *   <LinearGradient ... > … </LinearGradient>
 *   → <View ...첫번째 color bg 적용> … </View>
 *
 * 변환 후 사용자가 디자인 검수 필요. 본질적으로 디자인 다운그레이드(평평).
 *
 * 사용: node scripts/remove-linear-gradient.js <file1> <file2> ...
 */
const fs = require('fs');

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('Usage: node remove-linear-gradient.js <file1> [...]');
  process.exit(1);
}

for (const file of files) {
  let src = fs.readFileSync(file, 'utf-8');
  const original = src;

  // 1) <LinearGradient ... > → <View style={...}> with first color injected as bg via style merge.
  //    실용적: colors 첫 원소를 추출해 backgroundColor inline 추가.
  //    여러 JSX 인스턴스 처리: lazy 매치, 어트리뷰트 순서 변동 가능 → 단순 접근.
  src = src.replace(
    /<LinearGradient\s+([^>]*?)>/gms,
    (match, attrs) => {
      // colors=[...] 추출
      const colorsMatch = attrs.match(/colors=\{?\[([^\]]+)\]\}?/);
      let bgColor = null;
      if (colorsMatch) {
        const first = colorsMatch[1].split(',')[0].trim().replace(/['"`]/g, '');
        if (first.startsWith('#') || first.startsWith('rgb')) bgColor = first;
      }
      // style={...} 또는 style={[...]} 추출 — 그대로 유지
      const styleMatch = attrs.match(/style=(\{[^}]+\}|\{\[[^\]]+\]\})/);
      let styleAttr = styleMatch ? styleMatch[0] : '';
      // bgColor 가 있으면 inline style 추가
      if (bgColor && styleAttr) {
        if (styleAttr.includes('{[')) {
          // 배열 — 끝에 추가
          styleAttr = styleAttr.replace(
            /\]\}$/,
            `, { backgroundColor: '${bgColor}' }]}`,
          );
        } else {
          styleAttr = styleAttr.replace(
            /\}$/,
            ` && true, backgroundColor: '${bgColor}'}`,
          );
          // 더 깔끔: 배열로 wrap
          styleAttr = `style={[${styleMatch[1]}, { backgroundColor: '${bgColor}' }]}`;
        }
      }
      return `<View ${styleAttr}>`;
    },
  );

  // 2) </LinearGradient> → </View>
  src = src.replace(/<\/LinearGradient>/g, '</View>');

  // 3) import { LinearGradient } from 'expo-linear-gradient'; 제거
  src = src.replace(
    /import\s*\{\s*LinearGradient\s*\}\s*from\s*['"]expo-linear-gradient['"]\s*;\n?/g,
    '',
  );

  // 4) View import 보장
  if (!src.match(/from\s+['"]react-native['"]/m)) {
    // 못 찾으면 skip — 수동 검수
  } else if (!src.match(/\{\s*[^}]*\bView\b[^}]*\}\s*from\s+['"]react-native['"]/m)) {
    // View import 없으면 추가
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/m,
      (m, names) => {
        const trimmed = names.trim();
        const needsComma = trimmed.length > 0 && !trimmed.endsWith(',');
        return `import {${trimmed}${needsComma ? ', ' : ' '}View } from 'react-native'`;
      },
    );
  }

  if (src !== original) {
    fs.writeFileSync(file, src);
    console.log(`✓ ${file}`);
  } else {
    console.log(`- ${file} (변경 없음)`);
  }
}
