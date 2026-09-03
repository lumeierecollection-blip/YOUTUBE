#!/usr/bin/env node
/**
 * Runs the per-beat photo reasoning across EVERY channel in config/channels.json
 * and writes the required log.
 *
 * For each channel it either produces a full per-beat log (script line, every
 * candidate with its five metadata fields, the pick, and the quoted evidence),
 * or records an explicit, named gap saying exactly what is missing. It never
 * substitutes one channel's script for another's to make a channel look covered.
 *
 *   node src/skills/remotion-render/visual/run-beat-reasoning.mjs
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { narrationSections } from "../../../utils/script-narration.js";
import { reasonBeat, formatBeatLog, readDimensions, MISSING } from "./beat-photo-reasoning.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");

const config = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
const channels = config.channels || config;

/** Every script/SRT pair we can actually find for a channel. */
function findScriptPairs(channel) {
  const pairs = [];
  const dirs = [
    [join(ROOT, "data", "research", String(channel.id)), join(ROOT, "data", "tts", String(channel.id))],
    [join(ROOT, "data", "scripts", channel.channel_id), join(ROOT, "data", "tts", channel.channel_id)],
  ];
  for (const [sDir, tDir] of dirs) {
    if (!existsSync(sDir)) continue;
    for (const f of readdirSync(sDir).filter((f) => f.endsWith("script.json"))) {
      const slug = f.replace(/\.json$/, "");
      const srt = join(tDir, `${slug}-vo.srt`);
      if (existsSync(srt)) pairs.push({ script: join(sDir, f), srt, slug });
    }
  }
  return pairs;
}

/**
 * Candidate photos for a channel, with the exact five required fields.
 * A field the source did not supply is MISSING — never omitted, never guessed.
 */
function loadCandidates(channel) {
  const manifestPath = join(RENDER_DIR, `b-roll-manifest-${channel.channel_id}.json`);
  if (!existsSync(manifestPath)) return { candidates: [], note: `no b-roll manifest at ${manifestPath}` };
  const m = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const candidates = (m.files || []).map((f) => ({
    source_name: m.source || MISSING,
    source_url: f.source_url || MISSING,
    // The sourcing pass did not record the query it searched with. That is a
    // real hole in the manifest schema, so it is reported as one.
    search_query: MISSING,
    dimensions: readDimensions(join(RENDER_DIR, f.local)),
    source_text: {
      // The ONLY text the source itself returned. `content` in this manifest is
      // a production note written while sourcing, so it is not admissible as
      // evidence of what the picture shows, and is deliberately not passed here.
      title: f.commons_title || MISSING,
      description: MISSING,
      alt: MISSING,
    },
    _local: f.local,
  }));
  return { candidates, note: null };
}

const OUT_DIR = join(ROOT, "data", "renders", "beat-reasoning");
mkdirSync(OUT_DIR, { recursive: true });

const entries = [...channels.map((c) => ({ channel: c }))];
// ch-fixture is not one of the 17 production channels, but it is the only
// place in this repo where real source-provided photo metadata exists, so the
// reasoning stage is exercised against it too rather than only against gaps.
const fixture = { id: "fixture", channel_id: "ch-fixture", channel_name: "(ch-fixture — not a production channel)", style: "motion-graphics" };
entries.push({ channel: fixture });

const summary = [];
const out = [];

for (const { channel } of entries) {
  out.push("\n" + "=".repeat(78));
  out.push(`CHANNEL ${channel.id}  ${channel.channel_name}  [${channel.channel_id}]`);
  out.push("=".repeat(78));

  const pairs = findScriptPairs(channel);
  if (pairs.length === 0) {
    const reason =
      `NO SCRIPT DATA. Searched data/research/${channel.id}/ and ` +
      `data/scripts/${channel.channel_id}/ for a *script.json with a matching ` +
      `-vo.srt in data/tts/. Neither exists on this branch, and the stage that ` +
      `would produce one cannot run here (no provider API key is set and every ` +
      `provider host is refused by the egress policy). No beats to reason over.`;
    out.push(`  GAP: ${reason}`);
    summary.push({ channel: channel.channel_name, id: channel.id, status: "GAP — no script data", beats: 0, matched: 0 });
    continue;
  }

  const { candidates, note } = loadCandidates(channel);
  out.push(`  candidate photos available: ${candidates.length}${note ? `  (${note})` : ""}`);

  let beatCount = 0;
  let matched = 0;
  for (const pair of pairs) {
    const script = JSON.parse(readFileSync(pair.script, "utf-8"));
    const srtText = readFileSync(pair.srt, "utf-8");
    const sections = narrationSections(script)
      .filter((s) => s.voiceover && s.voiceover.trim())
      .map((s) => ({
        id: s.id, timing: s.timing, voiceover: s.voiceover,
        content: chunkTextClauseAware(s.voiceover),
        sfxCue: s.sfx_cue || null,
        bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
        beats: Array.isArray(s.beats) ? s.beats : null,
      }));
    const mg = buildMgPackage(srtText, { sections, hook: script.hook || null, channel, bRollFiles: [], imageForSection: () => null });
    const beats = mg.beats.filter((b) => b.archetype !== "LIST_ITEM");

    out.push(`\n  SCRIPT: ${pair.slug}  (${beats.length} beats)`);
    beats.forEach((b, i) => {
      const decision = reasonBeat(b.text, candidates);
      beatCount++;
      if (decision.picked) matched++;
      out.push(formatBeatLog(decision, { index: `${i + 1}/${beats.length}` }).split("\n").map((l) => "  " + l).join("\n"));
    });
  }
  summary.push({ channel: channel.channel_name, id: channel.id, status: "ran", beats: beatCount, matched });
}

out.push("\n" + "=".repeat(78));
out.push("SUMMARY");
out.push("=".repeat(78));
for (const s of summary) {
  out.push(`  ${String(s.id).padEnd(8)} ${String(s.channel).padEnd(34)} ${s.status.padEnd(24)} beats=${s.beats} matched=${s.matched} unmatched=${s.beats - s.matched}`);
}

const text = out.join("\n");
writeFileSync(join(OUT_DIR, "per-beat-log.txt"), text + "\n");
console.log(text);
console.log(`\nwritten: ${join(OUT_DIR, "per-beat-log.txt")}`);
