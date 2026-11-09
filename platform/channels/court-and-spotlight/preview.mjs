// Court & Spotlight preview. The format is chosen from the branch name (preview/court-and-spotlight-<format>) and defaults to the
// investigation format, mirroring how the real pipeline routes a story to one of three formats.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFixedShort } from "../../production/fixed-short.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const FORMATS = { investigation: "./sample-investigation.mjs", entertainment_magazine: "./sample-magazine.mjs" };

/** A real, licensed photograph, fetched at render time and passed in as a data URI. Its licence and author were read from the Commons API. */
async function photoProps(p) {
  const r = await fetch(p.url, { headers: { "User-Agent": "YouTubeAutomationPreview/1.0 (preview render; Wikimedia Commons image, CC BY 2.0)" } });
  if (!r.ok) throw new Error(`photo fetch failed: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 20000) throw new Error("photo is implausibly small");
  return { photo: `data:image/jpeg;base64,${buf.toString("base64")}`, credit: p.credit_line };
}

export default async function preview({ key, runId, tools }) {
  const branch = process.env.GITHUB_REF_NAME || "";
  const format = Object.keys(FORMATS).find((f) => branch.includes(f.replace(/_/g, "-")) || branch.includes(f) || (f === "entertainment_magazine" && branch.includes("magazine"))) || "investigation";
  const sample = await import(FORMATS[format]);
  tools.write("format-routing.json", { branch, format, composition: channel.formats[format].composition, when: channel.formats[format].when });
  await runFixedShort({ key, runId, tools, spec: { topic: sample.metadata.title, claims: sample.claims, sources: sample.sources, sentences: sample.sentences, scenes: sample.scenes, compositionId: channel.formats[format].composition, edgeVoice: channel.voice.tts, style: channel.voice.style, metadata: sample.metadata, minSeconds: 20, makeProps: sample.PHOTO ? () => photoProps(sample.PHOTO) : undefined } });
}
