// Renders a Rival Lines episode. usage: node render.mjs <episode_dir>
// MODE=stills  one PNG per scene (late in the scene, when everything has appeared) plus a contact sheet
// MODE=full    the whole video with the narration, to out/video-raw.mp4
// MODE=thumbs one 1280x720 PNG per variant in <episode>/thumbnails.json, to out/thumbs/
// MODE=chunk   CHUNK=i CHUNKS=n, silent frame range i of n, to out/chunks/chunk-i.mp4
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderStill, renderMedia, selectComposition } from "@remotion/renderer";

const ep = path.resolve(process.argv[2]);
const mode = process.env.MODE || "stills";
const out = path.join(ep, "out");
const props = JSON.parse(fs.readFileSync(path.join(out, "props.json"), "utf8"));
const fps = props.fps;
const realm = props.format === "realm";

const serveUrl = await bundle({ entryPoint: path.resolve(import.meta.dirname, "src", "index.ts"), publicDir: path.resolve(import.meta.dirname, "public") });
const comp = await selectComposition({ serveUrl, id: realm ? "RealmEpisode" : "Episode", inputProps: props });
console.log(`composition ${comp.width}x${comp.height}, ${comp.durationInFrames} frames at ${comp.fps}`);

if (mode === "stills") {
  const dir = path.join(out, "stills");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, s] of props.scenes.entries()) {
    const t = Math.min(s.t1 - 0.2, s.t0 + Math.max(6, (s.t1 - s.t0) * 0.92));
    const frame = Math.min(comp.durationInFrames - 1, Math.round(t * fps));
    await renderStill({ composition: comp, serveUrl, output: path.join(dir, `s${String(i + 1).padStart(2, "0")}_${s.id}.png`), inputProps: props, frame, imageFormat: "png" });
  }
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-pattern_type", "glob", "-i", path.join(dir, "s*.png"), "-vf", "scale=480:270,tile=6x6:padding=6:color=white", "-frames:v", "1", path.join(out, "contact.png")]);
  console.log(`stills: ${props.scenes.length}`);
} else if (mode === "full") {
  await renderMedia({ composition: comp, serveUrl, codec: "h264", crf: 18, pixelFormat: "yuv420p", audioBitrate: "192k", outputLocation: path.join(out, "video-raw.mp4"), inputProps: props, onProgress: (p) => { if (p.renderedFrames % 600 === 0) console.log(`frame ${p.renderedFrames}/${comp.durationInFrames}`); } });
} else if (mode === "thumbs") {
  const specs = JSON.parse(fs.readFileSync(path.join(ep, "thumbnails.json"), "utf8")).variants;
  const dir = path.join(out, "thumbs");
  fs.mkdirSync(dir, { recursive: true });
  if (realm) {
    for (const v of specs) {
      const tprops = { ...props, thumb: v };
      const tc = await selectComposition({ serveUrl, id: "RealmThumb", inputProps: tprops });
      await renderStill({ composition: tc, serveUrl, output: path.join(dir, `thumb-${v.id}.png`), inputProps: tprops, frame: 0, imageFormat: "png" });
      console.log(`thumb ${v.id}`);
    }
  } else {
    const w = props.data.results.wikipedia;
    const dateText = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const dayMonth = (iso) => new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    const fill = (t) => t.replace("{median}", dateText(w.scenarios.hold.median_date)).replace("{needed}", String(w.needed)).replace("{official}", String(props.data.totals.official_goals)).replace("{rev}", dayMonth(props.data.baseline.revision_timestamp));
    for (const v of specs) {
      if (!fs.existsSync(path.join(import.meta.dirname, "public", "ep", "images", `cutout-${v.img}.png`))) throw new Error(`cutout-${v.img}.png missing: run scripts/cutout.py first`);
      const thumb = { ...v, note: fill(v.note) };
      const tprops = { ...props, thumb };
      const tc = await selectComposition({ serveUrl, id: "Thumb", inputProps: tprops });
      await renderStill({ composition: tc, serveUrl, output: path.join(dir, `thumb-${v.id}.png`), inputProps: tprops, frame: 0, imageFormat: "png" });
      console.log(`thumb ${v.id}: ${thumb.note}`);
    }
  }
} else if (mode === "chunk") {
  const n = Number(process.env.CHUNKS), i = Number(process.env.CHUNK);
  const per = Math.ceil(comp.durationInFrames / n);
  const a = i * per, b = Math.min(comp.durationInFrames - 1, a + per - 1);
  fs.mkdirSync(path.join(out, "chunks"), { recursive: true });
  await renderMedia({ composition: comp, serveUrl, codec: "h264", crf: 18, pixelFormat: "yuv420p", muted: true, frameRange: [a, b], outputLocation: path.join(out, "chunks", `chunk-${i}.mp4`), inputProps: props });
  console.log(`chunk ${i}: frames ${a}-${b}`);
}
