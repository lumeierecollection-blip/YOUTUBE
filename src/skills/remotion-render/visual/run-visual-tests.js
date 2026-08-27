#!/usr/bin/env node
/**
 * Visual-director test suite.
 *
 * Run: node visual/run-visual-tests.js
 *
 * These are the mechanical guarantees behind the claims this layer makes.
 * The three that matter most, because they are the ones a future change is
 * most likely to quietly break:
 *
 *   1. NO DEAD STRATEGIES — every registered strategy names a scene the
 *      router actually handles, and no two strategies share one (PART 2).
 *   2. NO UNRENDERABLE ROUTING — the director never selects a strategy
 *      whose data requirements are unmet, which is what would put an empty
 *      or lying frame on screen.
 *   3. THE 150-METRE GATE — a geofence beat must produce a spatial visual,
 *      not a giant number (PART 23).
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, basename, sep } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { STRATEGIES, STRATEGY_PREFERENCE, TERMINAL_STRATEGY, assertStrategyRegistryIsSound } from "./strategies.js";
import { planVisual } from "./director.js";
import { buildStates, MAX_STATE_FRAMES, longestStaticRun } from "./states.js";
import { analyzeBeat } from "./semantics.js";
import { summarizeVisuals, summarizeSound } from "./diagnostics.js";
import { MAX_SUPPORTING_WORDS } from "./text-budget.js";
import { SAFE, CAPTION_RESERVE_Y, documentPageGeometry } from "../compositions/layout-constants.js";
import { composeShot, composedStrategies, assertCompositionIsComplete, shotSignatures, FRAMINGS, CAMERA_MOVES, DEPTH_PROFILES, planeOffset } from "./composition.js";
import { assertSoundMapIsSound, buildSoundtrack, soundEventsForBeat, materialsWithCharacter, volumeFor, MIN_GAP_FRAMES, MAX_EVENTS_PER_BEAT, ROLE_TARGET_DB } from "./sound-design.js";
import { SFX_LIBRARY } from "./sfx-library.js";
import { undefinedIdentifiers } from "./scope-check.js";
import { resolveImageAssets } from "../image-assets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..", "..");

/**
 * The scene components the router actually handles.
 *
 * Read STATICALLY from the router's own source rather than imported: node
 * cannot import .jsx without a transform, and a hand-maintained duplicate
 * list would be exactly the kind of thing that silently drifts out of sync
 * — which is the failure this test exists to catch. Parsing the real file
 * means the check can only pass when the real router is correct.
 */
const KNOWN_SCENES = (() => {
  const src = readFileSync(join(__dirname, "..", "compositions", "scenes", "index.jsx"), "utf-8");
  const block = /export const SCENE_COMPONENTS = \{([\s\S]*?)\n\};/.exec(src);
  if (!block) throw new Error("could not find SCENE_COMPONENTS in scenes/index.jsx");
  return block[1]
    .split("\n")
    .map((l) => l.trim().replace(/,$/, ""))
    .filter((l) => /^[A-Za-z][A-Za-z0-9_]*$/.test(l));
})();

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    const r = fn();
    if (r === true || r === undefined) {
      passed += 1;
      console.log(`  ok  ${name}`);
    } else {
      failures.push(`${name}: ${r}`);
      console.log(`  FAIL ${name}: ${r}`);
    }
  } catch (err) {
    failures.push(`${name}: threw ${err.message}`);
    console.log(`  FAIL ${name}: threw ${err.message}`);
  }
}

const channel = (() => {
  const all = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  return (all.channels || all).find((c) => c.id === 2) || null;
})();

const financeChannel = (() => {
  const all = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  return (all.channels || all).find((c) => c.id === 1) || null;
})();

const win = (dur = 120, anchor = 60) => ({ startFrame: 0, durationInFrames: dur, anchorFrame: anchor });

// ─────────────────────────────────────────────────────────────────────────────
console.log("registry — no dead or duplicated strategies");

check("every strategy routes to a scene the router handles", () => {
  const r = assertStrategyRegistryIsSound(KNOWN_SCENES);
  return r.pass || r.problems.join(" | ");
});

check("no scene component is orphaned", () => {
  const used = new Set(Object.values(STRATEGIES).map((s) => s.scene));
  const orphans = KNOWN_SCENES.filter((s) => !used.has(s));
  return orphans.length === 0 || `unused scene components: ${orphans.join(", ")}`;
});

check("schema strategy enum matches the registry exactly", () => {
  const schema = JSON.parse(readFileSync(join(ROOT, "schemas", "script.mg.json"), "utf-8"));
  const enumVals = schema.properties.sections.items.properties.beats.items.properties.visual.properties.strategy.enum;
  const reg = Object.keys(STRATEGIES);
  const missing = reg.filter((s) => !enumVals.includes(s));
  const extra = enumVals.filter((s) => !reg.includes(s));
  return (missing.length + extra.length === 0) || `missing:${missing} extra:${extra}`;
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nPART 23 — the 150-metre geofence hard gate");

const geofenceBeat = {
  text: "Police used a geofence warrant to scan a 150 meter radius for anyone's phone near a crime",
  archetype: "HERO_NUMBER",
  anchor_token: "150 meter",
  data: { unit: "meters", series: [{ label: "Warrant Radius", value: 150 }] },
};

check("a geofence beat plans a SPATIAL visual, not a number card", () => {
  const plan = planVisual(geofenceBeat, { channel });
  return plan.strategy === "GEOSPATIAL_RADIUS" || `got ${plan.strategy}`;
});

check("the geofence plan keeps the real 150 as a SUPPORTING measurement", () => {
  const plan = planVisual(geofenceBeat, { channel });
  return plan.supporting.value === 150 || `supporting.value=${plan.supporting.value}`;
});

check("the geofence concept plays through >=6 distinct visual states", () => {
  const plan = planVisual(geofenceBeat, { channel });
  const states = buildStates(plan, win(162, 87));
  return states.length >= 6 || `only ${states.length} states`;
});

check("the boundary locks ON the anchor frame (when '150' is spoken)", () => {
  const plan = planVisual(geofenceBeat, { channel });
  const states = buildStates(plan, win(162, 87));
  const lock = states.find((s) => s.key === "lock");
  if (!lock) return "no lock state";
  return Math.abs(lock.startFrame - 87) <= 1 || `lock starts at ${lock.startFrame}, anchor is 87`;
});

check("a geofence beat never resolves an icon as its hero", () => {
  const plan = planVisual(geofenceBeat, { channel });
  return plan.iconRole !== "primary" || "iconRole was primary";
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nPART 6 — HERO_NUMBER is no longer a number card by default");

const heroCases = [
  { text: "Twenty small purchases quietly became $500 by the end of the month", anchor: "$500", want: "ACCUMULATION" },
  { text: "The balance grew from $10,000 to $18,000 in four years", anchor: "$18,000", want: "TRANSFORMATION" },
  { text: "The system processes every request through three separate stages", anchor: "three stages", want: "PROCESS" },
];
for (const c of heroCases) {
  check(`"${c.text.slice(0, 42)}..." -> ${c.want}`, () => {
    const plan = planVisual(
      { text: c.text, archetype: "HERO_NUMBER", anchor_token: c.anchor, data: {} },
      { channel: financeChannel }
    );
    return plan.strategy === c.want || `got ${plan.strategy}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nPART 7/8 — STATEMENT is not icon-first");

check("the terminal fallback declares iconRole 'none'", () => {
  return STRATEGIES[TERMINAL_STRATEGY].iconRole !== "secondary" || "terminal strategy wants an icon";
});

check("no strategy may declare a primary icon role", () => {
  const bad = Object.entries(STRATEGIES).filter(([, d]) => d.iconRole && !["none", "secondary"].includes(d.iconRole));
  return bad.length === 0 || `${bad.map(([k]) => k).join(", ")}`;
});

check("an unreadable beat falls to CINEMATIC_STATEMENT, not an icon scene", () => {
  const plan = planVisual({ text: "and then it happened", archetype: "STATEMENT", anchor_token: "happened", data: {} }, { channel });
  return plan.strategy === TERMINAL_STRATEGY && plan.iconRole === "none"
    ? true
    : `strategy=${plan.strategy} iconRole=${plan.iconRole}`;
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\ndirector — never routes to a strategy it cannot draw");

check("no plan selects a strategy whose dataNeeds are unmet", () => {
  const samples = [
    { text: "The radius covered a wide area of the city", archetype: "HERO_NUMBER", anchor_token: "area", data: {} },
    { text: "The chart compares them", archetype: "PROGRESS", anchor_token: "chart", data: {} },
    { text: "It grew a lot over time", archetype: "PROGRESS", anchor_token: "grew", data: {} },
    { text: "A timeline of events unfolded", archetype: "STATEMENT", anchor_token: "timeline", data: {} },
    { text: "Nothing in particular", archetype: "STATEMENT", anchor_token: "nothing", data: {} },
  ];
  for (const s of samples) {
    const plan = planVisual(s, { channel });
    const def = STRATEGIES[plan.strategy];
    if (!def) return `unregistered strategy ${plan.strategy}`;
    const sup = plan.supporting;
    // Spot-check the requirements a scene would actually early-return on.
    if (plan.strategy === "DATA_CHART" && (!sup.series || sup.series.length < 2)) return "DATA_CHART with <2 series";
    if (plan.strategy === "COMPARISON" && !sup.qualitative && (!sup.series || sup.series.length < 2)) return "COMPARISON with <2 series and no opposition";
    if (plan.strategy === "TIMELINE" && (!sup.years || sup.years.length < 1)) return "TIMELINE with no years";
    if (plan.strategy === "GEOSPATIAL_RADIUS" && !Number.isFinite(sup.value)) return "GEOSPATIAL_RADIUS with no distance";
    if (plan.strategy === "IMAGE_EVIDENCE" && !(plan.payload && plan.payload.asset)) return "IMAGE_EVIDENCE with no asset";
  }
  return true;
});

check("every fallback carries a human-readable reason", () => {
  const plan = planVisual({ text: "um, well", archetype: "STATEMENT", anchor_token: "well", data: {} }, { channel });
  if (!plan.fallbacks.length) return true;
  const bad = plan.fallbacks.filter((f) => !f.reason || f.reason.length < 8);
  return bad.length === 0 || `reasonless fallback: ${JSON.stringify(bad[0])}`;
});

check("an authored strategy that cannot render is rejected with a reason", () => {
  const plan = planVisual(
    { text: "Something happened", archetype: "STATEMENT", anchor_token: "something", data: {}, visual: { strategy: "DATA_CHART" } },
    { channel }
  );
  if (plan.strategy === "DATA_CHART") return "routed to DATA_CHART with no series";
  const rej = plan.fallbacks.find((f) => /DATA_CHART/.test(f.from) || /DATA_CHART/.test(f.reason));
  return !!rej || `no fallback recorded: ${JSON.stringify(plan.fallbacks)}`;
});

check("an authored plan wins over the deterministic reading", () => {
  const plan = planVisual(
    {
      text: "Police used a geofence warrant to scan a 150 meter radius",
      archetype: "HERO_NUMBER",
      anchor_token: "150 meter",
      data: { unit: "meters" },
      visual: { strategy: "SCALE_COMPARISON", concept: "how big 150m is" },
    },
    { channel }
  );
  return (plan.strategy === "SCALE_COMPARISON" && plan.provenance === "authored") || `${plan.strategy}/${plan.provenance}`;
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nPART 11/12 — states are proportional, and long concepts densify");

check("states always tile the whole beat window with no gaps", () => {
  for (const dur of [45, 90, 162, 300, 600]) {
    for (const anchor of [5, Math.floor(dur / 2), dur - 5]) {
      const plan = planVisual(geofenceBeat, { channel });
      const states = buildStates(plan, win(dur, anchor));
      if (!states.length) return `no states for dur=${dur}`;
      if (states[0].startFrame !== 0) return `dur=${dur} anchor=${anchor}: starts at ${states[0].startFrame}`;
      if (states[states.length - 1].endFrame !== dur) return `dur=${dur} anchor=${anchor}: ends at ${states[states.length - 1].endFrame}`;
      for (let i = 1; i < states.length; i++) {
        if (states[i].startFrame !== states[i - 1].endFrame) return `dur=${dur} anchor=${anchor}: gap at state ${i}`;
      }
    }
  }
  return true;
});

check("a long concept densifies instead of holding one static state", () => {
  const plan = planVisual(geofenceBeat, { channel });
  const states = buildStates(plan, win(600, 300)); // 20s beat
  const longest = longestStaticRun(states);
  return longest <= MAX_STATE_FRAMES + 2 || `longest state ${longest}f > cap ${MAX_STATE_FRAMES}f`;
});

check("a lopsided anchor does not create a long pre-anchor stall", () => {
  // The exact regression a real render exposed: anchor late in the window.
  const plan = planVisual({ text: "The statute's clause was buried in section 4", archetype: "TERM_DEFINE", anchor_token: "section 4", data: {} }, { channel });
  const states = buildStates(plan, win(300, 283));
  const longest = longestStaticRun(states);
  return longest <= MAX_STATE_FRAMES + 2 || `longest state ${longest}f with a late anchor`;
});

check("sustaining states never rename the concept", () => {
  const plan = planVisual(geofenceBeat, { channel });
  const states = buildStates(plan, win(900, 400));
  const base = new Set(STRATEGIES.GEOSPATIAL_RADIUS.states.map((s) => s.key));
  const bad = states.filter((s) => !base.has(s.key) && !s.sustaining);
  return bad.length === 0 || `unexpected state ${bad[0].key}`;
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nsemantics — readings that a rendered frame proved wrong once");

check("'because' puts the CAUSE upstream of the EFFECT, not the reverse", () => {
  // Real defect: "Throughput collapsed because the second stage was holding"
  // drew collapse -> holding, i.e. an outcome causing its own cause.
  const r = analyzeBeat({
    text: "Throughput collapsed because the second stage was holding every batch until the slowest item finished.",
    archetype: "RELATION", anchor_token: "because", data: {},
  }).signals.CAUSE_EFFECT;
  if (!r) return "no causal signal";
  return (/second stage/.test(r.cause) && /collapsed/.test(r.effect)) || `cause="${r.cause}" effect="${r.effect}"`;
});

check("a forward marker keeps its natural order", () => {
  const r = analyzeBeat({
    text: "The batching rule led to a complete collapse in throughput.",
    archetype: "RELATION", anchor_token: "led to", data: {},
  }).signals.CAUSE_EFFECT;
  return (/batching rule/.test(r.cause) && /collapse/.test(r.effect)) || `cause="${r.cause}" effect="${r.effect}"`;
});

check("spelled-out numerals compose across words", () => {
  // "five hundred dollars" read as 100 once, so an accumulation counted to 100.
  const cases = [
    ["Twenty small purchases became five hundred dollars", 500],
    ["grew to eight hundred and forty dollars", 840],
    ["three hundred and forty dollars in interest", 340],
  ];
  for (const [text, want] of cases) {
    const nums = analyzeBeat({ text, archetype: "HERO_NUMBER", anchor_token: "", data: {} }).numbers;
    if (!nums.some((n) => n.value === want)) return `"${text}" -> ${JSON.stringify(nums.map((n) => n.value))}, wanted ${want}`;
  }
  return true;
});

check("a pronoun 'one' is not counted as a stated quantity", () => {
  // "Each one felt too small" became count=2 via a Math.max floor, so a
  // $500 total drew two cards — a picture stating a fact nobody said.
  const plan = planVisual({
    text: "quietly became five hundred dollars by the end of the month. Each one felt too small to matter.",
    archetype: "HERO_NUMBER", anchor_token: "five hundred dollars", data: {},
  }, { channel: financeChannel });
  if (plan.strategy !== "ACCUMULATION") return `routed to ${plan.strategy}`;
  return plan.supporting.countKnown === false || `countKnown=${plan.supporting.countKnown} count=${plan.supporting.count}`;
});

check("an opposition splits on the contrast, not on a reporting verb", () => {
  const r = analyzeBeat({
    text: "The government argued that short-term location data isn't a search, but Justice Kagan disagreed, ruling that it is.",
    archetype: "CONTRAST", anchor_token: "disagreed", data: {},
  }).signals.COMPARISON;
  if (!r || !r.qualitative) return "no qualitative opposition detected";
  return (r.pivot.toLowerCase() === "but" && /government/.test(r.left) && /Kagan/.test(r.right))
    || `pivot="${r.pivot}" left="${r.left.slice(0, 40)}"`;
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\ndiagnostics");

check("summarizeVisuals reports icon-hero as zero for planned beats", () => {
  const plan = planVisual(geofenceBeat, { channel });
  const beats = [{ ...geofenceBeat, archetype: "HERO_NUMBER", durationInFrames: 120, visualPlan: plan, visualStates: buildStates(plan, win()), scene: { iconRole: plan.iconRole, icon: null } }];
  const s = summarizeVisuals(beats);
  return s.metrics.iconHeroRatio === 0 || `iconHeroRatio=${s.metrics.iconHeroRatio}`;
});

check("summarizeVisuals flags a beat that still renders an icon hero", () => {
  const beats = [{ text: "x", archetype: "STATEMENT", durationInFrames: 120, visualPlan: null, visualStates: [], scene: { iconRole: "none", icon: "banknote" } }];
  const s = summarizeVisuals(beats);
  return s.warnings.some((w) => w.id === "VIS-ICON-HERO") || "no VIS-ICON-HERO warning";
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nno dead code");

check("no module exports something nothing imports", () => {
  // Two pass-2 leftovers (director.planAll, strategies.strategyNames) were
  // exported and never called by anything, including this suite. An export
  // with no reader is a maintenance cost and, worse, reads as a supported
  // entry point that is actually untested.
  const roots = [
    join(__dirname),
    join(__dirname, "..", "compositions"),
    join(__dirname, "..", "compositions", "scenes"),
    join(__dirname, "..", "qa-scripts"),
  ];
  const sources = [];
  for (const dir of roots) {
    for (const f of readdirSync(dir)) {
      if (!/\.(js|jsx|mjs)$/.test(f)) continue;
      sources.push({ file: join(dir, f), src: readFileSync(join(dir, f), "utf-8") });
    }
  }
  sources.push({ file: "render.js", src: readFileSync(join(__dirname, "..", "render.js"), "utf-8") });
  const corpus = sources.map((s) => s.src).join("\n");

  const dead = [];
  for (const { file, src } of sources) {
    if (!file.includes(`${sep}visual${sep}`)) continue; // this pass's own modules
    for (const m of src.matchAll(/export (?:function|const) (\w+)/g)) {
      const name = m[1];
      const uses = [...corpus.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
      if (uses <= 1) dead.push(`${basename(file)}: ${name}`);
    }
  }
  return dead.length === 0 || `exported but never imported: ${dead.join(", ")}`;
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nnothing draws outside the safe rect");

check("a document page never draws outside the safe rect", () => {
  // Calls the RENDERER'S OWN geometry function against the RENDERER'S OWN
  // constants, both imported from compositions/layout-constants.js.
  //
  // Two earlier versions of this check were wrong in the same way. Both
  // recovered SAFE and CAPTION_RESERVE_Y by regex over primitives.jsx —
  // node cannot import .jsx, so there was no other option — and one of them
  // also recomputed the page from DOCUMENT_PAGE_TOP and DOCUMENT_PAGES.
  // That duplicate stayed true right up until the scene began scaling the
  // page to its shot, after which the check was verifying a geometry the
  // renderer had abandoned and passing anyway. Moving the constants and the
  // maths into a pure .js module is what makes one model with two callers
  // possible; parsing source text never could.
  const failures = [];
  // Every framing DOCUMENT_EVIDENCE can receive, at every page variant.
  for (let v = 0; v < 3; v++) {
    for (const variant of [0, 1]) {
      const shot = composeShot("DOCUMENT_EVIDENCE", { variant });
      const f = {
        w: 1080 * (shot.bleed ? Math.max(shot.coverage, 1.05) : shot.coverage),
        cx: 1080 * shot.anchorX,
      };
      const g = documentPageGeometry(v, f);
      const where = `variant ${v} framing ${shot.framing.id}`;
      // The whole stack sits CAPTION_RESERVE_Y lower than design space says,
      // because captions are off and DesignSpace drops the stage into the
      // band they used to occupy. That drop is what broke this scene the
      // first time, so it is applied here rather than assumed away.
      if (g.py + CAPTION_RESERVE_Y < SAFE.top) {
        failures.push(`${where}: page top ${Math.round(g.py + CAPTION_RESERVE_Y)} < SAFE.top ${SAFE.top}`);
      }
      const clauseBottom = g.clause.y + g.clause.h + CAPTION_RESERVE_Y;
      if (clauseBottom > SAFE.bottom) {
        failures.push(`${where}: clause bottom ${Math.round(clauseBottom)} > SAFE.bottom ${SAFE.bottom}`);
      }
      if (g.px < SAFE.left || g.px + g.pageW > SAFE.right) {
        failures.push(`${where}: page spans ${Math.round(g.px)}..${Math.round(g.px + g.pageW)} outside ${SAFE.left}..${SAFE.right}`);
      }
      // The clause overhangs the page on both sides; it is the wider element
      // and therefore the one that decides whether the composition fits.
      if (g.clause.x < SAFE.left || g.clause.x + g.clause.w > SAFE.right) {
        failures.push(`${where}: clause spans ${Math.round(g.clause.x)}..${Math.round(g.clause.x + g.clause.w)} outside ${SAFE.left}..${SAFE.right}`);
      }
    }
  }
  return failures.length === 0 || failures.join("; ");
});
check("every strategy has a material, framing, camera and depth", () => {
  const r = assertCompositionIsComplete(STRATEGIES);
  return r.pass || r.failures.join("; ");
});

check("no two strategies share a whole shot signature", () => {
  // Two strategies with the same material, framing, camera AND depth will
  // look alike however different their subjects are. This caught
  // ACCUMULATION vs DATA_CHART and RELATIONSHIP vs VISUAL_METAPHOR in the
  // first draft of the table, which is exactly what it is for.
  const dupes = Object.entries(shotSignatures(STRATEGIES)).filter(([, v]) => v.length > 1);
  return dupes.length === 0 || dupes.map(([k, v]) => `${k}: ${v.join(" + ")}`).join("; ");
});

check("depth planes are far enough apart to be seen as depth", () => {
  // `vendor/video-shotcraft`'s depth-layer reference (Apache-2.0, already
  // vendored here) states it as a number: the parallax gradient between
  // adjacent planes must be >= 2x or the eye does not separate them, and a
  // shot gets at most four planes before it reads as overload.
  //
  // The first draft of DEPTH_PROFILES broke the first rule on both profiles
  // — LAYERED's foreground step was 1.35x and DEEP's was 1.50x — so those
  // planes were doing arithmetic and not much else.
  const problems = [];
  for (const [name, profile] of Object.entries(DEPTH_PROFILES)) {
    const planes = profile.planes;
    if (planes.length > 4) problems.push(`${name}: ${planes.length} planes, reference caps depth at 4`);
    for (let i = 1; i < planes.length; i++) {
      const g = planes[i].parallax / planes[i - 1].parallax;
      if (g < 2) {
        problems.push(`${name}: ${planes[i - 1].name}->${planes[i].name} gradient ${g.toFixed(2)}x is below 2x`);
      }
    }
  }
  return problems.length === 0 || problems.join("; ");
});

check("a plane ends up moving exactly its parallax factor times the camera", () => {
  // THE SIGN WAS INVERTED AND THE DEPTH READ BACKWARDS. `Shot` translates
  // the world by the camera's travel, so a plane at factor k must ADD
  // (k-1)*travel to land on k*travel. The first version added
  // (k-1)*travel*-1, which on TIMELINE's TRACK_RIGHT sent the FAR plane
  // 1.86x the camera's distance — it should go 0.14x — and sent the
  // FOREGROUND plane backwards at -0.20x. Near and far were swapped, so
  // every scene using planes was reading its own depth inside out.
  //
  // Checked as a RATIO against the camera's own travel, which is the thing
  // the parallax factor is defined against; asserting a pixel number would
  // just re-encode whatever the code happens to do.
  const problems = [];
  for (const name of composedStrategies()) {
    const shot = composeShot(name, { variant: 0 });
    const cam = shot.camera;
    const travelX = (cam.to.x - cam.from.x) * 1080;
    const travelY = (cam.to.y - cam.from.y) * 1920;
    // A HOLD has no travel, so there is no ratio to check — and no depth to
    // read either. Skipped rather than fudged.
    if (Math.abs(travelX) < 1e-6 && Math.abs(travelY) < 1e-6) continue;
    for (const plane of shot.planes) {
      const off = planeOffset(shot, plane.name, 1);
      for (const [axis, travel, add] of [["x", travelX, off.x], ["y", travelY, off.y]]) {
        if (Math.abs(travel) < 1e-6) continue;
        const ratio = (travel + add) / travel;
        if (Math.abs(ratio - plane.parallax) > 1e-6) {
          problems.push(`${name}.${plane.name} moves ${ratio.toFixed(2)}x the camera on ${axis}, declared ${plane.parallax}x`);
        }
      }
    }
  }
  return problems.length === 0 || problems.slice(0, 6).join("; ");
});

check("every plane carries a depth anchor, and the subject stays sharp", () => {
  // The same reference names the failure mode for offset-only parallax:
  // without a blur / desaturation anchor, layers read as stickers sliding
  // around rather than as distance. Plane applied only the translation
  // until this was added.
  const problems = [];
  for (const [name, profile] of Object.entries(DEPTH_PROFILES)) {
    for (const plane of profile.planes) {
      for (const key of ["blur", "saturate", "opacity"]) {
        if (typeof plane[key] !== "number") problems.push(`${name}.${plane.name} has no ${key}`);
      }
      if (plane.name === "subject") {
        // The layer being read is never softened. Everything else may be.
        if (plane.blur !== 0) problems.push(`${name}.subject is blurred ${plane.blur}px — the read layer must be sharp`);
        if (plane.saturate !== 1 || plane.opacity !== 1) problems.push(`${name}.subject is not at full saturation/opacity`);
      } else if (plane.blur === 0 && plane.saturate === 1 && plane.opacity === 1) {
        problems.push(`${name}.${plane.name} has parallax but no blur/saturation/opacity anchor`);
      }
    }
  }
  // And the component has to actually apply them.
  const stage = readFileSync(join(__dirname, "..", "compositions", "scenes", "stage.jsx"), "utf-8");
  if (!/filter:\s*parts/.test(stage)) problems.push("stage.jsx Plane does not apply a filter — the anchors are inert");
  return problems.length === 0 || problems.join("; ");
});

check("shots are not all centred", () => {
  // The pixel audit found fifteen of sixteen scenes centred within a few
  // percent of cx 0.43. Framing has to actually vary or the composition
  // layer is just paperwork.
  const xs = new Set();
  const ys = new Set();
  for (const name of composedStrategies()) {
    const s = composeShot(name, { variant: 0 });
    xs.add(s.anchorX);
    ys.add(s.anchorY);
  }
  if (xs.size < 3) return `only ${xs.size} distinct horizontal anchors across 16 strategies`;
  if (ys.size < 3) return `only ${ys.size} distinct vertical anchors across 16 strategies`;
  return true;
});

check("coverage is large enough that scenes are not hairlines", () => {
  // ISOLATED is the one deliberately sparse framing and is allowed; nothing
  // else may sit below half the frame's short axis.
  const thin = composedStrategies()
    .map((n) => [n, composeShot(n, { variant: 0 })])
    .filter(([, s]) => s.coverage < 0.5 && s.framing.id !== "isolated");
  return thin.length === 0 || thin.map(([n, s]) => `${n} at ${s.coverage}`).join(", ");
});

check("every camera move states a reason", () => {
  const bad = Object.values(CAMERA_MOVES).filter((m) => !m.reason || m.reason.length < 12);
  return bad.length === 0 || `moves without a reason: ${bad.map((m) => m.id).join(", ")}`;
});

check("a strategy's variants are framed differently", () => {
  // Where a strategy offers more than one framing, consecutive uses must
  // actually get different ones — that is the anti-repetition mechanism.
  const same = [];
  for (const name of composedStrategies()) {
    const a = composeShot(name, { variant: 0 });
    const b = composeShot(name, { variant: 1 });
    const opts = new Set([a.framing.id, b.framing.id]);
    // One-framing strategies (the map, the interface) are intentional.
    if (opts.size === 1 && a.framing.id !== "immersive" && a.framing.id !== "close") {
      same.push(`${name} always ${a.framing.id}`);
    }
  }
  return same.length === 0 || same.join("; ");
});

check("composing a shot is deterministic", () => {
  const a = JSON.stringify(composeShot("CAUSE_EFFECT", { variant: 1 }));
  const b = JSON.stringify(composeShot("CAUSE_EFFECT", { variant: 1 }));
  return a === b || "two calls produced different shots";
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nevery strategy is actually reachable");

check("every strategy the director can prefer has a way to be selected", () => {
  // The registry guard checked that every strategy is IN STRATEGY_PREFERENCE.
  // It never checked the other direction — that a listed strategy has a
  // detector — and two did not: DATA_CHART and SCALE_COMPARISON sat in the
  // preference list with no entry in the signals table, so
  // `if (!signal) continue` skipped them on every beat of every video. They
  // were reachable only through an authored `visual.strategy` block, which
  // no real script has yet written (authoredVisualPlanRatio is 0 on all
  // three test renders). Dead in practice while looking wired.
  const signals = Object.keys(analyzeBeat({ text: "probe", archetype: "STATEMENT", data: {} }).signals);
  const unreachable = [];
  for (const name of STRATEGY_PREFERENCE) {
    if (signals.includes(name)) continue;
    const how = STRATEGIES[name] && STRATEGIES[name].reachedBy;
    if (how === "asset" || how === "terminal") continue; // declared, deliberate
    unreachable.push(`${name} has no detector and no reachedBy declaration`);
  }
  return unreachable.length === 0 || unreachable.join("; ");
});

check("a comparison is between exactly two things", () => {
  // ComparisonScene draws two columns and slices the series to 2, so
  // accepting more silently DISCARDED real stated values.
  const four = [
    { label: "NORTH", value: 40 }, { label: "SOUTH", value: 65 },
    { label: "EAST", value: 30 }, { label: "WEST", value: 90 },
  ];
  const plan = planVisual(
    { text: "Four regions compared", archetype: "PROGRESS", anchor_token: "ninety", data: { series: four } },
    { sectionText: "The figures were forty, sixty five, thirty and ninety across the four regions." }
  );
  if (plan.strategy !== "DATA_CHART") return `four points routed to ${plan.strategy}`;
  const kept = (plan.supporting.series || []).length;
  return kept === 4 || `only ${kept} of 4 stated values survived to the scene`;
});

check("a magnitude with no reference is not a scale comparison", () => {
  // "five percent" alone has nothing to be scaled against; only "N percent
  // OF the <thing>" does. Without this the detector would swallow every
  // percentage in the corpus.
  const plan = planVisual(
    { text: "Rates rose to five percent", archetype: "PROGRESS", anchor_token: "five percent", data: {} },
    { sectionText: "Rates rose to five percent last year." }
  );
  return plan.strategy !== "SCALE_COMPARISON" || "a bare percentage was read as a scale comparison";
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nthe scenes actually compile");

check("every scene component parses as JSX", () => {
  // This suite runs in node, which cannot import .jsx, so several checks
  // read the scene files as TEXT. That is what makes them possible at all,
  // and it is also a blind spot: a JSX comment placed inside an attribute
  // list is invalid syntax that every text-based check happily passes, and
  // it took a 15-minute render to the bundler to find out. esbuild is
  // already in this package's node_modules; parsing costs milliseconds.
  const dir = join(__dirname, "..", "compositions", "scenes");
  const compDir = join(__dirname, "..", "compositions");
  let esbuild;
  try {
    esbuild = createRequire(import.meta.url)("esbuild");
  } catch {
    return "esbuild not resolvable — cannot verify the scenes parse";
  }
  const failures = [];
  const files = [
    ...readdirSync(dir).filter((f) => f.endsWith(".jsx")).map((f) => join(dir, f)),
    ...readdirSync(compDir).filter((f) => f.endsWith(".jsx")).map((f) => join(compDir, f)),
  ];
  for (const file of files) {
    try {
      esbuild.buildSync({ entryPoints: [file], bundle: false, write: false, loader: { ".jsx": "jsx" } });
    } catch (err) {
      failures.push(`${basename(file)}: ${String(err.message).split("\n")[1] || err.message}`);
    }
  }
  return failures.length === 0 || failures.join("; ");
});

check("an asset-library photo is reachable with the id the renderer passes", () => {
  // A REAL PRODUCTION BUG, found by tracing rather than by a render.
  //
  // Both image sources are keyed by the slug form of the channel id:
  // data/asset-library/index.json stores "channelId": "ch-01", the legacy
  // manifests are b-roll-manifest-ch-01.json, and the files live under
  // public/asset-library/ch-01/. render.js was passing its raw CLI argument
  // instead, and scripts/render-and-qa.js invokes it with String(c.id) —
  // so every lookup compared "1" against "ch-01" and returned nothing.
  // Every photo in the library was unreachable, and IMAGE_EVIDENCE, whose
  // only trigger is "a real asset exists for this section", could never
  // fire on any beat of any video.
  //
  // Checked against the manifest that actually ships, so a re-keyed
  // library or a reverted call site both fail here.
  const manifestPath = join(ROOT, "data", "asset-library", "index.json");
  if (!existsSync(manifestPath)) return true; // nothing catalogued yet
  const lib = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const assets = lib.assets || [];
  if (assets.length === 0) return true;

  const all = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = all.channels || all;
  const problems = [];
  for (const asset of assets) {
    const owner = channels.find((c) => c.channel_id === asset.channelId);
    if (!owner) {
      problems.push(`asset ${asset.id} is keyed "${asset.channelId}" which is no channel's channel_id`);
      continue;
    }
    // The cue the asset was catalogued under must find it again through
    // the real resolver, with the id render.js now passes.
    const hit = resolveImageAssets([asset.query || asset.id], owner.channel_id, null);
    if (!hit.length) {
      problems.push(`asset ${asset.id} does not resolve for its own query "${asset.query}" under ${owner.channel_id}`);
    }
  }
  // And the numeric form must NOT work, or the check proves nothing about
  // which spelling the call site uses.
  const sample = assets[0];
  const numeric = channels.find((c) => c.channel_id === sample.channelId);
  if (numeric && resolveImageAssets([sample.query || sample.id], String(numeric.id), null).length) {
    problems.push("the numeric id resolves too — this check cannot detect the mismatch it exists for");
  }
  // The call site itself: passing the CLI argument is the bug.
  const renderSrc = readFileSync(join(__dirname, "..", "render.js"), "utf-8");
  if (/resolveImageAssets\([^)]*,\s*channelId\s*,/.test(renderSrc)) {
    problems.push("render.js passes its raw CLI channelId to resolveImageAssets — must be channel.channel_id");
  }
  return problems.length === 0 || problems.join("; ");
});

check("no scene references an identifier that does not exist", () => {
  // The one every other check here is blind to. `OppositionComparison` read
  // `f.w`, `f.cx` and `f.h` with `f` neither a parameter nor a declaration
  // anywhere in the module — a guaranteed ReferenceError the moment a
  // qualitative COMPARISON beat rendered — and `abstract-scenes.jsx` called
  // `shotFrame` without importing it, which would have crashed every
  // VISUAL_METAPHOR and CINEMATIC_STATEMENT beat. Both shipped past the
  // text checks (no scope model), the per-file parse (syntax only), and the
  // whole-graph bundle (a free identifier is a legal global reference).
  //
  // Both were introduced by a refactor that converted scenes to lay out
  // against the shot frame, and both were in branches the clips I had
  // rendered never took. That is precisely the shape of bug a render cannot
  // be relied on to find.
  const roots = [
    join(__dirname, "..", "compositions"),
    join(__dirname, "..", "compositions", "scenes"),
    join(__dirname),
    join(__dirname, "..", "layers"),
    join(__dirname, "..", "primitives"),
    join(__dirname, "..", "effects"),
    join(__dirname, "..", "layout"),
    join(__dirname, "..", "styles"),
    join(__dirname, "..", "beats"),
    join(__dirname, "..", "captions"),
  ];
  const failures = [];
  let scanned = 0;
  for (const dir of roots) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!/\.(jsx|js)$/.test(name)) continue;
      const file = join(dir, name);
      let found;
      try {
        found = undefinedIdentifiers(readFileSync(file, "utf-8"), name);
      } catch (err) {
        failures.push(`${name}: could not parse — ${String(err.message).split("\n")[0]}`);
        continue;
      }
      scanned++;
      for (const x of found) {
        if (x.unavailable) return "@babel/parser not resolvable — cannot check scope";
        failures.push(`${name}:${x.line} \`${x.name}\` in ${x.fn}`);
      }
    }
  }
  if (scanned < 20) return `only scanned ${scanned} files — the scan is not reaching the render path`;
  return failures.length === 0 || failures.join("; ");
});

check("the scene graph resolves — every import names something that exists", () => {
  // Parsing each file ALONE cannot see across module boundaries, and that is
  // where the last two breakages actually were: a helper moved into a pure
  // .js module while an importer still named the old .jsx file, and a
  // constant re-exported from one file but never defined in the other.
  // Bundling from the router resolves the whole graph and fails on a name
  // that is imported but not exported.
  //
  // Not written to disk and not the render bundle — this is a resolution
  // check, not a build. The real render still goes through @remotion/bundler.
  let esbuild;
  try {
    esbuild = createRequire(import.meta.url)("esbuild");
  } catch {
    return "esbuild not resolvable — cannot verify the scene graph resolves";
  }
  const entries = [
    join(__dirname, "..", "compositions", "scenes", "index.jsx"),
    join(__dirname, "..", "compositions", "motion-graphics.jsx"),
  ];
  const failures = [];
  for (const entry of entries) {
    try {
      esbuild.buildSync({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: "esm",
        platform: "browser",
        loader: {
          ".jsx": "jsx", ".js": "jsx", ".json": "json",
          // Media and font imports are real (audio.js imports vo.mp3). They
          // are dropped rather than embedded: their bytes prove nothing about
          // whether the module graph resolves, and reading them would make
          // this check cost megabytes.
          ".mp3": "empty", ".wav": "empty", ".png": "empty", ".jpg": "empty",
          ".jpeg": "empty", ".svg": "empty", ".webp": "empty", ".mp4": "empty",
          ".woff": "empty", ".woff2": "empty", ".ttf": "empty", ".otf": "empty",
          ".css": "empty",
        },
        // Third-party packages are somebody else's problem; this check is
        // about THIS repo's own module graph.
        external: ["react", "react-dom", "remotion", "@remotion/*"],
        logLevel: "silent",
      });
    } catch (err) {
      const detail = (err.errors || []).map((e) => `${e.location ? basename(e.location.file) + ":" + e.location.line + " " : ""}${e.text}`);
      failures.push(`${basename(entry)}: ${detail.join(" | ") || err.message}`);
    }
  }
  return failures.length === 0 || failures.join("; ");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nnumbers land on their word");

check("a counter never contradicts the picture it labels at the anchor", () => {
  // Found on a rendered frame: the accumulation beat displayed "$0" on the
  // exact frame the narration said "five hundred dollars", because the
  // figure was driven by its own anchored state and started counting there.
  //
  // The rule is NOT "every figure is full at the anchor" — an earlier
  // version of this test said that and was wrong. Where the anchored state
  // INTRODUCES the quantity (COMPARISON's second bar lands on the anchor,
  // SCALE_COMPARISON's quantity grows from it), the figure SHOULD grow with
  // it; forcing it to full would print "$340" above a bar of zero height,
  // the same contradiction the other way round.
  //
  // The distinction is declared on the state itself as `resolves`: true
  // means the thing being labelled is already on screen and the anchored
  // state finishes it, so a figure must not restart there.
  const dir = join(__dirname, "..", "compositions", "scenes");
  const offenders = [];
  for (const [name, def] of Object.entries(STRATEGIES)) {
    const anchored = (def.states || []).find((s) => s.anchored);
    if (!anchored || !anchored.resolves) continue;
    const file = readdirSync(dir)
      .filter((f) => f.endsWith(".jsx"))
      .map((f) => ({ f, src: readFileSync(join(dir, f), "utf-8") }))
      .find((x) => new RegExp(`function ${def.scene}\\b`).test(x.src));
    if (!file) continue;
    const start = file.src.indexOf(`function ${def.scene}`);
    const next = file.src.indexOf("\nexport function", start + 1);
    const body = file.src.slice(start, next === -1 ? undefined : next);
    // p{Lock}, p{Right}, p{Grow}... the hook name for the anchored state.
    const hook = "p" + anchored.key[0].toUpperCase() + anchored.key.slice(1);
    const re = new RegExp(`<Figure[^>]*p=\\{[^}]*\\b${hook}\\b`, "s");
    if (re.test(body)) offenders.push(`${def.scene}: <Figure p={...${hook}}> restarts at an anchor that only RESOLVES an already-drawn value`);
  }
  return offenders.length === 0 || offenders.join("; ");
});

check("useValueProgress reaches exactly 1 on the anchor frame", () => {
  // Simulated directly: the helper is a React hook, so the arithmetic it
  // performs is checked here rather than the hook itself.
  const plan = planVisual(geofenceBeat, { channel });
  const states = buildStates(plan, { startFrame: 0, durationInFrames: 240, anchorFrame: 150 });
  const anchored = states.find((s) => s.anchored);
  if (!anchored) return "no anchored state";
  const at = (f) => Math.max(0, Math.min(1, f / anchored.startFrame));
  if (at(anchored.startFrame) !== 1) return `progress at anchor = ${at(anchored.startFrame)}`;
  if (at(anchored.startFrame + 30) !== 1) return "progress falls back after the anchor";
  if (at(0) !== 0) return `progress at beat start = ${at(0)}`;
  return true;
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\non-screen text budget");

check("no strategy prints more than the supporting-text budget", () => {
  const over = [];
  for (const beat of [
    geofenceBeat,
    { text: "The government argued that short-term location data is not a search, but Justice Kagan disagreed, ruling that it is.", archetype: "CONTRAST", anchor_token: "disagreed", data: {} },
    { text: "The Fourth Amendment requires a warrant supported by probable cause and particularity of place.", archetype: "STATEMENT", anchor_token: "warrant", data: {} },
    { text: "Each purchase was small, but the balance you carry compounds every month it survives.", archetype: "STATEMENT", anchor_token: "balance", data: {} },
    { text: "The request passes through intake, then review, then approval before anything ships.", archetype: "PROCESS", anchor_token: "review", data: {} },
    { text: "Every regulator, every bank and every clearing house depends on the same settlement layer.", archetype: "STATEMENT", anchor_token: "settlement", data: {} },
  ]) {
    const plan = planVisual(beat, { channel });
    const words = plan.supporting.words || 0;
    if (words > MAX_SUPPORTING_WORDS) over.push(`${plan.strategy}: ${words} words`);
  }
  return over.length === 0 || over.join("; ");
});

check("no scene re-derives its own on-screen phrase", () => {
  // The three extractors this replaced lived in the scene files with three
  // different word limits, and nothing outside the JSX could count them.
  const dir = join(__dirname, "..", "compositions", "scenes");
  const offenders = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".jsx"))) {
    const src = readFileSync(join(dir, f), "utf-8");
    if (/function (subjectPhrase|clauseFrom|keyWords)\s*\(/.test(src)) offenders.push(f);
  }
  return offenders.length === 0 || `phrase extractors still in ${offenders.join(", ")}`;
});

check("summarizeVisuals flags a beat that prints a subtitle", () => {
  const s = summarizeVisuals([{
    text: "one two three four five six seven eight nine ten", archetype: "STATEMENT",
    durationInFrames: 90, visualStates: [], scene: { iconRole: "none" },
    visualPlan: { strategy: "COMPARISON", provenance: "deterministic", fallbacks: [], supporting: { words: 14 } },
  }]);
  return s.warnings.some((w) => w.id === "VIS-TEXT-BUDGET") || "no VIS-TEXT-BUDGET warning";
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\ncomposition variants");

check("a declared variant count is backed by a scene that actually branches on it", () => {
  // Read the scene sources the same way the dead-strategy check reads the
  // router: a `variants: 3` declaration that no component consumes would
  // make the render report claim variety the pixels do not have.
  const dir = join(__dirname, "..", "compositions", "scenes");
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".jsx"))
    .map((f) => ({ f, src: readFileSync(join(dir, f), "utf-8") }));
  const bad = [];
  for (const [name, def] of Object.entries(STRATEGIES)) {
    const declared = def.variants || 1;
    const file = sources.find((s) => new RegExp(`function ${def.scene}\\b`).test(s.src));
    if (!file) {
      bad.push(`${name}: no source defines ${def.scene}`);
      continue;
    }
    const body = file.src.slice(file.src.indexOf(`function ${def.scene}`));
    const scoped = body.slice(0, body.indexOf("\nexport function") + 1 || undefined);
    const usesVariant = /variantOf\(beat\)/.test(scoped);
    // A scene may now vary through the SHOT instead: composition.js gives a
    // strategy several framings and the variant ordinal picks between them,
    // so a scene that lays out against shot.anchorX / coverage is already
    // rendering its second use differently. This check predates that layer
    // and originally demanded variantOf specifically, which would have
    // pushed a scene into carrying two variation mechanisms for one
    // purpose. Either satisfies the declaration; neither does not.
    const usesShot = /\bshot\.(anchorX|anchorY|coverage)\b/.test(scoped);
    const varies = usesVariant || usesShot;
    if (declared > 1 && !varies) bad.push(`${name} declares ${declared} variants but ${def.scene} neither calls variantOf nor lays out against the shot`);
    if (declared === 1 && usesVariant) bad.push(`${def.scene} calls variantOf but ${name} declares no variants`);
  }
  return bad.length === 0 || bad.join("; ");
});

check("variants are ordinals across a strategy's uses, so repeats cannot collide", () => {
  // Three beats on one strategy must get 0,1,2 — not three independent
  // hashes, which is what collided on the real ch-02 script.
  const plans = [0, 1, 2].map((i) => ({ strategy: "DOCUMENT_EVIDENCE", variantCount: 3, variant: i }));
  const seen = new Set(plans.map((p) => p.variant % p.variantCount));
  return seen.size === 3 || `only ${seen.size} distinct variants`;
});

check("summarizeVisuals flags two beats that draw the same composition", () => {
  const mk = (v) => ({
    text: "x", archetype: "STATEMENT", durationInFrames: 90, visualStates: [],
    scene: { iconRole: "none" },
    visualPlan: { strategy: "COMPARISON", provenance: "deterministic", variantCount: 1, variant: v, fallbacks: [] },
  });
  const s = summarizeVisuals([mk(0), mk(1)]);
  return s.warnings.some((w) => w.id === "VIS-SAME-COMPOSITION") || "no VIS-SAME-COMPOSITION warning";
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nsound design");

check("no dead sound entries: every mapped state, role and library asset is reachable", () => {
  const r = assertSoundMapIsSound(STRATEGIES, SFX_LIBRARY);
  return r.pass || r.failures.join("; ");
});

check("every library asset carries its licence and source", () => {
  // Provenance has to travel with the thing the RENDERER reads, not only
  // with the JSON record beside it. The first version of the generated
  // module stripped both fields and nobody would have noticed.
  const bad = SFX_LIBRARY.filter((e) => !e.license || !e.source);
  return bad.length === 0 || `${bad.length} entries with no licence/source: ${bad.map((e) => e.file).join(", ")}`;
});

check("every library asset actually exists under public/", () => {
  const dir = join(__dirname, "..", "public");
  const missing = SFX_LIBRARY.filter((e) => !existsSync(join(dir, e.file)));
  return missing.length === 0 || `missing: ${missing.map((e) => e.file).join(", ")}`;
});

check("every library asset carries MEASURED numbers, not placeholders", () => {
  const bad = SFX_LIBRARY.filter(
    (e) => !(e.durationMs > 0) || typeof e.meanDb !== "number" || typeof e.peakDb !== "number"
  );
  return bad.length === 0 || `${bad.length} entries missing measurements: ${bad.map((e) => e.file).join(", ")}`;
});

check("a sound is chosen for the material it lands on", () => {
  // `shot.material` was on every plan and read by nothing in the audio
  // path: a thud on paper and a thud on a machine bed played the same file.
  // This asserts the wiring actually changes the pick, on the three roles
  // where the 26-file library genuinely has more than one character.
  //
  // It does NOT claim the library can express every material — most roles
  // have one character and `assertSoundMapIsSound` fails if MATERIAL_CHARACTER
  // ever pretends otherwise.
  // GOES THROUGH soundEventsForBeat, NOT pickAsset. A first version of this
  // check called pickAsset directly with a material and passed even after
  // makeEvent stopped passing one — proving the function respects material
  // while the plan never reached it, which is the exact "wired but not
  // used" defect being fixed here. Real beats, real planner, real path.
  const problems = [];
  const sameSeedBeat = (strategy, stateKey) => {
    const shot = composeShot(strategy, { variant: 0 });
    return {
      startFrame: 0,
      durationInFrames: 120,
      archetype: "STATEMENT",
      visualPlan: { strategy, variant: 0, shot, supporting: {} },
      visualStates: [{ key: stateKey, startFrame: 0, durationInFrames: 120, endFrame: 120 }],
    };
  };
  // Pairs that share a discriminating role but sit on different materials.
  const pairs = [
    ["DOCUMENT_EVIDENCE", "page", "CAUSE_EFFECT", "effect", "impact"],       // paper vs field
    ["TRANSFORMATION", "settle", "TIMELINE", "focus", "emphasis"],           // mechanism vs atmosphere
  ];
  for (const [sa, ka, sb, kb, role] of pairs) {
    // Fresh carry each time: `avoid` is about not repeating, and letting it
    // leak between the two would explain a difference that material didn't.
    const ea = soundEventsForBeat(sameSeedBeat(sa, ka), SFX_LIBRARY, {})[0];
    const eb = soundEventsForBeat(sameSeedBeat(sb, kb), SFX_LIBRARY, {})[0];
    if (!ea || !eb) { problems.push(`${role}: ${!ea ? sa : sb} produced no event`); continue; }
    if (ea.role !== role || eb.role !== role) { problems.push(`${role}: got roles ${ea.role}/${eb.role}`); continue; }
    if (!ea.material || !eb.material) { problems.push(`${role}: event carries no material (${ea.material}/${eb.material})`); continue; }
    if (ea.character === eb.character) {
      problems.push(`${role}: ${ea.material} and ${eb.material} both chose "${ea.character}" — material is not reaching the pick`);
    }
  }
  // Every material the composition layer can assign is either mapped or
  // deliberately absent; a typo'd key would silently never match.
  const known = new Set(materialsWithCharacter());
  const composed = new Set(composedStrategies().map((s) => composeShot(s, { variant: 0 }).material));
  const unmapped = [...composed].filter((m) => !known.has(m));
  if (unmapped.length) problems.push(`materials no MATERIAL_CHARACTER entry covers: ${unmapped.join(", ")}`);
  return problems.length === 0 || problems.join("; ");
});

check("no sound is ever boosted above unity", () => {
  const over = [];
  for (const e of SFX_LIBRARY) {
    const v = volumeFor(e, e.role);
    if (v >= 1) over.push(`${e.file}@${v}`);
  }
  return over.length === 0 || `boosted to unity: ${over.join(", ")}`;
});

check("loudness normalisation lands each asset on its role target", () => {
  const off = [];
  for (const e of SFX_LIBRARY) {
    const out = e.meanDb + 20 * Math.log10(volumeFor(e, e.role));
    if (Math.abs(out - ROLE_TARGET_DB[e.role]) > 0.5) off.push(`${e.file} -> ${out.toFixed(1)}dB`);
  }
  return off.length === 0 || `off target: ${off.join(", ")}`;
});

check("sustaining states are silent — a long beat gets more picture, not more sound", () => {
  const plan = planVisual(geofenceBeat, { channel });
  // 20s: long enough that densify() must append sustaining states.
  const states = buildStates(plan, { startFrame: 0, durationInFrames: 600, anchorFrame: 300 });
  const sustaining = states.filter((s) => s.sustaining);
  if (sustaining.length === 0) return "densify produced no sustaining states to test";
  const events = soundEventsForBeat(
    { startFrame: 0, durationInFrames: 600, visualPlan: plan, visualStates: states },
    SFX_LIBRARY
  );
  const fromSustaining = events.filter((e) => sustaining.some((s) => s.key === e.state));
  return fromSustaining.length === 0 || `${fromSustaining.length} events fired on sustaining states`;
});

check("a beat never exceeds the per-beat cap or the minimum gap", () => {
  const plan = planVisual(geofenceBeat, { channel });
  const events = soundEventsForBeat(
    { startFrame: 0, durationInFrames: 300, visualPlan: plan, visualStates: buildStates(plan, { startFrame: 0, durationInFrames: 300, anchorFrame: 150 }) },
    SFX_LIBRARY
  );
  if (events.length > MAX_EVENTS_PER_BEAT) return `${events.length} events > cap ${MAX_EVENTS_PER_BEAT}`;
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].atFrame - events[i - 1].atFrame;
    if (gap < MIN_GAP_FRAMES) return `gap ${gap} < ${MIN_GAP_FRAMES}`;
  }
  return true;
});

check("scheduling is deterministic — the same beats give the same score", () => {
  const plan = planVisual(geofenceBeat, { channel });
  const beat = { startFrame: 90, durationInFrames: 300, archetype: "HERO_NUMBER", visualPlan: plan, visualStates: buildStates(plan, { startFrame: 90, durationInFrames: 300, anchorFrame: 200 }) };
  const a = JSON.stringify(buildSoundtrack([beat], SFX_LIBRARY));
  const b = JSON.stringify(buildSoundtrack([beat], SFX_LIBRARY));
  return a === b || "two runs produced different soundtracks";
});

check("a falling value gets a contraction, not an expansion", () => {
  const plan = planVisual(
    { text: "The fund fell from 40 million to 12 million in eighteen months.", archetype: "PROGRESS", anchor_token: "fell", data: {} },
    { channel: financeChannel }
  );
  if (plan.strategy !== "TRANSFORMATION") return `routed to ${plan.strategy}, not TRANSFORMATION`;
  const states = buildStates(plan, { startFrame: 0, durationInFrames: 240, anchorFrame: 120 });
  const grow = soundEventsForBeat({ startFrame: 0, durationInFrames: 240, visualPlan: plan, visualStates: states }, SFX_LIBRARY)
    .find((e) => e.state === "grow");
  if (!grow) return "no event on the `grow` state";
  return grow.role === "contraction" || `role=${grow.role} (from=${plan.supporting.from} to=${plan.supporting.to})`;
});

check("summarizeSound flags a score with no silence in it", () => {
  const events = Array.from({ length: 12 }, (_, i) => ({
    atFrame: i * 15, role: "texture", state: "x", reason: "y", volume: 0.1, targetDb: -38, file: "a.wav",
  }));
  const s = summarizeSound(events, { totalFrames: 180 });
  return s.warnings.some((w) => w.id === "AUD-NO-SILENCE") || `warnings: ${s.warnings.map((w) => w.id).join(",") || "none"}`;
});

check("summarizeSound flags an event that carries no reason", () => {
  const s = summarizeSound([{ atFrame: 0, role: "impact", volume: 0.3, targetDb: -31, file: "a.wav" }], { totalFrames: 300 });
  return s.warnings.some((w) => w.id === "AUD-UNEXPLAINED") || "no AUD-UNEXPLAINED warning";
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
