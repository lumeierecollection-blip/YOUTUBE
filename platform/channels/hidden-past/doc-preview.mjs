// Hidden Past documentary format preview. Story data comes from doc-<name>.mjs; photographs are real Commons files with licences recorded.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsAsset, dataUri } from "../../production/commons.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));

export default async function docPreview({ key, runId, tools, story }) {
  const s = await import(`./doc-${story}.mjs`);
  tools.write("story-blueprint.json", { ...s.blueprint, format: "history_documentary" });
  const images = {}, credits = {}, dates = {}, entries = [];
  for (const a of s.ASSETS) {
    const { file, entry } = await commonsAsset({ title: a.title, dir: join(tools.outDir, "assets"), id: a.id, claim: a.claim, role: a.role });
    images[a.key] = await dataUri(file); credits[a.key] = entry.credit_line; dates[a.key] = (entry.date_taken.match(/[0-9]{4}/) || [""])[0]; entries.push(entry);
  }
  tools.write("asset-manifest.json", { note: "Every image is a real file from Wikimedia Commons with its licence recorded. Nothing is AI-generated.", assets: entries });
  const result = await runFixedShort({ key, runId, tools, spec: { topic: s.topic, claims: s.claims, sources: s.sources, sentences: s.sentences, scenes: s.scenes, compositionId: "HiddenPastDocShort", edgeVoice: channel.voice.tts, style: "Serious, intriguing documentary narration, steady and clear, not slow", metadata: s.metadata, minSeconds: 20, music: { mood: "editorial" }, makeProps: () => ({ images, credits, dates }) } });
  tools.write("quality-report.json", { format: "history_documentary", technical: result.qa });
}
