/**
 * Shaded relief for long-form maps, the terrain look of the reference channels (This Is History's relief maps; RealLifeLore uses commercial
 * MapTiler tiles, which we do not have). Source: Natural Earth shaded relief, public domain (naturalearthdata.com), equirectangular, so a
 * lon/lat box crops straight to pixels and lines up with frameMap()'s projection (equirectangular with a cos(latitude) x-scale).
 * Downloaded once per run into output/cache. Returns a grayscale JPEG data URI sized to the map area.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../preview/lib.mjs";

const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const SOURCES = { "50m": { url: "https://naciscdn.org/naturalearth/50m/raster/SR_50M.zip", tif: "SR_50M/SR_50M.tif" }, "10m": { url: "https://naciscdn.org/naturalearth/10m/raster/SR_HR.zip", tif: "SR_HR/SR_HR.tif" } };

export function ensureRelief(res = "50m") {
  const dir = join(ROOT, "output/cache/relief"), s = SOURCES[res], zip = join(dir, `${res}.zip`), tifDir = join(dir, res);
  mkdirSync(dir, { recursive: true });
  const found = () => { const r = spawnSync("find", [tifDir, "-iname", "*.tif"], { encoding: "utf8" }); return (r.stdout || "").trim().split("\n").filter(Boolean)[0]; };
  if (existsSync(tifDir) && found()) return found();
  const d = spawnSync("curl", ["-sSfL", "--retry", "3", "-o", zip, s.url], { encoding: "utf8", timeout: 600000 });
  if (d.status !== 0) throw new Error(`relief download failed: ${d.stderr}`);
  mkdirSync(tifDir, { recursive: true });
  const u = spawnSync("unzip", ["-o", "-q", zip, "-d", tifDir], { encoding: "utf8" });
  if (u.status !== 0) throw new Error(`relief unzip failed: ${u.stderr}`);
  const tif = found(); if (!tif) throw new Error("no .tif in the relief archive");
  return tif;
}

/** box: { w, e, s, n } in degrees (frameMap's box); area: { w, h } in pixels. */
export async function reliefFor(box, area, res = "50m") {
  const tif = ensureRelief(res), img = sharp(tif, { limitInputPixels: false }), { width: W, height: H } = await img.metadata();
  const px = (lon) => Math.round(((lon + 180) / 360) * W), py = (lat) => Math.round(((90 - lat) / 180) * H);
  const x0 = Math.max(0, px(box.w)), x1 = Math.min(W, px(box.e)), y0 = Math.max(0, py(box.n)), y1 = Math.min(H, py(box.s));
  if (x1 - x0 < 4 || y1 - y0 < 4) throw new Error(`relief crop too small for box ${JSON.stringify(box)}`);
  // Where the box runs past the poles or the date line, the crop is clamped; the image is then placed at its own offset inside the area.
  const left = Math.round(((px(box.w) < 0 ? -px(box.w) : 0) / (px(box.e) - px(box.w))) * area.w), top = Math.round(((py(box.n) < 0 ? -py(box.n) : 0) / (py(box.s) - py(box.n))) * area.h);
  const w = Math.round(((x1 - x0) / (px(box.e) - px(box.w))) * area.w), h = Math.round(((y1 - y0) / (py(box.s) - py(box.n))) * area.h);
  const buf = await sharp(tif, { limitInputPixels: false }).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).resize(w, h, { fit: "fill" }).greyscale().jpeg({ quality: 82 }).toBuffer();
  return { uri: `data:image/jpeg;base64,${buf.toString("base64")}`, x: left, y: top, w, h, source: "Natural Earth shaded relief (public domain)" };
}

/**
 * The map base baked into one image: sea, land and relief already multiplied, so Chrome draws one picture per frame instead of blending and
 * clipping a 1920x1080 raster on every frame (the first relief render ran at about 0.6 s a frame on GitHub's software renderer).
 * landD is the SVG path of all land in the area's pixel space; colors come from the composition's palette, passed in by the job.
 */
export async function bakedBase({ box, area, landD, sea, land, strength = 0.55, res = "50m" }) {
  const r = await reliefFor(box, area, res), W = area.w, H = area.h;
  const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`);
  const base = await sharp(svg(`<rect width="${W}" height="${H}" fill="${sea}"/><path d="${landD}" fill="${land}"/>`)).png().toBuffer();
  // Relief lightened toward white by (1 - strength), so a multiply darkens the land by at most `strength`; then kept only where land is.
  // sharp always resizes before it extends, whatever the call order, so pad in one pass and fit to the frame in a second.
  const padded = await sharp(Buffer.from(r.uri.split(",")[1], "base64")).greyscale().linear(strength, 255 * (1 - strength)).extend({ top: r.y, left: r.x, bottom: Math.max(0, H - r.y - r.h), right: Math.max(0, W - r.x - r.w), background: "#ffffff" }).png().toBuffer();
  const relief = await sharp(padded).resize(W, H, { fit: "fill" }).greyscale().png().toBuffer();
  const mask = await sharp(svg(`<rect width="${W}" height="${H}" fill="black"/><path d="${landD}" fill="white"/>`)).greyscale().png().toBuffer();
  const reliefOnLand = await sharp(relief).joinChannel(mask).png().toBuffer();
  const out = await sharp(base).composite([{ input: reliefOnLand, blend: "multiply" }]).jpeg({ quality: 84 }).toBuffer();
  return { uri: `data:image/jpeg;base64,${out.toString("base64")}`, source: r.source };
}
