/**
 * Generates minimal valid PNG icons for the Chrome extension.
 * No external dependencies — uses Node.js built-in zlib.
 * Run: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const SIZES = [16, 48, 128];

// Colors
const BG = [0xcc, 0x00, 0x01, 0xff];   // #cc0001 red
const WHITE = [0xff, 0xff, 0xff, 0xff]; // white
const TRANS = [0x00, 0x00, 0x00, 0x00]; // transparent

/**
 * Create a simple RGBA pixel grid (size x size).
 * Draws a red rounded-square background + white "K" letter outline.
 */
function createPixels(size) {
  const pixels = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      row.push([...TRANS]);
    }
    pixels.push(row);
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  // Draw circle background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= r * r) {
        pixels[y][x] = [...BG];
      }
    }
  }

  // Draw a simple "K" using pixel blocks
  // K is drawn as a scaled glyph based on icon size
  const gw = Math.round(size * 0.45); // glyph width
  const gh = Math.round(size * 0.65); // glyph height
  const gx = Math.round(cx - gw / 2); // glyph top-left x
  const gy = Math.round(cy - gh / 2); // glyph top-left y
  const sw = Math.max(1, Math.round(size * 0.12)); // stroke width

  // Left vertical bar of K
  for (let y = gy; y < gy + gh; y++) {
    for (let x = gx; x < gx + sw; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        pixels[y][x] = [...WHITE];
      }
    }
  }

  // Upper diagonal of K (top-right)
  const midY = gy + Math.round(gh / 2);
  for (let i = 0; i < gh / 2; i++) {
    const progress = i / (gh / 2);
    const px = Math.round(gx + sw + progress * (gw - sw));
    const py = midY - i;
    for (let s = 0; s < sw; s++) {
      const nx = px + s;
      const ny = py - s;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        pixels[ny][nx] = [...WHITE];
      }
    }
  }

  // Lower diagonal of K (bottom-right)
  for (let i = 0; i < gh / 2; i++) {
    const progress = i / (gh / 2);
    const px = Math.round(gx + sw + progress * (gw - sw));
    const py = midY + i;
    for (let s = 0; s < sw; s++) {
      const nx = px + s;
      const ny = py + s;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        pixels[ny][nx] = [...WHITE];
      }
    }
  }

  return pixels;
}

function crc32(buf) {
  let crc = 0xffffffff;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (const byte of buf) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

function encodePNG(pixels, size) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines with filter byte 0 (None)
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      raw.push(...pixels[y][x]);
    }
  }
  const rawBuf = Buffer.from(raw);
  const compressed = zlib.deflateSync(rawBuf, { level: 9 });

  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, makeChunk('IHDR', ihdr), idat, iend]);
}

SIZES.forEach((size) => {
  const pixels = createPixels(size);
  const png = encodePNG(pixels, size);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created icon${size}.png (${png.length} bytes)`);
});

console.log('Done!');
