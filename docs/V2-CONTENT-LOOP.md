# V2 Content Loop — subject-matched drawings

Date: 2026-09-27 · Branch: claude/visual-rebuild-from-5f91e75 · Dry runs only

**Outcome: stopped, not converged.** Changes 1–3 landed and do what they
say. The loop's end conditions (every visual beat depicts its subject;
≥ 5/6 pass the frame reviewer; zero "abstract / unrelated drawing"
failures) were NOT met. Two blockers that the loop cannot tighten its way
past need a human decision (§4).

## 1. What changed

| Commit | Change | Verified in CI |
|---|---|---|
| 786c4f5 | Planner: one drawing per visual beat, depicting the SUBJECT; no match -> TYPOGRAPHY; per-channel shortlist | partly — see §3 |
| 382685a | Paper drawings visible on light grounds (paper = ground tinted 10–16% toward text; ink = text) | yes — ch-9's archival map sheet renders as a grey page on white (run 36348187176) |
| 0e0307b | One drawing per beat: `field` panel and paired primitives dropped in normalizeScene; coverage measured from the real layout | yes — no grid panel in any sampled frame; 29/31 visual beats are a single drawing (run 36349568641) |
| 0823038 | Planner: name `sentence_subject` first; channel topic is not the subject; abstract sentences -> TYPOGRAPHY | the subject is now named correctly; the drawing still often isn't (§3) |

## 2. Final per-channel results

Run 36349568641 (HEAD 0823038). Beat-check columns count the visual beats.

| Ch | Queue | Failing stage | Beat check | Wrong-drawing beats |
|---|---|---|---|---|
| 1 | approved-review | beat check | 0/3 YES | "Monarch Money" -> calendar grid; "YNAB" -> ledger notebook, calculator (the phone-app drawing exists) |
| 2 | approved-review | beat check | 3/6 YES | protesters -> case file folder; courthouse column for a news round-up |
| 9 | approved-review | beat check | 1/3 YES | "displaced civilians" -> archival map sheet; one beat fell back to a mechanism scene |
| 26 | approved-review | frame review (TEMPLATE_MONOCULTURE 40%) | **6/6 YES** | none flagged |
| 44 | approved-review | beat check | 3/5 YES | skills -> application window; "one-third of work" -> checklist rule |
| 48 | rejected | beat check (all 9) + local frames-centered | 0/9 YES | "Boeing 787" -> spacecraft silhouette; fleet -> product silhouette; no airliner exists |

Counts: approved 0 / approved-review 5 / rejected 1 · Forbidden lines: 0.
The previous run (36348187176) approved ch-9 outright — the first video
to pass every AI stage.

## 3. What the loop showed

- Changes 2 and 3 work on screen: one drawing, no panel, visible paper.
- The planner uses the library (29/31) and names the subject correctly,
  but then picks the nearest drawing even when it does not depict that
  subject — and it has **never** taken the TYPOGRAPHY fallback: 6
  TYPOGRAPHY beats across 6 videos, all of them the beat-0 hook.
- Several named subjects are abstract ("quality control process",
  "structural failure risk") and should have been TYPOGRAPHY.

## 4. Blockers — need a decision

1. **The TYPOGRAPHY cap undoes the fallback.** `scripts/plan-caps.cjs`
   holds TYPOGRAPHY to 1–2 beats and reassigns the rest to legacy
   mechanisms (STATE_CHANGE, ACTION_CONSEQUENCE, …), which MechanismScene
   draws as abstract geometry. The 40% per-mechanism cap does the same
   (it reassigned 2 of ch-2's beats this run). So even a planner that
   obeyed "no match -> TYPOGRAPHY" would get its third fallback turned back
   into shapes. Raising or changing these caps is loosening a check.
2. **Library gaps are real for 4 of 6 channels** (below). Where no drawing
   depicts the subject, the model substitutes rather than falling back.

## 5. library-gaps.md

(copied from data/ci-runs/library-gaps.md)

| Ch | Subject named by the planner | Drew instead | Missing drawing |
|---|---|---|---|
| 48 | "Boeing 787 Dreamliner" | spacecraft silhouette | airliner (side view) |
| 48 | "A321neo aircraft fleet" | product silhouette + counter | airliner |
| 48 | "A321neo fuselage", "fuselage stringers" | cross section, blueprint sheet | fuselage section / airframe |
| 48 | "corrosion protection" | vessel (primitive) | corroded / painted metal panel |
| 9 | "displaced civilians" | archival map sheet | crowd / group of people |
| 9 | "earthen trench" | mechanism scene | trench / border fortification |
| 2 | protesters camped in Puerta del Sol | case file folder | crowd with protest signs |
| 2 | "150 tents" | evidence exhibit + counter | tent |
| 44 | AI chatbots / chatbot conversation | court document, application window | chat conversation (message bubbles) |
| 26 | Rosneft (oil company) — run 36343146799 | case file folder, bank statement | oil rig / oil barrel |

Not gaps (the drawing exists, the planner picked another): ch-1 budgeting
apps -> phone showing a budgeting app; ch-2 elderly tenant -> figure
silhouette; ch-9 countries -> map-region-highlight.

## 6. Is the six-channel drawing set sufficient?

**No, not as-is.** ch-1 is sufficient (its failures are selection).
ch-26 is mostly sufficient. ch-2, ch-9, ch-44 and ch-48 each need 1–3
drawings (above). ch-48 is the clearest case: a manufacturing channel
about aircraft has no aircraft.

## 7. Suggested next decisions

1. Decide the TYPOGRAPHY cap for no-match beats (e.g. exempt a beat whose
   `sentence_subject` is null or has no drawing from the reassignment —
   that is a rule change, so it's yours to make).
2. Approve drawing additions from §5 (airliner first).
3. Then consider moving drawing selection out of free choice: have the
   model return the subject only, and pick the drawing (or TYPOGRAPHY)
   from a subject -> drawing table, so a wrong substitution can't happen.
