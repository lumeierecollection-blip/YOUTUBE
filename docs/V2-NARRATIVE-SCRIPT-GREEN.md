# Narrative Script — Final Report

Date: 2026-10-03
HEAD: 542b7f9 (main)
Runs: 2 — 37141128792 (run 1, HEAD 27fa1b8) and 37143472688 (run 2, HEAD 542b7f9). The
two-run cap is reached.

**Result: the narrative engine is built and enforced, but the scripts it produced do NOT meet
the structure.** The validators catch it on every channel. The root cause is the model, not
the rules: the script stage runs on `ollama/qwen2.5:3b` (a 3-billion-parameter local model,
`OPENCODE_MODELS_REASONING` in daily-pipeline-v2.yml). It copies the prompt's own example
("But the payoff isn't the rate. It's the timing." appears verbatim in three scripts),
repeats sentences between beats, and ignores the bans after the one re-ask.

## What was built

- `prompts/write-script.md`: five beats as five sections (hook / setup / rehook / payoff /
  close), a word budget per beat, the voice rules, banned openings and phrases. Grounding is
  unchanged: every fact still comes from this video's research.
- `scripts/validate-script-narrative.cjs`: per-beat checks, as specified.
- `scripts/validate-script-voice.cjs`: the voice rules.
- `scripts/validate-script-story.cjs`: runs both validators plus the specificity check. Any
  failure gets one re-ask with every failing beat and sentence marked. If it still fails, the
  result is logged to `data/ci-runs/blocked-script-{narrative,voice,specificity}-<ch>.txt`
  and the run continues.
- Shorts length moved to 92–107 words (36–52 s at the gate's rate), so the
  five beats fit. Over-long scripts are trimmed by whole sentences, never a beat's key line.
- Run 1 found a bug: the first check dropped the channel argument and validated an empty
  script, so its re-ask carried no real feedback. It was fixed and regression-tested before
  run 2.

## Per channel

Latest script per channel: run 2 for ch-1 / 2 / 26 / 44; run 1 for ch-9 and ch-48. In run 2, ch-9
failed at topic discovery and ch-48 failed the citation gate, so neither kept a script.

| Ch | Hook | Setup | Re-hook | Payoff | Close | Banned | Long | Name-starts |
|---|---|---|---|---|---|---|---|---|
| 1 | FAIL (person's name first) | FAIL (last line leaves no question) | PASS | FAIL (names no person / place / org) | PASS | 0 | 0 | 1 |
| 2 | FAIL (2 sentences) | FAIL (names nothing specific) | PASS | FAIL (no number) | FAIL (no action or number) | 0 | 0 | 0 |
| 9 | PASS | FAIL (last line leaves no question) | PASS | FAIL (hedged "could") | FAIL ("Stay informed") | 0 | 0 | 0 |
| 26 | FAIL (person's name first) | FAIL (last line leaves no question) | — | — | — | 0* | 3 | 2 |
| 44 | PASS | FAIL (names nothing specific) | PASS | FAIL (no number; no person, place or org) | FAIL (no action or number) | 0 | 1 | 0 |
| 48 | PASS | FAIL (last line leaves no question) | PASS | — | — | 0 | 1 | 0 |

"—": not recorded. The saved summary line for this channel is cut off at that point, and the
verdict is not guessed here. ch-26's voice check lists 9 failures, ch-48's lists 1.

* ch-26 ends sentences with "…, according to the arrest announcement". The voice rule bans
"According to" as an OPENING, so a trailing use is not counted. That is a gap in the
validator, noted.

Where re-hook passes, it passes only because the beat contains a flip word ("But…"). In ch-1,
ch-9 and ch-48 that word comes from the prompt's example, copied verbatim. The validator checks
words, not meaning, and says so in its header.

## Full scripts

### ch-1

run 2 (37143472688) — `the-50-30-20-budget-rule-explained-2026-2-shorts`, 112 words

> **HOOK** — Senator Elizabeth Warren popularized the 50/30/20 budget rule in her 2005 book All Your Worth.
>
> **SETUP** — The 50/30/20 rule suggests allocating 50% of after-tax income to essential expenses, 30% to wants, and 20% to savings and debt payments.
>
> **REHOOK** — But the payoff isn't the rate. It's the timing. The 50/30/20 rule is a flexible starting point, not a strict rule, and can be adjusted to fit individual income and expenses.
>
> **PAYOFF** — The 50/30/20 rule is a flexible starting point, not a strict rule, and can be adjusted to fit individual income and expenses. It's a great way to manage your finances and save money.
>
> **CLOSE** — Start applying the 50/30/20 rule today and watch your finances improve.

### ch-2

run 2 (37143472688) — `new-york-court-rules-ice-employment-claims-shorts`, 96 words

> **HOOK** — A New York court just ruled that undocumented workers can sue for lost wages if they are injured on the job. This is a significant victory for undocumented workers.
>
> **SETUP** — But the real issue is that the employer is not liable for the undocumented worker's injury.
>
> **REHOOK** — This ruling is a significant victory for undocumented workers. But the real issue is that the employer is not liable for the undocumented worker's injury.
>
> **PAYOFF** — This is a clear violation of the New York City Human Rights Law.
>
> **CLOSE** — This is a clear violation of the New York City Human Rights Law.

### ch-9

run 1 (37141128792) — `new-geography-luzon-economic-corridor-shorts`, 98 words

> **HOOK** — The UK's investment insights in the Philippines could unlock a $1 billion project in the Luzon Economic Corridor.
>
> **SETUP** — Renewable energy is a major area of interest for UK investment in the Luzon Economic Corridor, including projects in Subic, Clark, Manila, and Batangas.
>
> **REHOOK** — But the payoff isn't the rate. It's the timing.
>
> **PAYOFF** — The UK has already invested $186 million in flagship infrastructure projects in the Philippines. This investment could unlock a $1 billion project in the Luzon Economic Corridor.
>
> **CLOSE** — Stay informed about the UK's role in the Philippines and the potential $1 billion project in the Luzon Economic Corridor.

### ch-26

run 2 (37143472688) — `greg-lui-ai-tech-smuggling-shorts`, 120 words

> **HOOK** — Greg Lui, a tech company owner, was arrested for smuggling over $300 million worth of export-controlled servers to China.
>
> **SETUP** — Greg Lui, a 38-year-old San Gabriel Valley-based technology company owner, was arrested for allegedly smuggling more than $300 million worth of export-controlled computer servers to China, according to the arrest announcement.
>
> **REHOOK** — The arrested man used his company to buy and send items to China without the licenses required by the Department of Commerce, according to the arrest announcement.
>
> **PAYOFF** — The total value of the smuggled items was over $300 million, according to the arrest announcement.
>
> **CLOSE** — The arrested man used his company to buy and send items to China without the licenses required by the Department of Commerce, according to the arrest announcement.

### ch-44

run 2 (37143472688) — `virtual-negotiations-2026-shorts`, 107 words

> **HOOK** — Virtual negotiations are expected to become the norm in 2026, driven by the increasing use of digital tools and the need for remote collaboration.
>
> **SETUP** — This shift towards virtual negotiations is expected to fundamentally change how businesses conduct their negotiations in the future.
>
> **REHOOK** — But the real kicker is that chatbot negotiations are expected to become a significant part of virtual negotiations in 2026, thanks to AI guiding buyer-seller interactions.
>
> **PAYOFF** — This shift towards virtual negotiations will fundamentally change how businesses conduct their negotiations in the future.
>
> **CLOSE** — As a result, businesses need to be prepared for the rise of virtual negotiations and the role of AI in shaping these interactions.

### ch-48

run 1 (37141128792) — `posco-robot-test-manual-gap-202-shorts`, 121 words

> **HOOK** — A startup founded by researchers from DGIST won a $1 million contract to automate a steel mill task.
>
> **SETUP** — The Daegu Gyeongbuk Institute of Science and Technology (DGIST) announced that MFR, a startup founded by one of its researchers, had won a contract to supply unmanned automated robots for the shipping yard at a POSCO steel mill.
>
> **REHOOK** — But the payoff isn't the rate. It's the timing. The contract was awarded in just 6 months after the initial announcement.
>
> **PAYOFF** — MFR will begin implementing the robots in 12 months, starting with a pilot project. The goal is to automate 20% of the tasks by the end of the year.
>
> **CLOSE** — This contract could revolutionize the way steel mills operate, reducing human labor and increasing efficiency.

## Remaining blockers

- **The script model.** qwen2.5:3b cannot follow a narrative brief. The fix is to route the
  script stage to Gemini, which the planner already calls through `src/lib/gemini-client.js`
  with the CI keys (`ollama-agent.js` has no Gemini path today). Not done here: it would
  have shipped untested to main after the two-run cap.
- **The verbatim example.** The prompt's example re-hook is copied word for word. Remove it, or
  keep it only once a capable model writes the scripts.
- **Validator gap.** "according to" at the end of a sentence is not caught.
- **Prep failures before the script stage** (topic duplicates, research citation gate):
  ch-9 in run 2, ch-48 in run 2 (SCR-14, a cited URL not in the research), and ch-44 / ch-1
  in run 1 (length, since fixed).
