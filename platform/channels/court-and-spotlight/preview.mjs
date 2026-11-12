// Court & Spotlight preview. The format is chosen by classifying the story (classify.mjs) and the preview branch must agree with it:
// preview/court-and-spotlight-<format>. Each format has its own style profile, composition, evidence rules and music mood.
// Real photographs come from Wikimedia Commons with their licences recorded; cut-outs are made on the runner with rembg.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsAsset, dataUri } from "../../production/commons.mjs";
import { classifyStory } from "./classify.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../..");
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const FORMATS = {
  investigation: { module: "./proof-investigation.mjs", style: "styles/investigation.json" },
  entertainment_magazine: { module: "./proof-magazine.mjs", style: "styles/magazine.json" },
  vox_explainer: { module: "./proof-vox.mjs", style: "styles/vox.json" },
};
const readJson = (f) => JSON.parse(readFileSync(join(here, f), "utf8"));

/** Fetches every real photograph (licence enforced), makes cut-outs where asked, and returns props plus manifest entries. */
async function prepareAssets({ tools, ASSETS = [] }) {
  const dir = join(tools.outDir, "assets"), entries = [], images = {}, credits = {}, dates = {}, cut = {};
  const py = process.platform === "win32" ? "python" : "python3";
  for (const a of ASSETS) {
    const { file, entry } = await commonsAsset({ title: a.title, dir, id: a.id, claim: a.claim, role: a.role });
    let used = file;
    if (a.cutout) {
      used = join(dir, `${a.id}-cutout.png`);
      const args = [join(ROOT, "platform/production/cutout.py"), file, used, "--seed", String(a.cutout.seed || 1), ...(a.cutout.paper ? ["--paper", String(a.cutout.paper)] : []), ...(a.cutout.bw ? ["--bw"] : []), ...(a.cutout.model ? ["--model", a.cutout.model] : [])];
      const r = spawnSync(py, args, { encoding: "utf8", timeout: 900000 });
      if (r.status !== 0 && a.cutout.fallback) {
        // A cut-out that rembg could not make cleanly is refused, and the real photograph is shown framed instead. Nothing is generated.
        used = file;
        entry.treatment = `cut-out refused (${String(r.stderr).split("\n").filter(Boolean).slice(-1)[0] || "failed"}); the original photograph is used framed.`;
      } else if (r.status !== 0) throw new Error(`cut-out failed for ${a.id}: ${String(r.stderr).split("\n").slice(-6).join(" ").slice(0, 500)}`);
      else entry.treatment = `photographic cut-out (rembg, ${a.cutout.model || "u2net_human_seg"})${a.cutout.paper ? ", torn-paper edge" : ""}${a.cutout.bw ? ", monochrome" : ""}. No pixel of the subject is generated.`;
    }
    cut[a.key || a.id] = used !== file;
    images[a.key || a.id] = await dataUri(used);
    credits[a.key || a.id] = entry.credit_line;
    dates[a.key || a.id] = (entry.date_taken.match(/[0-9]{4}/) || [""])[0];
    entries.push(entry);
  }
  return { images, credits, dates, cut, entries };
}

export default async function preview({ key, runId, tools }) {
  const branch = process.env.GITHUB_REF_NAME || "";
  if (/serious/.test(branch)) return (await import("./serious-preview.mjs")).default({ key, runId, tools });
  if (/collage/.test(branch)) return (await import("./collage-preview.mjs")).default({ key, runId, tools });
  if (/grammy/.test(branch)) return (await import("./grammy-preview.mjs")).default({ key, runId, tools });
  const guess = Object.keys(FORMATS).find((f) => branch.includes(f.replace(/_/g, "-")) || branch.includes(f)) || (branch.includes("magazine") ? "entertainment_magazine" : branch.includes("vox") ? "vox_explainer" : "investigation");
  const proof = await import(FORMATS[guess].module);

  // 1. Classify the story before anything is produced, and keep the reasoning.
  const classification = classifyStory({ topic: proof.topic, central_question: proof.central_question, category: proof.category, evidence: (proof.ASSETS || []).map((a) => a.id) });
  tools.write("story-classification.json", { ...classification, branch, expected_for_branch: guess });
  if (classification.format !== guess) throw new Error(`classifier chose ${classification.format} but this proof is the ${guess} format: ${classification.reasoning}`);
  const style = readJson(FORMATS[guess].style);
  tools.write("style-profile.json", style);
  tools.write("story-blueprint.json", { ...proof.blueprint, style: guess, style_reasoning: classification.reasoning });

  // 2. Real, licensed photographs, then cut-outs.
  const { images, credits, dates, cut, entries } = await prepareAssets({ tools, ASSETS: proof.ASSETS });
  tools.write("asset-manifest.json", { note: "Every photograph is a real image from Wikimedia Commons with its licence recorded. Nothing here is AI-generated. Documents are typeset excerpts of fetched text.", assets: entries, documents: proof.DOCUMENTS || [], music: "see music-manifest.json" });

  // 3. Script, voice, music, render, frames and QA through the shared path.
  const result = await runFixedShort({ key, runId, tools, spec: { topic: proof.metadata.title, claims: proof.claims, sources: proof.sources, sentences: proof.sentences, scenes: proof.scenes, compositionId: style.composition, edgeVoice: channel.voice.tts, style: channel.voice.style, metadata: proof.metadata, minSeconds: 20, music: { mood: style.music.mood }, makeProps: () => ({ images, credits, dates, cut, ...(proof.extraProps ? proof.extraProps() : {}) }) } });
  tools.write("quality-report.json", { format: guess, style_checks: style.qa_checks, technical: result.qa, note: "Style checks are reviewed on the contact sheet and frames; the technical block is measured on the MP4." });
}
