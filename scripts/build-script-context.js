#!/usr/bin/env node
/**
 * Stage C input builder — emits, on stdout, the frozen Stage B research
 * artifact plus the channel's style/tone/script_template/concepts. Piped
 * into `claude -p --bare` as stdin for the write-script prompt.
 *
 * Usage: node scripts/build-script-context.js <channel-id> <slug> [--format shorts|longform] > context.json
 */

import { readFileSync, existsSync } from "fs";
import { resolveChannel } from "./lib/channel-lookup.mjs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function main() {
  const [channelId, slug] = process.argv.slice(2);
  const format = process.argv.includes("--format")
    ? process.argv[process.argv.indexOf("--format") + 1]
    : "shorts";

  if (!channelId || !slug) {
    console.error("Usage: node scripts/build-script-context.js <channel-id> <slug> [--format shorts|longform]");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const channel = resolveChannel(channelId, channels);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const researchPath = join(ROOT, "data", "research", String(channelId), `${slug}.json`);
  if (!existsSync(researchPath)) {
    console.error(`Research artifact not found: ${researchPath} — run Stage B first.`);
    process.exit(1);
  }
  const research = JSON.parse(readFileSync(researchPath, "utf-8"));

  const context = {
    channel_id: String(channelId),
    channel_name: channel.channel_name,
    niche: channel.niche,
    // Hard limits that keep this niche advertiser-friendly and inside YouTube's authenticity rules (config/channels.json niche_rules).
    niche_rules: channel.niche_rules || [],
    style: channel.style,
    tone: channel.tone,
    format,
    script_template: channel.script_template || null,
    concepts: channel.concepts || null,
    // The week's hot terms in the channel's YouTube category (scripts/
    // fetch-trending.cjs: words in >= 5 of the 50 most-popular titles) — a
    // keyword spine for titles / hooks, never a source of facts.
    seo_keywords: (() => {
      try { return JSON.parse(readFileSync(join(ROOT, "data", "trending", `${channelId}-keywords.json`), "utf-8")).keywords.slice(0, 12).map((k) => k.term); }
      catch { return []; }
    })(),
    // STRICT VISUAL RULE (config strict_visual: ch-02, ch-48; CHECK-REGISTER
    // SCR-19). The writer used to learn this only from gate feedback after
    // eight failed attempts (run 39399514270 ch-48 starved at 4-5 ungroundable
    // sentences per attempt). Say it up front, and say what does not count:
    // naming a person/organisation is not a visual. Everything stated must
    // still come from `research` — the rule changes WHAT to select, never
    // licenses an invented number.
    visual_rule: channel.strict_visual ? {
      required: true,
      rule: "EVERY voiceover sentence must state something a frame can draw: a sourced number, date, place, list, comparison, document, money object or cause/effect sequence. Naming a person, paper or organisation alone is NOT enough - a name plate is a text card. Prefer the research facts that carry a scene, a place, a measured figure or a step-by-step process; do not write method-only sentences like 'X analyzed Y' unless you can name the Y, where, or a result in that same sentence WITHOUT inventing anything. The figures must appear verbatim in the research artifact. NEVER name a study's authors, researchers, journals, databases or websites: the pipeline has no portrait or logo for them, and the beat is refused at render even when it also states a figure (run 39434350384 ch-48). Attribute findings to 'the study', 'the review' or 'the researchers' instead. Name a company only when the video is ABOUT that company and the research names it.",
    } : null,
    research,
  };

  process.stdout.write(JSON.stringify(context, null, 2));
}

main();
