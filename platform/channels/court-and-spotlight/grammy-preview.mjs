// Court & Spotlight, Grammy explainer in the "printed, not lit" look. Real Commons photographs (licences enforced), cut-outs with rembg,
// halftone ink bake adapted from Cele-san/vox-style-animation (MIT), original music, shared Short path.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsAsset, dataUri } from "../../production/commons.mjs";
import * as story from "./grammy-pack.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../..");
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const py = process.platform === "win32" ? "python" : "python3";
const run = (args) => { const r = spawnSync(py, args, { encoding: "utf8", timeout: 900000 }); if (r.status !== 0) throw new Error(`${args[0]} failed: ${String(r.stderr).split("\n").slice(-6).join(" ").slice(0, 500)}`); };

export default async function grammyPreview({ key, runId, tools }) {
  tools.write("story-blueprint.json", { ...story.blueprint, format: "vox_pack_explainer" });
  const images = {}, credits = {}, dates = {}, entries = [];
  for (const a of story.ASSETS) {
    const { file, entry } = await commonsAsset({ title: a.title, dir: join(tools.outDir, "assets"), id: a.id, claim: a.claim, role: a.role });
    let used = file;
    if (a.cutout) {
      const cut = join(tools.outDir, "assets", `${a.id}-cutout.png`);
      run([join(ROOT, "platform/production/cutout.py"), file, cut, "--seed", "1", ...(a.cutout.model ? ["--model", a.cutout.model] : [])]);
      used = cut; entry.treatment = `photographic cut-out (rembg ${a.cutout.model || "u2net_human_seg"}); no pixel of the subject is generated.`;
      if (a.cutout.halftone) {
        const ink = join(tools.outDir, "assets", `${a.id}-halftone.png`);
        run([join(ROOT, "platform/production/halftone.py"), cut, ink, "--cell", String(a.cutout.halftone.cell)]);
        used = ink; entry.treatment += " Halftone ink bake adapted from Cele-san/vox-style-animation (MIT).";
      }
    }
    images[a.key] = await dataUri(used); credits[a.key] = entry.credit_line; dates[a.key] = (entry.date_taken.match(/[0-9]{4}/) || [""])[0]; entries.push(entry);
  }
  tools.write("asset-manifest.json", { note: "Every image is a real Wikimedia Commons file with its licence recorded. The trophy photo shows another artist's Grammy trophies and is labelled so on screen. Nothing is AI-generated.", assets: entries, style_source: "github.com/Cele-san/vox-style-animation (MIT)" });
  const result = await runFixedShort({ key, runId, tools, spec: { topic: story.topic, claims: story.claims, sources: story.sources, sentences: story.sentences, scenes: story.scenes, compositionId: "CourtVoxPackShort", edgeVoice: channel.voice.tts, style: channel.voice.style, metadata: story.metadata, minSeconds: 20, music: { mood: "glam" }, makeProps: () => ({ images, credits, dates }) } });
  tools.write("quality-report.json", { format: "vox_pack_explainer", technical: result.qa });
}
