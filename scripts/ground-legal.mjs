/**
 * ground-legal — a hero object (a logo, a cut-out) must be LEGIBLE on the ground it is drawn on.
 *
 * Owner, 2026-10-09: ch-2's Flock logo is dark green; the planner gave that beat a near-black ground
 * (#101010) and it drew green on black. Gemini chooses grounds (the visual plan's GROUND line); code
 * enforces legality: if too little of the object's ink contrasts with the ground the planner chose,
 * the beat takes the best ground that VIDEO already uses (white included) and says so. It never
 * invents a ground the channel does not use, and a beat no ground in the video can legalise is left
 * as the planner drew it and reported.
 *
 * Legible = at least `SHARE` (60%) of the object's opaque pixels have a WCAG contrast ratio of at least
 * `RATIO` (2.5) against the ground. Measured on the PNG's own pixels (sharp), not on a guess.
 */
import sharp from "sharp";

export const RATIO = 2.5;
export const SHARE = 0.6;
const WHITE = "#FFFFFF";

const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const luma = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hexLuma = (hex) => { const n = parseInt(String(hex || WHITE).replace("#", ""), 16); return luma((n >> 16) & 255, (n >> 8) & 255, n & 255); };
export const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** The luminance of every opaque pixel of an image, as a Float32Array (subsampled to <= ~40k pixels). */
export async function inkLumas(file) {
  let data, info;
  try { ({ data, info } = await sharp(file).ensureAlpha().resize({ width: 200, height: 200, fit: "inside", withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true })); } catch { return null; }
  const out = [];
  for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] >= 128) out.push(luma(data[i], data[i + 1], data[i + 2]));
  return out.length ? Float32Array.from(out) : null;
}

/** Share of ink pixels with contrast >= RATIO against `groundHex` (null ground = the house white). */
export function legibility(lumas, groundHex) {
  if (!lumas || !lumas.length) return 1;
  const g = hexLuma(groundHex || WHITE);
  let ok = 0;
  for (const l of lumas) if (contrast(l, g) >= RATIO) ok++;
  return ok / lumas.length;
}

/**
 * @param beats  plan.beats ({ index, canvas: { ground_color, concept_visuals: [{ asset, class, name }] } })
 * @param publicDir  the Remotion public dir the assets are relative to
 * @returns [{ beat, was, now, share_was, share_now, object }] — the beats whose ground changed;
 *          `kept` beats (illegal, no ground in the video helps) are in `.stuck`.
 */
export async function legaliseGrounds(beats, publicDir, { join, existsSync }, log = () => {}) {
  const changed = [], stuck = [];
  const used = [...new Set(beats.map((b) => (b.canvas?.ground_color ? String(b.canvas.ground_color).toUpperCase() : null)))];
  const candidates = [...new Set([null, ...used])];   // null = the house white
  for (const b of beats) {
    const c = b.canvas;
    if (!c) continue;
    const objs = (c.concept_visuals || []).filter((v) => v?.asset && v.class === "cutout");
    if (!objs.length) continue;
    const now = c.ground_color ? String(c.ground_color).toUpperCase() : null;
    const files = objs.map((v) => join(publicDir, v.asset)).filter((f) => existsSync(f));
    const lumas = (await Promise.all(files.map(inkLumas))).filter(Boolean);
    if (!lumas.length) continue;
    // The worst object on the beat decides.
    const share = (g) => Math.min(...lumas.map((l) => legibility(l, g)));
    const s0 = share(now);
    if (s0 >= SHARE) continue;
    const best = candidates.map((g) => ({ g, s: share(g) })).sort((a, z) => z.s - a.s)[0];
    const label = (g) => g || "white";
    if (best.s >= SHARE && best.s > s0) {
      c.ground_color = best.g;
      changed.push({ beat: b.index, was: label(now), now: label(best.g), share_was: s0, share_now: best.s, object: objs[0].name });
      log(`[ground] beat ${b.index}: ${objs[0].name} is legible on ${(s0 * 100).toFixed(0)}% of its ink against ${label(now)} (Gemini's ground) — ${label(best.g)} instead (${(best.s * 100).toFixed(0)}%)`);
    } else {
      stuck.push({ beat: b.index, ground: label(now), share: s0, object: objs[0].name });
      log(`[ground] beat ${b.index}: ${objs[0].name} is legible on only ${(s0 * 100).toFixed(0)}% of its ink against ${label(now)}, and no ground this video uses does better (best ${label(best.g)} ${(best.s * 100).toFixed(0)}%) — left as planned`);
    }
  }
  return { changed, stuck };
}
