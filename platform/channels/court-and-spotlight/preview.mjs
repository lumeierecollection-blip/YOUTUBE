// Court & Spotlight preview. The format is chosen from the branch name (preview/court-and-spotlight-<format>) and defaults to the
// investigation format, mirroring how the real pipeline routes a story to one of three formats.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFixedShort } from "../../production/fixed-short.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const FORMATS = { investigation: "./sample-investigation.mjs" };

export default async function preview({ key, runId, tools }) {
  const branch = process.env.GITHUB_REF_NAME || "";
  const format = Object.keys(FORMATS).find((f) => branch.includes(f.replace("_", "-")) || branch.includes(f)) || "investigation";
  const sample = await import(FORMATS[format]);
  tools.write("format-routing.json", { branch, format, composition: channel.formats[format].composition, when: channel.formats[format].when });
  await runFixedShort({ key, runId, tools, spec: { topic: sample.metadata.title, claims: sample.claims, sources: sample.sources, sentences: sample.sentences, scenes: sample.scenes, compositionId: channel.formats[format].composition, edgeVoice: channel.voice.tts, style: channel.voice.style, metadata: sample.metadata, minSeconds: 20 } });
}
