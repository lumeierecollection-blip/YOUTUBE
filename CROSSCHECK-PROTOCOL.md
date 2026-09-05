# CROSS-CHECK PROTOCOL — Multi-Agent Verified Rebuild

**Repo:** `lumeierecollection-blip/YOUTUBE`
**For:** OpenCode
**Purpose:** every change to the motion-graphics pipeline is web-grounded
before it is made, made as a delete-then-replace, and independently
counter-checked after — by a different agent, in a different session, that
never sees the first agent's sources.

**Spec documents this protocol enforces:**
`MOTION-BLUEPRINT.md` · `MOTION-GRAPHICS-MANUAL.md` · `LAYOUT-SYSTEM.md` ·
`FINISH-SPEC.md` · `DETAIL-REFERENCE.md`

> **Those five documents are inputs to be verified, not scripture.** Every
> citation in them was checked once, by me, on one date. Phase 1 of this
> protocol requires the agent to re-verify each cited claim against the live
> source before implementing it, and to report any that have moved, changed,
> or were wrong. That is the point of the exercise — two independent passes,
> mine and OpenCode's, on the same claims.

---

# PART 0 — PREFLIGHT (do this before anything else)

Three environment facts decide whether this protocol can run at all.

## 0.1 `websearch` is not on by default

OpenCode's `websearch` tool <cite index="50-1">is only available when using the OpenCode provider or when the `OPENCODE_ENABLE_EXA` environment variable is set to any truthy value; it performs searches via Exa AI's hosted MCP service and requires no API key</cite>. The companion rule: <cite index="50-1">use `websearch` to find information (discovery) and `webfetch` to retrieve content from a specific URL (retrieval)</cite>.

**Without this, every Phase 1 and Phase 3 in this document silently degrades
into the model answering from training data — which is exactly the failure
this protocol exists to prevent.**

```bash
export OPENCODE_ENABLE_EXA=1
```

Verify before starting: ask OpenCode to run one `websearch` and show the
result. If it can't, stop and fix it.

## 0.2 Subagent depth must be raised to 2

<cite index="42-1">`subagent_depth` controls how deeply subagents can invoke other subagents. The default is 1, which allows primary agents to launch subagents but prevents those subagents from launching additional subagents.</cite>

This protocol's Phase 3 requires an **audit lane subagent** to invoke a
**separate verifier subagent**. At depth 1 that call fails and the
counter-check collapses into self-review.

## 0.3 `doom_loop` will fire on repeated searches

<cite index="54-1">`doom_loop` is triggered when the same tool call repeats 3 times with identical input.</cite>

Phase 1 and Phase 3 both research the same claim. **They must use different
query wording**, which is required anyway — see §2.3, where the verifier is
forbidden from reusing the researcher's queries.

---

# PART 1 — THE AGENT TOPOLOGY

<cite index="41-1">OpenCode has two built-in primary agents and three built-in subagents. Build is the default primary with all tools enabled. Plan is restricted for analysis. General is a general-purpose agent for researching complex questions and executing multi-step tasks, with full tool access except todo — use it to run multiple units of work in parallel. Explore is a fast, read-only agent for exploring codebases.</cite> <cite index="44-1">A subagent runs in a new session spun up by the primary agent, with its own tools and system prompt, running independently.</cite>

**The separate session is the load-bearing property.** It is what makes the
verifier's opinion worth something: it never sees the researcher's reasoning
or sources, only the diff and the claim.

## 1.1 Lanes

Eight audit lanes, run in parallel. Each owns an exclusive set of paths.

| Lane | Domain | Owns (exclusive write access) |
|---|---|---|
| `audit-layout` | slots, safe zones, the compiler, alignment | `layout/**`, `spec/**`, `layers/**` |
| `audit-type` | fonts, measurement, caption, crispness | `captions/**`, `layout/measure.js` |
| `audit-color` | palettes, OKLCH, contrast, elevation, background | `config/channels.json`, `styles/tokens.js` |
| `audit-motion` | timing, easing, springs, stagger, drag, blur | `beats/**` (motion props only) |
| `audit-encoding` | archetypes, charts, concept mapping | `primitives/Chart.jsx`, `spec/fromBeats.js` |
| `audit-audio` | SFX map, gains, LUFS, sync | `src/audio/**`, `audio.js` |
| `audit-render` | renderMedia options, config, encoder, CI | `render.js`, `remotion.config.js`, `.github/**` |
| `audit-assets` | icons, licences, images, font vendoring | `public/**`, `THIRD_PARTY_LICENSES.md` |

**1.1.1 — Exclusive ownership is not bureaucracy. It is a fix for a failure
you have already had.** The `chileleko366-stack` build hit a parallel-agent
shared-file collision across three worktrees that had to be reconciled by hand
before the matrix could go live. Eight lanes on one repo will reproduce that
within an hour unless ownership is enforced.

**1.1.2 — Shared files.** `Root.jsx`, `package.json`, and
`styles/motion-graphics.jsx` are owned by **the orchestrator only**. A lane
that needs a change there files a request in its ledger; the orchestrator
applies it between stages, never during.

## 1.2 Agent definitions

<cite index="42-1">Agents can be defined as markdown files in `.opencode/agents/`.</cite> Frontmatter supports `description`, `mode` (primary / subagent / all), `model`, `permission`, `hidden`, and `color`. <cite index="40-1">`hidden: true` removes a subagent from the @ autocomplete menu — useful for internal subagents invoked only programmatically via the Task tool — and `permission.task` controls which subagents an agent can invoke, using glob patterns evaluated in order with the last matching rule winning.</cite>

Create these files.

### `.opencode/agents/mg-orchestrator.md`

```markdown
---
description: Runs the staged motion-graphics cross-check rebuild. Dispatches audit lanes, owns shared files, enforces stage gates.
mode: primary
permission:
  edit:
    "**": deny
    "src/skills/remotion-render/Root.jsx": allow
    "src/skills/remotion-render/styles/motion-graphics.jsx": allow
    "src/skills/remotion-render/package.json": allow
    "data/audit/**": allow
  bash: allow
  websearch: allow
  webfetch: allow
  task:
    "*": deny
    "audit-*": allow
---

You orchestrate a staged rebuild. You do not write feature code.

Per stage:
1. Read the stage definition in CROSSCHECK-PROTOCOL.md Part 4.
2. Dispatch every lane listed for that stage IN ONE MESSAGE, in parallel.
3. Wait for all lanes. Read each ledger at data/audit/<stage>/<lane>.ledger.md.
4. Apply any shared-file requests the lanes filed.
5. Run the stage gate. If it fails, dispatch only the failing lanes again
   with the specific failure text. Never proceed on a failed gate.
6. Write data/audit/<stage>/GATE.md with pass/fail per check.
7. Report to the user: what changed, what was deleted, what each lane's
   counter-check rejected, and the gate result. Then stop and wait.

You never skip a stage. You never run two stages at once.
```

### `.opencode/agents/audit-layout.md` (template — one per lane)

```markdown
---
description: Audits and rebuilds layout, slots, safe zones, and the layout compiler against verified sources.
mode: subagent
permission:
  edit:
    "**": deny
    "src/skills/remotion-render/layout/**": allow
    "src/skills/remotion-render/spec/**": allow
    "src/skills/remotion-render/layers/**": allow
    "data/audit/**": allow
  bash: allow
  websearch: allow
  webfetch: allow
  task:
    "*": deny
    "verify-independent": allow
---

You audit ONE domain: layout, slots, safe zones, the compiler, alignment.

You follow the three-phase protocol in CROSSCHECK-PROTOCOL.md Part 2 for
EVERY change, without exception. A change that skipped a phase is reverted.

You never edit a file outside your ownership list. If a change requires one,
write a SHARED-FILE REQUEST block in your ledger and move on.

You never mark a claim verified because a spec document says it. The spec
documents are inputs to verify.
```

Duplicate for the other seven lanes, changing `description`, the `edit`
allow-list, and the domain sentence.

### `.opencode/agents/verify-independent.md`

```markdown
---
description: Independent counter-check. Receives a claim and a diff, re-researches from scratch, returns CONFIRM or REJECT.
mode: subagent
hidden: true
permission:
  edit: deny
  bash:
    "*": deny
    "npm run verify*": allow
    "npm test*": allow
    "git diff*": allow
    "git show*": allow
  websearch: allow
  webfetch: allow
  task: deny
---

You are a hostile reviewer. Your job is to find the reason a change is wrong.

You will be given: a CLAIM, a DIFF, and the file paths touched.
You will NOT be given the sources the implementing agent used. Do not ask
for them. If they appear in your context, ignore them.

Procedure:
1. Research the claim yourself, from scratch, using search wording that
   differs from anything in the claim text.
2. Reach at least two independent sources. Prefer first-party documentation
   over blogs and aggregators.
3. Read the diff. Check that it actually implements the claim, not something
   adjacent to it.
4. Run any machine checks in your bash allow-list.
5. Return exactly one verdict:
   - CONFIRM — claim verified AND diff implements it. Cite your own sources.
   - REJECT — with which of the two failed and why. Be specific.
   - UNVERIFIABLE — you could not reach two independent sources. This is
     NOT a pass. Say what you searched and what you found.

You have no edit permission. You never propose a fix. You judge.
```

### `opencode.json`

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "mg-orchestrator",
  "subagent_depth": 2,
  "permission": {
    "websearch": "allow",
    "webfetch": "allow",
    "external_directory": "deny",
    "doom_loop": "deny"
  }
}
```

**1.2.1 — On models.** <cite index="41-1">If you don't specify a model, primary agents use the globally configured model while subagents use the model of the primary agent that invoked them.</cite> Give `verify-independent` a *different* model from the lanes if you have one available. Two models disagreeing is a stronger signal than one model reviewing itself.

---

# PART 2 — THE THREE-PHASE PROTOCOL

**This runs for every single change. Not per stage. Not per file. Per change.**

## Phase 1 — GROUND (no edits permitted)

Before touching a file, the lane produces a **claim card**:

```
CLAIM-<lane>-<nnn>
  ASSERTION   One sentence, falsifiable, with a number where one exists.
  SPEC REF    Which doc and section asserts this.
  SOURCES     ≥2 independent, ≥1 first-party. URL + one-line paraphrase each.
  RE-VERIFIED Did the live source still say this? YES / CHANGED / WRONG.
  CURRENT     What the repo does now, with file:line and computed values.
  DELTA       Exactly what is wrong, in measurable terms.
  PLAN        Delete: <list>.  Replace with: <list>.
```

**Rules:**

- **P1.1 — No edit tool call may precede the claim card.** The lane's own
  permissions do not enforce this; the orchestrator checks the ledger
  ordering and reverts changes that lack a preceding card.
- **P1.2 — "The spec says so" is not a source.** If the live source has
  moved or contradicts the spec, `RE-VERIFIED: CHANGED` or `WRONG`, and the
  lane implements what the source says now, then flags the spec doc for
  amendment in its ledger.
- **P1.3 — Two independent sources minimum, one first-party.** A vendor's
  own docs plus a blog restating them is one source, not two.
- **P1.4 — `CURRENT` must contain a computed value, not a description.**
  "bars are misaligned" is not acceptable. "bar bottoms resolve to y=322;
  axis line occupies 358–362; 36 px gap" is.
- **P1.5 — If the claim cannot be grounded, it is not made.** Write
  `CLAIM-x-nnn: ABANDONED — could not verify` and move on. Do not implement
  on intuition and do not silently drop it.

## Phase 2 — CHANGE

- **P2.1 — Delete first, then write.** The user's instruction is explicit and
  it is correct: what is wrong gets removed, not wrapped, not flagged, not
  left behind a feature flag. Every change is a deletion plus a replacement.
- **P2.2 — One claim, one change, one commit.** Never batch two claims into
  one edit; the counter-check cannot isolate a failure in a batch.
- **P2.3 — The diff must be minimal.** Reformatting, renaming, or
  "while I'm here" edits inside a claim's diff are cause for REJECT.
- **P2.4 — Stay inside ownership.** A change that needs a shared file stops
  and files a SHARED-FILE REQUEST.
- **P2.5 — Record the diff hash in the ledger** before Phase 3, so the
  verifier is judging the exact bytes that were written.

## Phase 3 — COUNTER-CHECK (a different agent, a different session)

The lane invokes `verify-independent` via the Task tool with **only**:

```
CLAIM:  <the ASSERTION line, verbatim>
DIFF:   <git diff for this change>
FILES:  <paths touched>
GATES:  <which npm verify commands to run>
```

**Rules:**

- **P3.1 — The verifier does not receive the sources.** Passing them turns
  the counter-check into a rubber stamp. This is the single most important
  rule in the document.
- **P3.2 — The verifier must not reuse the researcher's search wording.**
  Required for independence, and required anyway to avoid `doom_loop`.
- **P3.3 — Two checks, not one.** Is the claim true? *And* does the diff
  implement the claim? A true claim implemented wrongly is a REJECT.
- **P3.4 — `UNVERIFIABLE` is not a pass.** It goes back to Phase 1 with a
  wider search, or the claim is abandoned and the change reverted.
- **P3.5 — On REJECT, the change is reverted, not patched.** Return to
  Phase 1 with the rejection text. Maximum two re-attempts per claim; after
  the second REJECT, escalate to the user with both rejection reasons.
- **P3.6 — The verifier's sources go in the ledger next to the
  researcher's.** If they cite different sources reaching the same
  conclusion, that is the strongest possible signal. If they cite the same
  single source, that is a weak pass and should be marked as such.

## 2.4 The ledger

`data/audit/<stage>/<lane>.ledger.md`, append-only:

```markdown
## CLAIM-layout-007
ASSERTION   Shorts safe area is 840x960 at x=48,y=288 per Google's vertical overlay.
SPEC REF    LAYOUT-SYSTEM §3.1
SOURCES     [1] first-party: <url> — "<paraphrase>"
            [2] third-party: <url> — "<paraphrase>"
RE-VERIFIED YES
CURRENT     SceneHeader at top:44,left:52 (mg.jsx:150). No file in repo
            contains 288, 888, or 1248.
DELTA       Kicker sits 244px above the top safe line.
PLAN        Delete SceneHeader absolute positioning. Replace with slot
            lookup from layout/slots.js.
DIFF        <hash>  +18 -6  layout/slots.js, layers/Layer.jsx
COUNTER     CONFIRM — verifier sources [3] <url>, [4] <url>. Gates L1,L2 pass.
            Note: verifier flagged that a third source gives 180/350/120/40;
            spec §3.1 already records this conflict. Accepted.
STATUS      LANDED
```

---

# PART 3 — WHAT EACH LANE MUST RESEARCH

Starting queries. Lanes are expected to go beyond these, and the verifier is
forbidden from reusing them.

**Sources of record** — a claim citing one of these counts as first-party:
`remotion.dev/docs/*` · `github.com/remotion-dev/skills` · `w3.org/WAI` and
`webaim.org` · `m3.material.io` and `material-components-android` docs ·
`lucide.dev/license` and `lucide.dev/contribute/icon-design-guide` ·
`developers.google.com` (Shorts safe-zone overlay) · Netflix and BBC subtitle
style guides · Cleveland & McGill (1984/1985) · `opencode.ai/docs/*`

| Lane | Must verify |
|---|---|
| `audit-layout` | Shorts safe-zone geometry and the conflict between sources; Remotion's 80px/100px layout floors; `measureText`/`fitText`/`fillTextBox` semantics; `useCurrentScale()` division for `getBoundingClientRect` |
| `audit-type` | 84px/44px minimums; Netflix 42-char line limit and the portrait ~60% reduction; CPS ceilings (17 vs 20 vs BBC ~15 — resolve the conflict); the 2-frame inter-cue gap; `validateFontIsLoaded`; `paint-order: stroke fill`; Remotion's subpixel-rendering page |
| `audit-color` | WCAG 4.5/3/7 thresholds and the no-rounding rule; the outline-as-foreground allowance; OKLCH perceptual uniformity; Material's dark-theme elevation-overlay range and why shadows fail on dark |
| `audit-motion` | Material duration slots; Remotion easing and `perceptual-scale`; `springTiming` `durationRestThreshold`; damping-ratio → overshoot relation; Figma's offset-shorter-than-duration rule; `CameraMotionBlur` shutter angle and sample cost |
| `audit-encoding` | Cleveland & McGill ranking and the 1.4–2.5× / 1.96× magnitudes; adjacent vs stacked bar findings; the modern replications *and their caveat* that context mediates effectiveness |
| `audit-audio` | −14 LUFS integrated for YouTube (verify current, it has changed before); Kenney pack licences; SFX-on-visual vs SFX-on-word timing practice; the existing `sfx-sourcing` SKILL.md rules |
| `audit-render` | That `remotion.config.js` does not apply to `renderMedia()`; `chromiumOptions.gl`; `imageFormat`, `crf`, `pixelFormat` defaults and ranges; `@remotion/captions` minimum version |
| `audit-assets` | Lucide's ISC licence and the separate Feather MIT notice; the 24px/2px/1px-padding construction spec; which vendored fonts expose `tnum` (verify by reading the GSUB table, not by asking the web); image resolution floor arithmetic |

**3.1 — Where my five documents and the live sources disagree, the live
source wins and the lane says so.** Log it as `RE-VERIFIED: CHANGED` and add
a `SPEC AMENDMENT` block. I expect at least a few — the docs were verified on
one date against sources that move.

---

# PART 4 — STAGES AND GATES

Sequential. The orchestrator runs one stage, gates it, reports, and stops.

| # | Stage | Lanes (parallel) | Gate |
|---|---|---|---|
| **0** | Preflight | orchestrator | `websearch` returns a live result; `subagent_depth: 2` confirmed; a throwaway `verify-independent` call returns a verdict |
| **1** | Dependency unblock | `audit-render`, `audit-assets` | render subpackage on `remotion@^4.0.503` + React 19; `@remotion/captions/transitions/paths/shapes/layout-utils/effects` installed; `inputProps` reaches the component; the generated-entry workaround deleted |
| **2** | Asset integrity | `audit-assets`, `audit-type` | every font in `channels.json` has a `.woff2`; `tnum` present or fallback flagged; 11 unused families removed; Lucide vendored with both licence notices |
| **3** | Colour system | `audit-color` | all 50 palettes derived from `baseHue`/`accentHue`; P1–P6 pass; zero hex literals; zero `#FFFFFF`/`#000000` |
| **4** | Slot table + lint | `audit-layout` | `layout/slots.js` exists; L1–L3 pass on fixtures; nothing in the repo positions by raw pixel |
| **5** | Measurement | `audit-type`, `audit-layout` | `measureText` throws on unloaded font; measure and render share one `fontStyle` object |
| **6** | Compiler | `audit-layout` | L1–L12 pass on all three existing scripts, all 12 mg channels |
| **7** | Layer + primitives | `audit-layout`, `audit-motion` | Tier 2 stills within ±2px; zero sibling flex in Stage/Headline/Caption |
| **8** | `PROGRESS` archetype | `audit-encoding`, `audit-motion` | L8, L9, L10 pass — the three chart bugs cannot recur |
| **9** | Remaining 7 archetypes | `audit-encoding`, `audit-motion` | 16 compositions render as stills; C10–C13, D11–D13 pass |
| **10** | Captions | `audit-type` | caption gates from MANUAL Part H; the 2-frame gap holds on every page |
| **11** | Counters + settles | `audit-motion`, `audit-type` | D4–D7, D14 pass; counter bounding box byte-identical across the count |
| **12** | Background + depth | `audit-color` | B2 density table applied; zero shadows; zero gradients; D8, D15 pass |
| **13** | Audio | `audit-audio` | one SFX per beat max; SFX on visual-land frames; −14 LUFS verified on a real render |
| **14** | Encoder + CI | `audit-render` | explicit `renderMedia` options; `remotion.config.js` deleted or annotated; matrix green on one channel |
| **15** | Delete-list sweep | all eight | `LAYOUT-SYSTEM` D1–D14 and `FINISH-SPEC` R01–R30 all grep-clean |
| **16** | Full render | orchestrator | one Short per mg channel; Tier 3 F1–F5, C14–C17 pass |

**4.1 — Stage 15 is a lane sweep, not a lane's job.** Each lane greps for the
deletions in its own domain and proves absence.

**4.2 — Gate failure never advances.** The orchestrator re-dispatches only
the failing lane, with the failure text, and the lane re-enters Phase 1.

**4.3 — No stage may be marked complete on a `UNVERIFIABLE`.**

---

# PART 5 — THE PROMPT TO PASTE

Everything above is configuration. This is what you actually send.

---

```
Read CROSSCHECK-PROTOCOL.md in full before doing anything else. Then read,
in this order: MOTION-BLUEPRINT.md, MOTION-GRAPHICS-MANUAL.md,
LAYOUT-SYSTEM.md, FINISH-SPEC.md, DETAIL-REFERENCE.md. Then read every
SKILL.md in .opencode/skills/.

Treat those five specs as claims to verify, not as instructions to follow.
They carry citations. Your job includes checking whether those citations
still say what they are quoted as saying.

You are running the staged rebuild in CROSSCHECK-PROTOCOL.md Part 4, for
style: "motion-graphics" only — the 12 channels listed at the top of
MOTION-GRAPHICS-MANUAL.md.

THE RULES, IN ORDER OF PRECEDENCE:

1. Every change follows the three phases in Part 2. Ground with live web
   research before the edit. Make the edit as a deletion plus a replacement.
   Counter-check with verify-independent after the edit. No exceptions, no
   batching, no "this one is obvious."

2. verify-independent NEVER receives your sources. Give it the claim, the
   diff, and the file paths. Nothing else. If it confirms using sources you
   did not find, that is a good outcome — record both.

3. Delete what is wrong. Do not comment it out, do not leave it behind a
   flag, do not write a wrapper around it. LAYOUT-SYSTEM Part 7 and
   FINISH-SPEC Part 6 are lists of things to remove. Remove them.

4. Never claim a visual works without a rendered PNG frame. Frame-by-frame
   ffmpeg contact sheets are the standard on this project, because render
   reports have proven unreliable here before.

5. Stay inside your lane's file ownership. Shared files go through the
   orchestrator between stages, never during. This repo has already had a
   parallel-agent shared-file collision that had to be reconciled by hand —
   do not reproduce it.

6. Report honestly. If a spec document is wrong, say so and cite what the
   live source says now. If you cannot verify something, say UNVERIFIABLE
   and stop — do not implement on intuition and do not quietly drop it.

7. Never merge to main without my explicit confirmation.

START WITH STAGE 0 ONLY.

Run the preflight checks. Confirm websearch returns a live result, confirm
subagent_depth is 2, and make one throwaway verify-independent call to prove
the counter-check path works end to end.

Then report:
  - the three preflight results
  - the eight lanes you will dispatch in Stage 1, and what each will verify
  - anything in the five spec docs you already believe is wrong

Then stop and wait for me. Do not begin Stage 1.
```

---

# PART 6 — HOW THIS FAILS, AND WHAT STOPS IT

Multi-agent verification loops fail in predictable ways. Each is addressed
above; this is the index so you can check the protocol is actually working
rather than performing.

| Failure | What it looks like | Guard |
|---|---|---|
| **Rubber-stamping** | verifier confirms everything | P3.1 — it never sees the sources; it must find its own |
| **Self-confirmation** | agent researches to justify a change it already decided | P1.1 — the claim card must precede the first edit tool call, and the orchestrator checks ordering |
| **Citation laundering** | vendor doc + three blogs restating it, counted as four sources | P1.3 — one restatement chain is one source |
| **Silent training-data answers** | agent "researches" without searching | §0.1 — `websearch` must be proven live at Stage 0 |
| **Batching** | six fixes in one diff, one counter-check | P2.2 — one claim, one change |
| **Scope creep in diffs** | a rename buried in a fix | P2.3 — REJECT on non-minimal diffs |
| **Lane collision** | two agents editing one file | §1.1 — exclusive ownership; shared files to the orchestrator |
| **Loop stall** | claim rejected repeatedly, agent keeps trying | P3.5 — two attempts, then escalate |
| **`UNVERIFIABLE` treated as pass** | the quiet killer | P3.4 and §4.3 |
| **Doom-loop trip** | identical query three times | §0.3 — verifier must vary wording |
| **Gate theatre** | gates that only check what was just written | Tier 1 checks L8–L10 encode the bugs that actually happened, not the code that was just added |

**6.1 — The honest limitation.** Two agents agreeing is not proof. It is two
draws from correlated distributions, especially on the same model — which is
why §1.2.1 recommends a different model for the verifier where possible, and
why P3.6 asks you to mark a pass as *weak* when both agents landed on the
same single source. Treat CONFIRM as "no one found a reason this is wrong,"
not as "this is right."

**6.2 — The gates are stronger than the agents.** Tier 1 lint runs in
milliseconds with no browser and no model. Where a rule can be moved out of
agent judgement and into `layout/lint.js`, move it. The agents are for the
things a linter cannot decide.

---

# PART 7 — SOURCES

**OpenCode (first-party):**
`opencode.ai/docs/agents/` — primary vs subagent, `mode`, `hidden`,
`permission.task` glob evaluation order ·
`opencode.ai/docs/config/` — `.opencode/agents/` markdown definitions,
`default_agent`, `subagent_depth` default of 1 ·
`opencode.ai/docs/tools/` and `open-code.ai/en/docs/tools` — built-in tool
list; **`websearch` requires the OpenCode provider or `OPENCODE_ENABLE_EXA`**;
websearch-for-discovery vs webfetch-for-retrieval ·
`opencode.ai/docs/permissions/` — permission keys including `task`, `skill`,
`websearch`, `external_directory`, and **`doom_loop` firing on three identical
tool calls**

**OpenCode (third-party, corroborating):**
`cefboud.com/posts/coding-agents-internals-opencode-deepdive/` — the Task
tool spins up a new session per subagent ·
`arceapps.com/blog/opencode-subagents/` — built-in subagent roles and
parallel use · `deepwiki.com/sst/opencode/5.3-built-in-tools` ·
`deepwiki.com/Kilo-Org/kilocode/7.5-web-fetch-tool` — webfetch permission
flow and limits

**Repo (read for this document):**
`.opencode/skills/*/SKILL.md` (all 15) · `PROMPT_FOR_OPENCODE.md` ·
`config/channels.json` · `src/skills/remotion-render/**` ·
project history: the three-worktree shared-file collision, the
never-clean-CI-run record, and the frame-by-frame contact-sheet standard
