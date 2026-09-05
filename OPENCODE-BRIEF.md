# Brief for OpenCode — what this repo is, where it stands, what to do next

Written 2026-09-05, at commit `f97f759` on `main`.

`PROMPT_FOR_OPENCODE.md` is the ORIGINAL bootstrap prompt from before any of
this existed. It is kept as a record of the intent and is no longer a work
order. **This file is the work order.** `CLAUDE.md` and `PLAN.md` carry the
project's background and conventions.

**You have full build authority here.** Most of this system does not exist
yet — 14 channels have no visual identity, 48 template pairs are unwritten,
whole style families have no object vocabulary. Create them. Write new specs,
new templates, new object primitives, new gates, new scripts, new schemas,
whatever the work needs. Nothing below is a list of things you may not do; it
is a description of what is here, what has been measured, and where the
biggest gaps are. Where this brief and your own judgement disagree, back your
judgement with a measurement and go.

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
engineer editing it, and the runtime it calls. Worth holding both in mind,
because you can improve the runtime from the engineer's seat. The pipeline's
own agents are scoped in `.opencode/agents/pipeline-*.md` with `read` denied,
which was done because an agent that could read repo docs started confusing
itself about which stage it was in. Rescope them if you have a better
arrangement.

## 2. The one thing that is actually load-bearing

The output is factual video. Every fact, statistic, claim, image and sound in
a finished video has to come from a real fetched source, and every claim in a
script has to trace to a URL that appears in the research artifact. That is
what `scripts/gate-script.js` checks. It is the product, not a restriction on
your engineering.

Everything else is convention, and conventions are yours to change when you
have a reason:

- **Gates and schemas are editable.** If one is wrong, measure it, change it,
  and record what you found in `CHECK-REGISTER.md`. Extending the namespace
  table in §0.3 keeps the check IDs coherent.
- **A rendered frame beats an argument.** Whenever you change something
  visual, render it and look. This repo has shipped bugs that only a frame
  revealed — see `CHECK-REGISTER.md` §3.16 for two of them.
- **Colour lives in `config/channels.json` and `config/visual-identity.json`**
  so a channel's look is editable in one place. Add fields there freely.
- **`main` is where the 06:00 UTC cron fires**, so it is the branch that ships
  to real channels. Work on a branch, merge deliberately.

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

**How the missing-template case behaves today.** A beat whose (channel,
strategy) pair has no template stops the run rather than falling back to a
generic scene. That was chosen because with 48 pairs missing, a fallback would
have silently become the whole system — the exact monoculture the rebuild
existed to end. The fastest way past it is to write the templates; if you find
a better answer than a hard stop, build it.

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

Two gates are red for reasons that are not code defects:

- `scripts/gate-visual-identity.js` fails VID-04 on all three specs because
  `human_validated` is absent. The field exists so a person can confirm the
  spec matches the references it claims to come from. It is not blocking any
  engineering — write specs, templates and renders freely while it sits
  unsigned.
- `scripts/gate-visual-qa.js` rejects every render on 7.3 and 7.4 because no
  vision key is present. It reports an unrun check as a failure so a missing
  key never reads as a pass. Supply the key and both start returning real
  verdicts.

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

**Asset APIs were unreachable from the sandbox this was built in.** Pexels,
Pixabay, Wikimedia and Unsplash all returned `000` there with no keys set, so
the objects in `compositions/objects/index.jsx` are procedural graphics. Your
machine may well reach them. If it does, wire the photo path back up — the
addendum treats real photographs as the first-ranked visual — and QA 7.6 stops
being vacuous. Procedural, photographic and typographic objects can coexist.

## 6. The biggest gaps, roughly in order of leverage

This is where the work is, not a queue you have to follow. Reorder it, split
it, or go after something not on it.

1. **Get the three specs signed.** Read
   `docs/style-reference/ch-0{1,2,9}-motion-graphics.md` and check each field
   against its cited references. `human_validated` is the field that clears
   VID-04 once someone is satisfied the spec matches its sources.
2. **Turn on vision QA.** Set the three variables above, run the visual QA
   loop, and see what 7.3 and 7.4 actually say about the three renders. They
   may well disagree with the four measured checks. That disagreement is the
   most valuable signal available right now.
3. **Write templates for the remaining 48 pairs on the three live channels.**
   `node scripts/gate-scene-templates.js --coverage` lists them. Each one
   needs an intent, an environment, objects drawn from that channel's
   `core_objects`, a camera path from its `camera_language`, and typography
   in its declared placement. `gate-scene-templates.js` checks all of it.
   Write the object drawings each new template needs, in
   `compositions/objects/index.jsx` — `ObjectShape` throws on an unknown name
   so a missing drawing is loud rather than an empty frame. Invent new object
   types freely; add them to the channel's `core_objects` and they are legal.
4. **Write identity specs for the other 14 channels.**
   `scripts/research-style.mjs` runs the section-1 research phase and marks
   what it could not source as `UNRESOLVED` so you can see the gaps. Eleven of
   the 14 are `cinematic-documentary` or `minimal`, while every template and
   object so far is `motion-graphics`. Those two styles want their own object
   vocabulary and probably their own renderer primitives — a genuinely open
   design problem, and the most interesting thing on this list. Extend
   `schemas/visual-identity.json` if the current 12 fields do not describe
   them well.
5. **Wire the new engine into production.** It currently runs only through
   `qa-scripts/render-plan.mjs`; nothing in the daily pipeline calls it. A
   per-channel flag would let a fully templated channel use it while the rest
   keep the old path, but the rollout shape is yours to choose.

## 7. Loose ends worth knowing about

- An object drawn on top of **another object's** paper uses the paper mark
  colour and would be near-invisible if a template placed it alone on a dark
  ground. Nothing detects this today. A per-object declaration of which
  surface it sits on would fix it properly.
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
