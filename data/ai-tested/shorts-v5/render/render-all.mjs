import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname);
const plansDir = path.resolve(root, "../plans");
const scriptsDir = path.resolve(root, "../scripts");
const audioDir = path.resolve(root, "../audio");
const assetsDir = path.resolve(root, "../assets");
const outDir = path.resolve(root, "../out");
const publicDir = path.resolve(root, "public");
for (const d of ["audio", "logos", "photos", "sfx"]) fs.mkdirSync(path.join(publicDir, d), { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); }
    else fs.copyFileSync(s, d);
  }
}
copyDir(audioDir, path.join(publicDir, "audio"));
copyDir(path.join(assetsDir, "logos"), path.join(publicDir, "logos"));
copyDir(path.join(assetsDir, "photos"), path.join(publicDir, "photos"));
copyDir(path.join(assetsDir, "sfx"), path.join(publicDir, "sfx"));

const sfxDir = path.join(publicDir, "sfx");
const sfxFiles = fs.existsSync(sfxDir) ? fs.readdirSync(sfxDir).filter(f => /\.(ogg|mp3|wav)$/i.test(f)) : [];
const sfxByBase = new Map();
for (const f of sfxFiles) sfxByBase.set(f.replace(/\.(ogg|mp3|wav)$/i, "").toLowerCase(), `sfx/${f}`);
function resolveSfxRef(v) {
  if (!v || typeof v !== "string") return null;
  if (/^(https?:|data:)/.test(v)) return v;
  let p = v.replace(/^\/+/, "");
  // music refs that don't exist - drop; music/ is not a real dir
  if (p.startsWith("music/")) {
    const mbase = p.slice(6).replace(/\.(ogg|mp3|wav)$/i, "").toLowerCase();
    if (sfxByBase.has(mbase)) return sfxByBase.get(mbase);
    return null;
  }
  if (!p.startsWith("sfx/")) return p;
  const name = p.slice(4);
  const base = name.replace(/\.(ogg|mp3|wav)$/i, "").toLowerCase();
  if (sfxByBase.has(base)) return sfxByBase.get(base);
  const alias = { hit:"hit", impact:"impact", boom:"impact", thump:"thud", whoosh:"whoosh", swoosh:"whoosh", riser:"riser", tension:"riser", glitch:"glitch", digital:"glitch", click:"click", tick:"tick", bell:"bell", chime:"bell", reveal:"reveal", pop:"reveal", confirm:"confirm", success:"confirm", error:"error", alert:"error", switch:"switch", drop:"drop", sweep:"sweep" };
  for (const [k, val] of Object.entries(alias)) { if (base.includes(k) && sfxByBase.has(val)) return sfxByBase.get(val); }
  return sfxFiles.length ? `sfx/${sfxFiles[0]}` : null;
}

const knownLogos = new Set(["openai","google","meta","anthropic","nvidia","huggingface","spacex","claude","gemini"]);
function publicExists(rel) {
  if (!rel || typeof rel !== "string") return false;
  if (/^(https?:|data:)/.test(rel)) return true;
  return fs.existsSync(path.join(publicDir, rel.replace(/^\/+/, "")));
}
function sanitizeAssetRef(v) {
  if (v && typeof v === "object") {
    const raw = v.a || v.file || v.src || v.name || v.logo || "";
    const clean = typeof raw === "string" ? raw.replace(/^\/+/, "") : "";
    const base = clean.replace(/^logos\//, "").replace(/^photos\//, "").replace(/\.(svg|png|jpg|jpeg|webp)$/i, "").replace(/-logo$/, "").replace(/_logo$/, "").replace(/-white$/, "");
    let resolved = "";
    if (knownLogos.has(base)) resolved = base;
    else if (clean.includes("/") && publicExists(clean)) resolved = clean;
    else if (publicExists(`logos/${clean}`)) resolved = `logos/${clean}`;
    else if (publicExists(`photos/${clean}`)) resolved = `photos/${clean}`;
    if (!resolved) return "";
    const out = { ...v };
    if (out.a) out.a = resolved; else if (out.file) out.file = resolved; else if (out.src) out.src = resolved; else if (out.name) out.name = resolved; else out.a = resolved;
    return out;
  }
  if (!v || typeof v !== "string") return "";
  const clean = v.replace(/^\/+/, "");
  const base = clean.replace(/^logos\//, "").replace(/^photos\//, "").replace(/\.(svg|png|jpg|jpeg|webp)$/i, "").replace(/-logo$/, "").replace(/_logo$/, "").replace(/-white$/, "");
  if (knownLogos.has(base)) return base; // renderer resolves to logos/<base>-white.svg
  // if it's a path to an existing public file, keep it
  if (clean.includes("/") && publicExists(clean)) return clean;
  if (publicExists(`logos/${clean}`)) return `logos/${clean}`;
  if (publicExists(`photos/${clean}`)) return `photos/${clean}`;
  return ""; // drop missing/unknown assets to avoid render crash
}
function sanitizePhotoRef(v) {
  if (!v || typeof v !== "string") return null;
  const clean = v.replace(/^\/+/, "").replace(/^photos\//, "");
  const base = clean.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "").replace(/-logo$/, "").replace(/_logo$/, "");
  if (knownLogos.has(base)) return { kind: "logo", value: base };
  if (publicExists(`photos/${clean}`)) return { kind: "photo", value: clean };
  if (publicExists(clean)) return { kind: "photo", value: clean };
  return null;
}
function sanitizePlan(plan) {
  for (const b of plan.beats || []) {
    if (Array.isArray(b.assets)) b.assets = b.assets.map(sanitizeAssetRef).filter(Boolean);
    if (b.photo && typeof b.photo === "string") {
      const pr = sanitizePhotoRef(b.photo);
      if (!pr) { delete b.photo; }
      else if (pr.kind === "logo") { b.assets = Array.from(new Set([...(b.assets||[]), pr.value])); delete b.photo; }
      else { b.photo = pr.value; }
    }
    // also sanitize bg_image if present
    if (b.bg_image && typeof b.bg_image === "string") {
      const bg = b.bg_image.replace(/^\/+/, "");
      if (!publicExists(bg) && !publicExists(`photos/${bg}`)) delete b.bg_image;
      else if (!bg.includes("/") && publicExists(`photos/${bg}`)) b.bg_image = `photos/${bg}`;
    }
    if (Array.isArray(b.sfx)) b.sfx = b.sfx.map(s => typeof s === "string" ? resolveSfxRef(s) : s).filter(Boolean);
  }
  if (plan.audio && Array.isArray(plan.audio.sfx)) {
    plan.audio.sfx = plan.audio.sfx.map(s => ({ ...s, src: resolveSfxRef(s?.src) })).filter(s => s.src);
  }
  if (plan.audio?.music?.src) {
    const m = resolveSfxRef(plan.audio.music.src);
    if (m) plan.audio.music.src = m; else delete plan.audio.music;
  }
  if (Array.isArray(plan.asset_manifest)) {
    plan.asset_manifest = plan.asset_manifest.map(a => {
      if (!a || typeof a !== "object") return a;
      const f = String(a.file || "");
      const clean = f.replace(/^\/+/, "");
      const ok = knownLogos.has(clean.replace(/\.(svg|png|jpg|jpeg|webp)$/i, "").replace(/-logo$/,"").replace(/_logo$/,"")) || publicExists(clean) || publicExists(`logos/${clean}`) || publicExists(`photos/${clean}`) || publicExists(`sfx/${clean}`);
      return { ...a, status: ok ? (a.status || "ready") : "missing" };
    });
  }
  return plan;
}

const files = fs.readdirSync(plansDir).filter(f => f.endsWith(".plan.json")).sort();
const failures = [];
for (const f of files) {
  const plan = sanitizePlan(JSON.parse(fs.readFileSync(path.join(plansDir, f), "utf8").replace(/^\uFEFF/, "")));
  const id = plan.id;
  const audioPath = path.join(audioDir, `${id}.mp3`);
  let dur = plan.beats.reduce((a, b) => a + (Number(b.dur) || 0), 0) || 30;
  if (fs.existsSync(audioPath)) {
    try {
      const out = execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1", audioPath], { encoding: "utf8" }).trim();
      const d = parseFloat(out);
      if (Number.isFinite(d) && d > 5) dur = d;
    } catch {}
  }
  const planned = plan.beats.reduce((a,b)=>a+(Number(b.dur)||0),0) || dur;
  const scale = dur / planned;
  let cursor = 0;
  plan.beats = plan.beats.map((b) => {
    const sd = Math.max(0.8, (Number(b.dur) || 2) * scale);
    const t = cursor; cursor += sd;
    return { ...b, t: +t.toFixed(3), dur: +sd.toFixed(3) };
  });
  if (plan.beats.length) {
    const last = plan.beats[plan.beats.length - 1];
    const end = last.t + last.dur;
    if (end < dur) last.dur = +(dur - last.t + 0.2).toFixed(3);
  }
  plan.duration_target_sec = dur;
  const props = JSON.stringify({ plan, audioSrc: `audio/${id}.mp3`, audioDurationSec: dur });
  const outFile = path.join(outDir, `${id}-${plan.slug}.mp4`);
  const tmpFile = path.join(outDir, `.${id}-${plan.slug}.tmp.mp4`);
  console.log(`Rendering ${id} -> ${outFile} (dur=${dur}s)`);
  try {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    execFileSync("npx", ["remotion", "render", "src/index.ts", `Short-${id}`, tmpFile, "--props", props, "--codec=h264", "--crf=18", "--audio-bitrate=192k"], {
      cwd: root, stdio: "inherit", shell: process.platform === "win32"
    });
    fs.renameSync(tmpFile, outFile);
  } catch (e) {
    console.error(`RENDER FAILED ${id}:`, e?.message || e);
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
    failures.push({ id, slug: plan.slug, error: String(e?.message || e).slice(0, 500) });
  }
}
if (failures.length) {
  fs.writeFileSync(path.join(outDir, "RENDER_FAILURES.json"), JSON.stringify(failures, null, 2));
  console.error("Some renders failed:", failures.map(f=>f.id).join(","));
  process.exit(1);
}
console.log("All renders complete");
