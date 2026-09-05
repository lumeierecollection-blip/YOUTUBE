// Stage-15 SFR application — delete-list sweep fixes (2026-08-30).
//
// Applies, in order:
//   1. SFR-audit-type-del09  — delete `chunkVoiceover` wrapper (render.js,
//      verify-compositions.js), both call sites -> chunkTextClauseAware,
//      TYP-11 row -> PASS.
//   2. SFR-LAY15-1           — DEL-08: evidence-scenes.jsx role strip
//      flex -> absolute (verbatim from audit-layout ledger).
//   3. SFR-motion-15-1       — DEL-16: remove mg background breathes
//      (constants, fps, breathe computation, both scale applications,
//      update comments).
//   4. SFR-motion-15-2 (b)   — DEL-16: abstract-scenes.jsx destabilising
//      wobble -> [0,0,0,0].
//   5. SFR-DEL14-1 option A  — qa-sample.js refactor: bundle real Root.jsx,
//      select "MotionGraphicsShorts", inputProps both calls, scale 0.5;
//      header + import + entry-block rewritten; DEL-14 register row scoped.
//   6. SFR-DEL20-1           — qa-render-motion.mjs jpeg -> png.
//   7. Register amendments   — DEL-01/08/12/14/18/21/25/26/28/30 rows,
//      COL-13 state, ENC-05/06 state, §4.2 tail, new §4.3 paragraph.
//   8. Doc consistency — LAYOUT-SYSTEM.md (§0.12 bullet + D2 row),
//      MOTION-BLUEPRINT.md Rule 3.1, visual-qa-loop.yml header comment.
//
// Line-wise, CRLF-preserving, existence-checked: OLD anchors use the file's
// on-disk bytes (CHECK-REGISTER.md is double-encoded — ≤ appears as the
// mojibake â‰¤, § as Â§, — as â€”); NEW text is proper Unicode, same as
// apply-sfr-13-14.mjs. Idempotent: a step whose NEW text already exists
// exactly once (or, for pure deletions, whose OLD text is already absent)
// is skipped. Anything else must match the OLD text exactly once or the
// script aborts without writing that step.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "C:/Users/user/YOUTUBE";
const REG = join(ROOT, "CHECK-REGISTER.md");
const RENDER = join(ROOT, "src/skills/remotion-render/render.js");
const VERIFY = join(ROOT, "src/skills/remotion-render/verify-compositions.js");
const EVIDENCE = join(ROOT, "src/skills/remotion-render/compositions/scenes/evidence-scenes.jsx");
const MG = join(ROOT, "src/skills/remotion-render/compositions/motion-graphics.jsx");
const ABSTRACT = join(ROOT, "src/skills/remotion-render/compositions/scenes/abstract-scenes.jsx");
const QA_SAMPLE = join(ROOT, "src/skills/remotion-render/qa-sample.js");
const QA_RENDER_MOTION = join(ROOT, "src/skills/remotion-render/qa-scripts/qa-render-motion.mjs");
const WF = join(ROOT, ".github/workflows/visual-qa-loop.yml");
const LAYOUT = join(ROOT, "LAYOUT-SYSTEM.md");
const BLUEPRINT = join(ROOT, "MOTION-BLUEPRINT.md");

function splitLines(s) {
  return s.split(/\r?\n/);
}
function detectEol(s) {
  return s.includes("\r\n") ? "\r\n" : "\n";
}

function applyLineReplace(file, oldLines, newLines, label) {
  const src = readFileSync(file, "utf8");
  const eol = detectEol(src);
  const lines = splitLines(src);

  const countMatches = (block) => {
    const hits = [];
    for (let i = 0; i + block.length <= lines.length; i++) {
      let ok = true;
      for (let j = 0; j < block.length; j++) {
        if (lines[i + j] !== block[j]) { ok = false; break; }
      }
      if (ok) hits.push(i);
    }
    return hits;
  };

  const hits = countMatches(oldLines);
  const newHits = newLines.length > 0 ? countMatches(newLines) : [];

  if (newLines.length === 0) {
    // Pure deletion: already applied iff the old text is gone.
    if (hits.length === 0) {
      console.log(`SKIP ${label} (already applied)`);
      return;
    }
  } else if (newHits.length === 1) {
    console.log(`SKIP ${label} (already applied)`);
    return;
  }

  if (hits.length !== 1) {
    console.error(`ABORT ${label}: expected exactly 1 anchor match, found ${hits.length}`);
    console.error(`  anchor[0] = ${JSON.stringify(oldLines[0])}`);
    process.exit(1);
  }

  const at = hits[0];
  const out = [...lines.slice(0, at), ...newLines, ...lines.slice(at + oldLines.length)];
  writeFileSync(file, out.join(eol), "utf8");
  console.log(`APPLIED ${label}`);
}

function applySubstringReplace(file, oldText, newText, label) {
  const src = readFileSync(file, "utf8");
  const newCount = src.split(newText).length - 1;
  if (newCount === 1) {
    console.log(`SKIP ${label} (already applied)`);
    return;
  }
  const count = src.split(oldText).length - 1;
  if (count !== 1) {
    console.error(`ABORT ${label}: expected exactly 1 match, found ${count}`);
    console.error(`  oldText = ${JSON.stringify(oldText)}`);
    process.exit(1);
  }
  writeFileSync(file, src.replace(oldText, newText), "utf8");
  console.log(`APPLIED ${label}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 1. SFR-audit-type-del09 — delete chunkVoiceover wrapper
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(RENDER, [
  "// PART 4.2 of the motion-graphics rebuild: this used to be a blind",
  "// word-count split (DEL-09 / TYP-11 in CHECK-REGISTER.md — a real shipped",
  "// defect: \"...found: 1,980 meters below the\" stranded an article as the",
  "// last word of a caption). chunkTextClauseAware (beats.js) does the same",
  "// ≤maxWords grouping but repairs any boundary that would orphan an",
  "// article, preposition, conjunction, or a number split from its unit.",
  "function chunkVoiceover(text, maxWords = 7) {",
  "  return chunkTextClauseAware(text, maxWords);",
  "}",
], [
  "// PART 4.2 of the motion-graphics rebuild: this used to be a blind",
  "// word-count split (DEL-09 / TYP-11 in CHECK-REGISTER.md — a real shipped",
  "// defect: \"...found: 1,980 meters below the\" stranded an article as the",
  "// last word of a caption). The `chunkVoiceover` wrapper was deleted on",
  "// 2026-08-30 (stage-15 sweep, DEL-09/TYP-11 PASS). chunkTextClauseAware",
  "// (beats.js) does the same ≤maxWords grouping but repairs any boundary",
  "// that would orphan an article, preposition, conjunction, or a number",
  "// split from its unit.",
], "render.js: delete chunkVoiceover wrapper");

applySubstringReplace(RENDER,
  "      content: chunkVoiceover(s.voiceover),",
  "      content: chunkTextClauseAware(s.voiceover),",
  "render.js: call site -> chunkTextClauseAware");

applyLineReplace(VERIFY, [
  "function chunkVoiceover(text, maxWords = 7) {",
  "  return chunkTextClauseAware(text, maxWords);",
  "}",
  "",
], [], "verify-compositions.js: delete chunkVoiceover wrapper");

applySubstringReplace(VERIFY,
  "    content: chunkVoiceover(s.voiceover),",
  "    content: chunkTextClauseAware(s.voiceover),",
  "verify-compositions.js: call site -> chunkTextClauseAware");

// ─────────────────────────────────────────────────────────────────────────
// 2. SFR-LAY15-1 — evidence-scenes.jsx role strip flex -> absolute
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(EVIDENCE, [
  "      {pRole > 0 && role ? (",
  "        <div style={{",
  "          position: \"absolute\", left: 48, top: 1176, opacity: ease(pRole),",
  "          display: \"flex\", alignItems: \"center\", gap: 12,",
  "        }}>",
  "          <div style={{ width: 28, height: 3, background: colors.accent }} />",
  "          <Label x={0} y={-13} text={role} color={colors.accent} size={24} tracking={3} fontFamily={fontFamily} />",
  "        </div>",
  "      ) : null}",
], [
  "      {pRole > 0 && role ? (",
  "        <div style={{ position: \"absolute\", left: 48, top: 1176, opacity: ease(pRole) }}>",
  "          <div style={{ position: \"absolute\", left: 0, top: 2, width: 28, height: 3, background: colors.accent }} />",
  "          <Label x={40} y={-13} text={role} color={colors.accent} size={24} tracking={3} fontFamily={fontFamily} />",
  "        </div>",
  "      ) : null}",
], "evidence-scenes.jsx: role strip absolute (SFR-LAY15-1)");

// ─────────────────────────────────────────────────────────────────────────
// 3. SFR-motion-15-1 — remove mg background breathes
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(MG, [
  "// PART 7 of the rebuild — \"nothing perfectly still: <=1.5% scale breath,",
  "// 20s+ period, on background layers.\" Applied to the dotGrid/grain texture",
  "// layers only, never the flat base-colour fill beneath them (scaling that",
  "// would risk a 1-2px edge gap under the design-space scale wrapper; the",
  "// texture layers sit on top of a same-colour base so a breathing edge is",
  "// invisible either way). frame-audit's margin-flatness check was re-run",
  "// against this — see PART 10's report — since a naive implementation could",
  "// in principle raise it; extended again for CanvasGrain (frame-audit.js's",
  "// blurredStddev/chromaStddev) to allow grain specifically while still",
  "// catching a real gradient/tint.",
], [
  "// DEL-16 (2026-08-30): the PART-7 \"nothing perfectly still\" rule was",
  "// originally shipped as a <=1.5% scale breathe (20s+ period) on the",
  "// dotGrid/grain texture layers. That sine pulse is DEL-16's banned class",
  "// (D5.1 / MOT-14 — frames inside a hold must not differ), so the breathe",
  "// is deleted and the texture layers are static. The base flat-colour fill",
  "// never scaled (a breathing edge would risk a 1-2px gap under the",
  "// design-space scale wrapper); frame-audit's margin-flatness check remains",
  "// extended for CanvasGrain (frame-audit.js's blurredStddev/chromaStddev)",
  "// to allow grain specifically while still catching a real gradient/tint.",
], "motion-graphics.jsx: PART-7 breathe comment rewritten");

applyLineReplace(MG, [
  "const BREATHE_PERIOD_SEC = 20;",
  "const BREATHE_AMPLITUDE = 0.015;",
  "",
], [], "motion-graphics.jsx: BREATHE constants deleted");

applyLineReplace(MG, [
  "  const { fps } = useVideoConfig();",
  "  const breathe = 1 + BREATHE_AMPLITUDE * Math.sin((2 * Math.PI * frame) / (fps * BREATHE_PERIOD_SEC));",
], [], "motion-graphics.jsx: fps + breathe computation deleted");

applySubstringReplace(MG,
  '          style={{ position: "absolute", inset: 0, opacity: grid.opacity, scale: `${breathe}`, transformOrigin: "center" }}',
  '          style={{ position: "absolute", inset: 0, opacity: grid.opacity }}',
  "motion-graphics.jsx: dotGrid Solid scale stripped");

applyLineReplace(MG, [
  "      <div",
  "        // PART 7 parallax — a different (slower, phase-shifted) rate than",
  "        // the dotGrid layer above it, so the two background layers read as",
  "        // sitting at different depths rather than moving as one unit.",
  "        // Preserved from the noise() layer this replaces.",
  "        style={{",
  "          position: \"absolute\",",
  "          inset: 0,",
  "          scale: `${1 + BREATHE_AMPLITUDE * 0.6 * Math.sin((2 * Math.PI * frame) / (fps * BREATHE_PERIOD_SEC * 1.4) + Math.PI / 3)}`,",
  "          transformOrigin: \"center\",",
  "        }}",
  "      >",
], [
  "      <div",
  "        // DEL-16 (2026-08-30): the background texture layers are static —",
  "        // the dotGrid/grain \"parallax\" depth cue was the deleted breathe's",
  "        // phase shift; both layers now share the DesignSpace plane.",
  "        style={{",
  "          position: \"absolute\",",
  "          inset: 0,",
  "        }}",
  "      >",
], "motion-graphics.jsx: CanvasGrain wrapper static");

// ─────────────────────────────────────────────────────────────────────────
// 4. SFR-motion-15-2 (b) — abstract-scenes.jsx destabilising wobble
// ─────────────────────────────────────────────────────────────────────────
applySubstringReplace(ABSTRACT,
  "      wobble = [0, 1, 2, 3].map((i) => Math.sin(frame * 0.13 + i * 1.7) * 9 * a);",
  "      wobble = [0, 0, 0, 0];",
  "abstract-scenes.jsx: destabilising wobble zeroed (SFR-motion-15-2b)");

// ─────────────────────────────────────────────────────────────────────────
// 5. SFR-DEL14-1 option A — qa-sample.js refactor to real Root.jsx/inputProps
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(QA_SAMPLE, [
  " * The style compositions are fully data-driven (no defaultProps): props come from",
  " * render.js at full render time. This helper bakes real mg data into a small entry",
  " * and renders ONLY frames 0..179 at 540x960 so qa_frames.py can analyse it.",
], [
  " * The style compositions are fully data-driven: props pass through inputProps",
  " * (the render.js contract — LAYOUT-SYSTEM.md §0.12/D6). This helper renders",
  " * the real Root.jsx MotionGraphicsShorts composition at scale 0.5 — output",
  " * is ONLY frames 0..179 at 540x960 so qa_frames.py can analyse it.",
], "qa-sample.js: header comment rewritten (DEL-14)");

applySubstringReplace(QA_SAMPLE,
  'import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";',
  'import { readFileSync, existsSync, mkdirSync } from "fs";',
  "qa-sample.js: writeFileSync import dropped");

applyLineReplace(QA_SAMPLE, [
  "  const entryPath = join(__dirname, \"qa-entry.jsx\");",
  "  const props = {",
  "    mg,",
  "    font: channel.font || \"DM Sans\",",
  "    palette: channel.thumbnail_spec?.color_palette || null,",
  "    channelName: channel.channel_name || \"\",",
  "  };",
  "  const defaults = JSON.stringify(props, null, 2).replace(/</g, \"\\\\u003c\");",
  "  const entry = `import React from \"react\";",
  "import { Composition, registerRoot } from \"remotion\";",
  "import { MotionGraphicsShorts } from \"./compositions/motion-graphics.jsx\";",
  "",
  "const DEFAULTS = ${defaults};",
  "",
  "const Root = () => (",
  "  <Composition",
  "    id=\"QaComp\"",
  "    component={MotionGraphicsShorts}",
  "    durationInFrames={${mg.totalFrames}}",
  "    fps={30}",
  "    width={540}",
  "    height={960}",
  "    defaultProps={DEFAULTS}",
  "  />",
  ");",
  "",
  "registerRoot(Root);",
  "`;",
  "  writeFileSync(entryPath, entry, \"utf-8\");",
  "  console.log(`QA entry written (${mg.beats.length} beats, ${mg.totalFrames}f total, sampling 0-${frames - 1})`);",
  "",
], [
  "  const props = {",
  "    mg,",
  "    font: channel.font || \"DM Sans\",",
  "    palette: channel.thumbnail_spec?.color_palette || null,",
  "    channelName: channel.channel_name || \"\",",
  "  };",
  "",
], "qa-sample.js: generated qa-entry.jsx block deleted (DEL-14)");

applyLineReplace(QA_SAMPLE, [
  "  const serveUrl = await bundle({ entryPoint: entryPath, onProgress: () => {} });",
  "  const composition = await selectComposition({ serveUrl, id: \"QaComp\", browserExecutable: CHROME });",
  "  await renderMedia({",
  "    composition,",
  "    serveUrl,",
  "    codec: \"h264\",",
  "    frameRange: [0, frames - 1],",
  "    outputLocation: outPath,",
  "    browserExecutable: CHROME,",
  "    concurrency: 1,",
  "    timeoutInMilliseconds: 120000,",
  "  });",
], [
  "  // DEL-14 (2026-08-30): no generated qa-entry.jsx shim — bundle the real",
  "  // Root.jsx, select the real composition by id, pass props via inputProps",
  "  // on both calls (the render.js contract), and scale 0.5 the 1080x1920",
  "  // shorts cap onto the 540x960 sample contract qa_frames.py expects.",
  "  const serveUrl = await bundle({ entryPoint: join(__dirname, \"Root.jsx\"), onProgress: () => {} });",
  "  const composition = await selectComposition({",
  "    serveUrl,",
  "    id: \"MotionGraphicsShorts\",",
  "    inputProps: props,",
  "    browserExecutable: CHROME,",
  "  });",
  "  await renderMedia({",
  "    composition: { ...composition, durationInFrames: Math.max(composition.durationInFrames, frames) },",
  "    serveUrl,",
  "    codec: \"h264\",",
  "    inputProps: props,",
  "    frameRange: [0, frames - 1],",
  "    outputLocation: outPath,",
  "    browserExecutable: CHROME,",
  "    concurrency: 1,",
  "    scale: 0.5,",
  "    timeoutInMilliseconds: 120000,",
  "  });",
], "qa-sample.js: real Root.jsx + inputProps + scale 0.5 (SFR-DEL14-1)");

// ─────────────────────────────────────────────────────────────────────────
// 6. SFR-DEL20-1 — qa-render-motion.mjs jpeg -> png
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(QA_RENDER_MOTION, [
  "  imageFormat: \"jpeg\",",
  "  jpegQuality: 80,",
], [
  "  imageFormat: \"png\",",
], "qa-render-motion.mjs: imageFormat png (SFR-DEL20-1)");

// ─────────────────────────────────────────────────────────────────────────
// 7. CHECK-REGISTER.md amendments (old anchors = on-disk mojibake bytes;
//    new text = proper Unicode, mirroring apply-sfr-13-14.mjs)
// ─────────────────────────────────────────────────────────────────────────
applySubstringReplace(REG,
  "| DEL-01 | The no-op scale factor | `Math.min(width, height) / 1080` | MAJOR |",
  "| DEL-01 | ~~The no-op scale factor~~ **RETIRED, INVERTED 2026-08-30** | ~~`Math.min(width, height) / 1080`~~ | ~~MAJOR~~ |",
  "register DEL-01 row: RETIRED/INVERTED");

applySubstringReplace(REG,
  "| DEL-08 | Sibling flex in content zones | `display: *[\"']flex` in Stage/Headline/Caption | BLOCKER |",
  "| DEL-08 | Sibling flex in content zones (mg-style path) | `display: *[\"']flex` in mg-style Stage/Headline/Caption; `minimal`/`cinematic-documentary` = OTHER-STYLE per Part 6 (amended 2026-08-30); carved: motion-graphics.jsx:949 dead `Centered`, :1033 leaf-internal chip | BLOCKER |",
  "register DEL-08 row: scoped to mg-style path");

applySubstringReplace(REG,
  "| DEL-12 | Bar glow / radial gradients / accent gridlines | `boxShadow\\|radial-gradient` | MAJOR |",
  "| DEL-12 | Bar glow / radial gradients / accent gridlines (outside the designed ground shading) | `boxShadow\\|radial-gradient\\|radialGradient\\|linearGradient` — EXCEPT the four `scenes/stage.jsx` environment fills `paper-fall`/`sub-floor`/`atmo-haze`/`shot-falloff` (ink-on-bg alpha ≤14%, no hue; render-QA'd §3.12.11) and `visual/composition.js` parallax plane ratios (run-visual-tests ≥2×) | MAJOR |",
  "register DEL-12 row: pattern extended + carve");

applySubstringReplace(REG,
  "| DEL-14 | `inputProps` entry-file workaround | generated entry path | MAJOR |",
  "| DEL-14 | `inputProps` entry-file workaround | generated entry path in the production SSR path (`render.js` / real `Root.jsx`) — amended 2026-08-30: `qa-sample.js` refactored to `inputProps` (SFR-DEL14-1, option A); `data/audit/*/_*-entry.jsx` QA-harness shims carved as instrumentation | MAJOR |",
  "register DEL-14 row: scoped to production SSR path");

applySubstringReplace(REG,
  "| DEL-18 | Gradient fills | `gradient` | MAJOR |",
  "| DEL-18 | Gradient fills | `(?i)gradient` — same four-`stage.jsx` carve as DEL-12; everything else live still fails | MAJOR |",
  "register DEL-18 row: pattern extended + carve");

applySubstringReplace(REG,
  "| DEL-21 | Text transform / skew / rotate | `skew\\|rotate(` on text | MINOR |",
  "| DEL-21 | ~~Text transform / skew / rotate~~ **AMENDED 2026-08-30** | `skew\\|rotate(` on body/caption/supporting text — `skew` 0 hits; excepted: vertical causal-marker label (structure-scenes.jsx:726, LAY-15-governed pivot); scene/`<g>` canvas transforms are shape-scope, out of scope by definition | MINOR |",
  "register DEL-21 row: amended (text-scope + carve)");

applySubstringReplace(REG,
  "| DEL-25 | Parallax / depth layers | `parallax` | MINOR |",
  "| DEL-25 | ~~Parallax / depth layers~~ **AMENDED 2026-08-30** | `parallax` — carved: the positive-checked DEPTH-plane system (`visual/composition.js` DEPTH_PROFILES + `Shot`/`planeOffset`, `stage.jsx` Plane, run-visual-tests.js depth tests, COL-20); any OTHER parallax (outside the plane system, or a plane without a blur/saturate/opacity depth anchor) still FAILs | MINOR |",
  "register DEL-25 row: amended (DEPTH-plane carve)");

applySubstringReplace(REG,
  "| DEL-26 | Three.js / WebGL geometry | `three\\|THREE\\.` | MAJOR |",
  "| DEL-26 | Three.js / WebGL geometry | `three\\|THREE\\.` case-bound (`THREE\\.`, `react-three`) — amended 2026-08-30: carved the verified `effects/` pipeline (`PhotoTreatment.jsx`, `CanvasGrain.jsx`, `PostFxReadyGate.jsx` via `@remotion/three` + `@react-three/postprocessing`, §3.12.12); any 3D object geometry or fake-3D lit scene outside it still FAILs (§3.12.9) | MAJOR |",
  "register DEL-26 row: amended (effects-pipeline carve + case-bound)");

applySubstringReplace(REG,
  "| DEL-28 | Global film grain in this style | `grain` in mg style | MINOR |",
  "| DEL-28 | ~~Global film grain in this style~~ **RETIRED-scoped 2026-08-30** — `grain` allowed only as CanvasGrain (`effects/CanvasGrain.jsx` + its mg Background mount), PhotoTreatment's per-photo grain, and the word in \"fine-grained\" (beats.js:909,1083); any other `grain` in mg live code fails. Positive checks: data/audit/17 measurements + synthetic controls, §3.12.12 render, frame-audit blurredStddev/chromaStddev | MINOR |",
  "register DEL-28 row: RETIRED-scoped");

applySubstringReplace(REG,
  "| DEL-30 | Hex literals in `channels.json` | `#[0-9A-Fa-f]{6}` | MAJOR |",
  "| DEL-30 | ~~Hex literals in `channels.json`~~ **RETIRED, INVERTED 2026-08-30** — hex is the sanctioned palette and lives ONLY inside a channel's `colors` block: `#[0-9A-Fa-f]{6}` outside `colors` = 0 hits (68/68 inside). Script-side sibling: SCR-13 | MAJOR |",
  "register DEL-30 row: RETIRED/INVERTED");

applySubstringReplace(REG,
  "| TYP-11 | Caption is SRT-derived, not word-count chunked | `grep chunkVoiceover` | 0 hits | 1 | BLOCKER | 10 | **FAIL** |",
  "| TYP-11 | Caption is SRT-derived, not word-count chunked | `grep chunkVoiceover` | 0 hits | 1 | BLOCKER | 10 | **PASS** - 2026-08-30 (wrapper deleted; both call sites call `chunkTextClauseAware` directly) |",
  "register TYP-11 row: PASS");

applySubstringReplace(REG,
  "| COL-13 | Zero gradient fills | `grep -rn \"gradient\"` | 0 hits | 1 | MAJOR | 12 | **PASS** - 0 code hits, only removal-comments (motion-graphics-rebuild-v2) |",
  "| COL-13 | Zero gradient fills | `grep -rn \"gradient\"` | 0 hits | 1 | MAJOR | 12 | **PASS-with-amendment** - 0 CSS/code gradient hits as-written, but the class-level \"0 code hits\" does NOT hold since 61ded3d (2026-08-27): four designed SVG environment fills in scenes/stage.jsx (paper-fall/sub-floor/atmo-haze/shot-falloff) are invisible to the case-sensitive pattern and are carved out under DEL-12/18 amendments |",
  "register COL-13 state corrected");

applySubstringReplace(REG,
  "| ENC-05 | Routing is text-based, not cue-based | `grep pickScene` | 0 hits | 1 | BLOCKER | 9 | **FAIL** |",
  "| ENC-05 | Routing is text-based, not cue-based | `grep pickScene` | 0 hits | 1 | BLOCKER | 9 | **PASS** - 2026-08-30 stage-15 remeasure (0 code hits; Stage-9 ledger recorded CHANGED→PASS) |",
  "register ENC-05 row: PASS");

applySubstringReplace(REG,
  "| ENC-06 | No number is regex-scraped from prose | `grep extractStats\\|extractHeroNumber` | 0 hits | 1 | BLOCKER | 9 | **FAIL** |",
  "| ENC-06 | No number is regex-scraped from prose | `grep extractStats\\|extractHeroNumber` | 0 hits | 1 | BLOCKER | 9 | **PASS** - 2026-08-30 stage-15 remeasure (0 code hits; Stage-9 ledger recorded CHANGED→PASS) |",
  "register ENC-06 row: PASS");

// §4.2 tail (DEL-09 description — wrapper was since deleted) + new §4.3
// paragraph, in ONE replacement so re-runs stay idempotent (the paragraph
// starts with the same lines the tail edit produces).
applyLineReplace(REG, [
  "for the full reasoning and the COL-01 ceiling consequence. DEL-09's grep",
  "pattern is unchanged in name but no longer distinguishes fixed from",
  "unfixed behaviour â€” see the amendment note after Â§3.10 in this file's",
  "history, or just: `chunkVoiceover` is now a wrapper around the",
  "clause-boundary-aware `chunkTextClauseAware`, so the pattern still matches",
  "by name; TYP-21 is the real behavioural check.",
], [
  "for the full reasoning and the COL-01 ceiling consequence. DEL-09's grep",
  "hit 0 from 2026-08-30 (stage-15 sweep): the `chunkVoiceover` wrapper is",
  "deleted from render.js and verify-compositions.js, and both call sites call",
  "the clause-boundary-aware `chunkTextClauseAware` directly, so the grep no",
  "longer matches by name; TYP-21 is the real behavioural check.",
  "",
  "**4.3 — Stage-15 DEL amendment set (delete-list sweep, 2026-08-30).** Rows",
  "amended per §4.2's DEL-17 precedent (amendment, not deletion; every case",
  "backed by live evidence in the stage-15 lane ledgers `data/audit/15/*.ledger.md`):",
  "",
  "- **DEL-01** — RETIRED, INVERTED 2026-08-30: its pattern's only live hit",
  "  is `scaleUnit()` at `compositions/mg-style.js:155`, the LAY-20 u-scaler",
  "  (MANUAL A3.2), NOT the deleted no-op (Part 0.1's dead scaler is",
  "  structurally replaced by the DesignSpace S-fit, motion-graphics.jsx:294).",
  "  LAY-20's \"applied\" wording is stale: `scaleUnit` has 0 call sites",
  "  repo-wide; the convention is carried by the fixed 1080×1920 design space",
  "  (u=1 both formats). The dead export should be wired into MG_TYPE scaling",
  "  or removed under a hygiene notice; neither is a DEL-01 deletion.",
  "- **DEL-08** — re-scoped to the mg-style path per Part 6: `minimal`/",
  "  `cinematic-documentary` flex is OTHER-STYLE (their own rebuilds). Live",
  "  mg-path hits are gone: SFR-LAY15-1 rebuilt the evidence-scenes.jsx:174",
  "  role strip absolute. Carved: motion-graphics.jsx:949 (dead `Centered`),",
  "  :1033 (leaf-internal chip).",
  "- **DEL-12 / DEL-18** — patterns extended to SVG camelCase after the real",
  "  blind spot: the kebab-case patterns could never match SVG",
  "  `<radialGradient>` / `<linearGradient>` elements, so four designed",
  "  ink-on-bg environment fills in `scenes/stage.jsx` (paper-fall / sub-floor /",
  "  atmo-haze / shot-falloff, alpha ≤14%, no hue, render-QA'd §3.12.11) were",
  "  invisible to the gate for 3 days. Amended patterns + carve; COL-13's",
  "  stale PASS corrected.",
  "- **DEL-14** — scoped to the production SSR path (`render.js` / real",
  "  `Root.jsx`): `qa-sample.js` refactored to `inputProps` (SFR-DEL14-1,",
  "  option A); `data/audit/*/_*-entry.jsx` QA-harness shims carved as",
  "  instrumentation.",
  "- **DEL-21** — `rotate(` scoped to body/caption/supporting text; the",
  "  vertical causal-marker label (structure-scenes.jsx:726) is a designed,",
  "  LAY-15-governed feature; scene/`<g>` canvas transforms are shape-scope.",
  "- **DEL-25** — the positive-checked DEPTH-plane system (`visual/composition.js`",
  "  DEPTH_PROFILES + `Shot`/`planeOffset`, `stage.jsx` Plane, run-visual-tests.js",
  "  depth tests, COL-20) carved; other parallax still FAILs.",
  "- **DEL-26** — three.js/WebGL confined to the verified @remotion/three +",
  "  @react-three/postprocessing effects pipeline (§3.12.12); pattern made",
  "  case-bound (`THREE\\.`, `react-three`) so the English word \"three\" is not",
  "  a false positive; any 3D object geometry or fake-3D lit scene still FAILs.",
  "- **DEL-28** — channel/photo grain carved as the designed feature",
  "  (CanvasGrain + PhotoTreatment + \"fine-grained\" in beats.js); any other",
  "  `grain` in mg live code fails.",
  "- **DEL-30** — hex is the sanctioned palette and lives ONLY inside a",
  "  channel's `colors` block (68/68 hits inside); hex outside `colors` = 0",
  "  hits. Script-side sibling: SCR-13.",
], "register §4.2 tail + new §4.3 paragraph");

// ─────────────────────────────────────────────────────────────────────────
// 8. Doc consistency (stale chunkVoiceover / DEL-14 references)
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(LAYOUT, [
  "- **`chunkVoiceover` (Part 7 D2) is still live** at `render.js:118` and",
  "  `verify-compositions.js:38` — word-count chunking that ignores phrase",
  "  boundaries and SRT timing, feeding the two emergent styles.",
], [
  "- **~~`chunkVoiceover` (Part 7 D2)~~ — CLEARED 2026-08-30.** The wrapper is",
  "  deleted (stage-15 sweep, DEL-09/TYP-11); `chunkTextClauseAware` (beats.js)",
  "  is called directly at both call sites (render.js, verify-compositions.js).",
], "LAYOUT-SYSTEM.md §0.12 bullet: chunkVoiceover cleared");

applySubstringReplace(LAYOUT,
  "| D2 | `chunkVoiceover()` | `render.js:118`, `verify-compositions.js:38` | word-count chunking that ignores phrase boundaries and SRT timing |",
  "| D2 | ~~`chunkVoiceover()`~~ — **CLEARED 2026-08-30** | ~~`render.js:118`, `verify-compositions.js:38`~~ | wrapper deleted (DEL-09/TYP-11); clause-aware `chunkTextClauseAware` called directly |",
  "LAYOUT-SYSTEM.md D2 row: struck through");

applyLineReplace(BLUEPRINT, [
  "**Rule 3.1 — Max 7 words per beat. Max 2 lines. One idea per beat.**",
  "This replaces `chunkVoiceover`'s fixed word-count chunker, which splits",
  "mid-phrase.",
], [
  "**Rule 3.1 — Max 7 words per beat. Max 2 lines. One idea per beat.**",
  "Enforced by `chunkTextClauseAware()` (beats.js) — the old `chunkVoiceover`",
  "fixed word-count chunker it replaced was deleted 2026-08-30 (DEL-09/TYP-11).",
], "MOTION-BLUEPRINT.md Rule 3.1: updated");

applyLineReplace(WF, [
  "# budget. Renders through qa-sample.js because compositions are data-driven (no",
  "# defaultProps): it bakes a channel's SRT into a QA entry and renders frames 0-179.",
], [
  "# budget. Renders through qa-sample.js — real Root.jsx entry, props via",
  "# inputProps, scale 0.5 (DEL-14 refactor 2026-08-30): frames 0-179 at 540x960.",
], "visual-qa-loop.yml header comment updated");

console.log("\nStage-15 apply script finished.");