// Dopamine Loop sample Short, built from one fetched abstract. Runs on GitHub (channel-preview.yml).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { claims, metadata, scenes, sentences, sources } from "./sample.mjs";

const channel = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "channel.json"), "utf8"));

export default async function preview({ key, runId, tools }) {
  if (/serious/.test(process.env.GITHUB_REF_NAME || "")) return (await import("./serious-preview.mjs")).default({ key, runId, tools });
  await runFixedShort({ key, runId, tools, spec: { topic: "Why being left out hurts", claims, sources, sentences, scenes, compositionId: "DopamineLoopShort", edgeVoice: channel.voice.tts, style: channel.voice.style, metadata, minSeconds: 20 } });
}
