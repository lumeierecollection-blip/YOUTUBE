#!/usr/bin/env node
/**
 * Remove repeated sentences from a script, in place (scripts/lib/dedupe-sentences.mjs — deletion only).
 *
 * Usage: node scripts/dedupe-sentences.js <script.json> [--strict]
 *
 * Exit 0: no repeats left (prints what was removed). Exit 3 (--strict only): a repeat remains that deletion cannot fix (both copies are the only
 * sentence of their section) — printed as "  - CLARITY:" lines. Without --strict a remaining repeat is printed and the exit is 0. Exit 1: usage/IO.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dedupeSections } from "./lib/dedupe-sentences.mjs";

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/dedupe-sentences.js <script.json> [--strict]"); process.exit(1); }
const script = JSON.parse(readFileSync(file, "utf-8"));
const { sections, removed, unfixable } = dedupeSections(script.sections || []);
if (removed.length) {
  script.sections = sections;
  writeFileSync(file, JSON.stringify(script, null, 2) + "\n");
  for (const r of removed) console.log(`[dedupe] removed [${r.section}] "${r.sentence}" — it repeats "${r.repeats}"`);
}
for (const u of unfixable) console.log(`  - CLARITY: "${u.b}" repeats "${u.a}". Say something new from the research in its place.`);
if (unfixable.length && process.argv.includes("--strict")) process.exit(3);
