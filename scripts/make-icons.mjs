// Generates the app icons and iOS launch screens as PNGs, with no dependencies.
// Run: npm run icons
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('public');
const BG = [10, 11, 13];
const BG_HI = [28, 32, 38];
const ACCENT = [200, 245, 96];

// ---------- PNG encoding ----------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Dumbbell shape (signed distance field) ----------
function sdRoundBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
const ANGLE = (35 * Math.PI) / 180;
function sdDumbbell(x, y) {
  // rotate into the dumbbell's frame; logo spans roughly [-1, 1]
  const c = Math.cos(ANGLE), s = Math.sin(ANGLE);
  const px = c * x - s * y;
  const py = s * x + c * y;
  const ax = Math.abs(px);
  let d = sdRoundBox(px, py, 0.62, 0.075, 0.075); // bar
  d = Math.min(d, sdRoundBox(ax - 0.43, py, 0.1, 0.44, 0.07)); // inner plates
  d = Math.min(d, sdRoundBox(ax - 0.66, py, 0.08, 0.3, 0.06)); // outer plates
  return d;
}

function render(w, h, logoSize, { radial = true } = {}) {
  const buf = Buffer.alloc(w * h * 3);
  const cx = w / 2, cy = h / 2;
  const scale = logoSize / 2; // pixels per logo unit
  const maxR = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const t = radial ? Math.min(1, Math.hypot(x - cx, y - cy) / (maxR * 0.9)) : 1;
      let r = BG_HI[0] + (BG[0] - BG_HI[0]) * t;
      let g = BG_HI[1] + (BG[1] - BG_HI[1]) * t;
      let b = BG_HI[2] + (BG[2] - BG_HI[2]) * t;
      const lx = (x + 0.5 - cx) / scale;
      const ly = (y + 0.5 - cy) / scale;
      if (Math.abs(lx) < 1.2 && Math.abs(ly) < 1.2) {
        const d = sdDumbbell(lx, ly) * scale; // distance in pixels
        const a = Math.min(1, Math.max(0, 0.5 - d));
        r += (ACCENT[0] - r) * a;
        g += (ACCENT[1] - g) * a;
        b += (ACCENT[2] - b) * a;
      }
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
    }
  }
  return encodePNG(w, h, buf);
}

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log('wrote', path.relative(process.cwd(), file));
}

write(path.join(OUT, 'apple-touch-icon.png'), render(180, 180, 180 * 0.66));
write(path.join(OUT, 'pwa-192.png'), render(192, 192, 192 * 0.66));
write(path.join(OUT, 'pwa-512.png'), render(512, 512, 512 * 0.66));
write(path.join(OUT, 'pwa-maskable-512.png'), render(512, 512, 512 * 0.5));

const SPLASH = [
  [1320, 2868], [1206, 2622], [1290, 2796], [1179, 2556], [1284, 2778],
  [1170, 2532], [1125, 2436], [828, 1792], [750, 1334],
];
for (const [w, h] of SPLASH) {
  write(path.join(OUT, 'splash', `splash-${w}x${h}.png`), render(w, h, w * 0.3, { radial: false }));
}
