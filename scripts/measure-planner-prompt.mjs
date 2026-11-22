#!/usr/bin/env node
/**
 * measure-planner-prompt.mjs - writes the exact text the planner sends to the model, for a token count made OUTSIDE
 * this script (planner-token-budget.yml counts it with Google's offline tokenizer).
 *
 *   node scripts/measure-planner-prompt.mjs --out out/tokens/branch [--module scripts/gemini-visual-plan.js] [--label branch]
 *
 * The fixture is the same 12-sentence script scripts/test-plan-gates.mjs bounds, so the two numbers describe one prompt.
 * Writes: prompt-text.txt (static + dynamic, as test-plan-gates joins them), prompt-text-with-note.txt (the text exactly
 * as withReferenceImages() sends it beside the reference frames), static.txt, dynamic.txt and chars.json.
 *
 * What this cannot do: it counts no tokens and it cannot count the reference frames the planner attaches (FRAME_COUNT
 * images); only the provider can price an image. No network, no credential, no write outside --out.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const out = arg("out");
const modPath = resolve(arg("module", join(import.meta.dirname, "gemini-visual-plan.js")));
const label = arg("label", "prompt");
if (!out) { console.error("usage: measure-planner-prompt.mjs --out <dir> [--module <gemini-visual-plan.js>] [--label <name>]"); process.exit(2); }

const { buildPlanPromptParts } = await import(pathToFileURL(modPath).href);
const refPath = resolve(modPath, "..", "reference-frames.js");
const { REFERENCE_NOTE, FRAME_COUNT } = await import(pathToFileURL(refPath).href);

const sents = Array.from({ length: 12 }, (_, i) => ({ text: "The judge in Miami ruled that the forty year old federal law criminalizing voting by noncitizens violates the constitution, part " + i + ".", start: i * 4, end: i * 4 + 4 }));
const { staticPart, dynamicPart } = buildPlanPromptParts(sents, null, "2");
const text = staticPart + dynamicPart;
const withNote = `${text}\n\n${REFERENCE_NOTE}`;

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "static.txt"), staticPart);
writeFileSync(join(out, "dynamic.txt"), dynamicPart);
writeFileSync(join(out, "prompt-text.txt"), text);
writeFileSync(join(out, "prompt-text-with-note.txt"), withNote);
const chars = {
  label, module: modPath.replace(/\\/g, "/").split("/").slice(-3).join("/"),
  static_chars: staticPart.length, dynamic_chars: dynamicPart.length, text_chars: text.length, with_note_chars: withNote.length,
  repo_estimate_tokens_at_3_6: Math.ceil(text.length / 3.6), reference_frames_attached_per_call: FRAME_COUNT,
};
writeFileSync(join(out, "chars.json"), JSON.stringify(chars, null, 2) + "\n");
console.log(JSON.stringify(chars));
