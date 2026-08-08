/**
 * data/audit/9/png-identity.mjs — minimal, dependency-free PNG decode +
 * region compare for the C17 pixel-identity gate (pngjs is not installed).
 *
 * Supports 8-bit color types 0/2/4/6 (grayscale, RGB, gray+alpha, RGBA) —
 * exactly what Remotion renderStill emits. Filter reconstruction implements
 * the 5 PNG filter types (None/Sub/Up/Average/Paeth) with node:zlib for the
 * IDAT stream.
 */
import zlib from "node:zlib";

export function decodePng(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) throw new Error("png-identity: not a PNG signature");
  }
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    const dataStart = off + 8;
    if (type === "IHDR") {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
    } else if (type === "IDAT") {
      idat.push(buf.subarray(dataStart, dataStart + len));
    } else if (type === "IEND") {
      break;
    }
    off = dataStart + len + 4; // skip payload + CRC
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`png-identity: unsupported color type ${colorType}`);
  if (bitDepth !== 8) throw new Error(`png-identity: unsupported bit depth ${bitDepth}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels; // bytes per pixel at 8-bit
  const stride = width * channels;
  const out = Buffer.alloc(width * height * channels);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const line = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const cur = raw[rowStart + x];
      const left = x >= bpp ? line[x - bpp] : 0;
      const up = prev[x];
      const upLeft = x >= bpp ? prev[x - bpp] : 0;
      let val;
      switch (filter) {
        case 0: val = cur; break; // None
        case 1: val = cur + left; break; // Sub
        case 2: val = cur + up; break; // Up
        case 3: val = cur + Math.floor((left + up) / 2); break; // Average
        case 4: { // Paeth
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          val = cur + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default:
          throw new Error(`png-identity: bad filter ${filter} at row ${y}`);
      }
      line[x] = val & 0xff;
    }
    prev = line;
  }
  return { width, height, channels, data: out };
}

/**
 * Compare two PNG buffers over a pixel region { x0, y0, x1, y1 } (half-open).
 * Returns { identical, firstDiff? } — identical is true only when every
 * channel of every pixel in the region is exactly equal.
 */
export function pngRegionDiff(a, b, region) {
  const pa = decodePng(a);
  const pb = decodePng(b);
  if (pa.width !== pb.width || pa.height !== pb.height || pa.channels !== pb.channels) {
    return { identical: false, reason: "dimension/channel mismatch" };
  }
  const x0 = Math.max(0, Math.floor(region.x0));
  const y0 = Math.max(0, Math.floor(region.y0));
  const x1 = Math.min(pa.width, Math.ceil(region.x1));
  const y1 = Math.min(pa.height, Math.ceil(region.y1));
  if (x1 <= x0 || y1 <= y0) return { identical: true, note: "empty region" };
  const c = pa.channels;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * pa.width + x) * c;
      for (let k = 0; k < c; k++) {
        if (pa.data[i + k] !== pb.data[i + k]) {
          return {
            identical: false,
            firstDiff: { x, y, ch: k, a: pa.data[i + k], b: pb.data[i + k] },
          };
        }
      }
    }
  }
  return { identical: true, region: { x0, y0, x1, y1 } };
}
