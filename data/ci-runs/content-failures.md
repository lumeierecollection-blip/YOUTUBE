# Content failures (not tooling bugs)

Run 36343146799 (HEAD 97e9475, 2026-09-27, dry run). Sentences come from
each render's `-beat-check.json`; reasons are the checker's own words.
These videos failed an AI stage on what they show or say, not because of
sampling, layout maths or transport.

## Beat check — the frame does not show what the sentence says

Every failing beat below is the same pattern: an abstract composition
(grid panel, bars, blocks, labels) where the sentence names a concrete
thing (an app, a study, a border clash, an oil company's money).

| Ch | Beat | Sentence | Checker's reason |
|---|---|---|---|
| 1 | 1 | Let's dive into the top personal finance apps for 2026. | abstract grid lines and labels; no apps shown |
| 1 | 2 | First up, Monarch Money. | generic labeled box, not the app |
| 1 | 3 | Next, we have YNAB (You Need a Budget) with its hands-on zero-based budgeting features. | abstract bars, not zero-based budgeting |
| 1 | 4 | And finally, Goodbudget stands out with its hands-on envelope budgeting features. | abstract green block, not envelopes |
| 1 | 5 | These apps simplify budgeting and saving, making money management easier for everyone. | generic icons and labels |
| 9 | 1 | In 2025, the border dispute between Cambodia and Thailand escalated to a brutal conflict, resulting in over 100 deaths… | abstract charts and labels summarising the sentence |
| 9 | 2 | Despite the 1962 ruling, the border remained contentious, leading to renewed fighting in 2025… | abstract shapes and a label |
| 9 | 3 | The conflict … disrupted the livelihoods of those living near the border… | generic chart elements |
| 9 | 4 | The border dispute … is a complex issue with historical roots, recent developments, and ongoing consequences. | abstract geometric icons and labels |
| 26 | 1 | …how Rosneft, a major Russian oil company, funneled billions of dollars to the Kremlin-backed A7 company… | no depiction of oil, money flow or imports |
| 26 | 2 | The Financial Times investigation revealed that billions of dollars in foreign earnings from Rosneft helped finance… A7… | text labels and a generic document icon |
| 26 | 3 | A7 used billions of dollars in foreign currency from Rosneft to conduct international transactions despite Western sanctions… | abstract diagrams; SWIFT bypass not communicated |
| 26 | 4 | Rosneft's foreign earnings were crucial in enabling the Kremlin's financial operations… | generic dashboard UI elements |
| 44 | 1 | …how AI chatbots are causing unexpected communication tensions in the workplace. | abstract shapes and labels |
| 44 | 2 | …a study in Nature Communications found that AI-supported chatbots can lead to misunderstandings and team distrust. | abstract UI blocks and labels |
| 44 | 3 | Another study in Frontiers in Psychology revealed that miscommunications caused by AI agents can severely impact team trust. | abstract geometric shapes and labels |
| 44 | 4 | …a recent arXiv.org research highlighted that generative AI can become challenging to process in real-world conversations. | generic document and block icons |
| 44 | 5 | …as AI integration grows, so does the potential for communication breakdowns. | generic arrows and chevrons |

## Frame review — whole video

| Ch | Verdict |
|---|---|
| 2 | NEEDS_IMPROVEMENT — whole-video FAIL (CRITICAL) 3/10: "relies heavily on repetitive, abstract vector templates and static text screens rather than a continuous, engaging visual argument" |

## Challenger — plan contradicts the sentence (twice)

| Ch | Beat | Issue |
|---|---|---|
| 48 | 3 | CONTRADICTION. **The script itself states that ISO 9001:2015 was published in 2026** — a factual error in the script, which the plan then drew (a "6th edition" stack). This should have been caught before the script stage, under CLAUDE.md's "every claim traces to a source" rule; it needs a look at ch-48's research and script gates, not the visuals. |

## Local audit — frames-centered (the backup verdict for 26 and 48)

The crop is correctly placed now (97e9475). The frame's true centre lands
in the **gutter between laid-out objects**: the portrait slot grid from
674b27c stacks objects (1x2 / 2x2), so on dark channels the centre 150x150
is background (ch-26 beats 1 and 3: 3.1 / 4.0 vs 0.0; ch-48 beat 1: 4.2 vs
0.0, threshold > 5). That's a composition-layout outcome. It was not
changed: layout is outside the categories cleared for this loop.

## Run 36390736594 — ch 9 (geography-demographics-shaping-china)
- Challenger rejected the plan twice: beat 1 CONTRADICTION, beat 4 CONTRADICTION.
- Cause is the script, not the plan: it says China's population declines by
  "25 million" in one sentence and "250 million" in another. Not fixed in
  the render path — a plan cannot reconcile two figures the script states.
