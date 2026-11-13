#!/usr/bin/env node
/**
 * Long-form thumbnails: renders the three thumbnail concepts of the episode storyboard (platform/longform/v2/episodes/<channel>.mjs `thumbs`) with the real
 * LF2 thumbnail component and exports 1280x720 JPEGs (YouTube's size, under 2 MB). thumb-1 is the primary; 2 and 3 are alternates for A/B tests.
 * Usage: node platform/longform/v2/make-thumbs.mjs <channel>.  Output: output/longform-prod/<channel>/thumbnails/
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { SPECS } from "../stills/specs.mjs";

const slug = process.argv[2], ch = slug.startsWith("hidden-past") ? "hidden-past" : slug.startsWith("ai-tested") ? "ai-tested" : slug;
const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const REMOTION = join(ROOT, "src/skills/remotion-render"), OUT = join(ROOT, "output/longform-prod", slug, "thumbnails"), RAW = join(OUT, "raw");
mkdirSync(RAW, { recursive: true });
const spec = await SPECS[ch](slug);
const shots = spec.shots.filter((s) => s.group === "thumbs");
const job = join(OUT, "job.json");
writeFileSync(job, JSON.stringify({ outDir: RAW, shots: shots.map((s) => ({ name: s.name, id: s.id, props: s.props, frame: 0, scale: 1, durationInFrames: 1 })) }));
const r = spawnSync("node", ["render-stills.mjs", job], { cwd: REMOTION, stdio: "inherit", timeout: 20 * 60e3 });
if (r.status !== 0) { console.error("thumbnail render failed"); process.exit(1); }
const done = [];
for (const [i, s] of shots.entries()) {
  const out = join(OUT, `thumbnail-${i + 1}-${s.name.replace(/^thumb\d?-?/, "")}.jpg`);
  await sharp(join(RAW, `${s.name}.png`)).resize(1280, 720).jpeg({ quality: 90 }).toFile(out);
  done.push({ file: out, bytes: statSync(out).size, primary: i === 0 });
}
writeFileSync(join(OUT, "thumbnails.json"), JSON.stringify(done, null, 2));
console.log(done.map((d) => `${d.file} ${d.bytes}`).join("\n"));
