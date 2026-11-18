#!/usr/bin/env node
/**
 * Renders an SX Short (props: output/sx/<slug>/props.json) with Remotion, in shards on GitHub.
 *   node platform/shorts-sx/render.mjs <slug> --shard i/n   -> output/sx/<slug>/parts/part-<i>.mp4 (frames [i*F/n, (i+1)*F/n))
 *   node platform/shorts-sx/render.mjs <slug> --join         -> output/sx/<slug>/short.mp4 (parts concatenated + the narration, -14 LUFS)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), REMOTION = join(ROOT, "src/skills/remotion-render");
const slug = process.argv[2], OUT = join(ROOT, "output/sx", slug), PARTS = join(OUT, "parts"); mkdirSync(PARTS, { recursive: true });
const props = JSON.parse(readFileSync(join(OUT, "props.json"), "utf8"));
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : null; };

if (process.argv.includes("--join")) {
  const parts = readdirSync(PARTS).filter((f) => /^part-\d+\.mp4$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
  writeFileSync(join(PARTS, "list.txt"), parts.map((f) => `file '${join(PARTS, f).replace(/\\/g, "/")}'`).join("\n"));
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(PARTS, "list.txt"), "-i", join(OUT, "voice.mp3"), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", join(OUT, "short.mp4")], { stdio: "inherit" });
  console.log(`joined ${parts.length} parts -> ${join(OUT, "short.mp4")}`); process.exit(r.status);
}
const [si, sn] = (arg("shard") || "0/1").split("/").map(Number), F = props.frames, a = Math.floor((si * F) / sn), b = Math.floor(((si + 1) * F) / sn) - 1;
const req = createRequire(join(REMOTION, "package.json")), imp = (m) => import(pathToFileURL(req.resolve(m)).href);
const { bundle } = await imp("@remotion/bundler"), { renderMedia, selectComposition } = await imp("@remotion/renderer");
const { findChrome } = await import(pathToFileURL(join(REMOTION, "find-chrome.js")).href), chrome = findChrome();
const serveUrl = await bundle({ entryPoint: join(REMOTION, "Root.jsx"), publicDir: join(REMOTION, "public"), onProgress: () => {} });
const composition = await selectComposition({ serveUrl, id: "SX", inputProps: props, timeoutInMilliseconds: 180000, ...(chrome ? { browserExecutable: chrome } : {}) });
composition.durationInFrames = F;
await renderMedia({ composition, serveUrl, codec: "h264", inputProps: props, frameRange: [a, b], outputLocation: join(PARTS, `part-${si}.mp4`), crf: 16, pixelFormat: "yuv420p", concurrency: 2, timeoutInMilliseconds: 180000, chromiumOptions: { gl: "swangle" }, ...(chrome ? { browserExecutable: chrome } : {}) });
console.log(`shard ${si}/${sn}: frames ${a}-${b} -> part-${si}.mp4`);
