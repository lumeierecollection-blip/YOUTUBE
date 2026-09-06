#!/usr/bin/env node
/**
 * Compose every (channel, strategy) scene template from two authored inputs:
 * the channel's Visual Identity Specification and the strategy's structure.
 *
 *   node scripts/build-scene-templates.js
 *   node scripts/build-scene-templates.js --channel ch-03
 *   node scripts/build-scene-templates.js --check
 *
 * WHAT THIS IS AND IS NOT DECIDING.
 *
 * `config/strategy-structures.json` fixes the GRAMMAR of a beat — one subject,
 * two supports, where they sit, which way the camera travels, what the script
 * must supply. `config/visual-identity.json` fixes the VOCABULARY — which
 * objects, which environment, which of the twelve moves those camera indices
 * resolve to, which transitions, which typeface, where the type sits.
 *
 * Neither file alone produces a look. Crossed, they produce 289 templates in
 * which Legal Brief's COMPARISON and Factory Floor's COMPARISON share a
 * sentence structure and not one noun. TPL-09 in the gate is what proves that
 * claim rather than asserting it: it rejects any two channels whose template
 * for one strategy matches in every look-bearing field.
 *
 * HAND-WRITTEN TEMPLATES ARE NEVER OVERWRITTEN. The three ACCUMULATION
 * templates that were authored by hand carry intents a cross-product cannot
 * produce ("Several debts exist at once and together they are heavier than any
 * one of them"). They are listed in HAND_WRITTEN and skipped. Generated
 * templates are a floor, not a ceiling: replacing any of them with a
 * hand-written one is an upgrade, and adding its filename here is how you keep
 * it.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIR = join(ROOT, "config", "templates");
const argv = process.argv.slice(2);
const only = (argv.find((a) => a.startsWith("--channel=")) || "").split("=")[1]
  || (argv.includes("--channel") ? argv[argv.indexOf("--channel") + 1] : null);
const CHECK = argv.includes("--check");

/** Authored by hand from real references; the cross-product would be a downgrade. */
const HAND_WRITTEN = new Set([
  "ch-01.accumulation.json",
  "ch-02.accumulation.json",
  "ch-09.accumulation.json",
]);

const slug = (s) => s.toLowerCase().replace(/_/g, "-");

/**
 * Which of the channel's three transitions this strategy uses. Spreading by
 * position means a channel's 17 templates exercise all three rather than
 * settling on whichever is listed first.
 */
function transitionFor(spec, index) {
  return spec.transition_language[index % spec.transition_language.length];
}

/**
 * The type window, spread across the beat by strategy position. A channel whose
 * every caption appeared at exactly 0.6 would read as one template repeated,
 * which is the thing being avoided one level up.
 */
function typeWindow(index) {
  const ins = [0.12, 0.28, 0.44, 0.6];
  return { in_at: ins[index % ins.length], out_at: 1 };
}

function build(spec, strategy, struct, cid, index, structures) {
  const objs = spec.core_objects;
  const cams = spec.camera_language;
  const layout = structures.layouts[struct.layout];
  const env = structures.environments[spec.environment_type];
  if (!env) throw new Error(`no environment phrasing for "${spec.environment_type}" — add it to config/strategy-structures.json`);

  const roles = ["subject", "supporting", "context"];
  const objects = struct.object_slots.map((s, i) => {
    const o = { object: objs[s % objs.length], role: roles[i], anchor: layout[i] };
    if (struct.repeat && struct.repeat.slot === i) {
      o.repeats = struct.repeat.param;
      // TPL-10: a count-driven repeat is a representational claim and has to say
      // what the count means. A list-driven one draws exactly what the list holds.
      if (struct.parameters[struct.repeat.param].type === "number") {
        o.repeat_note = struct.repeat.note;
      }
    }
    return o;
  });

  const camera_path = [0, 0.55, 1].map((at, i) => ({
    at,
    move: cams[struct.camera_slots[i] % cams.length],
    ...(i === 1 ? { target: objects[0].object } : {}),
    reason: struct.reasons[i],
  }));

  // The caption slot reuses the strategy's own text parameter where it has one,
  // so a DOCUMENT_EVIDENCE beat captions the quote it found rather than a
  // generic label bolted alongside it.
  const textParam = Object.entries(struct.parameters).find(([, p]) => p.type === "text");
  const slotName = textParam ? textParam[0] : "label";
  const parameters = { ...struct.parameters };
  if (!textParam) parameters.label = { type: "text", from: "script-phrase", required: false };

  const win = typeWindow(index);

  return {
    version: 1,
    channel_id: cid,
    strategy,
    name: `${cid}-${slug(strategy)}-${spec.environment_type}`,
    intent: `${struct.intent} Here that is ${objects[0].object} on ${env.ground}.`,
    environment: { type: spec.environment_type, ground: env.ground, lighting: env.lighting },
    objects,
    camera_path,
    typography: [{
      slot: `{${slotName}}`,
      face: "secondary",
      placement: spec.text_placement,
      in_at: win.in_at,
      out_at: win.out_at,
    }],
    transitions: [{ to: "next", type: transitionFor(spec, index), duration_frames: 10 + (index % 4) * 4 }],
    parameters,
  };
}

function main() {
  const identity = JSON.parse(readFileSync(join(ROOT, "config", "visual-identity.json"), "utf-8")).channels;
  const structures = JSON.parse(readFileSync(join(ROOT, "config", "strategy-structures.json"), "utf-8"));
  const strategies = Object.keys(structures.strategies);
  mkdirSync(DIR, { recursive: true });

  let written = 0, skipped = 0, stale = 0;
  for (const [cid, spec] of Object.entries(identity)) {
    if (only && cid !== only) continue;
    strategies.forEach((strategy, index) => {
      const file = `${cid}.${slug(strategy)}.json`;
      if (HAND_WRITTEN.has(file)) { skipped++; return; }
      const doc = build(spec, strategy, structures.strategies[strategy], cid, index, structures);
      const text = JSON.stringify(doc, null, 2) + "\n";
      const path = join(DIR, file);
      if (CHECK) {
        if (!existsSync(path) || readFileSync(path, "utf-8") !== text) { stale++; console.log(`STALE ${file}`); }
        return;
      }
      writeFileSync(path, text);
      written++;
    });
  }

  if (CHECK) {
    console.log(stale ? `${stale} template(s) stale — re-run without --check` : "all templates up to date");
    process.exit(stale ? 1 : 0);
  }
  const total = readdirSync(DIR).filter((f) => f.endsWith(".json")).length;
  console.log(`scene templates: ${written} generated, ${skipped} hand-written left untouched, ${total} on disk.`);
}

main();
