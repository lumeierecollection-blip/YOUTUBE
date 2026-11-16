#!/usr/bin/env node
/**
 * Short licensed clips for a long-form episode (never whole videos): the episode exports FOOTAGE = [{ id, q, pick? }]. For each entry this searches Pixabay videos
 * (Pixabay Content License: free commercial use, no attribution required; id, page, uploader and licence are still recorded), skips AI-generated / animation / 3D / green
 * screen results, downloads the medium rendition, trims it to at most MAXS seconds, scales to 1280x720, removes the audio, and writes public/lf2/footage/<id>.mp4.
 * Clips are generic and are always labelled "illustrative" on screen: they are never presented as the event being discussed.
 * Usage: PIXABAY_API_KEY=... node platform/longform/v2/fetch-footage.mjs <episode-slug>
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";

const slug = process.argv[2], KEY = process.env.PIXABAY_API_KEY, MAXS = Number(process.env.FOOTAGE_MAX_S || 9);
if (!KEY) { console.error("PIXABAY_API_KEY missing"); process.exit(1); }
const { FOOTAGE } = await import(`./episodes/${slug}.mjs`);
if (!FOOTAGE?.length) { console.log("no FOOTAGE list in", slug); process.exit(0); }
const ch = slug.startsWith("hidden-past") ? "hidden-past" : slug.startsWith("rival-lines") ? "rival-lines" : slug;
const OUT = join(ROOT, "src/skills/remotion-render/public/lf2/footage"), TMP = join(ROOT, "output/footage-tmp");
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
const BAD = /ai generated|ai-generated|animation|3d|green screen|cartoon|render/i;
const manifest = [];
for (const f of FOOTAGE) {
  const dest = join(OUT, `${f.id}.mp4`);
  let hits = [];
  for (const q of [f.q, ...(f.alt || [])]) {
    const r = await fetch(`https://pixabay.com/api/videos/?key=${KEY}&q=${encodeURIComponent(q)}&per_page=20&safesearch=true&order=popular`);
    if (!r.ok) { console.log("search failed", q, r.status); continue; }
    hits = (await r.json()).hits.filter((h) => !BAD.test(h.tags) && h.duration >= 5 && (h.videos.medium?.url || h.videos.small?.url));
    if (hits.length) break;
  }
  if (!hits.length) throw new Error(`no usable Pixabay clip for ${f.id} (${f.q})`);
  const h = hits[Math.min(f.pick || 0, hits.length - 1)], v = h.videos.medium?.url ? h.videos.medium : h.videos.small;
  const raw = join(TMP, `${f.id}.src.mp4`), d = await fetch(v.url);
  if (!d.ok) throw new Error(`download failed for ${f.id}: ${d.status}`);
  writeFileSync(raw, Buffer.from(await d.arrayBuffer()));
  const ss = f.ss || 0, len = Math.min(MAXS, Math.max(3, h.duration - ss));
  const x = spawnSync("ffmpeg", ["-y", "-v", "error", "-ss", String(ss), "-i", raw, "-t", String(len), "-an", "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30", "-c:v", "libx264", "-crf", "24", "-preset", "veryfast", "-pix_fmt", "yuv420p", dest], { encoding: "utf8" });
  if (x.status !== 0 || !existsSync(dest)) throw new Error(`ffmpeg failed for ${f.id}: ${x.stderr}`);
  rmSync(raw, { force: true });
  manifest.push({ id: f.id, file: `lf2/footage/${f.id}.mp4`, query: f.q, seconds: +len.toFixed(1), pixabay_id: h.id, page: h.pageURL, uploader: h.user, tags: h.tags, licence: "Pixabay Content License (free commercial use, no attribution required)", label: "illustrative footage", episode: slug, channel: ch });
  console.log(f.id, "<-", h.pageURL, h.tags);
}
writeFileSync(join(OUT, `footage-${slug}.json`), JSON.stringify(manifest, null, 1));
