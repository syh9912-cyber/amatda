const fs = require('fs');
const buf = fs.readFileSync('C:\\amatda\\public\\assets\\amatda-screen-3.jpg');
console.log('File size:', buf.length, 'bytes');
console.log('JPEG header:', buf[0].toString(16), buf[1].toString(16));
// JPEG dimensions from EXIF/SOF markers
let i = 2;
while (i < buf.length - 8) {
  if (buf[i] === 0xFF) {
    const marker = buf[i+1];
    if (marker >= 0xC0 && marker <= 0xC3) {
      const h = buf.readUInt16BE(i+5);
      const w = buf.readUInt16BE(i+7);
      console.log('Dimensions:', w, 'x', h);
      break;
    }
    const len = buf.readUInt16BE(i+2);
    i += 2 + len;
  } else {
    i++;
  }
}
