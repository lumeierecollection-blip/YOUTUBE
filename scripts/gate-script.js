#!/usr/bin/env node
/**
 * Gate — script quality (CHECK-REGISTER.md SCR-03..SCR-08, SCR-12..SCR-14).
 * SCR-09/SCR-10/SCR-11 are enforced earlier, in reserve-topics.js at Stage A.
 *
 * BLOCKER checks fail the process (exit 1). MAJOR checks print a warning
 * and exit 0, unless --strict is passed.
 *
 * Usage: node scripts/gate-script.js <channel-id> <script-slug> [research-slug] [--strict]
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const WPM_TARGET = { "cinematic-documentary": 135, "motion-graphics": 155, minimal: 165 };
// Midpoint of render.js's clamp ranges, used only to sanity-check pacing —
// actual duration is decided later by the real voiceover audio length.
const FORMAT_MIDPOINT_MINUTES = { shorts: (15 + 180) / 2 / 60, longform: (2 + 12) / 2 };
const HEX_COLOR = /#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b/g;

function loadChannel(channelId) {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  return channels.find((c) => String(c.id) === String(channelId) || c.channel_id === channelId);
}

function wordCount(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--strict");
  const [channelId, scriptSlug, researchSlugArg] = args;
  // researchSlug defaults to scriptSlug for the single-format case; pass it
  // explicitly when one research artifact backs multiple script files
  // (e.g. "<slug>-shorts" and "<slug>-longform" both trace back to "<slug>").
  const researchSlug = researchSlugArg || scriptSlug;
  const strict = process.argv.includes("--strict");
  if (!channelId || !scriptSlug) {
    console.error("Usage: node scripts/gate-script.js <channel-id> <script-slug> [research-slug] [--strict]");
    process.exit(1);
  }

  const channel = loadChannel(channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const scriptPath = join(ROOT, "data", "research", String(channelId), `${scriptSlug}-script.json`);
  const researchPath = join(ROOT, "data", "research", String(channelId), `${researchSlug}.json`);
  if (!existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }
  const script = JSON.parse(readFileSync(scriptPath, "utf-8"));
  const research = existsSync(researchPath) ? JSON.parse(readFileSync(researchPath, "utf-8")) : null;

  const blockers = [];
  const majors = [];
  const sections = script.sections || [];
  const isMg = channel.style === "motion-graphics";

  if (isMg) {
    const allBeats = sections.flatMap((s) => (s.beats || []).map((b) => ({ ...b, sectionId: s.id, voiceover: s.voiceover })));

    // SCR-03 — anchor_token appears verbatim in its section's voiceover.
    for (const b of allBeats) {
      const vo = (b.voiceover || "").toLowerCase();
      if (!b.anchor_token || !vo.includes(String(b.anchor_token).toLowerCase())) {
        blockers.push(`SCR-03: beat in section "${b.sectionId}" has anchor_token "${b.anchor_token}" not found verbatim in its voiceover.`);
      }
    }

    // SCR-04 — every PROGRESS beat has data.series with >=2 points.
    for (const b of allBeats.filter((x) => x.archetype === "PROGRESS")) {
      const n = b.data?.series?.length || 0;
      if (n < 2) {
        blockers.push(`SCR-04: PROGRESS beat in section "${b.sectionId}" ("${b.text}") has ${n} series point(s), needs >=2.`);
      }
    }

    // SCR-05 — every series value traces to research.numbers.
    if (research) {
      const knownValues = new Set((research.numbers || []).map((n) => n.value));
      for (const b of allBeats) {
        for (const point of b.data?.series || []) {
          const matches = [...knownValues].some((v) => Math.abs(v - point.value) < 1e-9);
          if (!matches) {
            blockers.push(`SCR-05: series point "${point.label}"=${point.value} in section "${b.sectionId}" doesn't match any research.numbers[].value.`);
          }
        }
      }
    } else {
      majors.push(`SCR-05: research artifact not found at ${researchPath} — could not verify chart data traces to sourced numbers.`);
    }

    // SCR-06 (soft) — archetype mix vs. channel.concepts, only if declared.
    if (channel.concepts) {
      const total = allBeats.length || 1;
      const counts = {};
      for (const b of allBeats) counts[b.archetype] = (counts[b.archetype] || 0) + 1;
      const primaryShare = (channel.concepts.primary || []).reduce((s, a) => s + (counts[a] || 0), 0) / total;
      const excluded = (channel.concepts.excluded || []).filter((a) => counts[a] > 0);
      if (primaryShare < 0.5) majors.push(`SCR-06: primary archetypes are ${(primaryShare * 100).toFixed(0)}% of beats, need >=50%.`);
      if (excluded.length > 0) majors.push(`SCR-06: excluded archetype(s) used: ${excluded.join(", ")}.`);
    }

    // SCR-07 — STATEMENT <=30% of beats.
    const statementShare = allBeats.filter((b) => b.archetype === "STATEMENT").length / (allBeats.length || 1);
    if (statementShare > 0.3) {
      majors.push(`SCR-07: STATEMENT is ${(statementShare * 100).toFixed(0)}% of beats, must be <=30%.`);
    }
  }

  // SCR-08 (soft, both schemas) — pacing sanity check against style WPM target.
  // Real duration is decided later from actual voiceover audio length; this
  // only catches scripts that are wildly too dense or too sparse for their format.
  const totalWords = sections.reduce((sum, s) => sum + wordCount(s.voiceover), 0);
  const targetWpm = WPM_TARGET[channel.style] || 150;
  const midpointMinutes = FORMAT_MIDPOINT_MINUTES[script.format] || FORMAT_MIDPOINT_MINUTES.longform;
  const impliedWpm = totalWords / midpointMinutes;
  if (impliedWpm < targetWpm * 0.5 || impliedWpm > targetWpm * 1.5) {
    majors.push(`SCR-08: ${totalWords} words implies ~${impliedWpm.toFixed(0)} WPM at the ${script.format} midpoint duration, vs. this channel's ${targetWpm} WPM target — check pacing.`);
  }

  // SCR-12 — text_overlay is an object or null, never a bare string.
  // (Already enforced by --json-schema at the CLI boundary; checked again
  // here as defense in depth against hand-edited files.)
  for (const s of sections) {
    if (typeof s.text_overlay === "string") {
      blockers.push(`SCR-12: section "${s.id}" has text_overlay as a bare string, must be an object or null.`);
    }
  }

  // SCR-13 (soft) — no hex colour values anywhere in the script JSON.
  const rawJson = JSON.stringify(script);
  const hexHits = rawJson.match(HEX_COLOR);
  if (hexHits) {
    majors.push(`SCR-13: hex colour value(s) found in script JSON: ${[...new Set(hexHits)].join(", ")}. Colour belongs in channels.json, not the script.`);
  }

  // SCR-14 — sources_used >=3, all appear in the research file.
  const sourcesUsed = script.sources_used || [];
  if (sourcesUsed.length < 3) {
    blockers.push(`SCR-14: sources_used has ${sourcesUsed.length} entries, needs >=3.`);
  }
  if (research) {
    const known = new Set([
      ...(research.key_facts || []).map((f) => f.source_url),
      ...(research.numbers || []).map((n) => n.source_url),
    ]);
    const unknown = sourcesUsed.filter((u) => !known.has(u));
    if (unknown.length > 0) {
      blockers.push(`SCR-14: sources_used references URL(s) not present in the research file: ${unknown.join(", ")}`);
    }
  }

  if (majors.length > 0) {
    console.warn(`Script gate — ${majors.length} MAJOR warning(s) for ${channelId}/${scriptSlug}:`);
    majors.forEach((m) => console.warn(`  - ${m}`));
  }
  if (blockers.length > 0) {
    console.error(`Script gate FAILED (BLOCKER) for ${channelId}/${scriptSlug}:`);
    blockers.forEach((b) => console.error(`  - ${b}`));
    process.exit(1);
  }
  if (strict && majors.length > 0) {
    console.error(`Script gate FAILED (--strict, MAJOR warnings present) for ${channelId}/${scriptSlug}.`);
    process.exit(1);
  }

  console.log(`Script gate PASSED for ${channelId}/${scriptSlug}${majors.length ? ` (${majors.length} warning(s))` : ""}.`);
}

main();
