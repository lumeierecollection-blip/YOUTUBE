#!/usr/bin/env node
/**
 * cutout-contact-sheet.mjs — one PNG showing every cutout on the studio ground
 * with the renderer's own drop shadow, labelled with its name, source and
 * licence: the human look that the geometric checks cannot replace (is that
 * really a dollar bill? is the person the right one?). MISSING names are shown
 * as empty labelled tiles.
 *
 *   node scripts/cutout-contact-sheet.mjs [--dir <cutouts dir>] [--out <png>]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const dir = arg("dir", join(ROOT, "src", "skills", "remotion-render", "public", "cutouts"));
const out = arg("out", join(dir, "..", "..", "..", "..", "..", "data", "cutout-contact-sheet.png"));
const specs = JSON.parse(readFileSync(join(ROOT, "scripts", "cutout-specs.json"), "utf8")).specs;
const index = existsSync(join(dir, "index.json")) ? JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) : { cutouts: [] };
const by = new Map((index.cutouts || []).map((c) => [c.name, c]));

const COLS = 7, T = 260, LAB = 52, G = 14, GROUND = { r: 246, g: 244, b: 240 };
const rows = Math.ceil(specs.length / COLS);
const W = COLS * (T + G) + G, H = rows * (T + LAB + G) + G;
const esc = (s) => String(s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const comps = [];
for (const [i, sp] of specs.entries()) {
  const x = G + (i % COLS) * (T + G), y = G + Math.floor(i / COLS) * (T + LAB + G);
  const c = by.get(sp.name);
  if (c && existsSync(join(dir, `${sp.name}.png`))) {
    const img = await sharp(join(dir, `${sp.name}.png`)).resize(T - 40, T - 40, { fit: "inside" }).toBuffer();
    const m = await sharp(img).metadata();
    // The renderer's shadow: 2 px offset, 20 px blur, 0.15 opacity.
    const shadow = await sharp(img).ensureAlpha().extractChannel("alpha").blur(10).linear(0.15, 0).toBuffer();
    const sh = await sharp({ create: { width: m.width, height: m.height, channels: 3, background: { r: 0, g: 0, b: 0 } } }).joinChannel(shadow).png().toBuffer();
    const ox = x + Math.round((T - m.width) / 2), oy = y + Math.round((T - m.height) / 2);
    comps.push({ input: sh, left: ox + 2, top: oy + 2 }, { input: img, left: ox, top: oy });
  } else {
    comps.push({ input: Buffer.from(`<svg width="${T}" height="${T}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${T - 2}" height="${T - 2}" fill="none" stroke="#B0B0B5" stroke-dasharray="8 6"/><text x="${T / 2}" y="${T / 2}" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#8E8E93">missing</text></svg>`), left: x, top: y });
  }
  const label = `<svg width="${T}" height="${LAB}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="20" font-family="sans-serif" font-size="17" font-weight="700" fill="#0B0B0C">${esc(sp.name)}</text><text x="4" y="40" font-family="sans-serif" font-size="13" fill="#5A5A60">${esc(c ? `${c.source} · ${c.license}` : sp.category)}</text></svg>`;
  comps.push({ input: Buffer.from(label), left: x, top: y + T });
}
await sharp({ create: { width: W, height: H, channels: 3, background: GROUND } }).composite(comps).png().toFile(out);
console.log(`contact sheet: ${out} (${by.size}/${specs.length} cutouts)`);
