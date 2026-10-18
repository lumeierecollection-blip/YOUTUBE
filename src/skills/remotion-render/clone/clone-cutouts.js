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
/**
 * IS THE CUT-OUT USABLE? (owner, 2026-10-18: "make sure that the photo is properly usable to cut out. If not, then as it is, it's fine, but it should look
 * good.") The geometric checks in cutout_lib.py refuse a scene, a frame-cut object or a rectangle, but they cannot see a head sliced off, a hand missing, a
 * hole through a coat or a lump of the old background left on a shoulder. A vision model looks at the cut-out flattened on white and answers USABLE or
 * BROKEN; BROKEN — or no answer at all — shows the photo AS IT IS (the soft-edged vignette / bleed treatments), never a broken cut-out. The verdict is kept in
 * the cut-out's sidecar, so a render attempt after the first does not ask again.
 */
const CHECK_PROMPT = (entity) => `This image is a photograph of ${entity ? `"${String(entity).slice(0, 80)}"` : "a subject"} cut out of its background by software, shown on white.
Is the cut-out USABLE in a video?
  USABLE — the whole subject is there (for a person: the whole head, hair and face; shoulders may end at the bottom edge), its outline is clean, and no
    piece of the old background is left attached
  BROKEN — part of the subject is cut away (a slice of the head, a missing hand or ear, a hole through it), or chunks of the old background remain,
    or the outline is ragged or blotchy
Return JSON only: {"cutout": "USABLE" | "BROKEN", "why": "short reason"}`;
const checkNorm = (a) => (a && typeof a === "object" && !a.error && ["USABLE", "BROKEN"].includes(String(a.cutout || "").toUpperCase().trim()) ? { cutout: String(a.cutout).toUpperCase().trim(), why: String(a.why || "").slice(0, 140) } : null);
async function cutoutUsable(rel, entity) {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const { askProviders, imageDataUrl } = req("../../../../scripts/verify-cutout-image.cjs");
  const messages = [{ role: "user", content: [{ type: "text", text: CHECK_PROMPT(entity) }, { type: "image_url", image_url: { url: await imageDataUrl(join(RR, "public", rel)) } }] }];
  try {
    const r = await askProviders(messages, checkNorm);
    return r && r.v ? { ok: r.v.cutout === "USABLE", why: r.v.why, provider: r.provider } : { ok: false, why: "no vision provider answered", provider: null };
  } catch (e) { return { ok: false, why: `check failed: ${e.message}`, provider: null }; }
}

/** attachCutouts + the vision check above on every cut-out it made. Async; render.js awaits it. */
export async function attachCutoutsChecked(beats, channelId, log = console.log, check = cutoutUsable) {
  const res = attachCutouts(beats, channelId, log);
  const photos = [];
  for (const b of beats || []) {
    const c = b?.scene?.canvas;
    if (c?.photo) photos.push(c.photo);
    for (const x of c?.clone_extra || []) if (x && x.kind !== "logo") photos.push(x);
  }
  const seen = new Map();   // one check per cut-out file
  for (const p of photos) {
    if (!p || !p.cutout) continue;
    const sidecar = join(RR, "public", p.cutout.replace(/\.png$/, ".json"));
    let side = null;
    try { side = JSON.parse(readFileSync(sidecar, "utf8")); } catch { /* no sidecar */ }
    let v = seen.get(p.cutout) || (side && side.check) || null;
    if (!v) {
      v = await check(p.cutout, p.entity || p.name || null);
      try { if (side) writeFileSync(sidecar, JSON.stringify({ ...side, check: v })); } catch { /* cache only */ }
    }
    seen.set(p.cutout, v);
    if (v.ok) continue;
    log(`[clone] ${p.entity || p.asset}: cut-out ${p.cutout} not usable (${v.why}) -> the photo as it is`);
    delete p.cutout; delete p.cutout_grounded; delete p.cutout_bust;
    p.vignette = true;
    res.cut--; res.soft++;
  }
  return res;
}

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
