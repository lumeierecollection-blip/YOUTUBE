# data/audit/9/audit-encoding.ledger.md — Stage 9 gate: remaining archetypes

Gate (CROSSCHECK-PROTOCOL.md line 387): "Remaining 7 archetypes | `audit-encoding`,
`audit-motion` | 16 compositions render as stills; C10–C13, D11–D13 pass".
CHECK-REGISTER §3.5 stage-9 `ENC` rows: ENC-01..07, ENC-16..19.

Method: CROSSCHECK-PROTOCOL Part 2, phases P1.1 → P3.6 (claim card before edit,
delete-then-replace, diff hash, independent counter-check, verdicts).

---

## §0 — Snapshot (taken before any change)

| Item | Value |
|---|---|
| Repo HEAD | `65e90fc90f64abb53e73237ded5984d403c7cd59` |
| Working tree | clean (`git status --porcelain` empty) |
| `spec/fromBeats.js` (mine, pre-change) | sha1 `63d94d31010408035e2132841eeb869789fbea6e` |
| `primitives/Chart.jsx` (mine, pre-change) | sha1 `3764e989fca115d54e60e54127f66e44d41d658f` |
| `data/audit/9/` | did not exist |

### §0.1 — RE-VERIFIED (P1.2) states at snapshot time

| Register row | Register state | Re-verified fact | Verdict |
|---|---|---|---|
| ENC-05 (grep `pickScene` = 0) | FAIL | `pickScene` has **0 code hits** in `src/skills/remotion-render`; routing is the text-based `classifyBeat` (beats.js:662) + `classifyBeats` (beats.js:643) + Rule 4.2 demote (beats.js:665-668 area) | **CHANGED → PASS** (register stale; the legacy FAIL described pre-classifier code removed before HEAD) |
| ENC-06 (grep `extractStats\|extractHeroNumber` = 0) | FAIL | both identifiers have **0 code hits**; numbers come from `beat.data` (chartContentFor passthrough, ENC-24) | **CHANGED → PASS** |
| ENC-07 (no regex-derived headline) | FAIL | no regex headline derivation in `spec/` or `compositions/`; headline content is `scene.headline` / `data.unit` / anchor-token phrase (this stage's claim cards) | **CHANGED → PASS** (final proof is stage-9 gate Run 4) |
| ENC-19 (bRollFiles grep ≥1 hit) | FAIL — 0 | `bRollFiles` IS consumed: beats.js:646 (`classifyBeat` IMAGE_BEAT ctx), mg-package.js:404 (`parseSrtToBeats` opts), render.js:288-309 (`resolveBrollFiles`). The register's "grep in style file" targeted legacy `motion-graphics.jsx`, which never referenced it | **CHANGED → PASS** (consumption happens upstream of the style file; register's grep target was the wrong file) |
| ENC-17 (concepts in config) | N/B | `config/channels.json` has **0 `concepts` keys** (re-confirmed this stage) → the compiler-vs-config check has no config input; C4 side-table + SFR required | **data gap — SFR-ENC-9-3** |
| COL-11 (exactly one accent) | FAIL | see CLAIM-ENC-9-02 — MANUAL F1–F8 assign accents per-archetype; strict "exactly 1 per frame" contradicts F6/F7/F8 (no accent element) | **spec conflict — SFR-ENC-9-1** |
| stage-8 gate Run 2b / Run 7 | PASS (stage-8 evidence) | assertions at frombeats-chart-gate.mjs:341, :346, :431-436 assume a universal 4 px accent rule on every non-chart beat | **superseded by CLAIM-ENC-9-02** (§0.3) |

### §0.2 — DETAIL-REFERENCE C4 side-table (the ENC-17 concepts input, lines 502-534)

| Channel (id) | primary (≥50%) | secondary (≤35%) | excluded (0%) |
|---|---|---|---|
| Legal Brief (2) | CONTRAST, TERM_DEFINE, LIST_ITEM | HERO_NUMBER | — |
| Border Lines (9) | RELATION, CONTRAST | HERO_NUMBER, IMAGE_BEAT | — |
| Quantum Canvas (14) | RELATION, TERM_DEFINE | PROGRESS | — |
| Earth Signal (15) | PROGRESS, HERO_NUMBER | RELATION | — |
| Fraud Files (26) | PROGRESS, HERO_NUMBER, LIST_ITEM | RELATION | — |
| Machine Anatomy (32) | RELATION, LIST_ITEM | TERM_DEFINE | — |
| Build Smart (34) | LIST_ITEM, CONTRAST | HERO_NUMBER | — |
| MedBrief (40) | TERM_DEFINE, PROGRESS | CONTRAST | — |
| Mind & Body Files (41) | CONTRAST, TERM_DEFINE | PROGRESS | — |
| NutriDecode (42) | PROGRESS, CONTRAST | HERO_NUMBER | — |
| Skill Stack (44) | LIST_ITEM, RELATION | TERM_DEFINE | — |
| Factory Floor (48) | RELATION, PROGRESS | LIST_ITEM | — |

C4.1 threshold: primary ≥50%, secondary ≤35%, excluded 0% (DETAIL-REFERENCE C4.1).
Note: Money Mind (id 1, motion-graphics) has **no C4 row** — recorded, not my lane to fix.

### §0.3 — stage-8 gate divergence map (what changes, what stays)

Stage-8 gate `data/audit/8/frombeats-chart-gate.mjs` assertions that my stage-9 edit
is expected to affect (all traced to the accent-rule policy change, CLAIM-ENC-9-02):

| Stage-8 line | Assertion | After stage-9 change |
|---|---|---|
| 341 | downgraded spec layers `== "kicker,rail,caption,headline,accent"` | FAIL — HERO_NUMBER has no rule (F1: numeral is the accent; A2.3: one accent per frame) |
| 346 | downgrade frame `lintAll(...).pass === true` | FAIL on L7 only (0 accents) — expected |
| 431-436 | Run 7: `lintAll` per script × channel | FAIL on L7 only for beats whose archetype has no spec accent (map in CLAIM-ENC-9-02) |

Everything else in the stage-8 gate is expected to stay green (Run 1 chart recipe
unchanged; Run 2 ENC-08..24 throws unchanged; Run 3/4/5 source greps unchanged; Run 6
run-lint unchanged). The stage-8 gate is archived evidence; stage 9 supersedes the
universal-rule provisional geometry. Proven by gate Run 5 (spawned stage-8 gate, failures
must be a subset of the divergence map).

---

## §1 — Claim cards (P1.1 — written before any edit)

### CLAIM-ENC-9-01 — per-archetype headline content

**Claim.** `spec/fromBeats.js` derives the headline layer's `content.text` per archetype,
in this priority order (highest source of truth first):

| Archetype | Headline | Source chain | Manual / evidence |
|---|---|---|---|
| HERO_NUMBER | the unit | `data.unit` → `scene.headline` → `parseNumber(text).unit` → **omit layer** | MANUAL F1 zone "Headline: the unit"; deriveScene (mg-package.js:218 `normalizeUnit`) |
| TERM_DEFINE | the term | `scene.headline` → anchor phrase ≤16 chars | F2 zone "the term"; legacy HeadlineBox = scene.headline |
| CONTRAST | the consequence | `scene.headline` (null today) → anchor phrase after the pivot ≤4 tokens | F4 zone "headline is the consequence"; beats.js `pickAnchorTokenIndex` CONTRAST = first token after the pivot marker |
| RELATION | the relation word, uppercase | `scene.headline` (deriveScene = marker UPPERCASE) → **live relation markers** (mirror of mg-package.js RELATION_MARKERS, 19 entries, list-order-first-match) → anchor phrase | F6 zone "≤4 words"; deriveScene splitRelation (mg-package.js:153-161) |
| IMAGE_BEAT | who/what | `scene.headline` → `data.subjectLabel` → anchor phrase | F7 zone "who or what it is" |
| STATEMENT | subject noun phrase | `scene.headline` → `data.subjectLabel` → anchor phrase | F8 "icon + headline"; deriveScene subjectLabel |
| LIST_ITEM | **no headline layer** | — (no producer exists) | F3 zone "the list's own title, set once at the first item" — `deriveScene`/`groupListRuns` (mg-package.js:279-292) set only `listIndex/listTotal`, never a title → honest option is omit + SFR-ENC-9-4 |
| PROGRESS | takeaway phrase | anchor phrase ≤16 chars (stand-in) | F5 declares no headline zone (MOTION-GRAPHICS-MANUAL.md:1048-1063); stage-8 shipped the stand-in headline in the proven chart recipe (frombeats-chart-gate.mjs:207 `kicker,rail,caption,headline,chart`); keep + SFR-ENC-9-4 |

**Effect on the layer recipe.** Headline layer emitted only when the derivation yields a
non-empty string (LIST_ITEM → 3 layers; everything else → 4). PROGRESS chart path
unchanged (headline + chart).

**RE-ENTRY after verifier REJECT (P3.5) — RELATION row amended 2026-08-07.**
The independent counter-check (§7, verdict 1) REJECTED the original RELATION
source chain: DETAIL-REFERENCE A4 contains no connector-word list, and the provisional
4-item list [BECAUSE, THEN, UNLESS, WHILE] contradicts the live producers
(mg-package.js RELATION_MARKERS is 19 entries; beats.js classifies "THEN" as LIST_ITEM
and "WHILE" as CONTRAST). The RELATION fallback was reverted and re-implemented as a
mirror of the live `splitRelation` semantics (same 19-marker list, same list-order
first-match via `indexOf`, uppercased) — see §2.4. The mirror is pinned by the gate's
source-level sync check (Run 4, §2.4 item 3) so it cannot drift from mg-package.js.
Secondary wording corrections from the same REJECT: PROGRESS's headline is
`sceneOr(beat, headlineFor(beat))` (scene.headline preferred; null in production —
the claim's "anchor phrase (stand-in)" describes the effective path), and the
`headlineFor` caps are ≤16 chars AND ≤4 tokens for every archetype that uses the
fallback (TERM_DEFINE, CONTRAST, PROGRESS included).

**Evidence.** MANUAL F1–F8 zone tables (MOTION-GRAPHICS-MANUAL.md:971-1106);
deriveScene headline assignments (mg-package.js:210-245); `groupListRuns`
(mg-package.js:279-292, no title field); beats.js CONTRAST anchor semantics
(beats.js:633-640); RELATION live markers (mg-package.js:127-132, 153-161).

**State change.** No register row changes (headline content is not ENC-scored); it is the
layer contract that ENC-07 (no regex-derived headline) protects — headline content now
comes from beat data / scene / anchor tokens, never a regex.

---

### CLAIM-ENC-9-02 — accent elements per archetype (COL-11 / L7 conflict)

**Claim.** `spec/fromBeats.js` emits the 4 px accent rule **only for TERM_DEFINE**
(enter `anchor+6`, exit `end−6`) and the chart highlight for PROGRESS; **no** spec accent
layer for the other six archetypes. Accent assignments per MANUAL F:

| Archetype | Accent element | Lane | Manual |
|---|---|---|---|
| HERO_NUMBER | the numeral | peer Stage | F1 "the numeral is the accent element" |
| TERM_DEFINE | **the rule (spec layer)** | spec | F2 "the rule is the accent element for this beat; the icon is stroke, never accent" (MANUAL:1006) |
| LIST_ITEM | the chip numeral badge (6 frames) | peer Stage | F3:1025 |
| CONTRAST | right panel key element | peer Stage | F4:1043 |
| PROGRESS | the highlight bar | spec (chart) | F5:1061 |
| RELATION | none declared | — | F6:1065-1081 |
| IMAGE_BEAT | none declared | — | F7:1083-1096 |
| STATEMENT | none declared | — | F8:1098-1105 |

**Why the universal rule is wrong.** A2.3 (MANUAL:87-90): accent on at most ONE element
per beat; two accents in a frame → the render is REJECTED. A HERO_NUMBER frame with both
the stage numeral (accent, F1) and a spec rule would be rejected at render. The stage-6/8
provisional "rule for every non-chart beat" (fromBeats.js:15-19 pre-change) therefore
cannot survive stage 9.

**COL-11 / L7 conflict (RE-VERIFIED FINDING).** Register COL-11 (CHECK-REGISTER.md:189)
"Exactly one `accent` element per frame" is implemented by lint.js L7
(lint.js:192-206) as exactly 1 per frame counting spec layers only. Under the manual's
per-archetype assignments, spec-level L7 will report: 1 for TERM_DEFINE/PROGRESS, 0 for
the other six (stage accents are not spec layers, and F6/F7/F8 declare none at all).
Both readings cannot hold. The manual's per-archetype content contract is the layer
contract fromBeats implements; the compiler check needs a per-archetype accent map or
"at most one, in the archetype-designated element" wording → **SFR-ENC-9-1** to
audit-layout (lint.js is shared, outside my ownership).

**Gate-runner policy.** My gate runner asserts the manual's per-archetype accent map
directly (Run 1) and reports L7's per-archetype outcomes as expected evidence of the
conflict (Run 3).

**State change.** COL-11 (stage 9, FAIL) — remains open pending SFR-ENC-9-1; my lane
proves the manual side and contains the divergence.

---

### CLAIM-ENC-9-03 — per-archetype headline timing (A4 conflict)

**Claim.** `headlineEnterAt(anchorFrame, dur, delay)` becomes per-archetype:

| Archetype | delay | Source |
|---|---|---|
| HERO_NUMBER | 8 | F1 (headline RISE tA+8) + legacy `HEADLINE_DELAY` (motion-graphics.jsx:48-57) |
| TERM_DEFINE | 0 | F2 "term RISE at tA" + legacy |
| RELATION | 18 | F6 "headline RISE at tA+18" + legacy |
| IMAGE_BEAT | 6 | F7 "headline RISE at tA+6" + legacy |
| STATEMENT | 0 | F8 "headline RISE at tA" + legacy |
| CONTRAST | 0 | legacy (F4 declares no headline event) |
| LIST_ITEM | n/a (no headline) | — |
| PROGRESS | 8 | stage-8 shipped `anchor+8` (proven geometry); F5/A4 declare no PROGRESS headline event — retained, not contradicted |

Guard unchanged: `anchorFrame + delay ≤ dur − 6` else `end−6` (fromBeats.js:56-61
pre-change semantics).

**A4 conflict (RE-VERIFIED FINDING).** DETAIL-REFERENCE A4 HERO_NUMBER row
(DETAIL-REFERENCE.md:210-216) says "unit label RISE tA+2" and "headline RISE tA+58
(drag 12 from settle)" — two headline-era events. F1's zone table has ONE headline (the
unit) and legacy renders exactly one at tA+8 (`HEADLINE_DELAY.HERO_NUMBER = 8`,
motion-graphics.jsx:49; legacy comment "headline RISE at tA+8"). The manual + live
source agree with each other and disagree with A4 → follow F1/legacy, **SFR-ENC-9-2**
for the A4 row (same pattern as stage-8's SFR-motion-5 for the PROGRESS gridlines).

**Evidence.** MANUAL F1/F2/F6/F7/F8 tables; motion-graphics.jsx:48-57; A4 table
(DETAIL-REFERENCE.md:202-295).

---

### CLAIM-ENC-9-04 — ENC-01..07 / ENC-16..19 gate arming

**Claim.** `fromBeats` arms the stage-9 honesty gates. In-module throws (each names the
beat id + ENC code, R4 "data error = build error"):

| Gate | Rule | Throw scope | Register |
|---|---|---|---|
| ENC-01 | STATEMENT ≤30% of beats | array-level, after mapping | BLOCKER, FAIL ~100% |
| ENC-02 | no archetype repeats >2× consecutively | array-level | MAJOR, N/B |
| ENC-03 | exactly one `anchorTokenIndex`, in range of `wordTokens` | per beat | BLOCKER, N/B |
| ENC-04 | stage entrance `tA = anchorFrame − startFrame` ∈ [0, dur] (the [tA−4, tA+2] window must resolve inside the beat) | per beat | MAJOR, N/B |
| ENC-16 | ≤4 Stage-slot layers per frame (recipes emit 0 or 1) | per spec | MINOR, N/B |
| ENC-18 | IMAGE_BEAT ≤20% of beats | array-level | MINOR, N/B |

ENC-05/06/07: RE-VERIFIED PASS by source grep (§0.1) + gate Run 4. ENC-17: needs the
channel's `concepts` — absent from `config/channels.json` → the C4 side-table (§0.2)
becomes the gate-runner input, with **SFR-ENC-9-3** for the config. ENC-19:
RE-VERIFIED PASS (consumers at beats.js:646, mg-package.js:404, render.js:288-309),
proven by gate Run 4 grep.

**Deliberate non-gate.** C3.1 (headline shares ≤2 content words with the caption) is a
MANUAL Part C rule enforced in production by `gateMgHeadlineOverlap` (mg-package.js:471-482)
over `scene.headline` — which is null for CONTRAST/LIST_ITEM/PROGRESS today, so the
anchor-phrase stand-ins are NOT overlap-checked in production either. Making it a
fromBeats THROW now would reject real scripts whose consequence producer does not exist
yet → reported in gate Run 1 + SFR-ENC-9-4 instead. (No register ENC row owns C3.1 at
stage 9.)

**Evidence.** Register rows CHECK-REGISTER.md:232-238, :247-250; annotateBeats always
sets `anchorTokenIndex` (beats.js:419-440); buildMgPackage caps IMAGE_BEAT
(mg-package.js:428-432); mg-package downgrades (mg-package.js:417-425).

---

### CLAIM-ENC-9-05 — stage-8 gate divergence is contained and intentional

**Claim.** After the stage-9 edit, `node data/audit/8/frombeats-chart-gate.mjs` will fail
only on the assertions in §0.3's divergence map (accent-rule policy change), and
everything else — ENC-08..24 throw gates, chart recipe, Chart.jsx/fromBeats source
greps, run-lint — stays green. Proven by gate Run 5 (spawn + failure-subset check).

---

## §2 — Changes (Phase 2)

### §2.1 `src/skills/remotion-render/spec/fromBeats.js` (MY file — edit recorded 2026-08-07)

Applied after CLAIM-ENC-9-01..05 were written (§1). Diff: +218 / −39, one file
(`git diff --numstat`). No other file edited. Summary of the edit:

1. **Headline content per archetype** (CLAIM-ENC-9-01): new `headlineTextFor(beat)`
   with `heroNumberHeadline` (data.unit → scene.headline → `parseNumber(text).unit`),
   `relationHeadline` (scene.headline → A4 fixed list → anchor phrase), `subjectHeadline`
   (scene.headline → data.subjectLabel → anchor phrase), `sceneOr` helper; LIST_ITEM
   returns "" → no headline layer (SFR-ENC-9-4). `headlineFor` gains a 4-token cap.
2. **Accent policy** (CLAIM-ENC-9-02): `accentLayer` is emitted ONLY for TERM_DEFINE
   (enter `anchor+6`, F2); PROGRESS keeps the chart highlight; all other archetypes
   carry no spec accent layer (peer-lane Stage accents / none per F6/F7/F8).
3. **Per-archetype timing** (CLAIM-ENC-9-03): `HEADLINE_DELAY` map
   {HERO_NUMBER:8, TERM_DEFINE:0, RELATION:18, STATEMENT:0, IMAGE_BEAT:6, CONTRAST:0,
   LIST_ITEM:0, PROGRESS:8}; `headlineEnterAt(anchorFrame, dur, delay=8)`.
4. **Stage-9 gates** (CLAIM-ENC-9-04): `assertAnchor` (ENC-03/04) per beat,
   `assertStageLayerCount` (ENC-16) per spec, `assertArchetypeMix` (ENC-01/02/18)
   over the beats array in `fromBeats`. Stage-8 chart gates (ENC-08..24) untouched.
5. Docblock rewritten to record the new contract + SFR references.

### §2.2 Not changed (deliberate)

- `primitives/Chart.jsx` — unchanged (chart contract untouched; sha1 still
  `3764e989fca115d54e60e54127f66e44d41d658f`).
- No shared file was edited; all cross-lane needs are SFRs in §5.

### §2.3 Amendments during gate-run fixes (2026-08-07, same session)

All changes below implement or harden claims already in §1 — no new claim, no
scope creep beyond the per-archetype contract.

1. **`heroNumberHeadline` null guard (completes CLAIM-ENC-9-01).**
   `parseNumber(text)` returns `null` for classifier-marked HERO_NUMBER
   captions whose number is a hyphenated compound ("and thirty-five species
   found" — beats.js classifyBeat matches `five` at beats.js:670;
   parseNumber's word parser (mg-package.js:91-116) does not handle
   "thirty-five", returns null). Pre-fix `normalizeUnit(parseNumber(...).unit)`
   threw TypeError on real scripts (gate Run 3/4). Post-fix: null → `""` →
   headline layer omitted — the documented "Empty → omit" branch of
   CLAIM-ENC-9-01 (never a crash, never an invented unit). The VALUE side
   (deriveScene gives such beats value 0) is a mg-package.js parser gap →
   **SFR-ENC-9-6**.
2. **Gate-runner corrections (`data/audit/9/frombeats-archetype-gate.mjs`)** —
   all were bugs in MY harness, not in fromBeats:
   - Run 1 per-archetype loop called `fromBeats([beat])` per fixture; a lone
     IMAGE_BEAT/STATEMENT beat correctly tripped ENC-18/ENC-01 (1/1 = 100%).
     Now: one 8-beat mix (`mixSpecs`) + per-spec assertions.
   - ENC-01 probe array was 2/10 STATEMENT (20%) — below the >30% threshold,
     would never fire. Now 4/10 (40%), no consecutive runs (ENC-02 can't
     pre-empt).
   - ENC-16 structural check re-called `fromBeats([b])` per beat (same
     lone-beat crash); now reads `mixSpecs` layer slots directly.
   - IMAGE_BEAT fixture headline "THE ALAMEDA COURT" (17 chars) wrapped to 2
     lines → the compile's §3.7/§5.3 one-line rule rejected it. Fixture now
     "ALAMEDA COURT" (13 chars) — see finding F-2.
   - HEADLINE_DELAY check (CLAIM-ENC-9-03) asserted full-map equality with
     legacy; the documented PROGRESS divergence (8 here vs 0 legacy — stage-8
     anchor+8 retained) is intentional. Check is now per-key: any OTHER key
     drift still fails loudly; PROGRESS pinned to 8/0.
   - Run 5 stage-8 containment: "downgraded spec compiles and passes lintAll"
     is a §0.3 accent-policy divergence — added to the allowed list.
   - ENC-17 config check was a naive `includes("concepts")` substring grep,
     false-positive on channel descriptions ("programming concepts in 100
     seconds"); now a key-level scan for the `concepts` JSON key — the actual
     ENC-17 claim per §0.1.
3. Final gate run: **118 passed, 0 failed** (frombeats-archetype-gate.mjs,
   2026-08-07).

### §2.4 RELATION fallback re-implementation (P3.5 RE-ENTRY, 2026-08-07)

Verifier verdict 1 (REJECT) on CLAIM-ENC-9-01: the provisional RELATION fallback
list [BECAUSE, THEN, UNLESS, WHILE] contradicted the live producers. Reverted the
4-item list + uppercase-`includes` matcher and replaced with a mirror of
deriveScene's `splitRelation`: the same 19-marker RELATION_MARKERS
(mg-package.js:127-132), the same list-order-first-match semantics (`indexOf` on
the lowercased text), returned uppercased — matching deriveScene's
`scene.headline` output exactly (mg-package.js:234-241). Gate Run 4 now holds a
source-level sync check (fromBeats mirror vs mg-package list, verbatim + order)
so the mirror cannot drift; SFR-ENC-9-6 references it. Gate: **119 passed, 0
failed**. Re-dispatched to verify-independent (re-attempt 1 of 2, P3.5).

## §3 — P2.5 diff hash

| File | Pre-change sha1 | Post-change sha1 |
|---|---|---|
| `spec/fromBeats.js` | `63d94d31010408035e2132841eeb869789fbea6e` (raw, pre-edit) / git blob `08275a8a20c6f66b05aac390538de724dde98006` (HEAD) | raw sha1 `5A27A97A8C56108922D5E2D2119B18E15D08C374` / git blob `a92886da23df3e7f1daf60faa540342912ad3385` (after §2.3 guard) |
| `primitives/Chart.jsx` | `3764e989fca115d54e60e54127f66e44d41d658f` (git blob, HEAD) | unchanged |

`git diff --stat` (run 2026-08-07): `src/skills/remotion-render/spec/fromBeats.js | 257
+++++++++++++++++++++++---- 1 file changed, 218 insertions(+), 39 deletions(-)`.
Working tree otherwise clean. `node --check` passes on the edited file.

## §5 — Shared-file requests (SFRs)

- **SFR-ENC-9-1** (→ audit-layout, lint.js shared): register COL-11 / L7 "exactly one
  accent per frame" is archetype-blind while MANUAL F1–F8 assign accents per archetype
  (F6/F7/F8: none). Proposed fix: per-archetype accent map in L7 or wording "at most one,
  in the archetype-designated element". Evidence: CLAIM-ENC-9-02.
- **SFR-ENC-9-2** (→ DETAIL-REFERENCE owner): A4 HERO_NUMBER row "unit label RISE tA+2" +
  "headline RISE tA+58" contradicts F1's single headline (the unit) at tA+8 (live source
  + legacy HEADLINE_DELAY). Evidence: CLAIM-ENC-9-03.
- **SFR-ENC-9-3** (→ config owner): `config/channels.json` has no `concepts`; ENC-17 has
  no config input. Stage-9 gate uses the C4 side-table (§0.2) as stand-in. Evidence:
  §0.1 ENC-17 row.
- **SFR-ENC-9-4** (→ audit-motion / mg-package owner, shared): headline producers are
  missing for LIST_ITEM (list title), CONTRAST (consequence), PROGRESS (takeaway);
  `deriveScene` sets headline null for all three (mg-package.js:210-245). Until a
  producer exists: LIST_ITEM renders without a headline (manual-faithful omit), CONTRAST
  and PROGRESS use the anchor-phrase stand-in (not overlap-gated — see CLAIM-ENC-9-04).
- **SFR-ENC-9-6** (→ mg-package.js owner): `parseNumber` (mg-package.js:84-117) returns
  null for hyphenated word-numeral compounds ("thirty-five species"), while beats.js
  classifyBeat (beats.js:670) marks them HERO_NUMBER → deriveScene gives value 0
  (mg-package.js:216). Proposed fix: add a bounded TENS map (twenty..ninety) and split
  words on `[\s-]+` so "thirty-five" → 35. fromBeats already tolerates the null
  (headline omitted, §2.3 item 1); the value side still needs the parser. Evidence:
  gate Run 3/4 pre-fix crash, probe-verified on movile-cave-script beat 5.

## §6 — Findings (RE-VERIFIED during gate fixes)

- **F-1 — parseNumber < classifier word list (data-honesty gap).** A caption the
  classifier calls HERO_NUMBER ("and thirty-five species found") yields no numeric
  value from parseNumber; production would render a 0 counter with no headline unless
  SFR-ENC-9-6 lands. fromBeats now never crashes on it and never prints an invented
  unit. Severity: data-honesty, one beat in the three real scripts scanned.
- **F-2 — headline one-line rule is compile-truth, 16-char is the fail-fast proxy.**
  compile.js:160-165 rejects any headline taller than the slot's content box
  (slot.h − 48) — i.e. exactly 1 line at ≥84px (ROLE_FLOORS.headline). At the
  ~0.6×84 ≈ 50.4px/char estimate a 16-char headline ≈ 806px already exceeds the 800px
  slot; the 16-char stand-in (data/audit/6/build-shots.mjs:127-140) stays as the
  fromBeats fail-fast proxy, and the compile remains the final gate. Authors of
  scene.headline / subjectLabel should keep labels ≤1 line at 84px.
- **F-3 — HEADLINE_DELAY PROGRESS divergence re-confirmed.** legacy map
  (motion-graphics.jsx:56) PROGRESS: 0 vs fromBeats 8 (stage-8 anchor+8 retained,
  CLAIM-ENC-9-03 row). The stage-9 gate now encodes this as the ONE allowed drift.

## §7 — Verifier verdicts (P3.1 → P3.6 — filled after dispatch)

Dispatch 2026-08-07: five verify-independent sessions, one per claim in §1, each
given only the ASSERTION + `git diff src/skills/remotion-render/spec/fromBeats.js`
(P3.1 — no sources passed).

| Claim | Verdict | Verifier's independent sources | Notes |
|---|---|---|---|
| CLAIM-ENC-9-01 (headline content) | **REJECT** → re-entered Phase 1 (§1 RE-ENTRY + §2.4) | mg-package.js RELATION_MARKERS (19 entries, lines 127-132); beats.js classifyBeat (beats.js:674, 681 — THEN=LIST_ITEM, WHILE=CONTRAST); DETAIL-REFERENCE §A4 (no connector list exists) | The claimed fixed list was false vs the live producers; ALL other rows verified (HERO_NUMBER chain incl. the parseNumber-null guard, TERM_DEFINE, CONTRAST pivot-anchor, IMAGE_BEAT/STATEMENT subjectLabel, LIST_ITEM omit, PROGRESS stand-in; schema/compile accept an omitted headline). Secondary wording: PROGRESS prefers scene.headline (null in production); headlineFor caps ≤16 chars AND ≤4 tokens. Re-implemented as a live mirror — re-dispatched (re-attempt 1 of 2). |
| CLAIM-ENC-9-01 RELATION sub-claim (re-attempt 1) | **CONFIRM** | mg-package.js splitAtMarker/splitRelation/deriveScene (134-161, 234-241) read directly; fromBeats mirror diffed line-for-line; gate Run 4 sync check (484-498) | 19 markers identical + same order; same lowercase-indexOf list-order-first-match semantics; same uppercased output; edge cases probed (marker twice, substring "likely", cross-marker ordering "exactly like"/"like", "running on"/"run on") — no input produces a different matched marker. No-match fallback to anchor phrase is the documented path and is unreachable in production (deriveScene always sets scene.headline). |
| CLAIM-ENC-9-02 (accent policy) | CONFIRM | MANUAL F1–F8 zone tables (MOTION-GRAPHICS-MANUAL.md:971-1106); layout/lint.js L7 (192-206) + compile.js accent resolution (288-322) | rule layer only for TERM_DEFINE (anchor+6, end−6); chart highlight for PROGRESS; none for the other six; no other accent emitter in the package. |
| CLAIM-ENC-9-03 (headline timing) | CONFIRM | MANUAL F1/F2/F6/F7/F8 rise values (984/1002/1078/1096/1101); legacy HEADLINE_DELAY (motion-graphics.jsx:48-57) | all map values + guard verified; PROGRESS 8 vs legacy 0 flagged by the verifier and accepted as the one documented divergence (F5 declares no PROGRESS headline event; stage-8 anchor+8 retained). A4's tA+58/tA+14 conflict noted, not falsifying (implementation follows manual+legacy pair). |
| CLAIM-ENC-9-04 (ENC gates) | CONFIRM | CHECK-REGISTER.md §3.5 ENC rows (232-238, 247-250); beats.js producers (MAX_STATEMENT_RATIO=0.3 at beats.js:43, annotateBeats anchor at 367-437); mg-package.js IMAGE_BEAT cap (427-432) | thresholds >0.3 / >2× / in-range / [0,dur] / ≤1 stage layer / >0.2 all verified; throws name ENC code + beat/spec id; mix gate runs AFTER per-beat mapping. |
| CLAIM-ENC-9-05 (stage-8 containment) | CONFIRM | stage-8 gate source (52 assertions enumerated); layout/run-lint.js (no fromBeats dependency); archived stage8-gate-output.txt (47 ok / 5 fail) | exactly 5 failures — all accent-policy + ENC-01 family; every green category traced to code the diff does not touch. |

P3.6 note: the claim domain is repo-internal consistency, so the "independent
sources" are independent producer files (mg-package.js, beats.js, lint.js,
CHECK-REGISTER.md, the manual) — genuinely separate from fromBeats.js and from
each other. Verdict 1's REJECT is the strongest signal (three mutually
independent files contradicting the claim); verdicts 2-5 corroborate from
independent files.
