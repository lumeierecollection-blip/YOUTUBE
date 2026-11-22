// Court & Spotlight living-collage previews (investigation case board, Grammy magazine feature). Voice only: no music.
// Real Commons photographs with licences enforced; cut-outs by rembg; shared Short path for voice, timing, render and QA.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsAsset, dataUri } from "../../production/commons.mjs";
import { STORIES } from "./collage-stories.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../..");
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const py = process.platform === "win32" ? "python" : "python3";

export default async function collagePreview({ key, runId, tools }) {
  const branch = process.env.GITHUB_REF_NAME || "";
  const name = /grammy/.test(branch) ? "grammy" : "investigation";
  const s = STORIES[name];
  tools.write("story-blueprint.json", { ...s.blueprint, format: `collage_${name}` });
  const images = {}, credits = {}, dates = {}, entries = [];
  for (const a of s.ASSETS) {
    const { file, entry } = await commonsAsset({ title: a.title, dir: join(tools.outDir, "assets"), id: a.id, claim: a.claim, role: a.id });
    let used = file;
    if (a.cutout) {
      const cut = join(tools.outDir, "assets", `${a.id}-cutout.png`);
      const args = [join(ROOT, "platform/production/cutout.py"), file, cut, "--seed", String(a.cutout.seed || 1), ...(a.cutout.paper ? ["--paper", String(a.cutout.paper)] : []), ...(a.cutout.bw ? ["--bw"] : [])];
      const r = spawnSync(py, args, { encoding: "utf8", timeout: 900000 });
      if (r.status !== 0) throw new Error(`cut-out failed for ${a.id}: ${String(r.stderr).split("\n").slice(-5).join(" ").slice(0, 400)}`);
      used = cut;
      entry.treatment = `photographic cut-out (rembg)${a.cutout.paper ? ", torn-paper edge" : ""}${a.cutout.bw ? ", monochrome" : ""}; no pixel of the subject is generated.`;
    }
    images[a.key] = await dataUri(used);
    credits[a.key] = entry.credit_line;
    dates[a.key] = (entry.date_taken.match(/[0-9]{4}/) || [""])[0];
    entries.push(entry);
  }
  tools.write("asset-manifest.json", { note: "Every photograph is a real Wikimedia Commons file with its licence recorded. Paper, tape, stamps and type are drawn by the renderer. Nothing is AI-generated.", assets: entries });
  const result = await runFixedShort({ key, runId, tools, spec: { topic: s.topic, claims: s.claims, sources: s.sources, sentences: s.sentences, scenes: s.scenes, compositionId: s.composition, edgeVoice: channel.voice.tts, style: channel.voice.style, metadata: s.metadata, minSeconds: 20, makeProps: () => ({ images, credits, dates }) } });
  tools.write("quality-report.json", { format: `collage_${name}`, technical: result.qa });
}
