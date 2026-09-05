#!/usr/bin/env node
/**
 * VID gate — the Channel Visual Identity Specification is complete, curated
 * and human-validated before anything renders from it.
 *
 *   node scripts/gate-visual-identity.js                 # all channels
 *   node scripts/gate-visual-identity.js --channel ch-01
 *   node scripts/gate-visual-identity.js --require-all   # every channel in
 *                                                        # channels.json must
 *                                                        # have a specification
 *
 * WHY THIS EXISTS, MEASURED
 *
 * `config/channels.json` already describes three completely different visual
 * worlds. ch-01 asks for "top-down desk flat-lay", ch-02 for "courtroom
 * establishing wide", ch-09 for "satellite top-down". None of it reaches a
 * frame: `visual_spec` has ZERO references anywhere in the codebase, and so do
 * `camera_angles`, `b_roll_sources` and `color_grade`. The render path reads
 * only style, channel_id, thumbnail_spec, channel_name, sfx_profile,
 * script_template, font, content_pillars, tone, niche, colors, captions and
 * bg_mode — so everything separating Money Mind from Legal Brief at render
 * time reduces to `colors.accent` plus `bg_mode` plus `font`. That is the
 * whole reason the two renders read as "white + green" and "black + red"
 * versions of one video.
 *
 * This gate does not fix that. It makes the declaration a REAL artefact — one
 * that is schema-checked, provably backed by research, and provably signed off
 * — so the layers built on top of it (addendum sections 3 through 7) have
 * something they are allowed to depend on.
 *
 * WHAT IT REFUSES, AND WHY EACH REFUSAL IS THE ADDENDUM'S OWN RULE
 *
 *   VID-01  schema — every field present, every enum closed, exact
 *           cardinalities (4 primary / 3 secondary / >=5 objects / >=4 camera
 *           moves / exactly 3 transitions).            [addendum section 2]
 *   VID-02  the font names exist as real woff2 files in the render
 *           environment. Section 2 says "must be available in the rendering
 *           environment"; a name that is not there is a render failure, not a
 *           preference.
 *   VID-03  `style_reference_document` points at a file that exists. A
 *           specification with no research behind it is what section 1
 *           exists to prevent.                          [section 1.5, 1.6]
 *   VID-04  `human_validated` is present and dated.     [section 2]
 *   VID-05  the specification's channel_id is a real channel.
 *   VID-06  no two channels share an identical identity. Two channels with
 *           the same palette, environment, objects, camera and transitions
 *           are the monoculture this whole addendum is aimed at, so it is
 *           caught here rather than discovered in a render.
 *
 * WHAT IT DOES NOT DO
 *
 * It never writes or repairs a specification. Section 2 is explicit: "No
 * automated generation of these values is allowed; they must be manually
 * curated based on the research phase." This file only ever says yes or no.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPEC_PATH = join(ROOT, "config", "visual-identity.json");
const SCHEMA_PATH = join(ROOT, "schemas", "visual-identity.json");
const FONT_DIR = join(ROOT, "src", "skills", "remotion-render", "public", "fonts");

const argv = process.argv.slice(2);
const only = (argv.find((a) => a.startsWith("--channel=")) || "").split("=")[1]
  || (argv.includes("--channel") ? argv[argv.indexOf("--channel") + 1] : null);
const requireAll = argv.includes("--require-all");

/**
 * The fonts the renderer can actually use, derived from the woff2 files on
 * disk rather than from a hand-kept list that would drift. "PlayfairDisplay"
 * on disk is "Playfair Display" in config, so the comparison strips spaces —
 * the same normalisation the loader does.
 */
function availableFonts() {
  if (!existsSync(FONT_DIR)) return new Set();
  const names = new Set();
  for (const f of readdirSync(FONT_DIR)) {
    const m = /^([A-Za-z]+)-/.exec(f);
    if (m) names.add(m[1].toLowerCase());
  }
  return names;
}
const normFont = (s) => String(s || "").replace(/[\s_-]+/g, "").toLowerCase();

function fail(list, id, channel, message) {
  list.push({ id, channel, message });
}

function main() {
  const problems = [];

  if (!existsSync(SPEC_PATH)) {
    console.error(
      `VID: no specification file at config/visual-identity.json.\n` +
      `     Section 2 requires one per channel, curated by hand from the\n` +
      `     Style Reference Document that section 1's research phase produces.\n` +
      `     This gate will not create it: section 2 forbids automated generation.`
    );
    process.exit(1);
  }

  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
  const doc = JSON.parse(readFileSync(SPEC_PATH, "utf-8"));
  const channels = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8")).channels;
  const knownIds = new Set(channels.map((c) => c.channel_id));

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(doc)) {
    for (const e of validate.errors) {
      fail(problems, "VID-01", e.instancePath || "(root)", `${e.instancePath || "/"} ${e.message}`);
    }
  }

  const fonts = availableFonts();
  const fingerprints = new Map();
  const entries = Object.entries(doc.channels || {});

  for (const [cid, spec] of entries) {
    if (only && cid !== only) continue;

    if (!knownIds.has(cid)) {
      fail(problems, "VID-05", cid, `not a channel in config/channels.json`);
    }

    for (const key of ["typography_primary", "typography_secondary"]) {
      const name = spec[key];
      if (name && fonts.size && !fonts.has(normFont(name))) {
        fail(problems, "VID-02", cid,
          `${key} "${name}" has no woff2 in public/fonts (have: ${[...fonts].sort().join(", ")})`);
      }
    }

    const srd = spec.style_reference_document;
    if (srd && !existsSync(join(ROOT, srd))) {
      fail(problems, "VID-03", cid, `style_reference_document "${srd}" does not exist`);
    }

    if (!spec.human_validated || !spec.human_validated.by || !spec.human_validated.date) {
      fail(problems, "VID-04", cid,
        `not human-validated — section 2 forbids using this in a production render`);
    }

    // VID-06 — identical identities are the monoculture, caught here.
    const fp = JSON.stringify([
      spec.primary_palette, spec.secondary_palette, spec.environment_type,
      [...(spec.core_objects || [])].sort(), spec.camera_language,
      spec.transition_language, spec.framing_default, spec.text_placement,
      spec.use_of_negative_space, spec.motion_curve,
    ]);
    if (fingerprints.has(fp)) {
      fail(problems, "VID-06", cid,
        `visual identity is byte-identical to ${fingerprints.get(fp)} — two channels, one visual world`);
    } else {
      fingerprints.set(fp, cid);
    }
  }

  if (requireAll) {
    for (const c of channels) {
      if (!doc.channels || !doc.channels[c.channel_id]) {
        fail(problems, "VID-05", c.channel_id,
          `${c.channel_name} has no visual identity specification`);
      }
    }
  }

  const checked = only ? 1 : entries.length;
  if (problems.length) {
    console.error(`\nVID gate: ${problems.length} problem(s) across ${checked} specification(s)\n`);
    for (const p of problems) console.error(`  ${p.id}  ${p.channel}: ${p.message}`);
    console.error(
      `\nNothing was written. Section 2: "No automated generation of these values\n` +
      `is allowed; they must be manually curated based on the research phase."\n`
    );
    process.exit(1);
  }

  console.log(`VID gate: ${checked} specification(s) valid, human-validated, research-backed.`);
}

main();
