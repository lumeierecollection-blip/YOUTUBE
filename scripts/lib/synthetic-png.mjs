// Deterministic synthetic PNGs for render regression fixtures: no network, no binary files in the repo,
// no dependency beyond node:zlib. The same spec always yields the same bytes.
import { deflateSync } from "node:zlib";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

export const MAGENTA = [255, 0, 255];

export function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [0, 8, 4].map((n) => Math.round(f(n) * 255));
}

// spec: { w, h, hue (degrees), disc (bool) }. Opaque images fill the whole frame with the signature colour
// (grid lines every 64 px are darker, so a crop keeps the colour). A disc image is transparent outside a centred
// disc, with a half-transparent ring around it (signature colour at alpha 128), and magenta RGB under alpha 0.
export function syntheticPng({ w, h, hue, disc = false }) {
  const sig = hslToRgb(hue, 0.75, 0.45);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  const cx = w / 2, cy = h / 2, r = 0.45 * Math.min(w, h), ring = r * 1.08;
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const o = row + 1 + x * 4;
      const grid = x % 64 === 0 || y % 64 === 0;
      let alpha = 255;
      if (disc) {
        const d = Math.hypot(x - cx, y - cy);
        alpha = d <= r ? 255 : d <= ring ? 128 : 0;
      }
      // Fully transparent pixels carry loud magenta, not the signature colour: a renderer that drops the alpha
      // channel, or filters it without premultiplying, then shows magenta where the picture should be see-through.
      const rgb = alpha === 0 ? MAGENTA : grid ? sig.map((v) => Math.round(v * 0.8)) : sig;
      raw[o] = rgb[0];
      raw[o + 1] = rgb[1];
      raw[o + 2] = rgb[2];
      raw[o + 3] = alpha;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return {
    png: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]),
    signature: sig,
  };
}
