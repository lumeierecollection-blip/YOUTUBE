/**
 * clone-cutouts — the beat's OWN verified photo, isolated from its background, so the clone family can float it on the paper like the references do
 * (owner, 2026-10-16: "look how much better they look ... especially when it comes to pngs, the frames are not needed"). The references never box a picture:
 * ref-03's money bag, falling man, cash stack and reaching hands, the Zalando video's three brothers, flag and alarm clock are all cut-outs, large, often running off
 * the frame's edge, with a soft shadow. Our clone renders put every photo in a frame, a disc or a strip.
 *
 * Uses the repo's existing isolation (scripts/cutout_lib.py: rembg u2net + the geometric checks that refuse a scene, a cropped object or a rectangle). Nothing
 * new is sourced: only the photo the beat already carries and the pipeline already verified (a named person stays that person). When isolation is refused or
 * rembg is not installed, the photo is NOT boxed either: it is shown as a soft-edged vignette (the references' treatment of a portrait that is not cut out).
 *
 * Node only (spawns Python); runs in render.js before the composition is bundled, and writes public/cutouts-live/<channel>/photo-<hash>.png.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RR = join(__dirname, "..");                       // src/skills/remotion-render
const ROOT = join(RR, "..", "..", "..");
const CUTOUT_LIB = join(ROOT, "scripts", "cutout_lib.py");

let pythonCache;
function python() {
  if (pythonCache !== undefined) return pythonCache;
  for (const py of [process.env.CLONE_CUTOUT_PYTHON, "python3", "python"].filter(Boolean)) {
    const r = spawnSync(py, ["-c", "import rembg, PIL, numpy; print('ok')"], { encoding: "utf8" });
    if (r.status === 0 && /ok/.test(r.stdout)) return (pythonCache = py);
  }
  return (pythonCache = null);
}

/**
 * Isolate one photo. { ok, cutout (path under public/), grounded, why }.
 * A PERSON is isolated "grounded" (cut by the bottom edge is expected: shoulders) and stands on the frame's floor; anything else must be a whole object.
 */
export function cutoutPhoto(photo, channelId) {
  if (!photo || !photo.asset) return { ok: false, why: "no photo" };
  const src = join(RR, "public", photo.asset);
  if (!existsSync(src)) return { ok: false, why: `photo not on disk: ${photo.asset}` };
  const py = python();
  if (!py) return { ok: false, why: "rembg is not installed (CLONE_CUTOUT_PYTHON / python3 with rembg)" };
  const person = photo.kind === "person" || photo.view === "person";
  const hash = createHash("sha1").update(readFileSync(src)).digest("hex").slice(0, 16);
  const rel = `cutouts-live/${channelId}/photo-${hash}${person ? "-g" : ""}.png`;
  const out = join(RR, "public", rel);
  const sidecar = out.replace(/\.png$/, ".json");
  if (existsSync(out) && existsSync(sidecar)) {
    try { return JSON.parse(readFileSync(sidecar, "utf8")); } catch { /* re-isolate */ }
  }
  mkdirSync(dirname(out), { recursive: true });
  const args = [CUTOUT_LIB, "isolate", src, out, "--max-side", "1400", ...(person ? ["--grounded"] : [])];
  const run = (a) => {
    const r = spawnSync(py, a, { encoding: "utf8", timeout: 240000 });
    try { return JSON.parse(String(r.stdout || "").trim().split("\n").pop()); } catch { return { ok: false, why: `isolation did not answer (${r.status})` }; }
  };
  let rep = run(args), bust = false;
  // A HEAD-AND-SHOULDERS portrait is cut by the photo's bottom edge across its whole width (board 38864901359 ch-49, Chris Rock: "runs along the bottom edge for
  // 100%"). Drawn with that edge ON the video's bottom edge it is the references' bust, not a cropped object: tried again as a bust, and marked so the planner only
  // ever stands it on the floor.
  if (!rep.ok && person && /bottom edge/.test(String(rep.why || ""))) { const again = run([...args, "--bust"]); if (again.ok) { rep = again; bust = true; } }
  const res = rep.ok ? { ok: true, cutout: rel, grounded: person, bust, size: rep.size || null, why: "ok" } : { ok: false, why: rep.why || "refused" };
  try { writeFileSync(sidecar, JSON.stringify(res)); } catch { /* cache only */ }
  return res;
}

/**
 * Give every beat photo of a clone render its cut-out (photo.cutout) or mark it a vignette (photo.vignette). Mutates the beats' canvases in place and logs
 * each decision. Never throws: a photo that cannot be cut out is shown soft-edged, never boxed.
 */
export function attachCutouts(beats, channelId, log = console.log) {
  let cut = 0, soft = 0;
  const photos = [];
  for (const b of beats || []) {
    const c = b?.scene?.canvas;
    if (c?.photo) photos.push(c.photo);
    for (const x of c?.clone_extra || []) if (x && x.kind !== "logo") photos.push(x);
  }
  for (const p of photos) {
    if (!p || !p.asset || p.cutout || p.vignette) continue;
    const r = cutoutPhoto({ ...p, kind: p.kind === "person" ? "person" : p.kind }, channelId);
    if (r.ok) { p.cutout = r.cutout; p.cutout_grounded = !!r.grounded; p.cutout_bust = !!r.bust; cut++; log(`[clone] cut out ${p.entity || p.asset} -> ${r.cutout}`); }
    else { p.vignette = true; soft++; log(`[clone] ${p.entity || p.asset}: not cut out (${r.why}) -> soft-edged vignette`); }
  }
  return { cut, soft };
}
