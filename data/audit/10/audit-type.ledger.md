# STAGE 10 — AUDIT-TYPE LEDGER (caption gates from MANUAL Part H; the 2-frame gap holds on every page)

**Lane:** `audit-type` · **Stage:** 10 (Captions) · **Date:** 2026-08-08
**Gate (CROSSCHECK-PROTOCOL Part 4, Stage 10, line 388):** `caption gates from MANUAL Part H; the 2-frame gap holds on every page`
**Ownership exercised:** `captions/**` (created this stage) · `layout/measure.js` (no change) · `data/audit/**`.
**Precondition state:** clean tree at stage 9 hand-off; stage-9 ledger's `frombeats-archetype-gate.mjs:502` logged TYP-11/DEL-09 as "informational — stage 10" (this stage's blocker). Stage-5 ledger precedent for the SFR-between-stages mechanism (SFR-type-002 CONFIRM, orchestrator-applied). `data/audit/10/` did not exist at stage start (glob: no files).

---

## 1 — PHASE 1: CLAIM CARDS (grounded before any edit)

## CLAIM-cap-001 — H5: no caption page exceeds 25 chars/line, 2 lines, or 7 words
```
ASSERTION   Every caption page produced from a real repo SRT satisfies: ≤25
            characters per line, ≤2 lines, ≤7 words. Grounding: Netflix-style
            guidance is 42 chars/line max and 2 lines max for landscape;
            vertical video shrinks the line budget to roughly 60% of the
            landscape limit → 42 × 0.6 ≈ 25. The 7-word ceiling is grounded in
            the kinetic-typography retention guidance (3–7 words per beat).
SPEC REF    MOTION-GRAPHICS-MANUAL B3 (lines 391–394): "Netflix's style guide
            allows a maximum of two lines per cue... 42 characters per line"
            + "42 × 0.6 ≈ 25. Max 25 characters per line, max 2 lines, max
            7 words per page." Part H gate 5 (line 1154, verbatim): "No
            caption page exceeds 25 chars/line, 2 lines, or 7 words".
SOURCES     [1] subhero.io/en/blog/subtitle-standards-guide (fetched
                2026-08-08) — "For example, the maximum line length of 42
                characters for landscape videos translates to roughly 25
                characters for portrait or vertical videos" (vertical ≈ 60% of
                landscape, as the manual's own cite of the same source states).
            [2] subtitlesedit.com/blog/netflix-subtitle-guidelines-line-length-
                characters (fetched 2026-08-08) — Netflix line-length rules:
                "max of 2 lines" and 42 chars/line.
            [3] influencers-time.com/boost-short-form-video-retention-with-
                kinetic-typography-tips/ (fetched 2026-08-08; article dated
                2026-02-27) — "keep each beat to 3–7 words" (exact quote).
RE-VERIFIED YES. The 42→25 conversion is the manual's own arithmetic (42 × 0.6
            = 25.2, floored to 25) and [1] corroborates the 60% ratio
            directly. The 7-word cap is a manual's retained-strictness choice
            consistent with [3].
CURRENT     CAPTION_LIMITS in beats.js:67-70: maxCharsPerLine: 25,
            maxLines: 2, maxWords: 7 — exact. gateCaptions (beats.js:617-637)
            asserts all three per page (chars per line at :624, lines at :626,
            words at :627) and is wired into verify-compositions.js:71.
DELTA       none — limits and gate exist; this stage's deliverable re-asserts
            H5 on every page of every real SRT via the new gate runner.
PLAN        No production change. New gate runner asserts H5 per page on the
            4 real SRTs (data/tts/{ch-01,1,2,4}/*.srt) AND the sections-fallback
            synthesis path, so "every page" is literal, not sample-of-one.
```

## CLAIM-cap-002 — H6: no caption page exceeds 15 CPS
```
ASSERTION   Reading speed per caption page ≤ 15 characters per second, where
            CPS = non-space characters ÷ display duration (display window after
            reserving the 2-frame gap). Grounding (Phase-1 RE-ENTRY after
            counter-check REJECT, 2026-08-08 — attribution corrected to the
            verifier's first-party sources): the BBC guideline is 160–180 WPM
            ≈ 13.3–15 CPS (15 is the TOP of the BBC range); Netflix's own
            English (USA) Timed-Text Style Guide caps adult content at 20 CPS
            and children's at 17 CPS; Netflix's non-English TTSG variants
            (e.g., Russian) cap adult at 17 and children's at 13; the
            classic "six-second rule" ≈ 12 CPS. The manual's choice of 15 is
            conservative against every ADULT-oriented figure (BBC top 15,
            Netflix adult 17/20) — the right engineering choice for a mobile,
            distracted short-form audience — but it is NOT "the slowest
            published figure" (children's 13 and six-second-rule 12 are
            slower). Spec value unchanged: H6 = 15 CPS.
SPEC REF    MOTION-GRAPHICS-MANUAL B3 (lines 396–400): "Sources disagree and
            the disagreement is meaningful: <cite index=94-1>Netflix caps
            adult content at 17 characters per second and children's at 13</
            cite>; other summaries of the English guide give <cite index=90-1>
            20 CPS for adult content and 17 for children's</cite>; and <cite
            index=93-1>the BBC's 160–180 WPM works out to about 15 CPS</cite>...
            Adopt the conservative end: 15 CPS maximum." Part H gate 6
            (line 1155): "No caption page exceeds 15 CPS". NOTE (§6 finding):
            the manual's 94-1/90-1 attribution is imprecise vs first-party —
            Netflix's ENGLISH TTSG is 20 adult / 17 children's (I.14/II.17);
            17/13 are the NON-ENGLISH variants. The manual's SPEC VALUE (15)
            is unaffected.
SOURCES     [1] FIRST-PARTY: partnerhelp.netflixstudios.com/hc/en-us/articles/
                217350977 English (USA) Timed Text Style Guide, sections
                I.14/II.17 (verified 2026-08-08 by the independent verifier,
                live + 2022-01-24 archive) — "Adult programs: up to 20
                characters per second; Children's programs: up to 17
                characters per second". Change log 2018-03-09: "words per
                minute removed" from the Reading Speed section — English has
                capped at 20/17 CPS since at least 2019.
            [2] FIRST-PARTY: partnerhelp.netflixstudios.com/hc/en-us/articles/
                215346638 (Russian TTSG) + Subtitle Templates guide — "Up to
                17 cps" adult / "Up to 13 cps" children's — these are the
                NON-ENGLISH variants, not the English cap.
            [3] FIRST-PARTY: bbc.co.uk/accessibility/forproducts/guides/
                subtitles/ — "The recommended subtitle speed is 160–180 words
                per minute (WPM) or 0.33 to 0.375 second per word" (≈ 13.3–15
                CPS; 15 CPS = 180 WPM, the fast end).
            [4] ebrary.net subtitling chapters — "15 cps, roughly the same as
                180 wpm" and the classic six-second rule ≈ 12 CPS.
            [5] subhero.io/en/blog/subtitle-standards-guide (fetched
                2026-08-08) — "BBC guidelines target 160–180 words per minute,
                which works out to roughly 15 characters per second."
RE-VERIFIED YES (re-entry) — counter-check attempt 1 REJECTED the card's
            attribution (it presented 17/13 as THE Netflix cap and 20/17 as
            "other summaries"; first-party is the reverse, and "slowest
            published figure" is false). Card corrected above to the verifier's
            first-party numbers; the verifier's verdict explicitly endorses
            the corrected framing: "the engineering choice of 15 CPS for a
            mobile/distracted adult short-form audience is defensible... the
            repo's 15-CPS gate is a real, conservative cap." H6 value (15) is
            unaffected.
CURRENT     CAPTION_LIMITS.maxCPS: 15 (beats.js:71). gateCaptions computes CPS
            as non-space chars ÷ (endMs − startMs) (beats.js:480-484, :628) and
            asserts ≤ 15. pageCps uses the page's DISPLAY window (startMs..endMs
            after gap clamping in buildCaptionPages), matching the manual's
            intent.
DELTA       none for the limit; the gate runner adds an independent CPS
            recomputation (non-space chars ÷ display duration from the
            page-level fields, not trusting page.cps) so the check is not
            self-referential.
PLAN        No production change; independent CPS re-assertion in the new gate
            runner over all real pages + the sections-fallback path.
```

## CLAIM-cap-003 — H7: every caption page duration ∈ [833 ms, 5000 ms]
```
ASSERTION   Display duration of every caption page is at least 5/6 s (≈833 ms)
            and at most 5 s. The 833 ms floor is Netflix's timed-text minimum;
            the 7 s Netflix ceiling is a dialogue-subtitle figure, and the
            manual tightens it to 5 s because a narrated Short holding a page
            7 s means the beat cadence has failed.
SPEC REF    MOTION-GRAPHICS-MANUAL B3 (line 414): "Netflix requires cues to
            display for at least 5/6 of a second (about 833 ms) and no more
            than 7 seconds... this manual caps at 5 s." CAPTION_LIMITS
            (lines 408-409): minDurationMs: 833, maxDurationMs: 5000.
            Part H gate 7 (line 1156): "Every caption page duration ∈
            [833 ms, 5000 ms]".
SOURCES     [1] FIRST-PARTY: partnerhelp.netflixstudios.com/hc/en-us/articles/
                Timed-Text-Style-Guide-General-Requirements (fetched 2026-08-08)
                — "Minimum duration: 5/6 of a second per subtitle event";
                "Maximum duration: 7 seconds" (verbatim).
            [2] subtitlesedit.com/blog/netflix-subtitle-guidelines-line-length-
                characters (fetched 2026-08-08) — corroborates "minimum of
                five-sixths of a second (833 ms)" per event.
RE-VERIFIED YES — Netflix's own partner-help page (first-party) confirms both
            bounds; the manual's 5 s ceiling is a documented, deliberate
            tightening for narrated Shorts (not a source conflict).
CURRENT     CAPTION_LIMITS.minDurationMs 833 / maxDurationMs 5000 (beats.js:
            72-73). gateCaptions asserts durationMs in range (:629-630).
            buildCaptionPages enforces both: the merge loop (:551-555) extends
            short pages, the final clamp (:591-593) caps at 5000 and holds the
            last page to ≥ minDurationMs.
DELTA       none; the runner re-asserts durationMs ∈ [833, 5000] per page from
            the page's own durationMs AND recomputed from startMs/endMs.
PLAN        No production change; gate-runner re-assertion on every page.
```

## CLAIM-cap-004 — H8: every caption page is separated by ≥2 blank frames
```
ASSERTION   Between any two consecutive caption pages, at least 2 blank frames
            (66.67 ms at 30 fps) elapse with NO caption on screen. The gap is
            the brain's cue that the subtitle changed; zero-gap captions are
            re-read as unchanged and blur together. The exit animation (B5.3)
            must complete inside the gap.
SPEC REF    MOTION-GRAPHICS-MANUAL B3 (lines 416–420): "The 2-frame minimum
            gap between subtitles is crucial... > Every caption page MUST be
            separated from the next by ≥2 blank frames. > The exit animation
            (B5.3) must complete inside that gap." CAPTION_LIMITS line 410:
            minGapFrames: 2. Part H gate 8 (line 1157): "Every caption page is
            separated by ≥2 blank frames". THE STAGE GATE'S OWN SECOND HALF:
            "the 2-frame gap holds on every page" (CROSSCHECK-PROTOCOL:388).
SOURCES     [1] subhero.io/en/blog/subtitle-standards-guide (fetched
                2026-08-08) — exact quote: "The 2-frame minimum gap between
                subtitles is crucial: without it, your brain doesn't register
                that the subtitle has changed, and you end up re-reading the
                same text — zero-gap subtitles that visually blur together are
                one of the most common mistakes in amateur subtitle files."
            [2] manual arithmetic: gapMs = (2/30)×1000 = 66.67 ms (beats.js:
                535), applied as displayEnd = min(page.endMs, nextStart −
                gapMs) (:549, :591). Because frames are round(ms/33.33),
                round((nextStart−66.67)/33.33) = round(nextStart/33.33) − 2
                exactly (round(x−2) = round(x)−2), the reserved gap is EXACTLY
                2 frames by construction, never 1.
RE-VERIFIED YES — [1] is the manual's own cite (index 93-1), fetched live and
            matching verbatim. The 2-frame math is exact by construction at
            30 fps (property of rounding), and is ALSO re-verified empirically
            per page by the runner's independent recomputation.
CURRENT     minGapFrames: 2 (beats.js:74); gap reserved in buildCaptionPages
            (:535, :549, :591); gateCaptions asserts page gap ≥ 2 using
            startFrame/endFrame (:632-635).
DELTA       gateCaptions TRUSTS the page's startFrame/endFrame fields (which
            buildCaptionPages computed from the same rounding). The runner's
            independent recomputation re-derives the gap from raw
            startMs/endMs (displayEnd = min(endMs, nextStart − 66.67), then
            round both to frames, then subtract) — a genuinely independent
            check, not a re-read of the same field.
PLAN        No production change; independent gap recomputation per adjacent
            page pair in the new gate runner, asserted on all real SRTs AND
            the sections-fallback path (the fallback's proportional timing
            must also satisfy the gap).
```

## CLAIM-cap-005 — H9: headline and caption share ≤2 words
```
ASSERTION   For every beat, the headline (headline zone content) and the
            caption (the beat's spoken words) share at most 2 words. The
            headline states the value/term/label; the caption carries the
            sentence. Repeated vocabulary reads as duplication.
SPEC REF    MOTION-GRAPHICS-MANUAL C3.1 (line 687): "Headline and caption
            MUST NOT share more than 2 words. Checked automatically."
            Part H gate 9 (line 1158): "Headline and caption share ≤2 words".
SOURCES     [1] The manual itself (C3.1) — an internal rule whose "Checked
                automatically" makes the gate's job precise; no external
                citation is given or needed for an editorial dedup rule.
            [2] implemented check: gateMgHeadlineOverlap (mg-package.js:471-482)
                compares scene.headline words vs the beat's caption text using
                contentWords + overlapCount; wired in verify-compositions.js:72.
RE-VERIFIED YES — rule and implementation both present; implementation is
            content-word based (mg-package.js:41-60) to avoid counting
            stopwords as overlap.
CURRENT     gateMgHeadlineOverlap exists and runs in verify-compositions.js.
            It compares b.scene.headline (deriveScene, mg-package.js:210-273)
            against b.text (the beat/caption text) with overlapCount > 2 as the
            failure threshold.
DELTA       none; the runner re-asserts H9 over the real ch-01 beats (SRT path)
            AND the sections-fallback beats (synthesized captions → same
            deriveScene), so "headline and caption" is checked on every beat of
            both real pipelines.
PLAN        No production change; H9 re-assertion in the gate runner.
```

## CLAIM-cap-006 — B2.4: the caption is the only element permitted below y = 1140
```
ASSERTION   In the Shorts layout, nothing other than the caption block occupies
            pixels with y > 1140. The headline zone ends exactly at 1140
            (bottom edge inclusive, not below); the caption zone spans
            1152–1248 (= SAFE.bottom). The rail (4 px structural progress rule,
            x=48, y 288–1248) is structural furniture, documented in the
            manual's own zone table, and is the sole documented exception.
SPEC REF    MOTION-GRAPHICS-MANUAL B2.4 (line 383): "The caption is the only
            element permitted below y = 1140." Zone table A1.3 (line 55):
            "Rail | x 48, y 288–1248 | 4 px progress rule | yes". Headline zone
            (line 53): "964 – 1140". Caption zone (line 54): "1152 – 1248".
SOURCES     [1] manual zone table A1.3 (lines 49-55) — the rail's 288–1248
                span is IN THE MANUAL ITSELF, so the rail is not a gate
                violation but the documented structural exception to B2.4's
                content rule.
            [2] LAYOUT-SYSTEM §2.3 slot table (line 319): rail {48,288,4,960};
                headline {48,964,840,176} → bottom = 964+176 = 1140 exactly;
                caption {88,1152,760,96} → bottom = 1248 = SAFE.bottom
                (line 16: SAFE_SHORTS.bottom 1248).
            [3] TYP-18 / lint.js:91: "structural 4 px strokes (rail, accent
                rule) are exempt" from the 8 px grid — the rail is furniture,
                not content. BLUEPRINT §4.3: "Progress rail... thin vertical
                rule that fills across the video's duration". Layer.jsx:47:
                "structural + persistent (rail): furniture — never animates".
RE-VERIFIED YES — headline bottom = 1140 EXACTLY (not below); caption is the
            only content zone whose range starts at/after 1140; rail is the
            manual-documented structural exception (A1.3 line 55).
CURRENT     Slots match the manual (slots.js:38-42). lintL2 (layout/lint.js:63)
            asserts every slot inside SAFE. Nothing in the content slots
            (kicker/stage/headline) extends below 1140: kicker bottom 360,
            stage bottom 940, headline bottom 1140.
DELTA       B2.4 is currently enforced only implicitly (slot table + L2). The
            gate runner adds an EXPLICIT B2.4 check: assert no content slot
            bottom > 1140, caption zone top ≥ 1140, caption bottom ==
            SAFE.bottom 1248, and rail is the only non-caption slot spanning
            below 1140 (documented exception). Data-driven from slots.js.
PLAN        No production change; explicit B2.4 assertion in the gate runner,
            data-driven from SLOTS_SHORTS + SAFE_SHORTS.
```

## CLAIM-cap-007 — the gate is automatable over every page, including the sections-fallback path
```
ASSERTION   The Stage-10 gate must run as a script (exit 0/1) over every
            caption page of every real repo script/SRT, and over the
            sections-fallback synthesis path (no SRT → word-level captions
            synthesized from section voiceovers with proportional timing), so
            "every page" is literal. Both paths must satisfy H5–H9 + B2.4.
SPEC REF    CROSSCHECK-PROTOCOL:388 (gate verbatim, "every page");
            LAYOUT-SYSTEM §8.4 build order row 8 (line 728): "captions/ |
            caption gates from MANUAL Part H"; §8.1 target tree (lines 697-699):
            captions/fromSrt.js "parseSrt → createTikTokStyleCaptions → pages"
            + captions/CaptionLayer.jsx (render component — NOT this stage:
            CaptionLayer.jsx is the Part B component, build-order row 9's
            style wiring; this stage delivers the gate + fromSrt.js).
SOURCES     [1] protocol + build order (above).
            [2] production synthesis path exists: buildMgPackage
                (mg-package.js:371-398) synthesizes word-level captions when
                captions.length === 0 && sections.length > 0, with windows from
                sectionWindowsMs; pages then flow through the SAME
                parseSrtToMotionGraphics/buildCaptionPages pipeline (:442).
RE-VERIFIED YES — synthesis path read and confirmed (mg-package.js:375-398).
CURRENT     verify-compositions.js gates ONLY ch-01's SRT (one fixture, line
            61-72). No gate covers: the other 3 real SRTs, or the synthesized
            path. So today's automated coverage is 1 of 4 real SRTs + 0
            fallback paths — the "every page" claim is not yet automated.
DELTA       gates run on 1 real SRT; 3 SRTs + synthesis path un-gated.
PLAN        Create captions/run-caption-gate.js (exit 0/1) that: (1) runs
            buildMgPackage over all 4 real SRTs (ch-01 with its real script
            sections, the other three SRT-only) + the sections-fallback
            synthesis for ch-01 (sections, no SRT); (2) asserts H5–H9 via the
            production gates AND independent recomputations; (3) asserts B2.4
            from slots.js; (4) prints per-page evidence; (5) exits nonzero on
            any failure. Create captions/fromSrt.js as the canonical entry
            point re-exporting the production pipeline (parseSrt → pages) plus
            the B2.4 + independent-gap checks, so run-caption-gate.js and any
            later production caller share one module.
```

## CLAIM-cap-008 — TYP-11/DEL-09 BLOCKER: chunkVoiceover must be deleted from render.js and verify-compositions.js
```
ASSERTION   The register (TYP-11, DEL-09) mandates deleting chunkVoiceover —
            a word-count chunker used to fabricate section content. It infers
            structure by word count instead of using the Shot Spec / SRT
            structure, and it is an explicit Stage-10 deletion target. The
            register row 10 (frombeats-archetype-gate.mjs:502) already logged
            it as "informational — stage 10", i.e. the deletion lands HERE.
SPEC REF    CHECK-REGISTER TYP-11 (line ~152 range) / DEL-09 (line 344-346);
            LAYOUT-SYSTEM §7.1: "D2 infers phrasing by word count... Structure
            and timing come from the Shot Spec / SRT now. Nothing in a
            composition parses a sentence or divides a timeline." (lines
            661-664); LAYOUT-SYSTEM §7 D2 row (line 654).
SOURCES     [1] register + LAYOUT-SYSTEM §7.1/§7 (above).
            [2] CURRENT code: render.js:114 `function chunkVoiceover` and
                verify-compositions.js:18-23 `function chunkVoiceover` —
                verified present (grep, 2026-08-08). Note: LAYOUT-SYSTEM D2
                cites render.js:118 / verify-compositions.js:38; the actual
                definitions are at render.js:114 and verify-compositions.js:18
                (definition lines; the cited lines were likely call sites).
RE-VERIFIED YES — both definitions exist at :114 / :18 (grep-confirmed).
CURRENT     chunkVoiceover defined in BOTH render.js (:114) and
            verify-compositions.js (:18), and called at render.js and
            verify-compositions.js:35 to build section content arrays.
DELTA       2 definitions + 2 call sites; deletion is outside my ownership
            (render.js, verify-compositions.js) → SHARED-FILE REQUEST §4.
PLAN        SFR-cap-001: delete chunkVoiceover and its call sites in both
            files; verify-compositions.js section content then falls back to
            the raw voiceover text (single-element content array), which is
            what render.js does at its content-mapping site for the
            no-chunking case. Exact before→after in §5.
```

## CLAIM-cap-009 — TYP-19/DEL-27 (caption scope): no uppercase text in the caption path
```
ASSERTION   Caption text is sentence case. Uppercase is reserved for the
            kicker (28 px) and nothing else. The caption layer must NOT apply
            textTransform: uppercase.
SPEC REF    MOTION-GRAPHICS-MANUAL B4.4 (lines 461-463): "Sentence case, not
            uppercase. All-caps costs roughly 10–15% reading speed... Uppercase
            is reserved for the kicker (28 px) and nothing else." B4 style
            block line 439: textTransform: 'none'.
SOURCES     [1] manual B4.4 (above).
            [2] code: CaptionLayer textTransform: 'none' at
                motion-graphics.jsx:452; the only textTransform: "uppercase"
                occurrences are the kicker path (cinematic-documentary.jsx:348,
                454; Contrast.jsx:137; kicker 28 px per beats.js:86).
RE-VERIFIED YES — grep for textTransform across src/skills/remotion-render:
            uppercase only on kicker elements; caption path is 'none'.
CURRENT     Caption layer is 'none' (motion-graphics.jsx:452). PASS for the
            caption scope of TYP-19.
DELTA       none in the caption scope (kicker uppercase is TYP-19's non-caption
            remainder, out of this stage's gate).
PLAN        No change; record as PASS in §3 evidence (caption scope only).
```

### 1.1 Phase 1 summary

| Claim | Verdict | Change made |
|---|---|---|
| cap-001 H5 (25 chars / 2 lines / 7 words) | GROUNDED (live sources match manual) | gate runner re-asserts on every page |
| cap-002 H6 (≤15 CPS) | GROUNDED (live conflict 20/17 vs 17/13 recorded; 15 conservative) | gate runner independent CPS recomputation |
| cap-003 H7 (833–5000 ms) | GROUNDED (Netflix first-party) | gate runner re-assertion |
| cap-004 H8 (≥2 blank frames) | GROUNDED (subhero exact quote; math exact by construction) | gate runner independent gap recomputation |
| cap-005 H9 (≤2 shared words) | GROUNDED (C3.1 + implementation present) | gate runner re-assertion on SRT + synthesis paths |
| cap-006 B2.4 (caption only below 1140) | GROUNDED (headline bottom == 1140; rail = documented exception) | gate runner explicit B2.4 from slots.js |
| cap-007 automatable gate over every page | GROUNDED (coverage today: 1 of 4 SRTs, 0 fallback) | create captions/fromSrt.js + captions/run-caption-gate.js |
| cap-008 TYP-11/DEL-09 chunkVoiceover | GROUNDED (BLOCKER, both definitions present) | SFR-cap-001 deletion (outside ownership) |
| cap-009 TYP-19 caption scope | PASS (verified in code, no change) | none |

---

## 2 — PHASE 2 (CHANGE) RECORD

Only cap-007 carried a diff (all other cards are verification-only). P2.1 (delete-then-replace): nothing existed under `captions/` — both files are NEW (no deletions, no wraps). P2.4 (ownership): both files live under `src/skills/remotion-render/captions/` (lane-owned per protocol row 10 + audit-type.md allow-list); `layout/measure.js` untouched.

| File | Lines | Bytes | SHA-256 (P2.5 — untracked, no git diff; content hash is the diff) |
|---|---|---|---|
| `captions/fromSrt.js` | 219 | 8638 | `a51fd6f566769417…` |
| `captions/run-caption-gate.js` | 174 | 6327 | `4f895d03869468d5…` |

- `fromSrt.js` — canonical entry point re-exporting the production pipeline (`parseSrt → pages` via mg-package) plus `gateB24` (B2.4, data-driven from `SLOTS_SHORTS`/`SAFE_SHORTS`), `independentGapFrames` (raw-ms gap recomputation — never trusts `startFrame`/`endFrame`), and `gateCaptionPages` (production gate + independent recomputation combined).
- `run-caption-gate.js` — the Stage-10 gate runner: 6 cases (A ch-01 SRT+sections, B ch-01 SRT-only, C debt-snowball SRT, D what-to-say SRT, E great-fire SRT, F sections-fallback synthesis with no SRT); per case 4 checks (`prod` H5–H8, `prod` H9, `ind` H5–H8+B2.4+gap, `canon` drift + raw-page gate); per-page evidence to `data/audit/10/out/run-caption-gate.json`; `process.exit(overallFailures === 0 ? 0 : 1)` (line 173).

## 3 — PHASE 3 (COUNTER-CHECK) RECORD

Dispatched to fresh `verify-independent` sessions (P3.1: no spec sources passed; P3.2: verifiers used their own searches/wording).

| Card | Attempt | Verdict | Notes |
|---|---|---|---|
| cap-007 (the change) | 1 | **CONFIRM** | Sandbox denied node → verifier hand-traced both files against the repo pipeline and reproduced ch-01 page 0's evidence **byte-for-byte** (7 words, 2 lines, 2375 ms, 12.2 CPS, 2-frame gap). Confirmed the 5 failing checks (D: 7 pages 16.1–16.7 CPS; F: 5 pages 16.1–17.4 CPS) are GENUINE violations flagged identically by the production gate and the independent recomputation — "the gate is honest rather than green-washed". Exit contract confirmed. |
| cap-002 (15 CPS) | 1 | **REJECT** | Attribution inverted vs first-party: Netflix ENGLISH (USA) TTSG I.14/II.17 = **20 adult / 17 children's** (live + 2022-01-24 archive; change log 2018-03-09 "words per minute removed"); **17/13 are the non-English variants** (e.g., Russian TTSG); BBC 160–180 WPM ≈ 13.3–15 CPS (**15 is the fast end** of the BBC range); "15 = slowest published figure" is false (children's 13; six-second rule ≈ 12). P3.5 → Phase 1 re-entry: card corrected in §1. |
| cap-002 (re-attempt) | 1 of 2 | **CONFIRM** | Live first-party fetches by the verifier: bbc.co.uk/accessibility/forproducts/guides/subtitles/ ("160-180 WPM… 0.33 to 0.375 second per word"); partnerhelp.netflixstudios.com articles/217350977 ("I.14. Reading Speed Limits — Adult programs: Up to 20 characters per second / Children's programs: Up to 17…", quoted live, repeated at II.17); articles/215346638 ("14. Reading Speed Limits — Adult programs: Up to 17… / Children's: Up to 13…"); Szarkowska & Bogucka 2019, *Six-second rule revisited*, TCB 2(1):101–124 (≈ 12 CPS). beats.js:71 `maxCPS = 15`; `pageCps` (:480-484) = non-space chars ÷ display duration — matches the card's CPS definition; enforced at :628 and wired at verify-compositions.js:71. |
| cap-001 (H5) | — | verification-only | Grounded Phase 1 on live sources (subhero.io 42×0.6≈25; subtitlesedit.com; influencers-time.com 3–7 words). Mechanically re-asserted by the gate runner on **every page of all 6 cases** — zero H5 violations in the evidence JSON. |
| cap-003 (H7) | — | verification-only | First-party Netflix minimum 5/6 s / max 7 s (partnerhelp.netflixstudios.com Timed-Text Style Guide General Requirements, fetched Phase 1). Gate runner asserts duration ∈ [833, 5000] on every page — zero violations in evidence. |
| cap-004 (H8) | — | verification-only | 2 frames = 66.67 ms @ 30 fps. `independentGapFrames` recomputed every inter-page gap in the evidence from raw ms — **all ~430 gaps exactly 2 frames** (round(x−2)=round(x)−2 property held). The headline gate check ("2-frame gap holds on every page") is PROVEN by the evidence, not asserted. |
| cap-005 (H9) | — | verification-only | `prod.gateMgHeadlineOverlap` PASS in all 6 cases (0 headline/caption overlap violations in evidence). |
| cap-006 (B2.4) | — | verification-only | `gateB24` data-driven from slots.js: caption top 1152 ≥ 1140, caption bottom 1248 == SAFE.bottom, headline bottom 1140 (never below), rail = documented structural exception. PASS in all 6 cases. |
| cap-008 (chunkVoiceover) | — | verification-only | Fresh grep 2026-08-08: definitions at `verify-compositions.js:18` (call :35) and `render.js:114` (call :132) — matches the card exactly. Deletion is SFR-cap-001 (outside ownership). |
| cap-009 (uppercase) | — | verification-only | Fresh grep 2026-08-08: `textTransform: "uppercase"` at motion-graphics.jsx:268 (**kicker** — fontSize TYPE.kicker), cinematic-documentary.jsx:348/:454 (kicker), Contrast.jsx:137 (kicker); caption layer is `"none"` at motion-graphics.jsx:452. PASS for the caption scope. (Card's kicker list was incomplete — motion-graphics.jsx:268 omitted; now complete here.) |

## 4 — SHARED-FILE REQUESTS (SFRs)

**SFR-cap-001** (cap-008; TYP-11/DEL-09, BLOCKER carried from stage 9 — register row 10 logged "informational — stage 10"): delete `chunkVoiceover` from `verify-compositions.js:18-23/:35` and `render.js:114/:132`. Fallback for section content: single-element array of the raw voiceover text (the no-chunking path render.js already uses). Owner: orchestrator (both files outside audit-type ownership). Exact before→after for the orchestrator: remove the 2 definitions + 2 call sites; no other behavior change.

**SFR-cap-002** (cap-007/case-F finding): the sections-fallback synthesis path (`mg-package.js:375-398`) is gate-RED on real data — 5 pages at 16.1–17.4 CPS for ch-01 movile-cave, all in the hook. Root cause is the **script's declared section timings** (hook 197 chars / 10 s = 19.7 CPS declared; section_1 15.58, section_2 16.21, section_3 16.08; only close 14.42 ≤ 15). The synthesis faithfully maps declared timing; the declarations violate H6. Owners: mg-package.js / script pipeline. Options: (a) validate section CPS ≥ chars/15 at synthesis time and fail loud; (b) route synthesized pages through `fromSrt.js` independent gate; (c) script writer rejects sections whose declared timing < chars/15 (AMEND-3).

**SFR-cap-003** (case-D finding): channel-2 TTS SRT `data/tts/2/what-to-say-traffic-stop-script-vo.srt` speaks 12 blocks above 15 CPS (16.0–18.63; blocks 5 = 18.59, 15 = 18.63), producing 7 pages at 16.1–16.7 CPS that fail H6. Root cause: TTS voice rate too fast for H6. Owner: TTS generation pipeline. Regenerate at a slower rate (or split the fast blocks). Note: no script in `data/scripts/` currently matches this SRT's slug (ch-02's current script is narrowboat) — orchestrator to confirm whether this SRT is still in the render path or legacy.

## 5 — GATE-RUN RECORD (evidence)

Command (repo root): `node src/skills/remotion-render/captions/run-caption-gate.js` — runs, writes `data/audit/10/out/run-caption-gate.json` (`overallFailures: 5`), exits 1.

| Case | Pages | Syn | prod H5–H8 | prod H9 | ind H5–H8+B2.4+gap | canon drift+raw | Indep failures |
|---|---|---|---|---|---|---|---|
| A ch-01 SRT + sections | 47 | no | PASS | PASS | PASS | PASS | 0 |
| B ch-01 SRT only | 47 | no | PASS | PASS | PASS | PASS | 0 |
| C debt-snowball SRT only | 45 | no | PASS | PASS | PASS | PASS | 0 |
| D what-to-say SRT only | 120 | no | **FAIL** | PASS | **FAIL** | **FAIL** | 7 |
| E great-fire SRT only | 146 | no | PASS | PASS | PASS | PASS | 0 |
| F sections-fallback synthesis | 41 | yes | **FAIL** | PASS | **FAIL** | PASS | 5 |

Case D failing pages (all H6, 16.1–16.7 CPS): "their rights during traffic stops not" 16.3 · "because they're guilty, but because" 16.7 · "they don't know what" 16.1 · "moment where every word becomes evidence. Here" 15.6 · "Because in the moment, you will not" 15.7 · "invent good wording —" 16.3 · "you will revert to whatever you've" 16.2.
Case F failing pages (all H6, 16.1–17.4 CPS, all in the hook section): "In 1986, workers near the Black Sea" 16.6 · "broke into a cave that had been" 16.1 · "sealed for five and a half million" 16.5 · "years. Inside: toxic air, total darkness, and" 17.3 · "thirty-five species found nowhere else on Earth." 17.4.

**Stage-10 gate verdict (for the orchestrator's GATE.md): the automated runner is delivered and reports RED on real data — 5 failing checks, all H6 (15 CPS), root-caused and SFR'd in §4/§6. The headline check "the 2-frame gap holds on every page" (H8) is GREEN across all ~430 page pairs in all 6 cases.** The gate is behaving correctly: the failures are genuine (independently confirmed), not gate bugs.

Uncommitted work in the working tree (verified, do not commit without review): `src/skills/remotion-render/captions/{fromSrt.js, run-caption-gate.js}` (new), `data/audit/10/**` (ledger, out/run-caption-gate.json).

## 6 — FINDINGS + SPEC AMENDMENTS

Findings:
1. **Coverage gap closed (cap-007).** Before this stage, automated caption gates covered 1 of 4 real SRTs and 0 fallback paths. Now all 4 SRTs + the synthesis path run through production gates AND independent recomputation, per-page, with exit-code honesty. 5 genuine H6 violations were surfaced on real data (below) — the exact class of defect this gate exists to catch.
2. **Case D — channel-2 SRT violates H6 at the voice level.** 12 of the SRT's blocks speak at 16.0–18.63 CPS raw (block 5 = 18.59, block 15 = 18.63); 7 gate pages land at 15.6–16.7 CPS. No page segmentation can slow contiguous fast speech → SFR-cap-003 (TTS regeneration).
3. **Case F — sections-fallback synthesis violates H6 via the script's declared timing.** The synthesis is faithful to the script's declared section windows; movile-cave's declarations are inconsistent with H6 (hook 197 chars/10 s = 19.7 CPS; sections 1–3 also > 15). Telling contrast: the SAME script's real SRT (cases A/B) passes every gate at 8.4–14.9 CPS — real TTS speech fits H6; the declared timings don't. → SFR-cap-002.
4. **Manual citation hygiene (cap-002 REJECT outcome).** MOTION-GRAPHICS-MANUAL B3 (lines 396–400) attributes "17 adult / 13 children's" to Netflix as primary and "20/17" to "other summaries". First-party reality: Netflix English (USA) TTSG I.14/II.17 = 20/17 (since ≥2019); 17/13 are non-English variants. The manual's 94-1 URL (netflix-subtitle-style-guide-explained) returns 404 today. The SPEC VALUE (15 CPS) is unaffected and remains defensible as conservative against every adult-oriented figure (BBC top 15, Netflix adult 17/20) — but it is NOT "the slowest published figure" (children's 13; six-second rule ≈ 12).
5. **cap-008 still open.** `chunkVoiceover` deletion (TYP-11/DEL-09) remains pending as SFR-cap-001.
6. **cap-009 PASS.** Uppercase is confined to the kicker (4 sites); the caption layer is `textTransform: "none"`.

Spec amendments recommended (all outside audit-type ownership — for the orchestrator):
- **AMEND-1** — MOTION-GRAPHICS-MANUAL B3: correct the 94-1/90-1 attribution to first-party (English TTSG 20/17; non-English variants 17/13) and soften "conservative end" to "conservative against adult-oriented figures".
- **AMEND-2** — MOTION-GRAPHICS-MANUAL B3: note 15 CPS = 180 WPM = the fast end of the BBC range, not its midpoint.
- **AMEND-3** — script pipeline: reject/generate sections whose declared timing < chars/15 (CPS ceiling) at script-writing time, so the synthesis fallback can never exceed H6.

**Lane status:** Phase 1 (GROUND) done · Phase 2 (CHANGE) done (2 new files, hashes in §2) · Phase 3 (COUNTER-CHECK) done (cap-007 CONFIRM; cap-002 REJECT→re-ground→CONFIRM; remainder verification-only with machine evidence) · gate runner delivered, honest RED on real data with root causes and 3 SFRs filed. GATE.md is orchestrator-owned (protocol §1.2 / mg-orchestrator.md:28) and is not written by this lane.

---

## 7 — GATE RE-ENTRY (orchestrator failure text)

Orchestrator re-dispatched the lane 2026-08-08 with four grounded decisions on the stage-10 RED gate (§5: 5 H6 failures across cases D and F). Re-entry scope: Change 1 (record the unrecorded `gateSectionsDeclaredCps` addition) + Change 2 (runner edits) only. P1.1 ordering honoured: claim cards cap-010/cap-011 below were appended to this ledger BEFORE any edit to `run-caption-gate.js`.

### 7.1 — Orchestrator decisions (2026-08-08, grounded)

1. **Scope — no CLI flag.** The default full run IS the authoritative gate. `gateSectionsDeclaredCps()` (fromSrt.js:63-91) applies to **synthesis cases only** (it validates the *input* timing declarations of the sections-fallback path; SRT cases have no declared timing). Wire it into the runner's synthesis cases.
2. **Case D legacy — CONFIRMED orphaned → non-fatal, but still reported.** `data/tts/2/what-to-say-traffic-stop-script-vo.srt` is consumed by no script. Evidence re-verified by the lane this session: `data/scripts/**` contains only ch-01/movile-cave, ch-01/render-test, ch-02/narrowboat; `config/**` grep `what-to-say|traffic-stop` → **0 matches**; `data/**` grep → only `data/research/2/what-to-say-traffic-stop.json`. Treatment: `legacy: true` on case D — H6 failures printed as WARNINGS, visible in JSON + stdout, **excluded from the exit code**. SFR-cap-003 downgraded from "regenerate TTS" to "retire or regenerate if ever re-activated".
3. **Case G — ADD narrowboat sections-fallback.** `data/scripts/ch-02/narrowboat-10k-surprise-shorts-script.json` has sections + voiceover and NO SRT in `data/tts/2` → real production synthesis case, in the render path. **In-path: H6/declared-CPS failures DO count** toward the exit code. If narrowboat's declared timing violates H6, that is a genuine finding → escalate via SFR-cap-002/AMEND-3, not quietly passed.
4. **Case F totalMs — FIX IT.** The runner currently calls `buildMgPackage` without `totalMs`, so synthesis falls back to `max(words×450, 30000)` (mg-package.js:381) — NOT what production does (render.js:310: `totalMs = audioSecs×1000`). Compute `totalMs` from the script's declared timing (`target_duration_seconds × 1000`; both scripts declare 60 s, equal to their last section-window end `0:48-0:60` → 60000) and pass it for cases F and G so the gate tests the REAL production synthesis path. If declared-window H6 violations persist (hook = 197 chars/10 s = 19.7 CPS declared), that is the honest, faithful result and the correct basis for SFR-cap-002/AMEND-3.

### 7.2 — PHASE 1: CLAIM CARDS (this re-entry)

## CLAIM-cap-010 — Change 1: gateSectionsDeclaredCps fail-loud contract (fromSrt.js:63-91, applied previous session, unrecorded)
```
ASSERTION   The sections-fallback synthesis path (buildMgPackage, mg-package.js:
            378-398) distributes each section's voiceover word-for-word across
            the section's DECLARED timing window — sectionWindowsMs
            (mg-package.js:314-324) uses declared "0:00-0:10" windows verbatim
            when every section parses and lastEnd ≤ totalMs. A section whose
            declared window is shorter than chars/15 can NEVER produce
            H6-conforming pages: no page segmentation can slow contiguous
            speech (each word's span = chars/words × window, mg-package.js:
            389-395). The synthesis MUST fail loud before emitting captions
            when any section's declared CPS > 15; gateSectionsDeclaredCps is
            that gate — per-section non-space chars ÷ declared seconds vs
            CAPTION_LIMITS.maxCPS (15), with per-section evidence.
SPEC REF    SFR-cap-002 (ledger §4); H6 = 15 CPS (cap-002, counter-checked
            CONFIRM); MOTION-GRAPHICS-MANUAL B3; CROSSCHECK-PROTOCOL P1.5
            ("if the claim cannot be grounded it is not made") — the synthesis
            must not emit pages it knows cannot pass the gate.
SOURCES     [1] FIRST-PARTY live (re-fetched 2026-08-08 this session):
                bbc.co.uk/accessibility/forproducts/guides/subtitles/ —
                "The recommended subtitle speed is 160-180 words-per-minute
                (WPM) or 0.33 to 0.375 second per word" (≈13.3-15 CPS; 15 =
                top of BBC range — the cap-002 chain).
            [2] repo first-party: mg-package.js:378-398 (synthesis maps words
                proportionally across the declared window — the section's full
                text exactly fills its window), mg-package.js:314-324
                (declared windows verbatim when parsable + lastEnd ≤ totalMs),
                fromSrt.js:63-91 (the gate itself).
RE-VERIFIED YES — BBC figure re-fetched live (source [1]); synthesis
            arithmetic re-read (source [2]): a section's declared CPS is the
            floor the synthesis cannot beat, so failing loud at the input is
            the only honest failure point.
CURRENT     fromSrt.js:63-91 — gate present and correct (chars = non-space,
            timing regex matches "0:00-0:10", CPS = chars/durSec, failure when
            > maxCPS). BUT dead code: no caller — runner never imports it
            (run-caption-gate.js:36 imports only captionPagesFromSrt +
            gateCaptionPages), and mg-package.js synthesis doesn't invoke it.
DELTA       gate exists with zero call sites. Change 2 wires it into the
            runner's synthesis cases (F, G) as an in-path check.
PLAN        Delete: nothing (function verified correct by reading against
            mg-package.js arithmetic). Replace with: runner wiring (Change 2);
            production wiring stays SFR-cap-002 (mg-package.js is
            orchestrator-owned).
```

## CLAIM-cap-011 — Change 2: runner — legacy case D, new case G, totalMs fix, declared-CPS wiring
```
ASSERTION   The Stage-10 gate runner must (1) pass totalMs =
            target_duration_seconds × 1000 for synthesis cases (60000 for
            both ch-01 movile-cave and ch-02 narrowboat — each declares 60 s
            and its last section window ends at 0:60) so sectionWindowsMs
            uses declared windows verbatim, matching production's proxy
            (render.js:310 audioSecs×1000) instead of the words×450 fallback
            (mg-package.js:381); (2) add case G = ch-02 narrowboat
            sections-fallback (no SRT beside it in data/tts/2 → real in-path
            synthesis case, failures count); (3) mark case D (data/tts/2/
            what-to-say-traffic-stop-script-vo.srt) legacy — orphaned research
            data (0 config references, no matching script) — failures printed
            as WARNINGS, excluded from the exit code; (4) run
            gateSectionsDeclaredCps on synthesis cases (F, G) only, its
            failures counting (in-path).
SPEC REF    Orchestrator decisions 1-4 (§7.1); CROSSCHECK-PROTOCOL:388 (stage
            10 gate); ledger §4 SFR-cap-002/SFR-cap-003 (downgraded); ledger
            §5 case table.
SOURCES     [1] repo first-party: data/scripts/** glob (only ch-01/movile-cave,
                ch-01/render-test, ch-02/narrowboat), data/tts/2/*.srt glob
                (only what-to-say), config/** grep what-to-say|traffic-stop → 0
                matches, data/** grep → only research/2/what-to-say-traffic-
                stop.json (all re-run 2026-08-08 this session).
            [2] repo first-party: render.js:305-311 (production totalMs =
                audioSecs×1000), mg-package.js:314-324 (declared-window
                semantics), mg-package.js:378-398 (synthesis), script JSONs
                (movile-cave + narrowboat: target_duration_seconds 60, last
                timing 0:48-0:60).
RE-VERIFIED YES — every repo fact re-checked this session: both script JSONs
            read (target 60, lastEnd 60000), data/tts/2 glob (no narrowboat
            SRT), config grep (0), runner read (line 101 calls buildMgPackage
            with { sections } and no totalMs; no case G; case D fatal).
CURRENT     run-caption-gate.js:101 — buildMgPackage(c.srtText || "",
            { sections: c.sections || [] }) with NO totalMs → synthesis uses
            max(wordsAll×450, 30000); case D failures counted in
            overallFailures (:144-145); no case G; gateSectionsDeclaredCps
            never imported or called.
DELTA       (a) missing totalMs → wrong (non-production) synthesis timing;
            (b) case G absent → narrowboat in-path synthesis un-gated;
            (c) case D wrongly fatal → orphaned research SRT fails the gate;
            (d) declared-CPS gate dead → synthesis input violations unreported.
PLAN        Delete: totalMs-less buildMgPackage call; fatal handling for
            legacy case D; absent case G; dead gate. Replace with:
            scriptTotalMs(channel, file) helper (target_duration_seconds ×
            1000, fallback estimated_duration_seconds × 1000, fallback 60000);
            totalMs passed for F/G; case G entry; legacy: true on case D with
            WARN printing + evidence.legacy + exit-code exclusion; [syn]
            gateSectionsDeclaredCps check on cases with sections && no SRT.
            All edits inside captions/run-caption-gate.js (lane-owned).
```

### 7.3 — PHASE 2 (CHANGE) RECORD — this re-entry

Both files untracked (no git baseline; content hashes are the diff, ledger §2 precedent). P2.1 (delete-then-replace): Change 1 added a new function; Change 2 replaced the runner's synthesis/totalMs/legacy handling in place — nothing wrapped, nothing flagged, no feature flags. P2.4: edits confined to `captions/**` (lane-owned).

| File | Lines (before → after) | SHA-256 before (§2) | SHA-256 after (P2.5) |
|---|---|---|---|
| `captions/fromSrt.js` | 219 → 263 | `a51fd6f566769417…` | `D5EFA9809A2D559268BDAA001C2F31FD155EB546AD0A20521541A06C6837A45D` |
| `captions/run-caption-gate.js` | 173 → 231 | `4f895d03869468d5…` | `47FEB374A5B7BB113B851698DEAF328FD1B4CE41BF4A7BD91C3FD5B7EB838120` |

**Change 1 (cap-010)** — `fromSrt.js:48-91` new `gateSectionsDeclaredCps(sections, caps)`: per section with a parsable `M:SS-M:SS` timing and non-empty voiceover, computes non-space chars ÷ declared seconds and flags CPS > `CAPTION_LIMITS.maxCPS` (15). Returns `{ pass, failures, sections }` with per-section evidence (id, timing, chars, declaredSec, declaredCps). Implemented the SFR-cap-002 fail-loud contract: the synthesis maps declared timing word-for-word (mg-package.js:389-395), so a section declared faster than 15 CPS can never yield H6 pages — the input must fail loud first.

**Change 2 (cap-011)** — `run-caption-gate.js`:
1. Import `gateSectionsDeclaredCps` from `./fromSrt.js` (line 45).
2. Case D: `legacy: true` (line 71) — orphaned research SRT.
3. Case F: `totalMs: scriptTotalMs("ch-01", "movile-cave-shorts-script.json")` (line 80).
4. New case G: ch-02 narrowboat sections-fallback, `totalMs` from its script (lines 82-86).
5. New `scriptTotalMs(channel, scriptFile)` helper (lines 89-107): `target_duration_seconds × 1000` → fallback `estimated_duration_seconds × 1000` → fallback 60000.
6. `buildMgPackage` call now passes `totalMs: c.totalMs` (lines 137-140) — synthesis uses declared windows (both scripts: last section `0:48-0:60` = 60000 = target, so `sectionWindowsMs` mg-package.js:317-322 keeps declared windows verbatim).
7. New `[syn]` check on cases with sections && no SRT (lines 151-161): `gateSectionsDeclaredCps(c.sections)`.
8. Legacy accounting (lines 195-205): legacy-case failures print `WARN` (not FAIL), never increment `overallFailures`, still visible in stdout + JSON; evidence gains `legacy` and `warnings` fields (lines 210-213).
9. Doc-comment case list + check list updated to match (lines 10-38).

No changes to `mg-package.js`, `render.js`, `beats.js`, or any script JSON — those remain SFR/AMEND territory (SFR-cap-002/003, AMEND-3).

**Note on orchestrator prediction vs measured value:** the orchestrator's "hook 197 chars/10 s = 19.7 CPS declared" counts characters WITH spaces (197 = `t.length`). H6's CPS definition (cap-002; beats.js:480-484) is NON-SPACE characters: `t.replace(/\s+/g,"").length` = **163** → **16.3 CPS declared**. Both exceed 15; the verdict is unaffected. The gate's `syn` check and the ledger's AMEND-3 wording use the non-space definition (163 chars / 16.3 CPS), consistent with the production `pageCps`.

### 7.4 — PHASE 3 (COUNTER-CHECK) RECORD — this re-entry

| Card | Attempt | Verdict | Notes |
|---|---|---|---|
| cap-011 (Change 2, the runner) | 1 | **CONFIRM** | Every numbered requirement hand-verified against the repo: scriptTotalMs returns 60000 for both scripts (both declare target 60 s, last window 0:48-0:60 → sectionWindowsMs mg-package.js:317-321 keeps declared windows verbatim, bypassing the words×450 fallback); case G in-path (no legacy flag, no narrowboat SRT in data/tts/2); case D orphan re-grepped (config/ = 0 matches, data/scripts/ has no what-to-say script); [syn] guard `!c.srtText && c.sections` limits it to F/G; exit code accumulates non-legacy failures only. Explicit answers: case D non-fatal-but-visible matches the claim; case G in-path matches; the exit code cannot be 0 while an in-path H6 violation exists ([prod] gateCaptions beats.js:628 + [ind] independent recomputation both feed overallFailures; the known [prod] token-array line-length quirk is closed by [ind]'s lineText recomputation). `npm run verify` could not execute in the verifier's sandbox (PowerShell execution policy), but the verifier read the import chain and confirmed neither changed file is in verify-compositions.js's dependency graph — the diff provably cannot affect that regression. |
| cap-010 (Change 1, gateSectionsDeclaredCps) | 1 | **REJECT** | Two grounds, both accepted as correct by the lane on independent re-reading (P3.5 → Phase 1 re-entry below): **(a)** the card's "CAN NEVER produce H6-conforming pages" universal is false — page construction pools tokens across section boundaries (beats.js:503-511, span ≤ 1200 ms combine window) and the merge loop (beats.js:543-583) absorbs short/fast pages into slower neighbours, so a fast section flanked by slow ones can be diluted below 15 CPS at page level; the universal holds only for the repo's actual data (ch-01 hook hand-traced to an unfixable 17.4 CPS page), not for the machinery in general. The function remains a correct NECESSARY input check. **(b)** "the synthesis MUST fail loud before emitting captions" is not implemented — the only call site is the runner (run-caption-gate.js:155); mg-package.js is untouched by design (orchestrator decision: production wiring = pending SFR-cap-002, out of lane ownership). The card and the fromSrt.js doc comments asserted that wiring as done; both corrected (see §7.5). Verifier's own sources for 15 CPS: ETH Zurich digital accessibility ("15 characters per second… comfortable speed"); European subtitling literature via Aieti (Díaz & Remael / Szarkowska: 180 wpm ≈ 15 cps, typical maxima 12-16 cps) — corroborating beats.js:71 maxCPS = 15. |

**P3.5 disposition:** on REJECT the change is *reverted and re-grounded*, not patched. The CODE diff is not reverted because (1) the orchestrator's failure text explicitly ordered it (decision 1: "wire it into the synthesis cases in the runner"), (2) claim 2 (the same runner diff) is CONFIRMED, and (3) the rejected claims are assertions in the card/doc-comments, not the implementation. What is corrected is the CLAIM itself — re-entered at Phase 1 with the rejection text in §7.5 — and the overclaiming doc comments in fromSrt.js (both edited). Attempt counter for cap-010: 1 of 2.

### 7.5 — PHASE 1 RE-ENTRY (cap-010 attempt 2, rejection text from §7.4)

## CLAIM-cap-010R — Change 1 (corrected): gateSectionsDeclaredCps is a necessary input-level H6 check for the synthesis path
```
ASSERTION   The sections-fallback synthesis path (buildMgPackage, mg-package.js:
            378-398) distributes each section's voiceover word-for-word across
            the section's DECLARED timing window (sectionWindowsMs, mg-package.js:
            314-324, uses declared "0:00-0:10" windows verbatim when every
            section parses and lastEnd ≤ totalMs). A section whose declared
            window is shorter than chars/15 is spoken faster than H6 on
            average and WILL surface fast pages unless page construction
            dilutes it across boundaries — it is a NECESSARY check, not a
            sufficient one: page pooling (beats.js:503-511) and the merge loop
            (beats.js:543-583) can absorb a short fast section into slower
            neighbours, so the page-level gates ([prod] gateCaptions / [ind]
            gateCaptionPages) remain authoritative. gateSectionsDeclaredCps
            (fromSrt.js) implements the input-level check — per-section
            non-space chars ÷ declared seconds vs CAPTION_LIMITS.maxCPS (15),
            with per-section evidence — and the stage-10 runner exercises it on
            synthesis cases (F, G) as an in-path check. WIRING THIS GATE INTO
            THE PRODUCTION SYNTHESIS PATH (refuse to synthesize before
            emitting captions) is the PENDING SFR-cap-002, orchestrator-owned
            (ledger §4); it is NOT implemented in this diff by design.
SPEC REF    SFR-cap-002 (ledger §4, pending); H6 = 15 CPS (cap-002,
            counter-checked CONFIRM); MOTION-GRAPHICS-MANUAL B3; CROSSCHECK-
            PROTOCOL P1.5 (the gate must not emit pages it cannot defend —
            the fail-loud wiring is the SFR's job, not this stage's).
SOURCES     [1] FIRST-PARTY live (re-fetched 2026-08-08): bbc.co.uk/
                accessibility/forproducts/guides/subtitles/ — "160-180 words-
                per-minute (WPM) or 0.33 to 0.375 second per word" (≈13.3-15
                CPS; 15 = top of BBC range).
            [2] verifier's independent sources (§7.4): ETH Zurich digital
                accessibility — "15 characters per second… comfortable
                speed"; European subtitling literature (Díaz & Remael /
                Szarkowska via Aieti) — 180 wpm ≈ 15 cps, maxima 12-16 cps.
            [3] repo first-party: mg-package.js:378-398 (synthesis word spans
                ∝ chars across the declared window), mg-package.js:314-324
                (declared windows verbatim), beats.js:491-583 (page pooling +
                merge can dilute — the REJECT's ground (a), confirmed by lane
                re-reading), fromSrt.js:48-91 (the gate).
RE-VERIFIED YES (re-entry) — lane re-read beats.js:491-599 and confirms the
            REJECT's pooling analysis; the corrected ASSERTION removes the
            false universal and the false "wired into production" claim.
CURRENT     gateSectionsDeclaredCps at fromSrt.js:63-91 (after doc-comment
            correction, lines 48-65); runner calls it only when
            !c.srtText && c.sections.length (run-caption-gate.js:151-161);
            mg-package.js does NOT call it (pending SFR-cap-002).
DELTA       None in code vs §7.3 (doc comments corrected only). Delta vs the
            REJECTED card: ASSERTION reworded (necessary-not-sufficient;
            production wiring explicitly pending, not done).
PLAN        Delete: the overclaiming wording (done in card + doc comments).
            Replace with: the corrected wording above. No code change.
```

### 7.6 — PHASE 3 RE-ATTEMPT RECORD (cap-010R, attempt 2 of 2)

| Card | Attempt | Verdict | Notes |
|---|---|---|---|
| cap-010R (corrected Change 1) | 2 | **CONFIRM** | Fresh session. Both prior rejection grounds resolved: **(a)** the false universal is gone — the corrected card's "NECESSARY, not sufficient" hedge was verified in BOTH directions (input flags a 31-CPS 2-word section, merge loop dilutes it into slow neighbours → pages at 5-8 CPS; input at exactly 15.0 declared CPS with one 28-char word → single-word page at ~15.06 CPS, page gates authoritative). Mathematically: synthesis tokens tile [fromMs,toMs] contiguously, so duration-weighted average page CPS over a section == declared CPS; >15 forces at least one fast page absent boundary dilution. **(b)** the false wiring claim is gone — mg-package.js and render.js never call the gate (re-verified line-by-line); doc comments at fromSrt.js:40-44 and :61-64 now say PENDING SFR-cap-002, matching the code and the claim. Verifier's independent sources: UNE 153010 (AENOR) 15 cps via JoSTrans (Tamayo Masero); Ofcom "SDH should not exceed 180 wpm or 15 cps" (Romero-Fresco 2010, per JoSTrans); ETH Zurich accessibility; PLOS One 2018 (180 wpm ≈ 15 cps English SDH). Machine check: npm run verify blocked by PS execution policy in sandbox; substitute accepted — verify-compositions.js import graph (broll.js, mg-package.js, beats.js, icons-data.js, mg-style.js, tokens.js) contains neither changed file, so the diff cannot regress it; runner hand-traced and cross-checked against the real artifact data/audit/10/out/run-caption-gate.json (failure strings match fromSrt.js verbatim; [syn] entries only on F/G; D legacy warnings; overallFailures = 3 = F's [prod]+[syn]+[ind]). Note recorded (non-material): beats.js's own comment loosely credits "BBC" for 15 CPS; the claim does not repeat that attribution; also sectionWindowsMs needs parsed.length > 1 for the declared branch (irrelevant: F/G have 5 sections). |

**P3.5 outcome:** cap-010 attempt 2 = CONFIRM (within the two-attempt budget). cap-011 = CONFIRM on attempt 1. No claim exceeds its budget; no escalation to the user required.

### 7.7 — GATE RE-RUN RECORD (final, after re-entry changes)

Command (repo root): `node src/skills/remotion-render/captions/run-caption-gate.js` — writes `data/audit/10/out/run-caption-gate.json`, **exit code 1** (3 failing checks, all in-path case F). Content hashes (P2.5, final): fromSrt.js `21E1B56FAB7D49EB7629F27EFEE4A9F3A007A777DB272D51F5F6BEC48854D750` · run-caption-gate.js `47FEB374A5B7BB113B851698DEAF328FD1B4CE41BF4A7BD91C3FD5B7EB838120`.

| Case | Pages | Syn | prod H5-H8 | prod H9 | syn declared | ind H5-H8+B2.4+gap | canon drift | Result |
|---|---|---|---|---|---|---|---|---|
| A ch-01 SRT + sections | 47 | no | PASS | PASS | — | PASS | PASS | **GREEN** |
| B ch-01 SRT only | 47 | no | PASS | PASS | — | PASS | PASS | **GREEN** |
| C debt-snowball SRT only | 45 | no | PASS | PASS | — | PASS | PASS | **GREEN** |
| D what-to-say SRT only (LEGACY) | 120 | no | WARN (7 pages 15.6-16.7 CPS) | PASS | — | WARN | WARN | **WARN-only — excluded from exit code** |
| E great-fire SRT only | 146 | no | PASS | PASS | — | PASS | PASS | **GREEN** |
| F movile-cave synthesis (totalMs 60000) | 41 | yes | **FAIL** (5 pages 16.1-17.4 CPS) | PASS | **FAIL** (hook 163 chars/10 s = 16.3 declared) | **FAIL** (same 5 pages, independent) | PASS | **RED — in-path** |
| G narrowboat synthesis (totalMs 60000) | 37 | yes | PASS | PASS | PASS | PASS | PASS | **GREEN** |

Case F failing pages (all H6, unchanged from §5's faithful prediction — now with the production-faithful declared-window timing): "In 1986, workers near the Black Sea" 16.6 · "broke into a cave that had been" 16.1 · "sealed for five and a half million" 16.5 · "years. Inside: toxic air, total darkness, and" 17.3 · "thirty-five species found nowhere else on Earth." 17.4 — all in the hook section (declared 163 non-space chars / 10 s = 16.3 CPS). Case D's 7 pages remain visible as WARNINGS in JSON + stdout (§7.1 d.2 honoured). Case G (narrowboat) passes every check — its declared section timing fits H6 (hook 117 chars/10 s ≈ 11.7 CPS declared), demonstrating the synthesis path CAN pass when the script's declared timing is honest.

**The 2-frame gap (H8) — GREEN across all ~440 page pairs in all 7 cases** (independent raw-ms recomputation; round(x−2)=round(x)−2 property held). Stage-gate headline check proven, not asserted.

### 7.8 — FINAL STAGE VERDICT (re-entry)

**RED** — with one honest in-path failure and a precise path to green.

- **GREEN:** A, B, C, E (all SRT paths); **G** (narrowboat synthesis — the new in-path case passes, proving the synthesis path is H6-capable when declared timing is honest); H8 2-frame gap on every page; B2.4; H9; case D handled as legacy warnings exactly per orchestrator decision 2.
- **RED:** **case F** (ch-01 movile-cave sections-fallback) — the hook section's DECLARED timing is 163 non-space chars / 10 s = **16.3 CPS > 15**, producing 5 unfixable pages at 16.1-17.4 CPS. This is now the production-faithful result: with totalMs = 60000 the synthesis uses the script's declared windows verbatim (§7.1 d.4), matching what render.js would emit with a 60 s voiceover. The [syn] input gate catches it at the source; [prod] and [ind] catch it at page level — three independent confirmations of the same genuine defect. This is the designed honest RED, not a gate bug.

**Precise SFR path to green (for the orchestrator's GATE.md):**
1. **SFR-cap-002 exact contract** (ledger §4; pending, orchestrator-owned — apply to `mg-package.js` `buildMgPackage`): in the sections-fallback branch (`captions.length === 0 && sections.length > 0`, mg-package.js:378), call `gateSectionsDeclaredCps(sections)` BEFORE synthesizing; on `!pass`, throw (refuse to synthesize) with the per-section evidence (id, declared CPS, chars, declared seconds). Import from `./captions/fromSrt.js` (or the lane's canonical entry). This makes the input gate authoritative at production time, exactly as the attempt-2 CONFIRM requires ("the fail-loud wiring is the SFR's job"). Note: the gate must remain NECESSARY-not-sufficient — page-level gates still run (verify-compositions.js) because boundary pooling can dilute; production must not skip them.
2. **AMEND-3 wording** (script pipeline, for the script-writer): reject or re-tune any section whose DECLARED timing window is shorter than `nonSpaceChars(section.voiceover) / 15` seconds — i.e. require `declaredSeconds ≥ chars/15`. For ch-01 movile-cave hook: 163 chars → requires ≥ 10.87 s; declared 10.0 s → must grow to ≥ 10.9 s (or trim the hook to ≤ 150 chars). Section-level check at script-generation time, so the synthesis fallback can never exceed H6 (movile-cave fix: hook timing "0:00-0:10" → "0:00-0:11" is NOT enough — 163/15 = 10.87 s; the honest floor is 10.87 s; recommend "0:00-0:11" only with a trim to ≤ 150 chars, else "0:00-0:12").
3. **SFR-cap-003 (downgraded per decision 2):** case D's SRT is orphaned research data — retire it from `data/tts/2/` or regenerate only if the channel is ever re-activated with a matching script. No action required to reach green (it is excluded from the exit code).

**Lane status (re-entry complete):** P1.1 ordering honoured (cards before edits) · Change 1 re-grounded + doc comments corrected (attempt 2 CONFIRM) · Change 2 CONFIRM on attempt 1 · gate re-run exit 1, honest RED with 3 independent confirmations of the single case-F defect · final verdict RED with an exact SFR path to green · no escalation needed (no claim exceeded 2 attempts) · GATE.md is orchestrator-owned and not written by this lane.
