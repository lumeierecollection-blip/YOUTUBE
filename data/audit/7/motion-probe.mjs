// data/audit/7/motion-probe.mjs
// GATE probe for the audit-motion lane (Stage 7). Pure arithmetic, zero deps.
// Re-derives every number in the CLAIM-motion-* cards from first principles and
// from the INSTALLED Remotion binary. Run:  node motion-probe.mjs
// Exit code 0 = all gates pass; nonzero = a gate failed.
//
// Verifier note: this file is the lane's arithmetic record, not a source.
// Re-derive everything yourself before accepting a verdict.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..", "..");
const RENDER_PKG = path.join(REPO, "src", "skills", "remotion-render");

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// G1 — Frame → ms conversions at FPS=30 (MOTION-BLUEPRINT §1.3, beats.js:13-24)
// ─────────────────────────────────────────────────────────────────────────────
const FPS = 30;
const D = { micro: 4, short: 6, base: 9, large: 12, complex: 15, push: 60, hold: 45 };
const ms = (frames) => (frames / FPS) * 1000;

console.log("G1  frame→ms @30fps (beats.js D table):");
for (const [k, f] of Object.entries(D)) {
  const m = ms(f);
  console.log(`    ${k.padEnd(8)} ${String(f).padStart(2)}f -> ${m.toFixed(2)}ms`);
}
ok(Math.abs(ms(D.micro) - 133.33) < 0.01, "micro 4f = 133.33ms (blueprint comment '133ms')");
ok(Math.abs(ms(D.short) - 200) < 1e-9, "short 6f = 200.0ms");
ok(Math.abs(ms(D.base) - 300) < 1e-9, "base 9f = 300.0ms");
ok(Math.abs(ms(D.large) - 400) < 1e-9, "large 12f = 400.0ms");
ok(Math.abs(ms(D.complex) - 500) < 1e-9, "complex 15f = 500.0ms");
ok(Math.abs(ms(D.push) - 2000) < 1e-9, "push 60f = 2000.0ms (2.0s)");
ok(Math.abs(ms(D.hold) - 1500) < 1e-9, "hold 45f = 1500.0ms (1.5s)");

// ─────────────────────────────────────────────────────────────────────────────
// G2 — Material M3 duration slots (verified live: MDC Motion.md + Flutter
//      motion.dart + m3 tokens-specs). D tokens must hit these slots exactly
//      where the blueprint claims a slot mapping; micro is BETWEEN slots.
// ─────────────────────────────────────────────────────────────────────────────
const M3_SLOTS = [
  ["short1", 50], ["short2", 100], ["short3", 150], ["short4", 200],
  ["medium1", 250], ["medium2", 300], ["medium3", 350], ["medium4", 400],
  ["long1", 450], ["long2", 500], ["long3", 550], ["long4", 600],
  ["extraLong1", 700], ["extraLong2", 800], ["extraLong3", 900], ["extraLong4", 1000],
];
const slotAt = (m) => M3_SLOTS.find(([, v]) => v === m)?.[0] ?? null;

console.log("G2  D-token → M3 slot mapping:");
console.log("    slots:", M3_SLOTS.map(([n, v]) => `${n}=${v}`).join(" "));
ok(slotAt(200) === "short4", "D.short 200ms == M3 short4");
ok(slotAt(300) === "medium2", "D.base 300ms == M3 medium2");
ok(slotAt(400) === "medium4", "D.large 400ms == M3 medium4");
ok(slotAt(500) === "long2", "D.complex 500ms == M3 long2");
ok(slotAt(133.33) === null, "D.micro 133.33ms is NOT a raw M3 slot (sits between short2 100ms and short3 150ms) — blueprint arithmetic");
ok(slotAt(2000) === null && slotAt(1500) === null, "D.push/hold exceed the slot ceiling (extraLong4 1000ms) — cadence/readability-grounded, not slot-grounded");

// ─────────────────────────────────────────────────────────────────────────────
// G3 — Damping ratio ζ = c / (2·√(k·m)); Remotion spring-utils.js:35 uses this
//      exact formula. ζ>1 → overdamped → NO oscillation (no bounce).
// ─────────────────────────────────────────────────────────────────────────────
const zeta = (damping, stiffness, mass = 1) => damping / (2 * Math.sqrt(stiffness * mass));

console.log("G3  damping ratios (Remotion configs, mass=1):");
const configs = [
  ["blueprint E_PUSH (spring damping:200)", 200, 100],
  ["blueprint growSpring (§7.2 damping:16/stiffness:90)", 16, 90],
  ["legacy minimal.jsx:31 (100/120)", 100, 120],
  ["legacy minimal.jsx:32 (90/100)", 90, 100],
  ["legacy minimal.jsx:34 (80/90)", 80, 90],
  ["legacy cinematic-doc:120 (100/100)", 100, 100],
  ["legacy cinematic-doc:124 (100/80)", 100, 80],
  ["legacy cinematic-doc:155 (50/200)", 50, 200],
  ["mg.jsx:226 kicker spring (90/80)", 90, 80],
];
for (const [label, c, k] of configs) {
  const z = zeta(c, k);
  console.log(`    ${label.padEnd(52)} ζ = ${z.toFixed(3)}  ${z > 1 ? "overdamped (no oscillation)" : z < 1 ? "UNDERDAMPED (overshoots)" : "critically damped"}`);
}
ok(zeta(200, 100) === 10.0, "E_PUSH damping 200 / stiffness 100 -> ζ = 10.0 = 10× critical");
ok(zeta(200, 100) > 1, "E_PUSH ζ > 1 → overdamped → no bounce");
ok(zeta(16, 90) < 1, "growSpring ζ = 0.843 < 1 → underdamped → overshoot (the ONE place §7.2 permits it)");
ok(zeta(100, 120) > 1 && zeta(80, 90) > 1 && zeta(50, 200) > 1,
  "ALL legacy springs (damping 50-100) are ζ > 1 → none of them actually overshoot either");

// Overdamped no-oscillation proof (continuous solution): for ζ>1 the roots
// λ = −ζω₀ ± ω₀√(ζ²−1) of the characteristic equation are both real and
// strictly negative → x(t) = A·e^(λ₁t) + B·e^(λ₂t) is a monotone sum of
// decaying exponentials → never crosses the final value → zero overshoot.
const omega0 = (k, m = 1) => Math.sqrt(k / m);
const roots = (c, k, m = 1) => {
  const w0 = omega0(k, m);
  const z = zeta(c, k, m);
  const disc = Math.sqrt(Math.abs(z * z - 1));
  return [-z * w0 + w0 * disc, -z * w0 - w0 * disc];
};
for (const [label, c, k] of configs) {
  const [r1, r2] = roots(c, k);
  const z = zeta(c, k);
  const monotone = r1 < 0 && r2 < 0;
  if (z > 1 && !monotone) {
    ok(false, `${label}: overdamped roots must both be real and negative (got ${r1.toFixed(3)}, ${r2.toFixed(3)})`);
  } else if (z > 1) {
    console.log(`    ${label}: roots λ = ${r1.toFixed(3)}, ${r2.toFixed(3)} — both real & negative → monotone decay, no oscillation`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// G4 — Installed binary checks (root hoisted node_modules)
// ─────────────────────────────────────────────────────────────────────────────
const rootNodeModules = path.join(REPO, "node_modules");
const springUtils = path.join(rootNodeModules, "remotion", "dist", "cjs", "spring", "spring-utils.js");
const measureSpring = path.join(rootNodeModules, "remotion", "dist", "cjs", "spring", "measure-spring.js");
const transitionsIndex = path.join(rootNodeModules, "@remotion", "transitions", "dist", "esm", "index.mjs");

const read = (p) => fs.readFileSync(p, "utf8");

try {
  const su = read(springUtils);
  ok(su.includes("const zeta = c / (2 * Math.sqrt(k * m));"), "spring-utils.js:35 — installed binary uses ζ = c/(2√(km))");
  ok(/damping:\s*10/.test(su) && /stiffness:\s*100/.test(su) && /mass:\s*1/.test(su),
    "spring-utils.js defaultSpringConfig = {damping:10, mass:1, stiffness:100}");
  ok(/zeta < 1 \? underDampedPosition : criticallyDampedPosition/.test(su),
    "spring-utils.js:59 — oscillation branch ONLY for ζ < 1; ζ ≥ 1 is non-oscillatory");
  const msr = read(measureSpring);
  ok(/threshold = 0\.005/.test(msr), "measure-spring.js:11 — durationRestThreshold DEFAULT = 0.005 (blueprint Rule 5.3 + docs)");
  const ti = read(transitionsIndex);
  ok(ti.includes("options.durationRestThreshold"), "@remotion/transitions — springTiming passes durationRestThreshold through");
} catch (e) {
  console.log("FAIL  binary read:", e.message);
  failures += 1;
}

console.log(failures === 0 ? "\nALL GATES PASS" : `\n${failures} GATE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
