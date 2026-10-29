// scripts/generate-icons.mjs — توليد أيقونات PWA (PNG) بدون مكتبات خارجية
// تصميم: مربع أرجواني بزوايا دائرية + دائرة بيضاء + أعمدة باركود داخلها (نفس روح أيقونة POS)
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PURPLE = [0x76, 0x66, 0xe8];
const PURPLE_DARK = [0x5a, 0x4c, 0xc4];
const WHITE = [0xff, 0xff, 0xff];
const TRANSPARENT = [0, 0, 0, 0];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const corner = size * 0.18; // نصف قطر الزوايا
  const inRounded = (x, y) => {
    const r = corner;
    if (x < r && y < r && Math.hypot(x - r, y - r) > r) return false;
    if (x > size - r && y < r && Math.hypot(x - (size - r), y - r) > r) return false;
    if (x < r && y > size - r && Math.hypot(x - r, y - (size - r)) > r) return false;
    if (x > size - r && y > size - r && Math.hypot(x - (size - r), y - (size - r)) > r) return false;
    return true;
  };
  const cx = size / 2;
  const cy = size / 2;
  const ringOuter = size * 0.34;
  const ringInner = size * 0.265;
  // أعمدة الباركود داخل الحلقة (5 أعمدة بارتفاعات متفاوتة)
  const bars = [
    { x: -0.13, w: 0.052, h: 0.11 },
    { x: -0.055, w: 0.052, h: 0.16 },
    { x: 0.02, w: 0.052, h: 0.075 },
    { x: 0.095, w: 0.052, h: 0.14 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color = TRANSPARENT;
      if (inRounded(x, y)) {
        color = PURPLE;
        const dRing = Math.hypot(x - cx, y - cy);
        if (dRing <= ringOuter && dRing >= ringInner) color = WHITE;
        for (const bar of bars) {
          const bx = cx + bar.x * size;
          const by = cy + 0.02 * size;
          const bw = bar.w * size;
          const bh = bar.h * size;
          if (Math.abs(x - bx) <= bw / 2 && Math.abs(y - by) <= bh / 2) color = PURPLE_DARK;
        }
      }
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = color.length === 4 ? color[3] : 0xff;
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, buildIcon(size));
  console.log('wrote', file);
}
