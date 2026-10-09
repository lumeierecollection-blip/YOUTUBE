// scripts/lib/frame-motion.mjs — the pixel evidence behind the fake-pan check (CI run 37919459134: Gemini called a
// 1.09x push "unchanged"; the pixels measured it).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { estimateMotion, axisWidth } from "../lib/frame-motion.mjs";

const dir = mkdtempSync(join(tmpdir(), "fm-"));
const W = 540, H = 960;
// A deterministic textured "photograph": blobs of varying grey.
function photo() {
  const px = Buffer.alloc(W * H);
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  px.fill(120);
  for (let k = 0; k < 400; k++) {
    const cx = rnd() * W, cy = rnd() * H, r = 8 + rnd() * 40, v = Math.floor(rnd() * 255);
    for (let y = Math.max(0, cy - r | 0); y < Math.min(H, cy + r); y++) for (let x = Math.max(0, cx - r | 0); x < Math.min(W, cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) px[y * W + x] = v;
  }
  return sharp(px, { raw: { width: W, height: H, channels: 1 } });
}
async function save(img, name) { const f = join(dir, name); await img.png().toFile(f); return f; }

test("a 9% push-in is measured as a move of about 9%", async () => {
  const a = await save(photo(), "a.png");
  // The centre crop that fills the frame at 1.09x.
  const cw = Math.round(W / 1.09), ch = Math.round(H / 1.09);
  const b = await save(photo().extract({ left: Math.round((W - cw) / 2), top: Math.round((H - ch) / 2), width: cw, height: ch }).resize(W, H), "b.png");
  const m = await estimateMotion(a, b);
  assert.equal(m.moved, true, JSON.stringify(m));
  assert.ok(Math.abs(m.scale - 1.09) <= 0.02, `scale ${m.scale}`);
});

test("identical frames, and frames that differ only by something else, are not a move", async () => {
  const a = await save(photo(), "a2.png");
  assert.equal((await estimateMotion(a, a)).moved, false);
});

test("a chart that grows 9% about its floor widens its axis 9%", async () => {
  const frame = async (axisW, name) => save(sharp({ create: { width: W, height: H, channels: 3, background: "#fafafa" } })
    .composite([{ input: { create: { width: axisW, height: 4, channels: 3, background: "#111" } }, left: Math.round((W - axisW) / 2), top: 640 }]), name);
  const wa = await axisWidth(await frame(410, "c1.png")), wb = await axisWidth(await frame(447, "c2.png"));
  assert.ok(Math.abs(wa - 410) <= 2 && Math.abs(wb - 447) <= 2, `${wa} ${wb}`);
  assert.ok(wb / wa >= 1.05);
  assert.equal(await axisWidth(await save(sharp({ create: { width: W, height: H, channels: 3, background: "#fafafa" } }), "blank.png")), null);
});
