#!/usr/bin/env node
/**
 * reverify-cutout-library.mjs — "right or absent" for the old library
 * (owner's rule 2026-10-02): every PNG in public/cutouts/ is re-checked with
 * the current content verifier (verify-cutout-image.cjs: LITERAL and
 * recognizable without a label = MATCH). Anything else is deleted — the PNG
 * removed, the entry moved to MISSING.md, verified.json updated — so the
 * library fallback can only ever serve a right image. Entries already marked
 * non-MATCH in verified.json are deleted without asking a model.
 *
 *   node scripts/reverify-cutout-library.mjs [--dry-run] [--no-model]
 *
 * If no vision provider answers for an entry (rate limit, outage) it is KEPT
 * and reported as unverified: an outage must not wipe the library. Exit 0.
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { creditsMarkdown, missingMarkdown, markMissing } from "./cutout-library-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "src", "skills", "remotion-render", "public", "cutouts");
const dry = process.argv.includes("--dry-run"), noModel = process.argv.includes("--no-model");
const { verifyCutoutImage } = createRequire(import.meta.url)("./verify-cutout-image.cjs");
const readJ = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };

let index = readJ(join(DIR, "index.json"), { version: 1, cutouts: [], missing: [] });
const verified = readJ(join(DIR, "verified.json"), {});
const kept = [], removed = [], unverified = [];
for (const c of index.cutouts.slice()) {
  const png = join(DIR, `${c.name}.png`);
  let verdict = verified[c.name]?.verdict, seen = verified[c.name]?.seen || "";
  if (verdict === "MATCH" && !noModel && existsSync(png)) {
    let v = await verifyCutoutImage(png, c.name, { sourceUrl: null, useCache: false });
    for (let r = 0; v.verdict === "NONE" && r < 2; r++) { await new Promise((res) => setTimeout(res, 15000)); v = await verifyCutoutImage(png, c.name, { sourceUrl: null, useCache: false }); }
    if (v.verdict === "NONE") { unverified.push(c.name); kept.push(c.name); console.log(`[reverify] ${c.name}: no vision provider answered — KEPT, unverified this run`); continue; }
    verdict = v.verdict; seen = v.seen;
    verified[c.name] = { ...(verified[c.name] || {}), verdict: v.verdict === "MATCH" ? "MATCH" : v.verdict, seen: v.seen, provider: v.provider, verified_at: new Date().toISOString(), prompt: "literal-recognizable" };
  }
  if (verdict === "MATCH" && existsSync(png)) { kept.push(c.name); console.log(`[reverify] ${c.name}: MATCH (saw "${seen}") — kept`); continue; }
  removed.push(c.name);
  console.log(`[reverify] ${c.name}: ${verdict || "no verdict"}${seen ? ` (saw "${seen}")` : ""}${existsSync(png) ? "" : " (no PNG)"} — REMOVED`);
  if (!dry) {
    rmSync(png, { force: true });
    index = { ...index, cutouts: index.cutouts.filter((x) => x.name !== c.name) };
    index = markMissing(index, c.name, [`removed by re-verification (2026-10-02 rule "right or absent"): ${verdict || "no verdict"}${seen ? ` — saw "${seen}"` : ""}`]);
  }
}
if (!dry) {
  writeFileSync(join(DIR, "index.json"), JSON.stringify(index, null, 2) + "\n");
  writeFileSync(join(DIR, "verified.json"), JSON.stringify(verified, null, 2) + "\n");
  writeFileSync(join(DIR, "CREDITS.md"), creditsMarkdown(index));
  writeFileSync(join(DIR, "MISSING.md"), missingMarkdown(index));
}
console.log(`[reverify] ${kept.length} kept (${unverified.length} unverified this run), ${removed.length} removed: ${removed.join(", ") || "none"}${dry ? " (dry run)" : ""}`);
