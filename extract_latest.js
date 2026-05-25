const fs = require('fs');

const jsonlPath = 'C:\\Users\\syh99\\.claude\\projects\\C--amatda\\052024fc-baa5-41d2-a0d5-d2843d3e4c71.jsonl';
const size = fs.statSync(jsonlPath).size;
const fd = fs.openSync(jsonlPath, 'r');

// 마지막 8MB만 읽기 (방금 업로드한 이미지가 여기 있을 것)
const readLen = Math.min(size, 8000000);
const startPos = size - readLen;
const buf = Buffer.alloc(readLen);
const read = fs.readSync(fd, buf, 0, readLen, startPos);
fs.closeSync(fd);

const text = buf.slice(0, read).toString('utf8');

// 모든 /9j/ (JPEG SOI) 위치 찾기
let pos = 0;
const found = [];
while (pos < text.length) {
  const idx = text.indexOf('/9j/', pos);
  if (idx === -1) break;
  const endIdx = text.indexOf('"', idx);
  if (endIdx === -1) { pos = idx + 4; continue; }
  const b64 = text.substring(idx, endIdx);
  if (b64.length > 1000) { // 의미있는 크기만
    const decoded = Buffer.from(b64, 'base64');
    found.push({ pos: startPos + idx, size: decoded.length, data: decoded });
    console.log(`JPEG at offset ${startPos + idx}: ${decoded.length} bytes`);
  }
  pos = idx + 4;
}

if (found.length === 0) {
  console.log('No JPEG found in last 8MB');
} else {
  // 가장 큰 것 저장 (실제 스크린샷)
  found.sort((a, b) => b.size - a.size);
  const biggest = found[0];
  console.log(`\nSaving largest JPEG: ${biggest.size} bytes`);
  fs.writeFileSync('C:\\amatda\\public\\assets\\amatda-screen-3.jpg', biggest.data);
  console.log('Saved to amatda-screen-3.jpg');

  // 두번째도 저장 (비교용)
  if (found.length > 1) {
    const second = found[1];
    console.log(`Second largest: ${second.size} bytes`);
    fs.writeFileSync('C:\\amatda\\public\\assets\\debug-screen-2nd.jpg', second.data);
  }
}
