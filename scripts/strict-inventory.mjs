#!/usr/bin/env node
/**
 * DRAWABLE INVENTORY (strict_visual channels) — the research items the SCR-17
 * STRICT gate's own extractor (groundedVisualFor) can already draw. One
 * definition, used by build-script-context.js (the writer is handed the list)
 * and by the workflow (a topic whose research draws fewer than
 * MIN_DRAWABLE items is re-picked after attempt 1 instead of attempt 3).
 *
 * Run 39705589195 ch-48: research "university-of-utah-walking-changes-…" drew 2
 * items; 8 attempts could not ground 7-9 sentences from 2 facts without
 * inventing, and the gate (correctly) refused every one.
 *
 *   node scripts/strict-inventory.mjs <channel-id> <slug>   -> prints the count
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export const MIN_DRAWABLE = 3;

export async function drawableInventory(research) {
  // strict-visual.mjs logs its vocabulary on stdout at import; callers' stdout
  // is JSON or a number, so route that to stderr.
  const log = console.log;
  console.log = (...a) => console.error(...a);
  let groundedVisualFor;
  try { ({ groundedVisualFor } = await import("./strict-visual.mjs")); }
  finally { console.log = log; }
  const out = [];
  const add = (text, source) => {
    const g = groundedVisualFor(String(text || ""));
    if (g) out.push({ draws: g.visual_type, from: source, text: String(text).trim() });
  };
  (research.key_facts || []).forEach((k, i) => add(k.fact || k, `key_facts[${i}]`));
  (research.numbers || []).forEach((n, i) => {
    if (n && n.value != null) add(`${n.label || ""}: ${n.value} ${n.unit || ""}`.trim(), `numbers[${i}]`);
  });
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [ch, slug] = process.argv.slice(2);
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const research = JSON.parse(readFileSync(join(root, "data", "research", String(ch), `${slug}.json`), "utf8"));
    process.stdout.write(String((await drawableInventory(research)).length));
  } catch (e) {
    console.error(`strict-inventory: ${e.message}`);
    process.stdout.write("-1");
  }
}
