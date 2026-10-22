// node scripts/direction/brief-cli.mjs --script S --research R --plan P --manifest M --channel <id|file.json> [--reference-direction D] --out DIR
// Writes <stem>-scene-briefs.json and .md. Also exports locateInputs() for the advisory hook.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSceneBriefs, briefsToMarkdown } from "./scene-brief.mjs";
import { resolveChannel } from "../lib/channel-lookup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

export function loadChannel(arg) {
  if (existsSync(arg)) return readJson(arg);
  // The shared lookup (config ids are duplicated for legacy rows; the guard test
  // channel-lookup forbids id-first matching).
  try { return resolveChannel(String(arg)); } catch { return null; }
}

// Mirrors render-and-qa.js: video = data/renders/<ch>/<scriptStem minus -script>-<format>-<date>.mp4 (expectedOutputPath, :277-281);
// plan = data/visual-plans/<ch>/<scriptStem>-visual-plan.json (:308); research = data/research/<ch>/<topic_slug>.json (script.topic_slug).
// Returns { paths } or { skip: reason } -- never guesses.
export function locateInputs(videoPath, root = ROOT) {
  const m = /^(.+)-(shorts|longform)-\d{4}-\d{2}-\d{2}\.mp4$/.exec(basename(videoPath));
  if (!m) return { skip: `video name ${basename(videoPath)} does not match <slug>-<format>-<date>.mp4` };
  const ch = basename(dirname(videoPath));
  const manifest = videoPath.replace(/\.mp4$/, "-manifest.json");
  const script = join(root, "data", "research", ch, `${m[1]}-script.json`);
  const plan = join(root, "data", "visual-plans", ch, `${m[1]}-script-visual-plan.json`);
  for (const [k, p] of Object.entries({ manifest, script, plan })) if (!existsSync(p)) return { skip: `${k} not found at ${p}` };
  let research = null;
  try { research = join(root, "data", "research", ch, `${readJson(script).topic_slug}.json`); } catch (e) { return { skip: `script unreadable: ${e.message}` }; }
  if (!existsSync(research)) return { skip: `research not found at ${research}` };
  return { paths: { manifest, script, plan, research }, channelId: ch };
}

export function writeBriefs(briefs, outDir, stem) {
  mkdirSync(outDir, { recursive: true });
  const j = join(outDir, `${stem}-scene-briefs.json`), md = join(outDir, `${stem}-scene-briefs.md`);
  writeFileSync(j, JSON.stringify(briefs, null, 2) + "\n");
  writeFileSync(md, briefsToMarkdown(briefs, stem));
  return { json: j, md };
}

function main() {
  const a = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) a[argv[i].replace(/^--/, "")] = argv[i + 1];
  for (const k of ["script", "research", "plan", "manifest", "channel", "out"]) if (!a[k]) { console.error(`missing --${k}`); process.exit(2); }
  const manifest = readJson(a.manifest);
  const briefs = buildSceneBriefs({
    script: readJson(a.script), research: readJson(a.research), plan: readJson(a.plan), manifest,
    channel: loadChannel(a.channel), grammar: readJson(join(ROOT, "config", "clone-grammar.json")),
    referenceDirection: a["reference-direction"] ? readJson(a["reference-direction"]) : null,
  });
  const stem = String(manifest.video || basename(a.manifest, "-manifest.json")).replace(/\.mp4$/, "");
  const w = writeBriefs(briefs, resolve(a.out), stem);
  console.log(`${briefs.length} scene briefs -> ${w.json}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
