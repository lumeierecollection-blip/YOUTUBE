/**
 * data/audit/12/check-dot-grid-density.mjs — the COL-17/18 compiler probe
 * (audit-color lane, Stage 12). Fetches EXACT numbers, no judgement calls.
 *
 * What it proves, in two tiers:
 *
 *  TIER 1 (always runs, plain Node, no deps): the table and the section
 *  resolver in styles/tokens.js compute exactly what DETAIL-REFERENCE B2
 *  states — 6%/4%/0% per the eight live archetypes (COL-17 exact), one
 *  density per section as the min of its beats' densities, changing only
 *  at a section wipe (COL-18), fixed absolute 64 px pitch / 4 px dot
 *  (B2.3/B2.4, never %), and the B5 ceiling respected (every density
 *  <= .08). Then scans the APPLICATION SITE (motion-graphics.jsx) — the
 *  wiring gate for SFR-12-COL-1, method (b): the file must import the B2
 *  names from styles/tokens.js and apply them at exactly two dotGrid
 *  sites — Background via the STATE returned by
 *  dotGridStateForFrame(sectionRanges, beats, frame) (opacity from the B2
 *  set {0.06,0.04,0}, 0 = no layer), and the ListRunScene panel via the
 *  named constants DOT_DIAMETER / DOT_GRID_PITCH / DOT_GRID.LIST_ITEM,
 *  which resolve against the imported module to 4 / 64 / 0.04. Numeric
 *  literals are never accepted — a site resolving to 8/80 or opacity 0.1
 *  fails, and a hardcoded "*correct-looking*" 4/64/.04 fails too: the
 *  constants are single-sourced in tokens.js by construction.
 *
 *  TIER 2 (runs when the real deps exist — the render sandbox with
 *  `npm install` already done, i.e. the environment that ran
 *  pull-quote-probe.mjs): builds the REAL mg package from the real
 *  ch-fixture script + SRT via compositions/mg-package.js (mirroring
 *  verify-compositions.js), then re-runs every assertion on REAL beat
 *  archetypes per REAL section, including a full frame sweep that proves
 *  the applied opacity changes ONLY at a section wipe.
 *
 * Run:  node data/audit/12/check-dot-grid-density.mjs [motion-graphics.jsx path]
 * Exit: 0 = Tier-1 + Tier-2 (if deps present) + application site pass;
 *       1 = any failure.
 * APPLICATION_SITE failures count toward the exit code: PASS required.
 * The optional 2nd argv is a mutation-test hook: point the application-site
 * scan at a mutant copy of motion-graphics.jsx (see Phase-4 ledger — the
 * sneak fixtures proved 8/80 + opacity 0.1 and "correct-looking" 4/64/.04
 * literals both FAIL). With no argv the real composition is scanned.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..", "..");
const RENDER = path.join(REPO, "src", "skills", "remotion-render");

// Windows ESM: bare paths must be file:// URLs.
const imp = (p) => import(pathToFileURL(p).href);

// ---------------------------------------------------------------------------
// Tier 1 — the table + section resolver (styles/tokens.js, COL-owned).
// ---------------------------------------------------------------------------
const T = await imp(path.join(RENDER, "styles", "tokens.js"));

const ARCHETYPES = ["HERO_NUMBER", "TERM_DEFINE", "LIST_ITEM", "CONTRAST", "PROGRESS", "RELATION", "IMAGE_BEAT", "STATEMENT"];

// B2 table, transcribed from DETAIL-REFERENCE.md lines 347-356.
const EXPECTED = {
  HERO_NUMBER: 0.06, TERM_DEFINE: 0.06, LIST_ITEM: 0.04, CONTRAST: 0.04,
  PROGRESS: 0, RELATION: 0.06, IMAGE_BEAT: 0, STATEMENT: 0.06,
};
const DENSITY_SET = new Set([0.06, 0.04, 0]);

let failures = 0;
const fail = (msg) => { failures++; console.log("  FAIL " + msg); };
const pass = (msg) => console.log("  ok   " + msg);

console.log("== Tier 1: B2 table (COL-17 exact) ==");
const tableKeys = Object.keys(T.DOT_GRID).sort();
const expectedKeys = [...ARCHETYPES].sort();
if (JSON.stringify(tableKeys) === JSON.stringify(expectedKeys)) pass("table keys exactly the 8 live archetypes");
else fail(`table keys ${JSON.stringify(tableKeys)} != ${JSON.stringify(expectedKeys)} (schema drift)`);
for (const a of ARCHETYPES) {
  if (T.DOT_GRID[a] === EXPECTED[a]) pass(`${a} = ${EXPECTED[a]}`);
  else fail(`${a} = ${T.DOT_GRID[a]} expected ${EXPECTED[a]}`);
}
for (const [a, d] of Object.entries(T.DOT_GRID)) {
  if (!DENSITY_SET.has(d)) fail(`${a} density ${d} outside {6%,4%,0%} (B2.1)`);
  if (d > 0.08) fail(`${a} density ${d} exceeds B5 8% ceiling`);
}
if (T.DOT_GRID_PITCH !== 64 || !Number.isInteger(T.DOT_GRID_PITCH)) fail(`pitch ${T.DOT_GRID_PITCH} != 64 px (B2.3)`);
else pass(`pitch ${T.DOT_GRID_PITCH} px, absolute integer (B2.3, never %)`);
if (T.DOT_DIAMETER !== 4 || !Number.isInteger(T.DOT_DIAMETER)) fail(`dot ${T.DOT_DIAMETER} != 4 px (B2.4)`);
else pass(`dot ${T.DOT_DIAMETER} px (B2.4)`);
try { T.dotGridDensityForArchetype("NOT_AN_ARCHETYPE"); fail("unknown archetype should throw (drift must not default)"); }
catch { pass("unknown archetype throws — no silent defaulting"); }

console.log("== Tier 1: section resolver (COL-18, B2.2) ==");
const beat = (archetype, sectionIndex) => ({ archetype, sectionIndex });
// min-rule: mixed section resolves DOWN
{
  const d = T.dotGridDensityPerSection([beat("HERO_NUMBER", 0), beat("CONTRAST", 0)]);
  if (d[0] === 0.04) pass("HERO_NUMBER+CONTRAST section -> 0.04 (lower wins)");
  else fail(`HERO_NUMBER+CONTRAST section -> ${d[0]}, expected 0.04`);
}
{
  const d = T.dotGridDensityPerSection([beat("PROGRESS", 0), beat("STATEMENT", 0)]);
  if (d[0] === 0) pass("PROGRESS+STATEMENT section -> 0 (lower wins)");
  else fail(`PROGRESS+STATEMENT section -> ${d[0]}, expected 0`);
}
// within-section constant + per-section values
for (const [a, want] of Object.entries(EXPECTED)) {
  const d = T.dotGridDensityPerSection([beat(a, 3)]);
  if (d[3] === want) pass(`section with only ${a} -> ${want}`);
  else fail(`section with only ${a} -> ${d[3]}, expected ${want}`);
}
// frames: transition happens ONLY at the wipe; gaps/tail hold the density
{
  const ranges = { 0: { from: 0, to: 100 }, 1: { from: 200, to: 300 } };
  const beats = [beat("HERO_NUMBER", 0), beat("STATEMENT", 1)];
  const states = [50, 150, 250, 350, -5].map((f) => T.dotGridStateForFrame(ranges, beats, f));
  const at = [];
  for (const s of states) if (s) at.push(`${s.opacity}@${s.dotSize}/${s.gridSize}`); else at.push("null");
  const ok =
    states[0] && states[0].opacity === 0.06 && states[0].dotSize === 4 && states[0].gridSize === 64 &&
    states[1] && states[1].opacity === 0.06 &&          // gap between sections: still section 0 (B2.2: changes only at wipe)
    states[2] && states[2].opacity === 0.06 &&          // section 1 = STATEMENT 6%
    states[3] && states[3].opacity === 0.06 &&          // tail: holds last density
    states[4] === null;                                  // before first section: no grid
  if (ok) pass(`frame sweep [${at.join(", ")}] — wipe-only transitions (B2.2)`);
  else fail(`frame sweep [${at.join(", ")}] — expected .06@4/64 across, null before first section`);
}
{
  const ranges = { 0: { from: 0, to: 100 }, 1: { from: 100, to: 200 } };
  const beats = [beat("HERO_NUMBER", 0), beat("PROGRESS", 1)];
  const s = T.dotGridStateForFrame(ranges, beats, 150);
  if (s === null) pass("PROGRESS section -> no grid layer (0%)");
  else fail(`PROGRESS section -> ${JSON.stringify(s)}, expected null`);
}
{
  const s = T.dotGridStateForFrame({}, [], 10);
  if (s === null) pass("empty sections -> no grid layer");
  else fail(`empty sections -> ${JSON.stringify(s)}`);
}

// ---------------------------------------------------------------------------
// Tier 2 — real-data compile (only when the real deps are installed).
// ---------------------------------------------------------------------------
console.log("== Tier 2: real mg package (ch-fixture) ==");
let real = null;
try {
  const [{ buildMgPackage }, { chunkTextClauseAware }, { resolveBrollFiles }] = await Promise.all([
    imp(path.join(RENDER, "compositions", "mg-package.js")),
    imp(path.join(RENDER, "compositions", "beats.js")),
    imp(path.join(RENDER, "broll.js")),
  ]);
  const script = JSON.parse(fs.readFileSync(path.join(REPO, "data", "scripts", "ch-fixture", "movile-cave-shorts-script.json"), "utf-8"));
  const sections = (script.sections || [])
    .filter((s) => s.voiceover && s.voiceover.trim())
    .map((s) => ({
      id: s.id,
      timing: s.timing,
      voiceover: s.voiceover,
      content: chunkTextClauseAware(s.voiceover, 7),
      visualCue: s.visual_cue || null,
      bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
      textOverlay: s.text_overlay || null,
      transitionOut: s.transition_out || null,
    }));
  for (const section of sections) {
    section.bRollFiles = resolveBrollFiles(section.bRoll || [], "ch-fixture", script.topic_slug);
  }
  const channels = JSON.parse(fs.readFileSync(path.join(REPO, "config", "channels.json"), "utf-8"));
  const mgChannel = (channels.channels || channels).find((c) => c.style === "motion-graphics");
  if (!mgChannel) throw new Error("no motion-graphics channel in config/channels.json");
  const srt = fs.readFileSync(
    path.join(REPO, "data", "tts", "ch-fixture", "movile-cave-shorts-script-vo.srt"), "utf-8"
  );
  const pkg = buildMgPackage(srt, {
    sections,
    iconMap: mgChannel.icon_map || null,
    bRollFiles: sections.flatMap((s) => s.bRollFiles || []),
    imageForSection: (idx) => (sections[idx] && sections[idx].bRollFiles && sections[idx].bRollFiles[0]) || null,
  });
  real = { pkg, sections };
} catch (e) {
  console.log(`  SKIPPED — real deps not present on this machine (${e.message.split("\n")[0]}).`);
  console.log("  Run on the render sandbox (npm install'ed) for the full Tier-2 verdict.");
}

if (real) {
  const { pkg, sections } = real;
  pass(`built mg package: ${pkg.beats.length} beats, ${Object.keys(pkg.sectionRanges).length} sections, ${pkg.totalFrames} frames`);
  // every beat's archetype is table-known (drift would throw below, but
  // report cleanly first)
  const unknown = [...new Set(pkg.beats.map((b) => b.archetype).filter((a) => !(a in EXPECTED)))];
  if (unknown.length) fail(`beats with unknown archetypes: ${unknown.join(", ")}`);
  else pass("all real beat archetypes are in the B2 table");
  // COL-18 on real data: exactly one density per section, and it equals the
  // min over the section's beats (COL-17 exact).
  const perSection = T.dotGridDensityPerSection(pkg.beats);
  const sectionIdx = [...new Set(pkg.beats.map((b) => b.sectionIndex))].sort((a, b) => a - b);
  let col18ok = true;
  for (const idx of sectionIdx) {
    const want = Math.min(...pkg.beats.filter((b) => b.sectionIndex === idx).map((b) => EXPECTED[b.archetype]));
    if (perSection[idx] !== want) { col18ok = false; fail(`section ${idx}: computed ${perSection[idx]} != min ${want}`); }
  }
  if (col18ok) pass(`all ${sectionIdx.length} sections: single density == min over section beats (COL-17 exact, COL-18)`);
  // frame sweep: opacity changes ONLY at section wipes
  const wipes = new Set(Object.values(pkg.sectionRanges).map((r) => r.from));
  let prev = "none", transitions = [];
  for (let f = 0; f < pkg.totalFrames; f += 30) {
    const s = T.dotGridStateForFrame(pkg.sectionRanges, pkg.beats, f);
    const cur = s ? String(s.opacity) : "none";
    if (cur !== prev) {
      transitions.push(f);
      const atWipe = wipes.has(f) || f === 0;
      if (!atWipe) { col18ok = false; fail(`density transition ${prev}->${cur} at frame ${f}, not a section wipe`); }
      prev = cur;
    }
  }
  if (col18ok) pass(`frame sweep: transitions only at wipes ${JSON.stringify(transitions)} (B2.2)`);
  // geometry of every returned state
  let geoOk = true;
  for (let f = 0; f < pkg.totalFrames; f += 60) {
    const s = T.dotGridStateForFrame(pkg.sectionRanges, pkg.beats, f);
    if (s && (s.dotSize !== 4 || s.gridSize !== 64)) { geoOk = false; fail(`frame ${f} geometry ${s.dotSize}/${s.gridSize}`); }
  }
  if (geoOk) pass("every non-null state: dotSize 4 / gridSize 64");
}

// ---------------------------------------------------------------------------
// Application-site scan — the COL-17/18 WIRING gate (motion-graphics.jsx).
// Method (b), documented above: assert the call-site EXPRESSIONS reference
// the exact exported names / state members — never numeric literals (the
// SFR mandates symbol/state wiring; hardcoding would duplicate, and could
// drift from, the tokens constants) — then resolve those bindings against
// the imported styles/tokens.js module (`T` above), which Tier 1 has
// already pinned to 4 / 64 / .06 / .04 / 0. A site resolving to literal
// 8/80 or opacity 0.1 fails; a site hardcoding "*correct-looking*"
// literals (4/64/.04) ALSO fails, because constants are single-sourced in
// tokens.js by construction. Failures here count toward the exit code.
// ---------------------------------------------------------------------------
console.log("== Application site (motion-graphics.jsx dotGrid wiring) ==");
const mgSrcPath = process.argv[2] || path.join(RENDER, "compositions", "motion-graphics.jsx");
const src = fs.readFileSync(mgSrcPath, "utf-8");
const siteIssues = [];
const lineOf = (i) => src.slice(0, i).split("\n").length;
// expression of one prop inside a <Solid> attribute region, e.g. `dotSize: grid.dotSize`.
// Returns null for anything carrying embedded whitespace (a chained expr
// like `DOT_DIAMETER + 4`) — a bare symbol / member access is the ONLY
// shape the SFR wires on.
const attrOf = (region, name) => {
  const m = new RegExp(name + ":\\s*([^,}]+)").exec(region);
  if (!m) return null;
  const t = m[1].trim();
  return /\s/.test(t) ? null : t;
};
const isLiteral = (e) => /^(\d+(\.\d+)?|\.\d+)$/.test(e);

// (1) the file must import every B2 name from styles/tokens.js
{
  const importRe = /import\s*\{([^}]*)\}\s*from\s*["'][^"']*styles\/tokens\.js["']/g;
  const imported = new Set();
  let m;
  while ((m = importRe.exec(src))) for (const n of m[1].split(",")) imported.add(n.trim());
  for (const n of ["DOT_DIAMETER", "DOT_GRID_PITCH", "DOT_GRID", "dotGridStateForFrame"]) {
    if (imported.has(n)) pass(`tokens import carries ${n}`);
    else siteIssues.push(`tokens import missing ${n} — Background/ListRunScene wiring would be broken`);
  }
}

// (2) exactly two dotGrid({ ... }) application sites, nothing else
{
  const callRe = /dotGrid\(\{/g;
  const calls = [];
  let m;
  while ((m = callRe.exec(src))) calls.push(m.index);
  const allDotGrid = (src.match(/dotGrid\(/g) || []).length;
  if (calls.length === 2 && allDotGrid === 2) {
    pass(`exactly ${calls.length} dotGrid({ ... }) application sites (Background + ListRunScene panel)`);
  } else {
    if (calls.length !== 2) siteIssues.push(`${calls.length} dotGrid({ ... }) application site(s) — expected exactly 2 (Background + ListRunScene panel)`);
    if (allDotGrid !== calls.length) siteIssues.push(`${allDotGrid - calls.length} dotGrid( usage(s) outside the effects={[dotGrid({ ... })]} shape`);
  }
}

// (3) Background must consume the tokens helper's returned state, fed by the
//     mg package's real beats/sectionRanges (empties would silently kill it)
const stateAssignRe = /const\s+(\w+)\s*=\s*dotGridStateForFrame\(\s*sectionRanges\s*,\s*beats\s*,\s*frame\s*\)/g;
const stateVars = [];
{
  let m;
  while ((m = stateAssignRe.exec(src))) {
    if (src[m.index + m[0].length] === ";") stateVars.push(m[1]);
    else siteIssues.push(`line ${lineOf(m.index)}: dotGridStateForFrame(...) result is chained (|| etc.) — must be assigned bare to a const`);
  }
}
if (stateVars.length === 1) pass(`Background state: const ${stateVars[0]} = dotGridStateForFrame(sectionRanges, beats, frame)`);
else siteIssues.push(`${stateVars.length} bare dotGridStateForFrame(...) assignment(s) — expected exactly 1 (Background)`);
{
  const feedRe = /<Background\b[^>]*beats=\{(mg\?\.beats\s*\|\|\s*\[\]|mg\.beats)\}[^>]*sectionRanges=\{(mg\?\.sectionRanges\s*\|\|\s*\{\}|mg\.sectionRanges)\}[^>]*\/>/;
  if (feedRe.test(src)) pass("Background call site feeds mg?.beats / mg?.sectionRanges — density data wires in");
  else siteIssues.push("Background call site does not pass the mg package's beats / sectionRanges — density would silently be empty");
}

// (4) classify both sites: state-driven (Background) vs named constants +
//     resolved values (ListRunScene panel)
const stateDs = stateVars.length === 1 ? `${stateVars[0]}.dotSize` : "__nomatch__";
const stateGs = stateVars.length === 1 ? `${stateVars[0]}.gridSize` : "__nomatch__";
const stateOp = stateVars.length === 1 ? `${stateVars[0]}.opacity` : "__nomatch__";
let stateCalls = 0, constCalls = 0, stateCloseIdx = -1;
{
  const callRe = /dotGrid\(\{/g;
  let m;
  while ((m = callRe.exec(src))) {
    const c = m.index;
    const openTag = src.lastIndexOf("<Solid", c);
    const close = src.indexOf("/>", c);
    const region = src.slice(openTag, close + 2);
    const line = lineOf(c);
    const ds = attrOf(region, "dotSize");
    const gs = attrOf(region, "gridSize");
    const op = attrOf(region, "opacity");
    if (ds === stateDs && gs === stateGs && op === stateOp) {
      stateCalls++;
      stateCloseIdx = close;
    } else if (ds === "DOT_DIAMETER" && gs === "DOT_GRID_PITCH" && op === "DOT_GRID.LIST_ITEM") {
      constCalls++;
      const resolved = `${T.DOT_DIAMETER}/${T.DOT_GRID_PITCH}/${T.DOT_GRID.LIST_ITEM}`;
      if (T.DOT_DIAMETER !== 4 || T.DOT_GRID_PITCH !== 64 || T.DOT_GRID.LIST_ITEM !== 0.04) {
        siteIssues.push(`line ${line}: constants resolve ${resolved} — Tier 1 failed the tokens themselves; this wiring cannot be right`);
      } else if (T.DOT_GRID.LIST_ITEM > 0.08) {
        siteIssues.push(`line ${line}: DOT_GRID.LIST_ITEM ${T.DOT_GRID.LIST_ITEM} exceeds B5 8% ceiling`);
      } else {
        pass(`ListRunScene panel: DOT_DIAMETER / DOT_GRID_PITCH / DOT_GRID.LIST_ITEM resolve ${resolved} (B2.3/B2.4/B5)`);
      }
    } else {
      const desc = (label, e) => {
        if (e === null) return `${label} expr missing`;
        if (isLiteral(e)) return `${label} ${e} hardcoded literal${label === "opacity" && Number(e) > 0.08 ? " — exceeds B5 8% ceiling" : ""} (constants must come from tokens, not be duplicated)`;
        return `${label} expr \`${e}\` is not the SFR wiring`;
      };
      siteIssues.push(`line ${line}: unwired site — ${desc("dotSize", ds)}; ${desc("gridSize", gs)}; ${desc("opacity", op)}`);
    }
  }
}
if (stateCalls !== 1) siteIssues.push(`${stateCalls} state-driven (Background-style) site(s) — expected exactly 1`);
if (constCalls !== 1) siteIssues.push(`${constCalls} named-constant (ListRunScene-style) site(s) — expected exactly 1`);

// (5) the Background layer must be conditionally rendered — 0% density = no layer
if (stateVars.length === 1 && stateCalls === 1) {
  const v = stateVars[0];
  const openRe = new RegExp("\\{\\s*" + v + "\\s*\\?\\s*\\(");
  const closeRe = new RegExp("\\)\\s*:\\s*null\\s*\\}");
  const before = src.slice(stateCloseIdx - 400, stateCloseIdx);
  const after = src.slice(stateCloseIdx, stateCloseIdx + 200);
  if (openRe.test(before) && closeRe.test(after)) pass(`${v} grid element conditionally rendered — 0% density renders no layer`);
  else siteIssues.push(`Background ${v} grid layer not wrapped in {${v} ? ( ... ) : null} — 0% density would still emit an empty layer`);
}

if (siteIssues.length === 0) {
  console.log("  APPLICATION_SITE: PASS — both sites wired to styles/tokens.js, no literals:");
  console.log("    Background consumes dotGridStateForFrame(sectionRanges, beats, frame) state (geometry 4/64;");
  console.log("    opacity from the B2 set {0.06, 0.04, 0} <= B5 .08, 0 = no layer — Tier 1 pins the helper's");
  console.log("    values, so the state cannot drift); ListRunScene uses DOT_DIAMETER / DOT_GRID_PITCH /");
  console.log("    DOT_GRID.LIST_ITEM, resolving 4 / 64 / 0.04 <= B5 .08. Constants are single-sourced in");
  console.log("    styles/tokens.js — the call sites reference the symbols, never duplicate the numbers.");
} else {
  console.log("  APPLICATION_SITE: FAIL — wiring does not match SFR-12-COL-1:");
  for (const i of siteIssues) console.log("    - " + i);
}
failures += siteIssues.length;

console.log(failures === 0 ? "\nTIER 1: ALL PASS" : `\n${failures} FAILURE(S) — see above (Tier 1 / Tier 2 / application site)`);
process.exit(failures === 0 ? 0 : 1);