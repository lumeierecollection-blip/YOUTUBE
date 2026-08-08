const fs = require("fs");
const p = "C:/Users/Chile/YOUTUBE/data/audit/9/audit-motion.ledger.md";
let s = fs.readFileSync(p, "utf8");
let n = 0;
const rep = (re, text, label) => {
  if (!s.match(re)) {
    console.error("NO MATCH " + label);
    process.exit(1);
  }
  s = s.replace(re, text);
  n++;
};

// 1) correct the image evidence wording in the Post-REJECT re-run paragraph
rep(
  /G1@f70 = push done, image exactly \{48,392,840,548\}, credit at \{56,906\} = stage\.x\+8 \/ stage\.y\+stage\.h\u221234\./,
  "G1@f70 = the headline rect settles exactly on the compiled rect (push done at 66; the image headline enters RISE@anchor+6 and settles well before f70). The image container {48,392,840,548} and credit {56,906} are code-derived from the stage prop (ImageBeat.jsx:70-73,112-113) \u2014 confirmed by the re-dispatch counter-check; the probe itself gate-measures only the image container scale (image-push@30) and the compiled headline rects (G1), not the image/credit geometry.",
  "evidence-line"
);

// 2) correct the reconciliations item-2 404 reason
rep(
  /because the probe fixture\u2019s public dir lacks b-roll\/ch-01\/cave-entrance\.jpg \(the asset exists in the real public dir; probe-env gap only\)\./,
  "because the probe\u2019s headless bundle 404s the fixture image URL (/public/b-roll/... \u2014 a static-base mismatch in the served bundle: the asset DOES exist at src/skills/remotion-render/public/b-roll/ch-01/cave-entrance.jpg, but the headless server does not map that URL onto the publicDir; probe-env artifact only). No gate reads image bytes \u2014 all image gates read the container div\u2019s computed style, so the 404 never affects a gate result.",
  "404-reason"
);

// 3) insert the Re-dispatch verdicts section before §6
rep(
  /(## \u00a76 \u2014 SHARED-FILE REQUESTS \(SFRs\))/,
  "### Re-dispatch 1 (re-attempt 1 of 2, P3.5) \u2014 three claims \u2192 **3\u00d7 CONFIRM** (this session)\n\nThree `verify-independent` sessions, one per re-implemented claim, each given ONLY the verbatim ASSERTION (corrected claim card) + the component diff (P3.1 \u2014 no spec sources passed; each verifier re-read the repo itself):\n\n| Claim | Verdict | Independent sources used by the verifier | Notes |\n|---|---|---|---|\n| CLAIM-MOT-9-02 (HeroNumber, incl. settle click) | **CONFIRM** | MANUAL F1/E4.1/E4.2; DETAIL-REFERENCE A4 HERO_NUMBER; legacy HeroNumberScene (motion-graphics.jsx:582-611, Sfx 282-289); Progress.jsx (A2 counter); beats.js tokens; probe report G2a/G3/G4 | all 5 items match, incl. the previously-missing click_004 at dbToVolume(\u221222) on tA+56 (file exists in public/sfx/ui/); the A4 \u201cunit tA+2 / headline tA+58\u201d conflict resolved to the compiled anchor+8 (SFR-MOT-9-2), as the claim states. |\n| CLAIM-MOT-9-04 (ListItem, legacy run semantics) | **CONFIRM** | MANUAL F3 (1009-1028); DETAIL-REFERENCE A4 LIST_ITEM (238-251); legacy ListRunScene (motion-graphics.jsx:1013-1096) incl. popStyle/stageExitStyle/Sfx; Chip.jsx; slots.js; probe report G6a/G6b/G6c (f18 shift 89.571, f28 drop op 0.9376/tr \u22120.748, f45 bottom 940) | all 7 items match; the six dispatch-1 deviations (static stack, RISE entry, no shift/dim/badge/click/drop, DROP_STAGGER 7) are all gone. Two non-falsifying observations: spec docs live at repo root (claim-card citations lack full paths) and A4 row 4 dim \u201ctA\u22122\u201d vs F3 \u201ctA\u22124\u201d start conflict \u2014 the claim asserts only the shared 6 f duration. |\n| CLAIM-MOT-9-07 (ImageBeat, F7 treatment + push) | **CONFIRM** | MANUAL F7 (1083-1097) + E2.5/E2.6 (895-897); DETAIL-REFERENCE A4 IMAGE_BEAT; legacy ImageBeatScene (motion-graphics.jsx:945-992); fromBeats.js headline enter (IMAGE_BEAT 6); compile-lint.js; probe report image-push@30 | all 7 items match, incl. plain <img> (legacy-faithful), radius 24, saturate(0.35), 12% tint, fade tA\u22124, spring push 1.05\u21921.00 (byte-identical to the legacy push line), credit riseStyle. Two evidence-writeup inaccuracies flagged and corrected in \u00a72: G1 measures the headline rect, not image/credit geometry (the {48,392,840,548}/(56,906) values are code-derived, not gate-measured); the fixture 404 is a static-base artifact (asset exists), not a missing asset. |\n\nP3.6 note: every verifier re-derived the values independently (spec tables + legacy scenes + closed-form arithmetic reproducing the probe\u2019s measured numbers). The two corrections above are evidence-wording fixes only \u2014 no claim item, code line, or gate assertion changed as a result.\n\n$1",
  "redispatch-section"
);

// 4) status header
rep(
  /Phase 3 re-dispatch \(re-attempt 1 of 2, P3\.5\) in progress\./,
  "Phase 3 re-dispatch (re-attempt 1 of 2, P3.5) \u2192 **3\u00d7 CONFIRM** (\u00a75) \u2014 the re-implemented claims 9-02/9-04/9-07 are independently verified against the live spec + legacy; the two evidence-writeup inaccuracies the verifiers flagged were corrected in \u00a72 (no code or claim-item change). Stage-9 motion lane: **gate-ready** (probe 36/36 + 6/6, lint 38/0, 3\u00d7 CONFIRM).",
  "status-header"
);

fs.writeFileSync(p, s, "utf8");
console.log("OK, " + n + " replacements");
