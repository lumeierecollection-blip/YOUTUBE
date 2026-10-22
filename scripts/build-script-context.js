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

/**
 * DRAWABLE INVENTORY (strict_visual channels). Runs 39522796613..39611317543:
 * ch-2/ch-48 research was groundable (3-4 facts, every one drawable by the
 * gate's own extractor) but the writer padded 7-9 sentences with questions
 * ("Where do teams connect these servers?") and transitions that ground
 * nothing, and burned all 8 attempts. The abstract rule wasn't enough; this
 * hands the writer the concrete list, computed by the SAME extractor the
 * SCR-17 STRICT gate uses (groundedVisualFor), so "restate one of these" is
 * a rule it can follow on attempt 1. Facts only from the research.
 * The inventory itself lives in strict-inventory.mjs (the workflow uses it too).
 */
import { drawableInventory } from "./strict-inventory.mjs";

async function main() {
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
  const inventory = channel.strict_visual ? await drawableInventory(research) : null;

  const context = {
    channel_id: String(channelId),
    channel_name: channel.channel_name,
    niche: channel.niche,
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
      drawable_inventory: inventory,
      how_to_use_inventory: "drawable_inventory lists every research item the gate can already draw (draws = the graphic it becomes). Build EVERY sentence around one of these items, restating its figure, date or place in the sentence itself; the same item may anchor more than one sentence. No question sentences, no transitions, no rhetorical setups: a sentence that only links two others ('Where does this matter?', 'Here is why.') draws nothing and fails the gate. Fewer, fuller sentences beat padding.",
    } : null,
    research,
  };

  process.stdout.write(JSON.stringify(context, null, 2));
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
