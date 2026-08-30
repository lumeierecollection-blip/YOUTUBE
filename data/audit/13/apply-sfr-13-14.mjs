// Orchestrator application of Stage-13 + Stage-14 shared-file requests.
// - SFR-1   (audit-audio -> CHECK-REGISTER.md): AUD-02 row threshold correction
// - SFR-2   (audit-audio -> qa-scripts/fetch-sfx-library.mjs): stale license path
//           EXTENDED by orchestrator to the identical stale comment in the
//           generated visual/sfx-library.js (same one-line correction; the
//           next regeneration would produce exactly this line).
// - SFR-4   (audit-audio -> src/audio/sfx-manifest.json): relabel as design
//           catalog (lane offered recompute *or* relabel; relabel chosen —
//           minimal, honest; the per-file log lives in sfx-library.js).
// - RND-06..12 register-status updates (audit-render shared-file request #3,
//           "once orchestrator confirms" — all confirmed by direct read).
// - AUD-03..08 register-status updates (orchestrator register maintenance:
//           stage-13 gate verdicts must be reflected in the single source of
//           truth; every value traces to the lane's measured evidence.
// - qa/INVENTORY.md:16 (audit-render request #1): remove stale entry for a
//           deleted file.
// - MOTION-GRAPHICS-MANUAL.md A6.2 (audit-render request #2): strike advice
//           that §0.10 already invalidated and is now impossible to follow.
//
// NOT edited (carried to owners, recorded in GATE-13/GATE-14):
// - data/research/2/render-settings.json:41 (research lane; its generator
//   src/utils/render-settings.js:57/105 embeds the same stale CLI string, so a
//   half-fix of the artifact would regen it stale — carried whole).
//   MOTION-GRAPHICS-MANUAL.md E4 manifest pointer (doc lane).
//
// Line-wise, CRLF-preserving, existence-checked: each anchor must match exactly
// once or the script aborts without writing. This file is part of the audit
// record (referenced by data/audit/13/GATE.md and data/audit/14/GATE.md).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "C:/Users/user/YOUTUBE";
const REGISTER = join(ROOT, "CHECK-REGISTER.md");
const GENERATOR = join(ROOT, "src/skills/remotion-render/qa-scripts/fetch-sfx-library.mjs");
const GENERATED = join(ROOT, "src/skills/remotion-render/visual/sfx-library.js");
const MANIFEST = join(ROOT, "src/audio/sfx-manifest.json");
const INVENTORY = join(ROOT, "qa/INVENTORY.md");
const MANUAL = join(ROOT, "MOTION-GRAPHICS-MANUAL.md");

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
  const from = oldLines[0];
  let hits = [];
  for (let i = 0; i + oldLines.length <= lines.length; i++) {
    let ok = true;
    for (let j = 0; j < oldLines.length; j++) {
      if (lines[i + j] !== oldLines[j]) { ok = false; break; }
    }
    if (ok) hits.push(i);
  }
  // Idempotence: if the NEW text is already present exactly once, the step was
  // applied in a prior run — skip without error. Anything else must match the
  // OLD text exactly once or we abort without writing.
  let newHits = [];
  for (let i = 0; i + newLines.length <= lines.length; i++) {
    let ok = true;
    for (let j = 0; j < newLines.length; j++) {
      if (lines[i + j] !== newLines[j]) { ok = false; break; }
    }
    if (ok) newHits.push(i);
  }
  if (newHits.length === 1) {
    console.log(`SKIP ${label} (already applied)`);
    return;
  }
  if (hits.length !== 1) {
    console.error(`ABORT ${label}: expected exactly 1 anchor match, found ${hits.length}`);
    console.error(`  anchor[0] = ${JSON.stringify(from)}`);
    process.exit(1);
  }
  const at = hits[0];
  const out = [...lines.slice(0, at), ...newLines, ...lines.slice(at + oldLines.length)];
  writeFileSync(file, out.join(eol));
  console.log(`OK ${label} (line ${at + 1})`);
}
function applySubstringReplace(file, oldText, newText, label) {
  const src = readFileSync(file, "utf8");
  const hits = src.split(oldText).length - 1;
  if (hits === 0 && src.includes(newText)) {
    console.log(`SKIP ${label} (already applied)`);
    return;
  }
  if (hits !== 1) {
    console.error(`ABORT ${label}: expected exactly 1 occurrence of ${JSON.stringify(oldText)}, found ${hits}`);
    process.exit(1);
  }
  writeFileSync(file, src.replace(oldText, newText));
  console.log(`OK ${label} (substring, 1 occurrence)`);
}

// ── CHECK-REGISTER.md ────────────────────────────────────────────────────────

// SFR-1 — AUD-02 row. OLD anchor uses the register's on-disk bytes (the file
// is double-encoded: ≤ appears as the mojibake sequence â‰¤). NEW row is the
// lane's exact replacement text in proper Unicode.
applyLineReplace(
  REGISTER,
  ["| AUD-02 | â‰¤1 SFX per beat | compiler | â‰¤1 | 1 | MINOR | 13 | N/B |"],
  ["| AUD-02 | ≤3 SFX per beat, ≥12 frames apart, each explainable | compiler (`MAX_EVENTS_PER_BEAT`, `MIN_GAP_FRAMES`) | ≤3, gap≥12 | 1 | MINOR | 13 | FAIL→amended 2026-08-29 (stage 13). The ≤1 threshold never matched the compiler: `sound-design.js` ships `MAX_EVENTS_PER_BEAT=3`/`MIN_GAP_FRAMES=12` as documented design, and the PASS record is incompatible with a ≤1 cap — row 304's own \"9/9 events present\" counts 9 events across 5 beats. Stage-13 measurement of the QA inputs: 9 events/5 beats (ch-01), 12 events/5 beats (ch-48), 15 events/8 beats (ch-02 real script); beats with >1 event = 4/5, 5/5, 6/8; max 3; tightest actual gap 15 f. Texture ticks repeat inside one audible state by design; non-repetition events land exactly on visual-state start frames |"],
  "AUD-02 (SFR-1 register amendment)"
);

// AUD-03 .. AUD-08 — register-status maintenance reflecting stage-13 gate.
applyLineReplace(
  REGISTER,
  ["| AUD-03 | SFX fires on the visual-land frame, not the word | compiler | match | 1 | MINOR | 13 | N/B |"],
  ["| AUD-03 | SFX fires on the visual-land frame, not the word | compiler | match | 1 | MINOR | 13 | **PASS** - 2026-08-29 stage 13: anchorCheck exact (26 events at localDelta 0, 10 on-grid ticks inside repeat states, 0 OTHER); scheduler keys only off visualStates; SoundEvent mounts at the same atFrame |"],
  "AUD-03 status PASS"
);
applyLineReplace(
  REGISTER,
  ["| AUD-04 | Gains match the SFX map | compiler | exact | 1 | MINOR | 13 | N/B |"],
  ["| AUD-04 | Gains match the SFX map | compiler | exact | 1 | MINOR | 13 | **PASS** - 2026-08-29 stage 13: 0 vol/target/missing violations across all QA inputs; 26/26 files present |"],
  "AUD-04 status PASS"
);
applyLineReplace(
  REGISTER,
  ["| AUD-05 | Every SFX file is local, never a remote URL | `grep https` in audio | 0 hits | 1 | BLOCKER | 13 | UNK |"],
  ["| AUD-05 | Every SFX file is local, never a remote URL | `grep https` in audio | 0 hits | 1 | BLOCKER | 13 | **PASS** - 2026-08-29 stage 13: 0 https in audio.js/sound-design.js/sfx-library.js; attribution URLs are text records in sfx-manifest.json only; runtime loads via staticFile() |"],
  "AUD-05 status PASS"
);
applyLineReplace(
  REGISTER,
  ["| AUD-06 | Every SFX file's licence permits monetised use | licence log | 100% | 0 | BLOCKER | 13 | UNK |"],
  ["| AUD-06 | Every SFX file's licence permits monetised use | licence log | 100% | 0 | BLOCKER | 13 | **PASS** - 2026-08-29 stage 13: 26/26 licence records in sfx-library.js + sfx-library.measured.json; Kenney CC0 + Mixkit commercial use verified from first-party sources |"],
  "AUD-06 status PASS"
);
applyLineReplace(
  REGISTER,
  ["| AUD-07 | Master is âˆ’14 LUFS integrated | ffmpeg `ebur128` on a real render | âˆ’14 Â±0.5 | 3 | MAJOR | 13 | UNK |"],
  ["| AUD-07 | Master is −14 LUFS integrated | ffmpeg `ebur128` on a real render | −14 ±0.5 | 3 | MAJOR | 13 | N/B - 2026-08-29 stage 13: UNVERIFIABLE (no compositor/render on this machine); venue = production render + `audio-qa.mjs` ebur128 (stage 16/17) |"],
  "AUD-07 status N/B"
);
applyLineReplace(
  REGISTER,
  ["| AUD-08 | VO peaks â‰¤ âˆ’3 dBFS | ffmpeg | â‰¤ âˆ’3 | 3 | MINOR | 13 | UNK |"],
  ["| AUD-08 | VO peaks ≤ −3 dBFS | ffmpeg | ≤ −3 | 3 | MINOR | 13 | N/B - 2026-08-29 stage 13: UNVERIFIABLE (`vo.mp3` is a silent placeholder, measured 73.13 s, byte-identical to the staged file); venue = a real TTS render (stage 16/17) |"],
  "AUD-08 status N/B"
);

// RND-06 .. RND-12 — audit-render shared-file request #3 ("once orchestrator
// confirms" — every value confirmed by direct read of render.js:291-294,
// Test-Path False, and repo-wide greps).
applyLineReplace(
  REGISTER,
  ["| RND-06 | `renderMedia` sets `imageFormat: 'png'` | parse `render.js` | present | 1 | MAJOR | 14 | **FAIL** |"],
  ["| RND-06 | `renderMedia` sets `imageFormat: 'png'` | parse `render.js` | present | 1 | MAJOR | 14 | **PASS** - 2026-08-29 stage 14: render.js:291 `imageFormat: \"png\"` |"],
  "RND-06 status PASS"
);
applyLineReplace(
  REGISTER,
  ["| RND-07 | `renderMedia` sets an explicit `crf` | parse | present | 1 | MAJOR | 14 | **FAIL** |"],
  ["| RND-07 | `renderMedia` sets an explicit `crf` | parse | present | 1 | MAJOR | 14 | **PASS** - 2026-08-29 stage 14: render.js:292 `crf: 16` |"],
  "RND-07 status PASS"
);
applyLineReplace(
  REGISTER,
  ["| RND-08 | `renderMedia` sets `pixelFormat` | parse | present | 1 | MINOR | 14 | **FAIL** |"],
  ["| RND-08 | `renderMedia` sets `pixelFormat` | parse | present | 1 | MINOR | 14 | **PASS** - 2026-08-29 stage 14: render.js:293 `pixelFormat: \"yuv420p\"`; byte-confirmed in stage-14 clip ffprobe (pix_fmt=yuv420p) |"],
  "RND-08 status PASS"
);
applyLineReplace(
  REGISTER,
  ["| RND-09 | `chromiumOptions.gl` passed to `renderMedia`, not the config file | parse | present | 1 | BLOCKER | 14 | **FAIL** |"],
  ["| RND-09 | `chromiumOptions.gl` passed to `renderMedia`, not the config file | parse | present | 1 | BLOCKER | 14 | **PASS** - 2026-08-29 stage 14: render.js:294 `chromiumOptions: { gl: \"swangle\" }`; config file deleted (RND-10) |"],
  "RND-09 status PASS"
);
applyLineReplace(
  REGISTER,
  ["| RND-10 | `remotion.config.js` is deleted or annotated as CLI-only | file check | one of | 1 | MAJOR | 14 | **FAIL** |"],
  ["| RND-10 | `remotion.config.js` is deleted or annotated as CLI-only | file check | one of | 1 | MAJOR | 14 | **PASS** - 2026-08-29 stage 14: file deleted (git status: ` D`), Test-Path False; nothing imports or loads it |"],
  "RND-10 status PASS"
);
applyLineReplace(
  REGISTER,
  ["| RND-11 | No config-file setting is relied on by the SSR path | code review | 0 | 4 | BLOCKER | 14 | **FAIL** |"],
  ["| RND-11 | No config-file setting is relied on by the SSR path | code review | 0 | 4 | BLOCKER | 14 | **PASS** - 2026-08-29 stage 14: zero `Config.set` repo-wide; publicDir verified as bundler default from installed `@remotion/bundler` source (dist/bundle.js:182,256-258) |"],
  "RND-11 status PASS"
);
// RND-12 — restate denominator 12/12 → 6/6 per register scope header
// (corrected 2026-08-16) + status N/B-open. State stays N/B: row's own Stage
// column is 16; the CI matrix gate lands there.
applyLineReplace(
  REGISTER,
  ["| RND-12 | One full Short renders per mg channel | CI | 12/12 | 3 | BLOCKER | 16 | **FAIL** â€” never a clean run in CI. 2026-08-26: one real ch-02 (Legal Brief) Short rendered clean end-to-end via `render.js`'s actual CLI in a sandboxed Linux environment (`data/renders/2/*.mp4`, not committed — a local verification artifact, not a CI run) — 1/12, still open |"],
  ["| RND-12 | One full Short renders per mg channel | CI | 6/6 | 3 | BLOCKER | 16 | N/B - 2026-08-29 stage 14: denominator restated 12/12 -> 6/6 per register scope header (corrected 2026-08-16; 12/12 predated the 50->17 portfolio cut). CI not dispatchable from this session (`gh` 2.97.0 unauthenticated, no token). Evidence stands: 2026-08-26 ch-02 clean run (1/6), plus stage-14 real-path clip (270x480 yuv420p h264) and full-length runs reaching `renderMedia`. Row gates at stage 16 |"],
  "RND-12 restate 6/6 + N/B"
);

// ── SFR-2: stale license path (template + generated comment) ───────────────

applySubstringReplace(
  GENERATOR,
  "src/audio/kenney_interface_sounds_1.0/LICENSE.txt",
  "src/audio/kenney_interface/License.txt",
  "SFR-2 fetch-sfx-library.mjs L323"
);
applySubstringReplace(
  GENERATED,
  "src/audio/kenney_interface_sounds_1.0/LICENSE.txt",
  "src/audio/kenney_interface/License.txt",
  "SFR-2 generated visual/sfx-library.js L6 (same comment; regeneration would emit this line)"
);

// ── SFR-4: relabel manifest as design catalog ───────────────────────────────

{
  const src = readFileSync(MANIFEST, "utf8");
  const eol = detectEol(src);
  const lines = splitLines(src);
  const marker = '  "_note": "DESIGN CATALOG (2026-07-27 planning pass; pre-dates the 26-file shipped library). NOT the per-file license log: the authoritative per-file log is src/skills/remotion-render/visual/sfx-library.js (file/source/license per entry) plus src/audio/sfx-library.measured.json. See CHECK-REGISTER AUD-06 (stage 13, 2026-08-29).",';
  if (lines.includes(marker)) {
    console.log("SKIP SFR-4 manifest relabel (already applied)");
  } else {
    if (lines[0] !== "{") {
      console.error("ABORT SFR-4: manifest does not start with `{` on line 1");
      process.exit(1);
    }
    lines.splice(1, 0, marker);
    writeFileSync(MANIFEST, lines.join(eol));
    console.log("OK SFR-4 manifest relabel (inserted _note after line 1)");
  }
}

// ── audit-render request #1: qa/INVENTORY.md — remove deleted-file entry ────

applyLineReplace(
  INVENTORY,
  [
    "- `remotion.config.js` — jpeg format, overwrite, public dir `public`, OpenGL `angle`",
    "  renderer (needed by `@remotion/effects`).",
  ],
  [],
  "INVENTORY.md:16 remove remotion.config.js entry"
);

// ── audit-render request #2: MOTION-GRAPHICS-MANUAL.md A6.2 ─────────────────

applyLineReplace(
  MANUAL,
  [
    "**A6.2** — `@remotion/effects` runs on WebGL2, and renders require",
    "`Config.setChromiumOpenGlRenderer('angle')`. This must be set in",
    "`remotion.config.js` before any effect is used, or CI renders will silently",
    "differ from local ones.",
  ],
  [
    "**A6.2** — Superseded 2026-08-29 by RND-10/RND-11 (stage 14). `remotion.config.js`",
    "no longer exists — the SSR path (`bundle()` + `renderMedia()`) never read it",
    "(LAYOUT-SYSTEM §0.10), so no config file may set the renderer. GL selection is",
    "passed explicitly: `renderMedia({ chromiumOptions: { gl: 'swangle' } })` in",
    "`render.js`. See LAYOUT-SYSTEM §0.10 for the full reasoning.",
  ],
  "MANUAL A6.2 strike + pointer (render-lane request #2)"
);

console.log("\nALL STAGE-13/14 SFRS AND REGISTER UPDATES APPLIED");