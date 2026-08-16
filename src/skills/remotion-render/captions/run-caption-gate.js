/**
 * captions/run-caption-gate.js — Stage-10 gate runner (CROSSCHECK-PROTOCOL
 * Part 4 row 10: "caption gates from MANUAL Part H; the 2-frame gap holds on
 * every page"). Owned by: audit-type lane (Stage 10, 2026-08-08).
 *
 * Exit 0 when every gate passes on every page of every real repo SRT AND on
 * the sections-fallback synthesis path; exit 1 otherwise. Prints per-case,
 * per-check results and writes evidence JSON to data/audit/10/out/.
 *
 * Cases exercised:
 *   A  ch-fixture SRT + real script sections (the production path that
 *      verify-compositions.js gates — extended to the full gate set)
 *   B  ch-fixture SRT, no sections (SRT-only path)
 *   C  channel 1 debt-snowball SRT, no sections
 *   D  channel 2 what-to-say SRT, no sections
 *   E  channel 4 great-fire SRT, no sections
 *   F  sections-fallback synthesis (no SRT → word-level captions
 *      synthesized in buildMgPackage, mg-package.js:375-398) — ch-fixture
 *      movile-cave, declared totalMs (60 s); in-path, failures count
 *   G  sections-fallback synthesis — ch-02 narrowboat (no SRT in data/tts/2,
 *      script in render path); in-path, failures count
 *   D  is LEGACY (orphaned research SRT — no script/channel references it,
 *      ledger §7.1 d.2): its failures print as WARNINGS and never set the
 *      exit code, but remain visible in JSON + stdout
 *
 * Checks per case:
 *   [prod] gateCaptions (production H5-H8, beats.js:617) over the package
 *          pages exactly as verify-compositions.js does
 *   [h9]   gateMgHeadlineOverlap (C3.1, mg-package.js:471) over the beats
 *   [syn]  gateSectionsDeclaredCps (fromSrt.js) — synthesis cases only:
 *          declared section timing must satisfy H6 before synthesis maps it
 *          (SFR-cap-002 fail-loud contract; SRT cases have no declared timing)
 *   [ind]  independent gate (fromSrt.js gateCaptionPages): per-page CPS /
 *          duration / chars / lines / words recomputed from raw fields, the
 *          2-frame gap recomputed from RAW milliseconds, and B2.4 from the
 *          slot table — never trusting page.cps/durationMs/startFrame/endFrame
 *   [canon] canonical entry drift: captionPagesFromSrt (fromSrt.js) page
 *          count/text/timing must equal the production package pages
 */
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildMgPackage, gateMgHeadlineOverlap, enrichPages } from "../compositions/mg-package.js";
import { gateCaptions } from "../compositions/beats.js";
import { captionPagesFromSrt, gateCaptionPages, gateSectionsDeclaredCps } from "./fromSrt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..");
const OUT_DIR = join(__dirname, "..", "..", "..", "..", "data", "audit", "10", "out");
mkdirSync(OUT_DIR, { recursive: true });

const srt = (rel) => readFileSync(join(REPO, rel), "utf-8");

const CASES = [
  {
    name: "A ch-fixture SRT + sections",
    srtText: srt("data/tts/ch-fixture/movile-cave-shorts-script-vo.srt"),
    sections: loadSections("ch-fixture", "movile-cave-shorts-script.json"),
  },
  {
    name: "B ch-fixture SRT only",
    srtText: srt("data/tts/ch-fixture/movile-cave-shorts-script-vo.srt"),
  },
  {
    name: "C debt-snowball SRT only",
    srtText: srt("data/tts/1/debt-snowball-vs-debt-avalanche-shorts-script-vo.srt"),
  },
  {
    name: "D what-to-say SRT only",
    srtText: srt("data/tts/2/what-to-say-traffic-stop-script-vo.srt"),
    legacy: true, // orphaned research SRT — warnings only (ledger §7.1 d.2)
  },
  {
    name: "E great-fire SRT only",
    srtText: srt("data/tts/4/great-fire-of-london-script-vo.srt"),
  },
  {
    name: "F movile-cave sections-fallback synthesis (no SRT)",
    sections: loadSections("ch-fixture", "movile-cave-shorts-script.json"),
    totalMs: scriptTotalMs("ch-fixture", "movile-cave-shorts-script.json"),
  },
  {
    name: "G narrowboat sections-fallback synthesis (no SRT)",
    sections: loadSections("ch-02", "narrowboat-10k-surprise-shorts-script.json"),
    totalMs: scriptTotalMs("ch-02", "narrowboat-10k-surprise-shorts-script.json"),
  },
];

/**
 * Declared-total duration for the synthesis path, in ms — the production
 * proxy for audio duration (render.js:310 passes audioSecs×1000; the gate has
 * no audio, so the script's declared total is the faithful stand-in).
 * target_duration_seconds × 1000, falling back to estimated_duration_seconds
 * × 1000, then 60000. Both stage-10 scripts declare 60 s == their last
 * section-window end (0:48-0:60), so sectionWindowsMs (mg-package.js:314-324)
 * uses the DECLARED windows verbatim — the real production synthesis timing.
 */
function scriptTotalMs(channel, scriptFile) {
  const script = JSON.parse(
    readFileSync(join(REPO, "data", "scripts", channel, scriptFile), "utf-8")
  );
  const target = Number(script.target_duration_seconds);
  if (Number.isFinite(target) && target > 0) return target * 1000;
  const estimated = Number(script.estimated_duration_seconds);
  if (Number.isFinite(estimated) && estimated > 0) return estimated * 1000;
  return 60000;
}

function loadSections(channel, scriptFile) {
  const script = JSON.parse(
    readFileSync(join(REPO, "data", "scripts", channel, scriptFile), "utf-8")
  );
  return (script.sections || [])
    .filter((s) => s.voiceover && s.voiceover.trim())
    .map((s) => ({
      id: s.id,
      timing: s.timing,
      voiceover: s.voiceover,
      bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
    }));
}

function pageKey(page) {
  return {
    index: page.index,
    text: page.text,
    startMs: page.startMs,
    endMs: page.endMs,
    words: (page.words || []).length,
  };
}

let overallFailures = 0;
const evidence = [];

for (const c of CASES) {
  const pkg = buildMgPackage(c.srtText || "", {
    sections: c.sections || [],
    totalMs: c.totalMs, // synthesis only — declared total (ledger §7.1 d.4)
  });
  const checks = [];

  // [prod] production gates — exactly what verify-compositions.js runs today.
  const prodCaptions = gateCaptions(pkg.pages);
  const h9 = gateMgHeadlineOverlap(pkg.beats);
  checks.push(
    { name: "prod.gateCaptions (H5-H8)", ...prodCaptions },
    { name: "prod.gateMgHeadlineOverlap (H9)", ...h9 }
  );

  // [syn] synthesis-only input gate: declared section timing vs H6 before
  // the synthesis maps it (cap-010; SFR-cap-002). SRT cases have no declared
  // timing, so this check exists only when sections are synthesized.
  if (!c.srtText && c.sections && c.sections.length) {
    const declared = gateSectionsDeclaredCps(c.sections);
    checks.push({
      name: "syn.gateSectionsDeclaredCps (declared input timing)",
      pass: declared.pass,
      failures: declared.failures,
    });
  }

  // [ind] independent gate over the SAME package pages (enriched).
  const ind = gateCaptionPages(pkg.pages);
  checks.push({ name: "ind.gateCaptionPages (H5-H8 + B2.4 + gap)", pass: ind.pass, failures: ind.failures });

  // [canon] drift: canonical fromSrt entry must equal production pages.
  let drift = { pass: true, failures: [] };
  if (c.srtText) {
    const canon = captionPagesFromSrt(c.srtText);
    const prodKeys = pkg.pages.map(pageKey);
    const canonKeys = canon.map(pageKey);
    if (JSON.stringify(prodKeys) !== JSON.stringify(canonKeys)) {
      drift = {
        pass: false,
        failures: [
          `canonical captionPagesFromSrt (${canon.length} pages) differs from production pages (${pkg.pages.length})`,
        ],
      };
    } else {
      // Also gate the canonical RAW pages (string lines — exact H5 check).
      const canonGate = gateCaptionPages(canon);
      if (!canonGate.pass) {
        drift = {
          pass: false,
          failures: [
            `canonical raw pages fail gates: ${canonGate.failures.join("; ")}`,
          ],
        };
      }
    }
  }
  checks.push({ name: "canon.captionPagesFromSrt drift + raw gate", ...drift });

  const caseFail = checks.filter((ch) => !ch.pass).length;
  const warnCount = c.legacy ? caseFail : 0; // legacy failures: visible, not fatal
  if (!c.legacy) overallFailures += caseFail;
  for (const ch of checks) {
    const status = !ch.pass ? (c.legacy ? "WARN" : "FAIL") : "PASS";
    console.log(`[${c.name}] ${ch.name}: ${status}`);
    for (const f of ch.failures || []) console.log(`    - ${f}`);
  }
  if (warnCount > 0) {
    console.log(`[${c.name}] LEGACY (orphaned research SRT): ${warnCount} failing check(s) — warnings only, excluded from exit code (ledger §7.1 d.2)`);
  }
  console.log(
    `[${c.name}] summary: ${pkg.beats.length} beats, ${pkg.pages.length} pages, synthesized=${pkg.synthesized}`
  );

  evidence.push({
    case: c.name,
    legacy: !!c.legacy,
    warnings: warnCount,
    beats: pkg.beats.length,
    pages: pkg.pages.length,
    synthesized: !!pkg.synthesized,
    checks: checks.map((ch) => ({
      name: ch.name,
      pass: ch.pass,
      failures: ch.failures || [],
    })),
    independent: ind.evidence,
  });
}

writeFileSync(
  join(OUT_DIR, "run-caption-gate.json"),
  JSON.stringify({ date: "2026-08-08", overallFailures, evidence }, null, 2)
);
console.log(`\nGATE RESULT: ${overallFailures === 0 ? "PASS" : "FAIL"} (${overallFailures} failing check(s))`);
process.exit(overallFailures === 0 ? 0 : 1);
