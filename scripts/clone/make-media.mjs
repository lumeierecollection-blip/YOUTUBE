// Builds an episode's real moving media on GitHub (keys are secrets there), so the render has what the reference's main visual type needs:
//   ai:      real model runs, screen-recorded (scripts/clone/demo-record.mjs) -> <name>-chat.mp4 and <name>-app.mp4 + the full run log
//   pixabay: real stock footage by Pixabay id, trimmed (Pixabay Content License) -> <name>.mp4 + licence line
// Spec: data/clone/media/<slug>.json  { "channel": "...", "ai": [ {name, provider, prompt, app_seconds} ], "pixabay": [ {name, id, start, dur} ] }
// Output: src/skills/remotion-render/public/lf2/<channel>/clips/<slug>/ and data/clone/runs/<slug>/ (run logs = the information source for scripts).
// Usage: node scripts/clone/make-media.mjs <slug> [only-name ...]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [slug, ...only] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(`data/clone/media/${slug}.json`, "utf8"));
const out = `src/skills/remotion-render/public/lf2/${spec.channel}/clips/${slug}`;
const logs = `data/clone/runs/${slug}`;
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(logs, { recursive: true });
const want = (n) => !only.length || only.includes(n);
const ff = (...a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a], { stdio: "inherit" });
const toMp4 = (i, o, extra = []) => ff("-i", i, ...extra, "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1", "-an", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", o);
const failures = [];

for (const j of spec.ai || []) {
  if (!want(j.name)) continue;
  const tmp = `/tmp/ai-${j.name}`; fs.rmSync(tmp, { recursive: true, force: true });
  fs.writeFileSync(`${tmp}.json`, JSON.stringify(j));
  try { execFileSync("node", ["scripts/clone/demo-record.mjs", `${tmp}.json`, tmp], { stdio: "inherit", timeout: 600000 }); }
  catch { failures.push(j.name); if (fs.existsSync(`${tmp}/models.json`)) console.log("available", j.provider, fs.readFileSync(`${tmp}/models.json`, "utf8").replace(/\s+/g, " ")); continue; }
  const run = JSON.parse(fs.readFileSync(`${tmp}/run.json`, "utf8"));
  run.app_recorded = fs.existsSync(`${tmp}/app.webm`);
  fs.writeFileSync(`${logs}/${j.name}.json`, JSON.stringify(run, null, 1));
  if (fs.existsSync(`${tmp}/app.html`)) fs.copyFileSync(`${tmp}/app.html`, `${logs}/${j.name}-app.html`);
  toMp4(`${tmp}/chat.webm`, `${out}/${j.name}-chat.mp4`);
  if (run.app_recorded) toMp4(`${tmp}/app.webm`, `${out}/${j.name}-app.mp4`);
  console.log("ai", j.name, run.provider, run.model, run.generation_ms + "ms", "app", run.app_recorded);
}

const lic = [];
for (const p of spec.pixabay || []) {
  if (!want(p.name)) continue;
  // by id, or by query + pick (index after dropping AI-generated/animated clips)
  const q = p.id ? `id=${p.id}` : `q=${encodeURIComponent(p.query)}&per_page=20&safesearch=true&order=popular`;
  const r = await fetch(`https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&${q}`);
  const hits = r.ok ? (await r.json()).hits.filter((x) => !/ai generated|animation|3d|green screen/i.test(x.tags)) : [];
  const h = hits[p.pick || 0];
  if (h) p.id = h.id;
  if (!h) { failures.push(p.name); continue; }
  const v = h.videos.large?.url ? h.videos.large : h.videos.medium;
  const raw = `/tmp/px-${p.id}.mp4`;
  fs.writeFileSync(raw, Buffer.from(await (await fetch(v.url)).arrayBuffer()));
  toMp4(raw, `${out}/${p.name}.mp4`, ["-ss", String(p.start || 0), "-t", String(p.dur || 6)]);
  lic.push({ name: p.name, file: `${p.name}.mp4`, pixabay_id: p.id, page: h.pageURL, user: h.user, tags: h.tags, licence: "Pixabay Content License" });
  console.log("px", p.name, p.id, h.tags);
}
if (lic.length) {
  const f = `${out}/FOOTAGE.json`;
  const old = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).filter((x) => !lic.some((l) => l.name === x.name)) : [];
  fs.writeFileSync(f, JSON.stringify([...old, ...lic], null, 1));
}
if (failures.length) console.log("FAILED:", failures.join(", "));
