# Stage 15 — Delete-list sweep — audit-layout lane ledger

- **Lane:** audit-layout (layout, slots, safe zones, compiler, alignment)
- **Stage:** 15 (protocol row 15: "Delete-list sweep — LAYOUT-SYSTEM D1–D14 and FINISH-SPEC R01–R30 all grep-clean")
- **Date:** 2026-08-30
- **Scope:** register DEL table (CHECK-REGISTER §3.4, lines 1475–1509; FINISH-SPEC.md absent — DEL table IS the gate list). Owned rows: **DEL-01, DEL-08, DEL-10, DEL-14** (DEL-14 co-owned with audit-render; geometry parts mine).
- **Method:** every grep below run fresh by this lane against the working tree at HEAD `7282e8c`; no register State column read as evidence; no prior audit's grep trusted.
- **Owned dirs:** `layout/**`, `spec/**`, `compositions/layout-constants.js`, `data/audit/**`. All DEL sweeps of owned dirs: **0 hits** (see co-reports).
- **Edits made:** none. Every outcome requiring a change lands in a shared file (register/compositions) → SFRs below. No owned-file edit needed, so the three-phase research→edit→counter-check protocol was not triggered.

## 1. Per-row verdict table

| Row | Pattern | Hits (file:line) | Classification | Verdict |
|---|---|---|---|---|
| DEL-01 | `Math.min(width, height) / 1080` | 1 — `compositions/mg-style.js:155` (body of `scaleUnit()`, def at :154; doc at :153) | DESIGN FEATURE (LAY-20 + MANUAL A3.2); function currently dead export (0 call sites repo-wide) | **AMEND** — RETIRE/INVERT per DEL-17 precedent |
| DEL-08 | `display: ["']flex` in Stage/Headline/Caption | 7 — see §3 | 3 LIVE VIOLATION, 2 DEAD CODE, 1 LEGAL (leaf-internal), 1 near-miss→VIOLATION | **FAIL** — live sibling flex exists; deletions needed in shared files |
| DEL-10 | `space-around` | 0 in package; 4 repo-wide, all docs/history | — (docs: LAYOUT-SYSTEM.md:70 already records the deletion) | **PASS** |
| DEL-14 | generated entry path | `qa-sample.js:54` (`qa-entry.jsx`), + 15 `data/audit/*/_*-entry.jsx` harness shims | LEGITIMATE REUSE *of the form* (QA harness; production inputProps workaround is gone) — but a literal match of the row's written pattern. Co-owner audit-render rules FAIL (live match, CI-wired). | **FAIL** (co-signed with audit-render, primary owner) — see co-report; geometry parts clean |

## 2. DEL-01 — the no-op scale factor (MAJOR) → **AMEND**

**Hit (only one in the entire repo, run myself):**
- `compositions/mg-style.js:153-156`:
  ```js
  /** A3.2 — scale factor for a canvas: u = min(w, h) / 1080. */
  export function scaleUnit(width, height) {
    return Math.min(width, height) / 1080;
  }
  ```

**Classification: DESIGN FEATURE, not the deleted defect.**
1. The deleted thing (LAYOUT-SYSTEM Part 0.1, "The scaler — CLEARED") was the *live-but-inert* `u = min(w,h)/1080` scaler in the old `motion-graphics.jsx`, replaced by the real canvas fit `S = Math.min(height / 1920, width / 1080)` at `motion-graphics.jsx:294` inside the fixed 1080×1920 DesignSpace. The defect form (a scaler that ran and scaled nothing) is gone.
2. The surviving pattern hit is the register's own positive-pair: **LAY-20** ("Scale factor `u` is not a no-op" — 1 hit @ mg-style.js, **PASS**).
3. The same convention is normative text: **MANUAL A3.2** (`MOTION-GRAPHICS-MANUAL.md:153`: "All values multiply by `u = Math.min(width, height) / 1080`") and `beats.js:31` ("Minimum type sizes — §3.1, scaled by u = min(w,h)/1080").
4. DEL-01 ↔ LAY-20 is exactly §4.1's DEL/pair structure; deleting LAY-20's blessed function to make DEL-01 pass would invert that pair. DEL-17 is the precedent.

**Honest caveat (must be in the register note):** the *function* `scaleUnit` has **zero call sites** — not imported by `motion-graphics.jsx:23`, `mg-package.js:25`, or `verify-compositions.js:11` (the only mg-style importers), nor anywhere else in the repo. LAY-20's "applied" wording is stale: the *convention* is applied structurally (the DesignSpace makes u = 1 by construction for both formats), the *function* is not wired. A dead export cannot be a no-op *in a render* (it never executes), so it is not the DEL-01 defect; but it is dead code — recommend a separate cleanup row, not a DEL-01 deletion.

**Proposed amended register row (§3.4, DEL-17 format):**
```
| DEL-01 | ~~The no-op scale factor~~ **RETIRED, INVERTED 2026-08-30** | ~~`Math.min(width, height) / 1080`~~ | ~~MAJOR~~ |
```
**Proposed register note (§4.2-style, next free §4.x):** DEL-01 is retired/inverted: its pattern's only live hit is `scaleUnit()` at `compositions/mg-style.js:155`, the LAY-20 u-scaler (MANUAL A3.2), not the deleted no-op (Part 0.1's dead scaler is structurally replaced by the DesignSpace S-fit, `motion-graphics.jsx:294`). LAY-20's "applied" wording is stale — `scaleUnit` has 0 call sites repo-wide; the convention is carried by the fixed 1080×1920 design space (u=1 both formats). The dead export should be either wired into MG_TYPE scaling or removed under a hygiene notice; neither is a DEL-01 deletion. Stage-15 audit-layout ledger, 2026-08-30.

## 3. DEL-08 — sibling flex in Stage/Headline/Caption (BLOCKER) → **FAIL**

Pair: **LAY-11** (register state FAIL — consistent with this finding; method `grep -rn "display: *[\"']flex"`). Discriminator used (LAYOUT-SYSTEM §4.1 R1): **no `display: flex` at Stage/Headline/Caption layer level; flex permitted only inside a single leaf primitive, never between siblings whose relative position matters** (MANUAL A5.1 carve-out, re-affirmed by the dispatch).

All `display: "flex"` hits in `src/skills/remotion-render/` (7 — I ran the full-package grep; also swept `inline-flex`, `flexWrap`, template-literal `flex` = 0; all `flexDirection`/`justifyContent` hits pair with the listed `display:flex`):

| # | Hit | Zone | Live? | Class | Rationale |
|---|---|---|---|---|---|
| 1 | `compositions/scenes/evidence-scenes.jsx:174` — ImageEvidenceScene role strip (accent tick 28×3 + `Label`), `left:48, top:1176` | Caption band (CAPTION zoneTop 1152 / zoneBottom 1248, beats.js:55-56; `top:1176` sits inside) | YES (scene exported from `scenes/evidence-scenes.jsx:125`, mounted via `scenes/index.jsx` → `motion-graphics.jsx:25,1111`) | **LIVE VIOLATION** | Flex arranges two siblings (rule + text) whose relative position matters (gap 12, centred) — the exact anatomy of the banned caption form, in the caption band. Not a leaf primitive: no containing leaf; the flex container *is* the strip. The file's own doc calls it "a small caption" (evidence-scenes.jsx:24-27). House idiom for rule+text readouts in the same scene stack is `borderLeft` inline on the text block (DocumentEvidenceScene clause, :110-115) — no flex. Stage-7 chip precedent (icon+text inside one bordered Panel = leaf) does not apply: there is no bordered Panel here. |
| 2 | `compositions/motion-graphics.jsx:949` — `Centered` helper (`translate:-50% -50%`, flex centre) | Stage-zone helper | NO — 0 call sites (grep `<Centered`/`Centered(` = def only) | DEAD CODE | Cannot reach a render. Not a row failure. Delete-with-unused or leave for hygiene; note only. |
| 3 | `compositions/motion-graphics.jsx:1033` — ListRunScene chip (index `+` + item text, gap 20, padding 24) | Stage zone (chips stacked at computed `bottom = 940 − k·88`, motion-graphics.jsx:1014-1018 — positions are computed, not flex-driven) | YES (ListRunScene at :971, mounted at :1129) | **LEGAL — leaf-internal** | The chip is a bordered leaf (Panel per rebuild comment :963-964); flex lays out content *inside* one chip = R1's permitted case; stage-7 audit-layout ledger (line 359) classified this exact chip anatomy leaf-internal. Part 0.12's "emergent" bullet (LAYOUT-SYSTEM.md:167-168) is stale — line refs (mg.jsx:1045-1088) predate HEAD's 1033 and the rebuild. |
| 4 | `compositions/minimal.jsx:86` — MinimalSections content column (`flexDirection: column, justifyContent: center, alignItems: center, padding: 40`) | minimal content (headline/body) region | YES (MinimalShorts/Longform :117/:128, both exported + registered in Root.jsx:15) | **LIVE VIOLATION** | Flex-column stacking of sibling content lines (AnimatedCaption), centred — the D1-banned "flex between siblings whose relative position matters". File explicitly named in LAYOUT-SYSTEM D1 (D1 row: `motion-graphics.jsx (CaptionLayer, HeadlineBox, ListRunScene), minimal.jsx, cinematic-documentary.jsx`). Also inside DEL-13's full-deletion target `MinimalSections` — dies with that sweep if DEL-13 lands; exists at HEAD as of this sweep. |
| 5 | `compositions/cinematic-documentary.jsx:142` — `DataOverlay` (value + label, flex column) | n/a | NO — 0 call sites | DEAD CODE | Cannot reach a render. Note only. |
| 6 | `compositions/cinematic-documentary.jsx:311` — Longform section content area (`AbsoluteFill`, flex column, centre, padding 80) | headline/body content | YES (CinematicDocumentaryLongform :261 → SectionBackground :284 → :311; exported, Root.jsx:14) | **LIVE VIOLATION** | Same flex-column sibling stacking of content lines (AnimatedText). D1-named file. Matches Part 0.12's own flag ("flex-column centering… cd.jsx:359-367" — stale line ref, same defect, HEAD :311). |
| 7 | `compositions/cinematic-documentary.jsx:408` — Shorts section content area | headline/body content | YES (shorts composition chain) | **LIVE VIOLATION** | Same as #6 at the Shorts path. |

**Scope note for the register (ambiguity, must be decided by register keeper):** register Part 6 lists "`minimal` and `cinematic-documentary` styles — this register is motion-graphics only" as *deliberately not checked*. But LAYOUT-SYSTEM D1 (the source row this DEL encodes, mapped via §0.2) *names* `minimal.jsx` and `cinematic-documentary.jsx` explicitly, stage-7 G5 classed "Legacy `compositions/*.jsx` flex is delete-list D1", and the DEL table itself reaches minimal via DEL-13 (`MinimalSections`). **DEL-08 as written therefore FAILs on these hits.** If the Part-6 carve-out is intended to govern, DEL-08's row needs an explicit file-scope amendment; until then the grep evidence stands.

**Verdict: FAIL.** Live sibling flex in Stage/Headline/Caption exists at `evidence-scenes.jsx:174`, `minimal.jsx:86`, `cinematic-documentary.jsx:311`, `:408`. All in `compositions/**` (shared, outside my edit ownership) → SFRs below.

## 4. DEL-10 — `space-around` (MAJOR) → **PASS**

- Package `src/skills/remotion-render/`: **0 hits** (grep `space-around` across the whole package).
- Repo-wide: 4 hits, all documentation/history, none a code path: `LAYOUT-SYSTEM.md:70` ("`space-around` is gone from `motion-graphics.jsx`" — the deletion record), `DETAIL-REFERENCE.md:462`, `CHECK-REGISTER.md:1488` (the row itself), `data/audit/15/audit-audio.ledger.md:47` (another lane's clean row).
- Consistent with audit-audio's DEL-10 CLEAN; independently re-grepped here.

## 5. DEL-14 — `inputProps` entry-file workaround (MAJOR) → **FAIL** (co-signed; primary owner audit-render)

**What I verified independently:**
- Production path is clean: `render.js:272,281` passes `inputProps` to `selectComposition()`/`renderMedia()`; `verify-compositions.js:137,145` same. `writeRenderEntry()`, `render-entry.jsx`, `verify-entry.jsx`: **0 hits**. LAYOUT-SYSTEM.md:155-162 (D6 CLEARED) corroborated by my greps.
- The row's written pattern ("an entry file auto-generated from a template / `_*-entry.jsx` shim / 'generated entry' mechanism") DOES match one live mechanism: **`qa-sample.js:54-88`** — writes `qa-entry.jsx` from a template string and bundles it; reaches the component via `defaultProps` (not `inputProps`); CI-live via `.github/workflows/visual-qa-loop.yml` (audit-render's finding). Co-owner audit-render rules this a live match → **FAIL + SFR-DEL14-1**.
- Also matching the letter of the pattern but outside the render package: 15 harness shims under `data/audit/*/_*-entry.jsx` (stages 2–17 probes; stage-8 gate advertises "_progress-entry.jsx (runtime-generated)" as a deliverable). These are audit instrumentation, not the production workaround.

**Geometry parts (my co-ownership slice):** clean. No entry mechanism participates in any geometry/scaling/deletion row; the generated entries carry no layout code. Nothing to add to audit-render's SFR.

**My recommendation (aligned with audit-render option B, DEL-17-style):** AMEND the register row to scope the pattern to the *production SSR render path* (`render.js`/real `Root.jsx`) and carve the QA/harness samplers (`qa-sample.js`, `data/audit/**/_*-entry.jsx`) out as documented exceptions — or accept audit-render's option A refactor of `qa-sample.js` to inputProps + a static entry. Either resolution is the orchestrator's/register keeper's call; the row cannot honestly read PASS as-written.

## 6. Cross-cutting co-reports (other DEL patterns inside MY owned dirs)

All independently grepped this stage, not read from the register:

- `src/skills/remotion-render/layout/**: **0 hits** for `flex`, `gradient`, `border:`, `space-around`, `parallax`, `particle`, `Math.random`, `skew`/`rotate(`, `https://` (sweep of DEL-08/10/12/18/19/23/24/25/26/29 patterns in owned dir).
- `src/skills/remotion-render/spec/**: **0 hits** for `flex`, `Math.min(width, height) / 1080`, `space-around`, generated-entry.
- `compositions/layout-constants.js`: **0 hits** for the DEL-01/08/10/12/18/19/21/23/24/25/29 pattern set. (Two `Math.min` uses at :82/:92 are page cover-fit geometry, not the DEL-01 form.)
- Related observation (geometry domain): `motion-graphics.jsx:294` `Math.min(height / 1920, width / 1080)` is the real canvas S-fit and must NOT be caught by any DEL-01 amendment; `abstract-scenes.jsx:278` `Math.min(1.1, f.w / 1080)` is a capped per-scene phrase fit, also a different expression.
- Co-report to audit-render (DEL-14 primary): geometry side of DEL-14 confirmed clean; evidence re-derived independently (qa-sample.js:54/82), matching their FAIL row and SFR-DEL14-1.

## 7. SHARED-FILE REQUESTS (verbatim; none apply to an owned file)

### SFR-LAY15-1 — DEL-08: `compositions/scenes/evidence-scenes.jsx:174` (owner: scene/visual lane; shared `compositions/**`)

**Reason:** DEL-08 FAIL — live sibling flex in the Caption band; row is BLOCKER.

Before (L171-179):
```jsx
      {pRole > 0 && role ? (
        <div style={{
          position: "absolute", left: 48, top: 1176, opacity: ease(pRole),
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 28, height: 3, background: colors.accent }} />
          <Label x={0} y={-13} text={role} color={colors.accent} size={24} tracking={3} fontFamily={fontFamily} />
        </div>
      ) : null}
```
After (proposal — absolute only, house-idiom; owner to verify ±1-2 px on a real frame):
```jsx
      {pRole > 0 && role ? (
        <div style={{ position: "absolute", left: 48, top: 1176, opacity: ease(pRole) }}>
          <div style={{ position: "absolute", left: 0, top: 2, width: 28, height: 3, background: colors.accent }} />
          <Label x={40} y={-13} text={role} color={colors.accent} size={24} tracking={3} fontFamily={fontFamily} />
        </div>
      ) : null}
```
(Equivalent geometry: tick at x=48..76, label text centred on the strip's vertical middle via the existing y=-13, gap 12 preserved by label x=40.)

### SFR-LAY15-2 — DEL-08: `compositions/minimal.jsx:86-104` (owner: minimal-style lane / DEL-13 lane; shared `compositions/**`)

**Reason:** DEL-08 FAIL — live sibling flex (flex-column centred content) in a D1-named file; also the DEL-13 full-deletion target `MinimalSections`.

Before: the `AbsoluteFill` at :84-92 with `display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 40` stacking `{lines.map(AnimatedCaption …)}` (:93-103).
After: rebuild the minimal content column on the slot model (LAYOUT-SYSTEM Part 2-8; the register's own plan for minimal: D5/D7 + content zones) — or, if DEL-13 sweeps `MinimalSections` in full, this flex dies with it; then no separate action. Deletion/replacement is outside my ownership; exact before→after geometry must be authored by the style lane on the slot table.

### SFR-LAY15-3 — DEL-08: `compositions/cinematic-documentary.jsx:308-329` (Longform) and `:406-429` (Shorts) (owner: cinematic-style lane; shared `compositions/**`)

**Reason:** DEL-08 FAIL — live sibling flex in a D1-named file, both format paths.

Before (both sites): the `AbsoluteFill` at :309-316 / :406-413 with `display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 80/40` stacking `{section.content?.map(AnimatedText …)}`.
After: absolute-positioned content blocks inside the section (baseline-align the first line, stack subsequent lines at fixed offsets, or place on `layout/slots.js` zones if/when the cinematic style gains a slot table — Part 0.2 already flags this file as zone-unaware). Exact geometry is the style lane's call; this lane only requires the `display: flex` be gone.

### SFR-LAY15-4 — DEL-01 + DEL-14 register amendments (owner: register keeper / orchestrator; `CHECK-REGISTER.md` read-only for audit lanes)

**Reason:** DEL-01 is a DEL-17-style RETIRED/INVERTED amendment (proposed row + note text in §2 of this ledger; the note must include the stale-"applied" caveat). DEL-14 row needs the production-path scoping amendment + QA carve-out (or orchestrator option A per audit-render's SFR-DEL14-1) — see §5. Register is read-only for audit lanes; either change is applied by the register keeper, not by me.

## 8. Final VERDICT

- **DEL-01: AMEND** — pattern's only hit is the LAY-20/A3.2 u-scaler (dead export, not the deleted no-op); propose RETIRED/INVERTED + hygiene note, per DEL-17 precedent.
- **DEL-08: FAIL** — live sibling flex in Stage/Headline/Caption at `evidence-scenes.jsx:174`, `minimal.jsx:86`, `cinematic-documentary.jsx:311/408`; SFRs LAY15-1..3 filed (deletions in shared `compositions/**`); 2 dead-code hits (motion-graphics.jsx:949 `Centered`, cinematic-documentary.jsx:142 `DataOverlay`) and 1 legal leaf-internal hit (motion-graphics.jsx:1033 chip) noted with rationale; Part-6-vs-D1 scope ambiguity recorded for the register keeper.
- **DEL-10: PASS** — 0 hits in the render package; repo hits are docs/history only.
- **DEL-14: FAIL (co-signed with audit-render, primary)** — production inputProps path clean; literal pattern matches `qa-sample.js` generated entry (CI-live) + harness shims; geometry slice clean; recommended resolution: register AMEND (option B) or `qa-sample.js` refactor (option A), orchestrator's call.
- **Owned-dir sweeps (layout/**, spec/**, layout-constants.js): clean for the full DEL pattern set.** No owned-file change required; no three-phase protocol triggered. Ledger: `data/audit/15/audit-layout.ledger.md`.