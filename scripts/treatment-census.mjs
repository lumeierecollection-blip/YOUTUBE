#!/usr/bin/env node
/** Real distribution of selected treatments over a real script. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMgPackage } from "../src/skills/remotion-render/compositions/mg-package.js";
import { chunkTextClauseAware } from "../src/skills/remotion-render/compositions/beats.js";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const s = JSON.parse(readFileSync(join(ROOT, "data/research/1/debt-snowball-vs-debt-avalanche-shorts-script.json"), "utf8"));
const sec = (s.sections || []).filter((x) => x.voiceover && x.voiceover.trim()).map((x) => ({
  id: x.id, timing: x.timing, voiceover: x.voiceover, content: chunkTextClauseAware(x.voiceover), bRoll: null }));
const mg = buildMgPackage(readFileSync(join(ROOT, "data/tts/1/debt-snowball-vs-debt-avalanche-shorts-script-vo.srt"), "utf8"),
  { sections: sec, bRollFiles: [], imageForSection: () => null });
const t = {};
for (const b of mg.beats) if (b.visualPlan) t[b.visualPlan.numberTreatment] = (t[b.visualPlan.numberTreatment] || 0) + 1;
const roll = Object.entries(t).filter(([k]) => k !== "settle");
process.stdout.write(`on ch-01's real ${mg.beats.length}-beat script: ${t.settle || 0} settle, ${roll.reduce((n, [, v]) => n + v, 0)} roll (${roll.map(([k, v]) => `${k} x${v}`).join(", ")})`);
