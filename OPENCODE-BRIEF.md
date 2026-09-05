# Brief for OpenCode — what this repo is, where it stands, what to do next

Written 2026-09-05, at commit `f97f759` on `main`.

`PROMPT_FOR_OPENCODE.md` is the ORIGINAL bootstrap prompt from before any of
this existed. It is kept as a record of the intent and is no longer a work
order. **This file is the work order.** Read `CLAUDE.md` and `PLAN.md` too;
they carry the hard rules, and the hard rules are not negotiable.

---

## 1. What is being built

17 automated YouTube channels, each with its own niche, visual style and
config in `config/channels.json`. A GitHub Actions cron
(`.github/workflows/daily-pipeline.yml`, 06:00 UTC, **fires only on `main`**)
runs the whole thing per channel: research a topic, write a script, generate
a voiceover, render a video with Remotion, upload private, auto-publish after
the channel's delay.

The three pipeline stages all run through `scripts/opencode-agent.js`, which
drives `opencode run` — you. So you are two things in this repo at once: the
engineer editing it, and the runtime it calls. Do not confuse the two. The
pipeline's own agents are scoped in `.opencode/agents/pipeline-*.md` with
`read` denied, deliberately, so they cannot load repo docs and confuse
themselves about which stage they are in.

## 2. The hard rules

These are not style preferences. Breaking one is worse than shipping nothing.

- **No fact, statistic, claim, image or sound that did not come from a real
  fetched source.** A topic that cannot be grounded gets skipped, not
  invented.
- **Every claim in a script traces to `sources_used`, and every URL there
  appears in the research artifact.** Gated by `scripts/gate-script.js`.
- **Never loosen a schema or skip a gate to make a run pass.** Fix what is
  producing bad output. If a gate is wrong, prove it is wrong with a
  measurement, then change it and say so in `CHECK-REGISTER.md`.
- **Never claim a visual works without a rendered frame to point at.**
  "Should work" is not evidence. This repo has been burned by that
  specifically.
- **Never merge to `main` without explicit human confirmation.** The cron is
  inert on any other branch, which is the safety valve during development.
- Colour lives in `config/channels.json` and `config/visual-identity.json`,
  never in a script or a generated string.
- `CHECK-REGISTER.md` is the single source of truth for check IDs. Extend the
  namespace table in §0.3; never invent a parallel ID scheme.

## 3. What just landed, and why it existed

Two videos from two different channels looked like the same video in two
colourways. The diagnosis was that the renderer was making the visual
decisions at render time from generic strategy code, so every channel
converged on the same look. The fix is a two-stage architecture, specified in
a 9-section addendum and now built:

- **Design time.** Each channel gets a Visual Identity Specification
  (`config/visual-identity.json`, schema in `schemas/visual-identity.json`,
  derived from real cited references under `docs/style-reference/`), plus
  static scene templates per (channel, strategy) pair in `config/templates/`.
- **Run time.** `scripts/build-visual-plan.js` reads the script, picks the
  template for that beat's strategy, fills only the declared parameters from
  the script's own sentences, and emits a plan. The renderer
  (`src/skills/remotion-render/compositions/template-scene.jsx`) is a pure
  function of that plan — it contains no channel id and no strategy name, and
  a test enforces that.

**Section 3's abort is real and must stay real.** A beat whose (channel,
strategy) pair has no template stops the run. There is no generic template and
no nearest match. With 48 pairs still missing, a fallback would silently
become the entire system, which is exactly the monoculture this rebuild
exists to end.

The acceptance test was three renders — Money Mind, Legal Brief, Geopolitical
— proving they cannot be mistaken for each other. They pass. Stills and clips
are under `data/renders/plan/`. The full account, including the two bugs the
first attempt shipped, is `CHECK-REGISTER.md` §3.16.

## 4. Where it actually stands

| Thing | State |
|---|---|
| Channels with a Visual Identity Specification | 3 of 17 |
| Specs signed `human_validated` | 0 of 3 |
| (channel, strategy) templates | 3 of 51 across those 3 channels |
| Renderer, plan builder, gates | built, tested, on `main` |
| QA checks 7.1 / 7.2 / 7.5 / 7.6 | pass on all three renders |
| QA checks 7.3 / 7.4 (vision) | never executed — no key has ever reached a run |

Channels with no identity spec: ch-03, ch-04, ch-07, ch-11, ch-17, ch-26,
ch-30, ch-31, ch-35, ch-39, ch-44, ch-46, ch-47, ch-48.

Two gates are red **by design**, and neither is a bug to fix in code:

- `scripts/gate-visual-identity.js` fails VID-04 on all three specs because
  `human_validated` is absent. Section 2 forbids automated generation of
  these values; a human has to read the spec and sign it. Do not add the
  field yourself.
- `scripts/gate-visual-qa.js` rejects every render on 7.3 and 7.4 because no
  vision key is present. An unrun check is not a passed check.

## 5. APIs and keys

**Model providers.** Five, one model each, tried in order by
`scripts/opencode-agent.js` — not by OpenCode's own config, which cannot
express a fallback list (`Config.model` is a single string; see
`PROVIDER-ROUTING.md` for the schema quote). Two chains, split by stage, in
`daily-pipeline.yml`:

- `OPENCODE_MODELS_RESEARCH` — Stages A and B, cheapest first, tool-calling
  for websearch. Zen free tier, then Mistral, Groq, Google, Cerebras.
- `OPENCODE_MODELS_REASONING` — Stage C, ordered by how granular a reasoning
  control the provider exposes, then by price.

Keys referenced by the workflows: `OPENCODE_API_KEY`, `CEREBRAS_API_KEY`,
`GROQ_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`.

**Search comes from OpenCode, not from the model provider.** Cerebras's API
has no built-in search; OpenCode supplies a real Exa-backed `websearch`,
enabled by `OPENCODE_ENABLE_EXA=1`. That is what keeps the grounding rule true
after the provider switch. Page fetching is denied outright and searches are
capped at 1–2 calls with `numResults: 6` — the free tier rate-limits
tokens-per-minute **account-wide**, so both models return the same quota error
at once and failover does not escape it. Loosening any of those caps brings
the limit straight back.

**Vision, for QA 7.3 and 7.4.** Set as repository variables plus one secret:

```
VISION_API_BASE = https://generativelanguage.googleapis.com/v1beta/openai
VISION_MODEL    = gemini-2.5-flash
VISION_API_KEY  = (secret)
```

That base is Google's OpenAI-compatible surface and was chosen on
measurement, not preference: POSTing the exact body the gate builds, with a
deliberately invalid key, returns `400 Please pass a valid API key` — path,
method and payload accepted. `opencode.ai/zen/v1` also works as a base if you
prefer it; it was simply unreachable from the sandbox where this was written.

**Asset APIs are unreachable and no photo path exists.** Pexels, Pixabay,
Wikimedia and Unsplash all returned `000` from the development sandbox and no
keys were set. Section 4.1 of the addendum permits three kinds of visual —
real photographs from approved sources, procedural graphics, and typography —
so the objects in `compositions/objects/index.jsx` are procedural. That is the
second-ranked option in the spec's own hierarchy, not a workaround. If you get
real asset keys working, the photo path becomes available again and 7.6 stops
being vacuous.

## 6. What to do next, in order

1. **Get the three specs signed.** Read
   `docs/style-reference/ch-0{1,2,9}-motion-graphics.md`, check each field
   against its cited references, and have the human add `human_validated`.
   Nothing downstream should be trusted until a person has looked at these.
2. **Turn on vision QA.** Set the three variables above, run the visual QA
   loop, and see what 7.3 and 7.4 actually say about the three renders. They
   may well disagree with the four measured checks. That disagreement is the
   most valuable signal available right now.
3. **Write templates for the remaining 48 pairs on the three live channels.**
   `node scripts/gate-scene-templates.js --coverage` lists them. Each one
   needs an intent, an environment, objects drawn from that channel's
   `core_objects`, a camera path from its `camera_language`, and typography
   in its declared placement. `gate-scene-templates.js` enforces all of it.
   Add the procedural object drawings each new template needs —
   `ObjectShape` throws on an unknown object rather than omitting it.
4. **Write identity specs for the other 14 channels.**
   `scripts/research-style.mjs` runs the section-1 research phase and writes
   `UNRESOLVED` rather than guessing. Fill the gaps from real references.
   Note that 11 of the 14 are `cinematic-documentary` or `minimal`, and every
   template and object built so far is `motion-graphics` — those two styles
   will need their own object vocabulary, not a reskin of this one.
5. **Decide how the new engine reaches production.** It currently runs only
   through `qa-scripts/render-plan.mjs`. Nothing in the daily pipeline calls
   it yet. Flag-gate it per channel so a channel with full template coverage
   uses it and the rest keep the old path, rather than switching all 17 at
   once.

## 7. Known-open, stated plainly

- An object drawn on top of **another object's** paper uses the paper mark
  colour and would be near-invisible if a template placed it alone on a dark
  ground. Nothing detects this; the renderer cannot know what a template
  stacked.
- `data/renders/plan/` is gitignored. Re-render rather than expecting the
  frames to be in a clone.
- `npm run test-config` is broken on `main` — it points at
  `src/utils/test-config.js`, which does not exist. Pre-existing, unrelated to
  the visual work, not yet triaged.
- `.opencode/skills/*/SKILL.md` has not been migrated to `.claude/skills/`.
  Scoped out deliberately; see the script-pipeline rebuild notes.

## 8. Commands

```
node scripts/gate-visual-identity.js                 # VID — the specs
node scripts/gate-scene-templates.js                 # TPL — the templates
node scripts/gate-scene-templates.js --coverage      # what is still missing
node scripts/build-visual-plan.js --channel ch-01 \
     --script <script.json> --out data/plans/x.plan.txt
node src/skills/remotion-render/qa-scripts/render-plan.mjs \
     --plan data/plans/x.plan.json --still
node scripts/gate-visual-qa.js --channel ch-01 \
     --video <mp4> --plan <plan.json>                # VQA — section 7
node src/skills/remotion-render/visual/run-visual-tests.js   # 78 checks
```
