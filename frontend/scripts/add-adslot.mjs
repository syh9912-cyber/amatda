import fs from 'fs';
import path from 'path';

const files = process.argv.slice(2);

for (const f of files) {
  const p = path.join('app', '(main)', `${f}.tsx`);
  if (!fs.existsSync(p)) { console.log('MISS:', f); continue; }
  let src = fs.readFileSync(p, 'utf8');
  if (src.includes('AdSlot')) { console.log('SKIP:', f); continue; }

  const importRegex = /^import .+ from ['"][^'"]+['"];?$/gm;
  const matches = [...src.matchAll(importRegex)];
  if (matches.length === 0) { console.log('no-import:', f); continue; }
  const last = matches[matches.length - 1];
  const insertPos = last.index + last[0].length;
  const newImport = `\nimport { AdSlot } from '../../components/ads/AdSlot';`;
  src = src.slice(0, insertPos) + newImport + src.slice(insertPos);

  const stylesMatch = src.match(/\nconst \w+\s*=\s*StyleSheet/);
  if (!stylesMatch) { console.log('no-styles:', f); fs.writeFileSync(p, src); continue; }
  const cutoff = stylesMatch.index;
  const head = src.slice(0, cutoff);
  const tail = src.slice(cutoff);

  // Find last </ScrollView> or </FlatList> in head — insert AdSlot right after
  let idx = -1;
  let tagLen = 0;
  const candidates = ['</ScrollView>', '</FlatList>'];
  for (const c of candidates) {
    const i = head.lastIndexOf(c);
    if (i > idx) { idx = i; tagLen = c.length; }
  }
  if (idx < 0) { console.log('no-scroll:', f); fs.writeFileSync(p, src); continue; }

  // find indent of this line
  const lineStart = head.lastIndexOf('\n', idx) + 1;
  const indent = head.slice(lineStart, idx);
  const afterTag = idx + tagLen;
  const newHead = head.slice(0, afterTag) + `\n${indent}<AdSlot />` + head.slice(afterTag);
  src = newHead + tail;
  fs.writeFileSync(p, src);
  console.log('ok:', f);
}
