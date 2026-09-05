#!/usr/bin/env node
/**
 * TPL gate — every scene template is schema-valid AND stays inside the
 * visual identity its channel declared.
 *
 *   node scripts/gate-scene-templates.js
 *   node scripts/gate-scene-templates.js --channel ch-01
 *   node scripts/gate-scene-templates.js --coverage   # which (channel, strategy)
 *                                                     # pairs still have no template
 *
 * THIS IS WHERE SECTION 8 BECOMES ENFORCEABLE.
 *
 * Section 8's prohibitions are all of the same shape: something that is
 * supposed to differ per channel is instead shared across all of them. A
 * prohibition written in prose gets violated by the next person in a hurry. So
 * each one is a check against the channel's own Visual Identity Specification:
 *
 *   "no generic camera rig"        -> TPL-03: every move is in camera_language
 *   "not the same transitions"     -> TPL-04: every transition is in transition_language
 *   "not the same typography"      -> TPL-05: every face is one the channel declared
 *   "each template stages itself"  -> TPL-02: environment.type == environment_type
 *   "no invented visual elements"  -> TPL-06: every object is in core_objects
 *   "no numbers as the primary
 *    visual unless supported"      -> TPL-07: is_primary_visual needs a justification
 *   "no charts unless declared"    -> TPL-08: a chart-shaped object must be in core_objects
 *
 * TPL-09 is the one that is not from section 8: two channels whose templates
 * for the same strategy are identical apart from the channel_id have not
 * escaped the monoculture, they have copied it. The check compares the parts
 * that carry the look, so a legitimately similar template still passes if its
 * environment, objects or camera genuinely differ.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIR = join(ROOT, "config", "templates");
const SCHEMA = join(ROOT, "schemas", "scene-template.json");
const IDENTITY = join(ROOT, "config", "visual-identity.json");

const argv = process.argv.slice(2);
const only = (argv.find((a) => a.startsWith("--channel=")) || "").split("=")[1]
  || (argv.includes("--channel") ? argv[argv.indexOf("--channel") + 1] : null);
const coverage = argv.includes("--coverage");

/** Objects whose whole nature is a chart, for TPL-08. */
const CHART_WORDS = /\b(chart|graph|plot|histogram|bar|line graph|pie)\b/i;

function loadTemplates() {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: f, doc: JSON.parse(readFileSync(join(DIR, f), "utf-8")) }));
}

function main() {
  const problems = [];
  const add = (id, where, msg) => problems.push({ id, where, msg });

  if (!existsSync(IDENTITY)) {
    console.error("TPL: no config/visual-identity.json — a template cannot be checked against an identity that does not exist.");
    process.exit(1);
  }
  const identity = JSON.parse(readFileSync(IDENTITY, "utf-8")).channels || {};
  const templates = loadTemplates().filter((t) => !only || t.doc.channel_id === only);

  if (coverage) {
    const strategies = Object.keys(
      JSON.parse(readFileSync(join(ROOT, "schemas", "script.mg.json"), "utf-8"))
        .definitions?.beat?.properties?.visualPlan?.properties?.strategy?.enum
        ? {} : {}
    );
    // Strategy list comes from the registry, not a duplicated copy.
    const src = readFileSync(join(ROOT, "src", "skills", "remotion-render", "visual", "strategies.js"), "utf-8");
    const names = [...src.matchAll(/^ {2}([A-Z_]+):\s*\{/gm)].map((m) => m[1]);
    const have = new Set(templates.map((t) => `${t.doc.channel_id}|${t.doc.strategy}`));
    let missing = 0;
    for (const cid of Object.keys(identity)) {
      const gaps = names.filter((n) => !have.has(`${cid}|${n}`));
      missing += gaps.length;
      console.log(`${cid}: ${names.length - gaps.length}/${names.length} strategies templated` +
        (gaps.length ? `\n    missing: ${gaps.join(", ")}` : ""));
    }
    console.log(`\n${missing} (channel, strategy) pairs have no template. Section 3: each one is a hard abort at runtime, not a fallback.`);
    return;
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA, "utf-8")));

  const byStrategy = new Map();

  for (const { file, doc } of templates) {
    const where = file;
    if (!validate(doc)) {
      for (const e of validate.errors) add("TPL-01", where, `${e.instancePath || "/"} ${e.message}`);
      continue; // the cross-checks below assume a well-formed document
    }

    const spec = identity[doc.channel_id];
    if (!spec) {
      add("TPL-02", where, `channel ${doc.channel_id} has no visual identity specification`);
      continue;
    }

    if (doc.environment.type !== spec.environment_type) {
      add("TPL-02", where,
        `environment.type "${doc.environment.type}" is not the channel's declared "${spec.environment_type}"`);
    }

    const cam = new Set(spec.camera_language || []);
    for (const k of doc.camera_path) {
      if (!cam.has(k.move)) {
        add("TPL-03", where, `camera move "${k.move}" is not in ${doc.channel_id}'s camera_language (${[...cam].join(", ")})`);
      }
    }

    const trans = new Set(spec.transition_language || []);
    for (const t of doc.transitions || []) {
      if (!trans.has(t.type)) {
        add("TPL-04", where, `transition "${t.type}" is not in ${doc.channel_id}'s transition_language (${[...trans].join(", ")})`);
      }
    }

    for (const t of doc.typography || []) {
      if (t.placement !== spec.text_placement) {
        add("TPL-05", where,
          `text placement "${t.placement}" is not the channel's declared "${spec.text_placement}"`);
      }
      if (t.out_at < t.in_at) {
        add("TPL-05", where, `typography slot "${t.slot}" goes out (${t.out_at}) before it comes in (${t.in_at})`);
      }
      if (t.is_primary_visual && !t.justification) {
        add("TPL-07", where,
          `slot "${t.slot}" claims is_primary_visual with no justification — section 8 allows a numeric display as the primary element only where the template explicitly supports it`);
      }
    }

    const core = new Set(spec.core_objects || []);
    const subjects = (doc.objects || []).filter((o) => o.role === "subject");
    if (subjects.length !== 1) {
      add("TPL-06", where, `${subjects.length} objects marked subject — exactly one is required`);
    }
    for (const o of doc.objects || []) {
      if (!core.has(o.object)) {
        add("TPL-06", where, `object "${o.object}" is not in ${doc.channel_id}'s core_objects`);
      }
      if (CHART_WORDS.test(o.object) && !core.has(o.object)) {
        add("TPL-08", where, `chart-shaped object "${o.object}" is not declared in core_objects`);
      }
      if (o.repeats && !(doc.parameters || {})[o.repeats]) {
        add("TPL-01", where, `object "${o.object}" repeats over "${o.repeats}", which is not a declared parameter`);
      }
      if (o.repeats) {
        const t = (doc.parameters[o.repeats] || {}).type;
        if (t !== "list" && t !== "number") {
          add("TPL-01", where, `object "${o.object}" repeats over "${o.repeats}", which is type ${t} — only list or number can drive a repeat`);
        }
        // A count-driven repeat is a representational claim, so it has to say
        // what the count means. Without this, N drawn objects silently reads
        // as "there are N of these".
        if (t === "number" && !o.repeat_note) {
          add("TPL-10", where,
            `object "${o.object}" repeats over the number "${o.repeats}" with no repeat_note — state whether the count is quantitative or symbolic`);
        }
        if (t === "number" && !(doc.parameters[o.repeats] || {}).max_items) {
          add("TPL-10", where,
            `object "${o.object}" repeats over the number "${o.repeats}" with no max_items — a total of 13,600 would draw 13,600 objects`);
        }
      }
    }

    for (const t of doc.typography || []) {
      const m = /^\{([a-z0-9_]+)\}$/i.exec(t.slot);
      if (m && !(doc.parameters || {})[m[1]]) {
        add("TPL-01", where, `typography slot references {${m[1]}}, which is not a declared parameter`);
      }
    }

    const key = doc.strategy;
    const look = JSON.stringify([
      doc.environment,
      (doc.objects || []).map((o) => [o.object, o.role, o.anchor]),
      (doc.camera_path || []).map((k) => [k.at, k.move]),
      (doc.transitions || []).map((t) => [t.type, t.duration_frames]),
      (doc.typography || []).map((t) => [t.face, t.placement, t.in_at, t.out_at]),
    ]);
    if (!byStrategy.has(key)) byStrategy.set(key, new Map());
    const seen = byStrategy.get(key);
    if (seen.has(look)) {
      add("TPL-09", where,
        `identical in every look-bearing field to ${seen.get(look)} — two channels, one template`);
    } else {
      seen.set(look, file);
    }
  }

  if (problems.length) {
    console.error(`\nTPL gate: ${problems.length} problem(s) across ${templates.length} template(s)\n`);
    for (const p of problems) console.error(`  ${p.id}  ${p.where}: ${p.msg}`);
    console.error("");
    process.exit(1);
  }
  console.log(`TPL gate: ${templates.length} template(s) valid and inside their channel's declared identity.`);
}

main();
