# AUDIT-ENCODING — Stage 15 ledger (Delete-list sweep)

**Lane:** `audit-encoding` — archetypes, charts, concept mapping, data honesty
**Stage:** 15 (CROSSCHECK-PROTOCOL.md Part 4 row 15 — "Delete-list sweep: LAYOUT-SYSTEM D1–D14 and FINISH-SPEC R01–R30 all grep-clean")
**Date:** 2026-08-30
**FINISH-SPEC.md:** confirmed ABSENT (`Test-Path FINISH-SPEC.md` = False). Its R01–R30 robot list is re-encoded as the DEL table in CHECK-REGISTER.md Part 4 (lines 1469–1527), which is the gate list used here.

## Method

- No files were edited. The three-phase edit protocol (Part 2 of CROSSCHECK-PROTOCOL.md) therefore does not apply; this is the sweep phase only. No claim cards, no diffs, no counter-check calls.
- Every row below was verified by my own greps (Grep tool, ripgrep semantics) executed this session — **not** from CHECK-REGISTER's State column. Register rows ENC-05/06 currently show stale FAIL in the State column; the greps below are the evidence, and the register's own grep parameters are what were measured.
- Grep scope per row: `src/skills/remotion-render/` (the motion-graphics render package), plus a repo-wide code sweep for cross-check completeness. Hits outside the package are annotated and not counted against the row unless stated.
- Pattern note DEL-05: the register table cell (line 1481) reads `` `[A-Za-z]+)\\s+([A-Za-z]+` `` — markdown-escaped. Both decodings were tested: `[A-Za-z]+\)\s+\([A-Za-z]+` (prompt form) and `[A-Za-z]+\)\\s+\([A-Za-z]+` (literal `\\s`). Both give the same verdict.

## Per-row verdicts

| ID | Pattern (as checked) | Hits in package | Verdict | Paired positive check |
|---|---|---|---|---|
| DEL-04 | `extractStats\|extractHeroNumber\|extractFlowLines` | 1 (comment only) | **PASS** | ENC-06/08 (register rows FAIL but their grep terms are clean — resolved as PASS in the Stage-9 ledger; my greps reproduce 0 code hits), SCR-05 (gate-script.js) |
| DEL-05 | two-word headline regex (both decodings) | 0 | **PASS** | — |
| DEL-06 | `iconFor` | 0 | **PASS** | VIS-02 `iconHeroRatio` = 0 (register §3.3 PASS, 3 real renders) |
| DEL-32 | `resolveIcon` outside `iconRole === "secondary"` guard | 6 (1 live, all guarded) | **PASS** | VIS-02; diagnostics.js icon-hero audit; run-visual-tests.js iconRole asserts |
| DEL-33 | `StatementScene` reachable for a beat carrying `visualPlan` | 10 (0 code for the bare identifier) | **PASS** | run-visual-tests.js:173,184–186 (terminal strategy iconRole "none"); VIS-02 |
| DEL-07 | `pickScene` | 0 | **PASS** | ENC-05 (its own grep parameter `pickScene` = 0 hits — verified; register State stale FAIL, Stage-9 ledger recorded CHANGED→PASS) |
| DEL-13 | `MinimalSections` | 3 — all in `compositions/minimal.jsx` (MINIMAL style file) | **PASS** | — (OTHER-STYLE note; mg path clean) |
| DEL-31 | `channelName` / `sections[idx].id` read inside `Kicker`/`SectionKickers` (`compositions/motion-graphics.jsx`) | 0 (no such components; no such reads) | **PASS** | — (composition path) — **but see AMEND-15-1 co-report: the scaffolding's raw-`section.id` content survives dormant in MY owned `spec/fromBeats.js`** |

## Per-hit classification

### DEL-04 — regex stat scrapers
- `compositions/beats.js:840` — inside a block comment: "matches this file's own precedent (parseNumber over extractStats/extractHeroNumber)". **COMMENT-OR-STRING-ONLY** — a record of what was replaced (seed confirmed). `extractFlowLines` has zero hits anywhere in the repo. No live scrapers exist; numbers flow from `beat.data` (parseNumber / authored series), enforced by fromBeats.js throw gates (ENC-08/09/24/10/21/20) and SCR-05.
- Verdict: **PASS**.

### DEL-05 — two-word headline regex
- Package scope: **0 hits** for `[A-Za-z]+\)\s+\([A-Za-z]+` and 0 for the register-literal `\\s` variant. A deliberately looser probe (`[A-Za-z]+\)[ A-Za-z]+\([A-Za-z]+`) matched 15 ordinary JS invocation patterns (`) clearTimeout(`, `) return greedyWrap(`, `) if (`…), none of which is headline construction.
- Repo-wide strict pattern: 3 hits, all outside the package and all natural-language parentheticals in strings/comments — `data/audit/12/check-dot-grid-density.mjs:17` ("frame) (opacity"), `scripts/render-and-qa.js:198` ("task(s) (warn-only"), `scripts/gate-research.js:95` ("domain(s) (need >=3)"). None constructs a headline from static text.
- Verdict: **PASS**.

### DEL-06 — keyword icon ladder (`iconFor`)
- **0 hits** package-wide and repo-wide. Icon lookup is now `resolveIcon` + `matchIconTerm` (mg-style.js:160–182) driven by each channel's `icon_map`, vendored-set-gated (`gateIconNames`, mg-package.js:819–826).
- Verdict: **PASS**.

### DEL-32 — unconditional per-beat icon resolution (`resolveIcon` outside guard)
Hits (6):
- `mg-style.js:158` — comment. **COMMENT-OR-STRING-ONLY.**
- `mg-style.js:179` — `export function resolveIcon(...)` — the resolver's **definition**. Its existence is legitimate: it is the vendored-map resolver used only by the guarded call. **LEGITIMATE REUSE.**
- `mg-package.js:25` — `import { resolveIcon, ... }` — **LEGITIMATE REUSE** (import for the guarded call below).
- `mg-package.js:254, 258` — comments documenting the deleted unconditional line and the fallback chain. **COMMENT-OR-STRING-ONLY** (a deletion record).
- `mg-package.js:273` — the only live call: `icon: wantsIcon ? resolveIcon(iconMap, beat.text) : null`, where `wantsIcon = iconRole === "secondary"` (line 269) and `iconRole = plan ? plan.iconRole : "none"` (line 268). **DESIGN FEATURE, backed by positive checks**: `iconRole` is clamped to `"secondary"|"none"` at the only assignment point (director.js:457); strategies.js:379–381 makes any other role a registry failure; run-visual-tests.js:149 asserts `plan.iconRole !== "primary"`; :173–186 assert the terminal strategy is icon-free. Companion `isSpecificIconMatch` (mg-package.js:274) is under the same `wantsIcon` guard.
- Verdict: **PASS** — no `resolveIcon` call site exists outside an `iconRole === "secondary"` protection (`wantsIcon` is a direct alias of that exact comparison).

### DEL-33 — icon-only stage scene (`StatementScene` reachable for a planned beat)
Hits (10); the bare identifier `StatementScene` has **0 code hits**:
- `mg-package.js:259`, `mg-style.js:189`, `motion-graphics.jsx:1105`, `abstract-scenes.jsx:15`, `abstract-scenes.jsx:145`, `strategies.js:13` — all **COMMENT-OR-STRING-ONLY** deletion records. motion-graphics.jsx:1097–1110 is explicit: the old archetype-keyed fallback switch (which included the lone-centred-icon `StatementScene`) "was confirmed unreachable in every real caller … and deleted rather than kept".
- `strategies.js:297` — `scene: "CinematicStatementScene"` — the **replacement** identifier (substring match only). CINEMATIC_STATEMENT is the terminal strategy (`reachedBy: "terminal"`, `iconRole: "none"`, strategies.js:296–308; TERMINAL_STRATEGY constant line 336; "Deliberately NOT icon-bearing", lines 331–335).
- `scenes/index.jsx:16, 45` — import/export of the replacement `CinematicStatementScene` (registered in SCENE_COMPONENTS, the router's registry).
- `scenes/abstract-scenes.jsx:168–306` — the replacement scene itself: phrase on a stake over three real depth planes; **renders no icon** ("Neither scene here renders an icon at all." line 20; "No icon. Ever." line 147). It is reachable for planned beats (it is the terminal strategy) but its behavior is the opposite of the violation.
- Positive checks: run-visual-tests.js:173 (`STRATEGIES[TERMINAL_STRATEGY].iconRole !== "secondary"`), :184–186 (terminal plan's iconRole is "none"); VIS-02 iconHeroRatio.
- Verdict: **PASS** — the icon-only stage scene does not exist; only its deletion record and its icon-free replacement survive.

### DEL-07 — cue-based scene routing (`pickScene`)
- **0 hits** package-wide. Repo-wide, the identifier appears only in `data/audit/9/frombeats-archetype-gate.mjs:24–25,440` — the Stage-9 gate *that tests for the absence* (not live code).
- §4.1 note: DEL-07 pairs with ENC-05. ENC-05's own grep parameter is the same string (`grep pickScene` → 0 hits) — verified by my grep. The text-based router is physically present: `classifyBeats`/`classifyBeat` (beats.js:745/764), `deriveScene` (mg-package.js:248), semantic detectors (visual/semantics.js), `SemanticScene` (scenes/index.jsx:65). The register's State column still says FAIL for ENC-05; that is the stale record the Stage-9 ledger already corrected (CHANGED→PASS). My greps reproduce the clean state.
- Verdict: **PASS**.

### DEL-13 — `MinimalSections` text-on-gradient
- 3 hits, **all** in `compositions/minimal.jsx` (66, 117, 128) — the MINIMAL style's own composition file, registered separately in Root.jsx:3 (`import { compositions as minimal } from "./compositions/minimal.jsx"`). The motion-graphics path (motion-graphics.jsx, mg-style.js, mg-package.js, scenes/, visual/, spec/) contains **0 hits** and none of the mg files imports minimal.jsx.
- Per the DEL-13 judge scope: **OTHER-STYLE** — not the motion-graphics style's artifact. The mg-style path is clean.
- Verdict: **PASS** (mg path grep-clean; hits are the MINIMAL style's, out of this register's scope — register Part 6 row 3).

### DEL-31 — kicker scaffolding
Registered pattern: `channelName` or `sections[idx].id` read inside `Kicker`/`SectionKickers` (`compositions/motion-graphics.jsx`).
- **No `Kicker` or `SectionKickers` identifier exists anywhere in the package** (the only "Kicker" string is a comment in the layout compiler, `layout/compile-lint.js:94`, describing the kicker *slot's* content shape — not a component).
- `motion-graphics.jsx:1192` — `channelName = ""` — destructured default prop, **never read** (single occurrence in the file; grep for further uses = none).
- `motion-graphics.jsx:1187` — `sections = []` — destructured default prop, **never read** (single occurrence).
- `sections[idx].id` / `sections[i].id` / `section.id` patterns in motion-graphics.jsx — **0 hits**.
- The kicker no longer exists as a rendered composition element in the mg render path (no component renders one; motion-graphics.jsx:1080's "per-section kicker" is a header comment for a section that currently contains none).
- Verdict (registered pattern): **PASS**. **But see AMEND-15-1.**

## Cross-cutting co-reports — other DEL patterns inside MY owned files

Owned paths: `spec/fromBeats.js`, `visual/strategies.js`, `visual/director.js`, `visual/semantics.js`, `visual/channel-grammar.js`, `primitives/Panel.jsx`, `compositions/scenes/**` (7 scene files + elements/; `stage.jsx` is outside my ownership per the agent permission allow-list and is reported only as context).

| DEL | Pattern | Hits in my owned files | Classification |
|---|---|---|---|
| DEL-16 | `Math.sin(` outside arc helper | `abstract-scenes.jsx:92` — destabilising wobble; `primitives.jsx:91` — `seeded()` deterministic PRNG hash; `structure-scenes.jsx:822` — `Math.sin(t*Math.PI)*sag` sag curve inside a link-shape helper | abstract-scenes:92 amplitude is gated by act-state progress `a` (`* 9 * a`) — motion-driven destabilisation, **not an idle pulse**; DESIGN FEATURE but flag `audit-motion` (row owner) for confirmation. primitives.jsx:91 is the documented deterministic seeding primitive (header + line 107: "Math.random would break both") — **LEGITIMATE REUSE**. structure-scenes:822 is a shape/arc helper — **LEGITIMATE REUSE** (reads as the allowed arc-helper class). |
| DEL-21 | text `skew\|rotate(` | `structure-scenes.jsx:726` — causal-marker TEXT rotated 90° to ride vertically on the gate (functionally positioned label, structure-scenes:718–738); `structure-scenes.jsx:759`, `GeospatialRadiusScene.jsx:253/351/378`, `quantity-scenes.jsx:203` — group/chip/map rotations, not text | 726: **DESIGN FEATURE** (functional vertical label on the causal gate; not decorative slop) — flag `audit-type` (row owner). 759/253/351/378/203: **LEGITIMATE REUSE** (shape/coordinate-space rotation, not text transforms). |
| DEL-23 | `Math.random` | `GeospatialRadiusScene.jsx:80`, `primitives.jsx:107`, `quantity-scenes.jsx:121`, `structure-scenes.jsx:131`, `visual/director.js:388` | **COMMENT-OR-STRING-ONLY** — all five are affirmations of its absence (determinism records). PASS in my files. |
| DEL-25 | `parallax` | `abstract-scenes.jsx:232, 289`, `structure-scenes.jsx:129` | **COMMENT-OR-STRING-ONLY** in my files, describing the designed depth system (composition.js plane factors; run-visual-tests.js:541 "a plane ends up moving exactly its parallax factor times the camera"). Observation for the row owner: DEL-25 (MINOR) now greps the *replacement's own vocabulary* — a DEL-17-style RETIRED/INVERTED amendment candidate. Not judged here. |
| DEL-18 | `gradient` | `elements/chart.jsx:38` | **COMMENT-OR-STRING-ONLY** ("instead of one gradient-shaded bar" — describing what the chart does NOT do). PASS. |
| DEL-08 | `display: flex` in Stage/Headline/Caption | `evidence-scenes.jsx:174` — `display: "flex", alignItems: "center", gap: 12` — a scene-internal inline row (accent tick + role label in ImageEvidenceScene, absolute at y=1176) | **LIKELY LEGITIMATE** — this is scene chrome, not the layout system's Stage/Headline/Caption content-zone flex the check targets; flag the row owner (`audit-layout`) to confirm the zone definition. (Other flex hits — motion-graphics.jsx:949/1033, minimal.jsx:86, cinematic-documentary.jsx:142/311/408 — are outside my ownership; reported for completeness only.) |
| DEL-29 | `https://` in compositions | 0 in my owned files | clean |
| DEL-12/15/19/20/24 | boxShadow/radial-gradient, Easing.linear, border:, imageFormat, particle | 0 in my owned files | clean |
| DEL-02/03/09/10/11/14/22/26/27/30 | GridBackground, ColorWipe, chunkVoiceover, space-around, Config.set, generated-entry, moodFrom, three, caption-uppercase, hex-in-config | 0 | clean (no hits of any of these identifiers in my owned files) |

## Amendment / SFR blocks

### AMEND-15-1 — DEL-31 heading vs pattern mismatch: raw-`section.id` kicker survives dormant in `spec/fromBeats.js` (MY file)
- **Finding:** `spec/fromBeats.js` `sectionFor()` (350–355) + `kickerLayer()` (357–365) emit `content: { index: section.index + 1, label: section.id }` — i.e., the kicker slot's text is the **raw section id**. Real authored section ids are machine slugs: `"hook"`, `"section_1"`, `"section_2"`, `"reveal"`, `"close"` (verified in `data/scripts/ch-02/narrowboat-10k-surprise-shorts-script.json`). Via the layout compiler's documented rendering (`renderedTextForContent`, `layout/compile-lint.js:97–108`) that would display "01 hook"-/"02 section_2"-style scaffold text — the exact "raw section id as kicker text" that DEL-31's *heading* bans. The registered *pattern* (components in motion-graphics.jsx) is clean because the render path dropped the kicker entirely; the scaffolding was re-encoded one layer down.
- **Mitigating facts:** (a) `fromBeats.js` currently has **zero consumers** — no import anywhere in the repo (grep for `fromBeats`/`validateShotSpecs` yields only its own header comment and the Stage-9 harness in `data/audit/`); the live render path builds beats through `buildMgPackage` (mg-package.js:559), which never calls it. The violation is latent, not live. (b) `schemas/script.mg.json` sections have only `id` (required: `id`, `voiceover`, `beats`) — **no authored `label` field exists**, so there is no grounded replacement source for the kicker text (P1.5: an ungrounded replacement is not made).
- **Action taken:** **none** (no edit). The registered DEL-31 grep is clean; deleting/changing `kickerLayer` without a verifiable replacement would break the layout layer's `{index, label}` kicker contract (compile-lint.js, audit-layout's file) and cannot be grounded.
- **Proposed amendment (per DEL-17 precedent, register §4.2), for the stage that wires `fromBeats.js` into the render:** give authored sections a human `label` field in `schemas/script.mg.json` and change `kickerLayer` to `label: section.label`, OR extend DEL-31's pattern to ban `section.id` as kicker content in the spec layer. This is explicitly NOT satisfied by this sweep.
- **Shared-file needs if the amendment is actioned later:** `schemas/script.mg.json` (outside my ownership) for the label field; `layout/compile-lint.js` (audit-layout) documenting the kicker content contract. None needed now — **NO SHR filed this stage** (no live violation requiring a shared-file change).

### AMEND-15-2 — register State-column hygiene (no code change)
- ENC-05/ENC-06 State column (lines 272–273) still reads **FAIL** while their exact grep parameters are 0-hit today (verified this session: `pickScene` = 0; `extractStats|extractHeroNumber` = 0; plus `extractFlowLines` = 0). The Stage-9 ledger (`data/audit/9/audit-encoding.ledger.md` lines 26–27) already recorded CHANGED→PASS. Recommendation: the register's State column for ENC-05/ENC-06 should be updated to PASS to stop future lanes re-litigating a resolved state. No grep was skipped to reach this: the greps are the evidence.

## Final VERDICT

**ALL EIGHT OWNED ROWS PASS (DEL-04, DEL-05, DEL-06, DEL-32, DEL-33, DEL-07, DEL-13, DEL-31).** Zero live violations found in the motion-graphics render package for any owned pattern. No edits made; no SHARED-FILE REQUEST filed (nothing outside ownership needs changing for a live violation this stage). One dormant re-encoding of DEL-31's *heading* (raw `section.id` as kicker label in `spec/fromBeats.js`, zero consumers) is recorded as AMEND-15-1 for the stage that wires the spec path; all cross-cutting DEL hits inside my owned files are comments, legitimate reuse, or design features backed by positive checks (detail above).