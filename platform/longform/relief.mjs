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
