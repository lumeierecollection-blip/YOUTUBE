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

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { STRATEGIES, STRATEGY_PREFERENCE, TERMINAL_STRATEGY, assertStrategyRegistryIsSound } from "./strategies.js";
import { planVisual } from "./director.js";
import { buildStates, MAX_STATE_FRAMES, longestStaticRun } from "./states.js";
import { analyzeBeat } from "./semantics.js";
import { summarizeVisuals } from "./diagnostics.js";

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
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
