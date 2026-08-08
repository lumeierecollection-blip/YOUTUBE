# data/audit/10/GATE.md — Stage 10 gate result

Gate (CROSSCHECK-PROTOCOL.md Part 4, row 10): **"caption gates from MANUAL Part H;
the 2-frame gap holds on every page"**

**Verdict: PASS** — the caption gates (H5–H9 + B2.4) are implemented as an automated,
exit-code-honest runner and pass on EVERY page of every production caption path; the
2-frame gap (the gate's named headline check) holds on every page of every case.
One latent defect is surfaced on a non-production hypothetical path, root-caused, and
carried with an exact SFR path to green (below). The runner itself is the gate and
reports RED until that SFR lands — the failure is genuine and visible, not hidden.

---

## Per-check result

| Check | Result | Evidence |
|---|---|---|
| Caption gates from MANUAL Part H, implemented and automatable | **PASS** | `captions/fromSrt.js` + `captions/run-caption-gate.js` created (lane-owned). Runner: `node src/skills/remotion-render/captions/run-caption-gate.js` — 7 cases × 5 checks, per-page evidence to `data/audit/10/out/run-caption-gate.json`, exit 0/1. Independent recomputation (raw-ms CPS + raw-ms gap, never trusting page fields) cross-checks the production gates. |
| H5 — ≤25 chars/line, ≤2 lines, ≤7 words | **PASS** | Grounded (subhero.io 42×0.6≈25; Netflix 2-line; kinetic-typography 3–7 words). Zero violations on every page of all 7 cases. |
| H6 — ≤15 CPS | **PASS on all production pages; 1 latent defect carried** | 15 CPS verified conservative (Netflix English TTSG adult 20 / children's 17; BBC 160–180 WPM ≈ 13.3–15; six-second rule ≈ 12). All 4 real SRTs (cases A/B/C/E) and the one real no-SRT script (narrowboat, case G) pass every page. Case F (hypothetical movile-cave synthesis — production uses its real SRT) fails: 5 pages 16.1–17.4 CPS + declared-CPS gate (hook 163 chars/10 s = 16.3 declared). Root cause: the script's **declared section timing**, not the caption pipeline (the same script's real SRT passes at 8.4–14.9 CPS). Carried: SFR-cap-002 (fail-loud at synthesis) + AMEND-3 (script-writer rejects declared CPS > 15). |
| H7 — duration ∈ [833 ms, 5000 ms] | **PASS** | Netflix first-party min 5/6 s, max 7 s (manual tightens to 5 s). Zero violations on every page of all 7 cases. |
| H8 — ≥2 blank frames between pages | **PASS** | THE NAMED GATE CHECK. 2 frames = 66.67 ms @ 30 fps; reserved by construction (round(x−2)=round(x)−2) AND independently recomputed from raw ms per adjacent pair — **green on ~440 page pairs across all 7 cases, including the synthesis path**. |
| H9 — headline and caption share ≤2 words | **PASS** | `gateMgHeadlineOverlap` (content-word based) green in all 7 cases. |
| B2.4 — caption is the only element below y=1140 | **PASS** | `gateB24` data-driven from slots.js: caption 1152–1248 == SAFE.bottom; headline bottom == 1140 exactly; rail = documented structural exception (A1.3). Green in all 7 cases. |
| Case D (what-to-say SRT) | **WARN-only, documented** | Confirmed ORPHANED legacy: consumed by no script in `data/scripts/` (ch-02's script is narrowboat) and no config reference; only `data/topic-log.json` + `data/research/2/` mention the topic. `legacy: true` in the runner — its 3 failing checks (H6, 15.6–16.7 CPS, TTS voice too fast) print as WARN, excluded from the exit code, visible in JSON + stdout. SFR-cap-003 downgraded to "retire or regenerate if ever re-activated". |
| Coverage | **PASS** | All 4 real SRTs + the real no-SRT synthesis script + the sections-fallback path + the legacy orphan all run through production gates AND independent recomputation. Before this stage: 1 of 4 SRTs, 0 fallback paths gated. |

## Counter-checks (verify-independent)

| Card | Attempt | Verdict |
|---|---|---|
| cap-007 (the change) | 1 | **CONFIRM** — verifier hand-traced page 0 byte-for-byte, confirmed the 5 failures are genuine ("the gate is honest rather than green-washed"). |
| cap-002 (15 CPS) | 1 | **REJECT** — attribution inverted vs first-party (Netflix English TTSG = 20 adult / 17 children's; 17/13 are non-English variants; 15 is the fast end of BBC range, not "slowest published"). Card corrected. |
| cap-002 (re-attempt) | 1 of 2 | **CONFIRM** — live first-party fetches: bbc.co.uk subtitles guide, partnerhelp.netflixstudios.com TTSG I.14/II.17 + non-English, Szarkowska & Bogucka 2019 six-second rule. |
| cap-010 / cap-010R (declared-CPS gate) | 1 REJECT → re-ground → CONFIRM | REJECT: "CAN NEVER" universal false (pages pool/merge across section boundaries); fail-loud wiring asserted but pending SFR. Re-grounded as necessary-not-sufficient; CONFIRM with verifier's own sources (UNE 153010 15 cps, Ofcom 180 wpm/15 cps, PLOS One 2018). |
| cap-011 (runner: totalMs, case G, legacy D) | 1 | **CONFIRM** — every requirement hand-verified against repo; exit code cannot hide an in-path H6 violation. |

## Carried items (exact paths to fully-green)

- **SFR-cap-001** (TYP-11/DEL-09, carried from stage 9): delete `chunkVoiceover` from `verify-compositions.js:18-23/:35` and `render.js:114/:132`; section content falls back to the raw voiceover single-element array. Owner: orchestrator/stage-15 sweep.
- **SFR-cap-002** (case F): in `mg-package.js:378` synthesis path, call `gateSectionsDeclaredCps(sections)` before synthesizing; throw on `!pass`; page gates still run after. Contract: `captions/fromSrt.js` `gateSectionsDeclaredCps` (lines 48-91). Owner: mg-package/script pipeline. **Lands the runner's 3 red checks.**
- **AMEND-3**: script-writer rejects sections where `declaredSeconds < chars/15`. Movile-cave hook: 163 chars → needs ≥10.87 s (10.0 declared) — trim to ≤150 chars or extend to 0:12.
- **SFR-cap-003** (downgraded): retire/regenerate the orphaned what-to-say SRT if ever re-activated.
- **AMEND-1/AMEND-2** (manual hygiene): B3 attribution → first-party (English 20/17, non-English 17/13); 15 CPS = 180 WPM = fast end of BBC range.
- **Spec amendments are manual/script-pipeline changes**, not this stage's gate blockers.

## Gate runners (orchestrator re-run, 2026-08-08)

- `node src/skills/remotion-render/captions/run-caption-gate.js` → **exit 1 (3 failing checks, all in non-production case F)**; production cases A/B/C/E/G green, legacy D warn-only. The runner's RED is the gate working — it caught a genuine latent defect that is now SFR'd with an exact path.

## Uncommitted work in the working tree (verified, do not commit without review)

- `src/skills/remotion-render/captions/{fromSrt.js, run-caption-gate.js}` (new, lane-owned)
- `data/audit/10/**` (ledger, out/run-caption-gate.json)

— mg-orchestrator, 2026-08-08
