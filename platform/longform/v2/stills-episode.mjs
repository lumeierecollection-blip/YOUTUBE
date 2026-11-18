#!/usr/bin/env node
/** Local visual check: renders stills of an episode's scenes (no timeline). Usage: node platform/longform/v2/stills-episode.mjs <slug> <outDir> <beatId@frame>... ("thumb" names also work: thumb1-crowd@0)
 * Missing footage files are dropped like render-episode does; the voice is not needed. Run from the repo root. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
const [slug, outDir, ...picks] = process.argv.slice(2);
const ch = slug.startsWith("hidden-past") ? "hidden-past" : slug.startsWith("ai-tested") ? "ai-tested" : "rival-lines";
const THEMES = JSON.parse(readFileSync(join(ROOT, "config/longform-v2.json"), "utf8")), PUB = join(ROOT, "src/skills/remotion-render/public");
const { EPISODE: ep } = await import(`./episodes/${slug}.mjs`);
const have = (m) => !(m.video && !existsSync(join(PUB, m.video))) && !(m.image && !existsSync(join(PUB, m.image)));
const shots = picks.map((p) => {
  const [id, fr] = p.split("@"), b = ep.beats.find((x) => x.id === id), th = (ep.thumbs || []).find((x) => x.name === id);
  const scene = b ? b.scene : { type: "thumb", ...th };
  const props = { ch, t: THEMES[ch], ...scene };
  if (props.cutaways) props.cutaways = props.cutaways.filter(have);
  if (props.shots) props.shots = props.shots.filter(have);
  return { name: `${id}-f${fr || 0}`, id: "LF2Scene", props, frame: Number(fr || 0), scale: 0.5, durationInFrames: 1800 };
});
mkdirSync(outDir, { recursive: true });
const job = join(outDir, "job.json"); writeFileSync(job, JSON.stringify({ outDir, shots }));
process.exit(spawnSync("node", ["render-stills.mjs", job], { cwd: join(ROOT, "src/skills/remotion-render"), stdio: "inherit", timeout: 20 * 60e3 }).status);
