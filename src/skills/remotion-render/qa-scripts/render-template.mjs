#!/usr/bin/env node
/**
 * Render a still straight from a (channel, strategy) template, for looking at.
 *
 *   node qa-scripts/render-template.mjs --channel ch-30 --strategy TIMELINE
 *   node qa-scripts/render-template.mjs --sweep 24 --out data/renders/sweep
 *
 * THIS IS A FIXTURE RENDERER AND MUST NOT BE MISTAKEN FOR THE PIPELINE.
 *
 * `scripts/build-visual-plan.js` is the real path: it fills a template's
 * parameters from a script's own sentences and records which sentence each
 * value came from. Nothing here is grounded in anything — the parameter values
 * below are fixed placeholders whose only job is to make the geometry resolve
 * so a person can look at the frame and see whether the objects, palette and
 * camera are right.
 *
 * So: use this to check that a template DRAWS. Never to check what it SAYS, and
 * never as a source of a rendered clip that goes anywhere near a channel.
 */
import { readFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { findChrome } from "../find-chrome.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

/** Placeholder values. Not researched, not grounded, fixture only. */
const FIXTURE = {
  number: 4,
  text: "Placeholder caption for a fixture render",
  date: "1971",
  list: ["first", "second", "third"],
};

const DUR = 150;

function planFrom(template, spec) {
  const at = (f) => Math.round(f * DUR);
  const count = (o) => {
    if (!o.repeats) return 1;
    const decl = template.parameters[o.repeats] || {};
    if (decl.type === "list") return FIXTURE.list.length;
    return Math.max(1, Math.min(decl.max_items || 6, FIXTURE.number));
  };
  return {
    version: 1,
    template: template.name,
    beat: { startFrame: 0, durationInFrames: DUR },
    palette: { primary: spec.primary_palette, secondary: spec.secondary_palette },
    fonts: { primary: spec.typography_primary, secondary: spec.typography_secondary },
    environment: template.environment,
    motion_curve: spec.motion_curve,
    framing: spec.framing_default,
    negative_space: spec.use_of_negative_space,
    objects: template.objects.map((o) => ({
      object: o.object, role: o.role, anchor: o.anchor,
      count: count(o), repeat_note: o.repeat_note || null,
    })),
    camera: template.camera_path.map((k) => ({ frame: at(k.at), move: k.move, target: k.target || null, reason: k.reason })),
    typography: template.typography.map((t) => ({
      text: FIXTURE.text, face: t.face, placement: t.placement, from: at(t.in_at), to: at(t.out_at),
    })),
    transitions: template.transitions,
    data: {},
  };
}

const identity = JSON.parse(readFileSync(join(ROOT, "config", "visual-identity.json"), "utf-8")).channels;
const TDIR = join(ROOT, "config", "templates");
const files = readdirSync(TDIR).filter((f) => f.endsWith(".json"));

let targets;
const sweep = arg("sweep");
if (sweep) {
  // An even spread across channels and strategies, deterministic so two runs of
  // the same sweep produce the same set and can be compared.
  const n = Number(sweep);
  const sorted = [...files].sort();
  targets = Array.from({ length: n }, (_, i) => sorted[Math.floor((i * sorted.length) / n)]);
} else {
  const cid = arg("channel"), strat = arg("strategy");
  if (!cid || !strat) { console.error("--channel and --strategy required (or --sweep N)"); process.exit(1); }
  targets = [`${cid}.${strat.toLowerCase().replace(/_/g, "-")}.json`];
}

const outDir = join(ROOT, arg("out", "data/renders/template"));
mkdirSync(outDir, { recursive: true });

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });

for (const file of targets) {
  const template = JSON.parse(readFileSync(join(TDIR, file), "utf-8"));
  const spec = identity[template.channel_id];
  const plan = planFrom(template, spec);
  const composition = await selectComposition({
    serveUrl, id: "TemplatePlanShorts", inputProps: { plan },
    ...(CHROME ? { browserExecutable: CHROME } : {}),
  });
  const out = join(outDir, file.replace(/\.json$/, ".png"));
  try {
    await renderStill({
      composition: { ...composition, durationInFrames: DUR },
      serveUrl, inputProps: { plan }, chromiumOptions: { gl: "swangle" },
      timeoutInMilliseconds: 180000, logLevel: "error",
      ...(CHROME ? { browserExecutable: CHROME } : {}),
      output: out, imageFormat: "png", frame: Math.round(DUR * 0.8),
    });
    console.log("ok   ", file);
  } catch (e) {
    console.log("FAIL ", file, "-", String(e.message).split("\n")[0].slice(0, 160));
  }
}
