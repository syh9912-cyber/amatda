const fs = require('fs');

const jsonlPath = 'C:\\Users\\syh99\\.claude\\projects\\C--amatda\\052024fc-baa5-41d2-a0d5-d2843d3e4c71.jsonl';
const size = fs.statSync(jsonlPath).size;
const fd = fs.openSync(jsonlPath, 'r');

const startPos = 38803000;
const readLen = Math.min(size - startPos, 5000000);
const buf = Buffer.alloc(readLen);
const read = fs.readSync(fd, buf, 0, readLen, startPos);
fs.closeSync(fd);

const text = buf.slice(0, read).toString('utf8');
const firstNewline = text.indexOf('\n');
const contText = text.substring(firstNewline + 1);

let pos = 0;
let found = 0;
while (pos < contText.length) {
  const idx = contText.indexOf('/9j/', pos);
  if (idx === -1) break;
  const endIdx = contText.indexOf('"', idx);
  if (endIdx === -1) { pos = idx + 100; continue; }
  const b64 = contText.substring(idx, endIdx);
  const decoded = Buffer.from(b64, 'base64');
  found++;

  const lineStart = contText.lastIndexOf('\n', idx) + 1;
  const ctx = contText.substring(lineStart, lineStart + 120);
  console.log('JPEG', found, '- size:', decoded.length, 'bytes');
  console.log('Context:', ctx.replace(/\n/g, ' '));

  if (decoded.length > 30000 && found === 1) {
    fs.writeFileSync('C:\\amatda\\public\\assets\\amatda-screen-home.jpg', decoded);
    console.log('>> Saved as amatda-screen-home.jpg');
  }

  pos = idx + 100;
  if (found >= 6) break;
}
