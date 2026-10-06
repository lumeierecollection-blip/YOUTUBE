# Channel expansion handoff — fleet run logs read

## §1 — fleet run 37540546857, all ten channels, ten different outcomes

There is **no shared gate**. The fleet failed in five distinct ways:

| channel | exit | failure | class |
|---|---|---|---|
| **ch-1** | **143** | SIGTERM, killed. No render output at all. | **infra** |
| **ch-8** | **143** | SIGTERM, killed. | **infra** |
| ch-2 | 1 | `Visual planning failed (gemini, then ollama) — no plan, no render.` | **planner, whole chain exhausted** |
| ch-26 | 1 | same | **planner, whole chain exhausted** |
| ch-44 | 1 | `challenger rejected the plan twice` | plan rejected |
| ch-9 | 1 | `challenger rejected the plan twice` | plan rejected |
| ch-10 | 1 | `canvas checks FAILED` — children-learn-language-word-structure | Layer 1 |
| ch-5 | 1 | `canvas checks FAILED` — google-flow-music-vibe-coding-tools | Layer 1 |
| ch-49 | 1 | `canvas checks FAILED` — josh-hartnett-verity-middle-age | Layer 1 |
| ch-6 | 1 | `beat check FAILED` — us-india-trade-deal-impasse | beat check |

Every failure is at step `Render + QA`.

## §2 — ch-1 is fleet size, not a channel defect

ch-1 emits **no render output whatsoever** and exits 143 (SIGTERM). It ships
videos daily and passed every earlier run. Ten concurrent Remotion renders plus
an Ollama model per runner is beyond the runner's capacity, and two of the ten
were killed outright. This is §2c: an infrastructure change, out of scope for a
diagnostic push.

So ch-1's failure explains nothing about the new channels — and the four new
channels' Layer 1 failures are **not** explained by anything shared either:
ch-5, ch-10, ch-49 all fail `canvas checks FAILED`, ch-6 fails the beat check,
and the two `challenger rejected` failures are on built channels that render
fine individually.

## The finding that outranks all of it

**ch-2 and ch-26 both report `Visual planning failed (gemini, then ollama) — no
plan, no render.`** That is the entire chain exhausted: the Gemini director and
then the local Ollama fallback both failed to produce a plan. Everything else in
this table is downstream of a render; this is upstream of it and means two built
channels produced no video at all.

This is now the highest-value read available, and it was not in scope. The log
shows `ollama/qwen2.5:3b` in the chain, so the fallback engaged and still
produced nothing. Whether that is quota, a schema rejection, or the fleet's
parallel load starving the local model is unread — ch-2's log is 310 KB and the
relevant lines were not isolated before context ran out.

## Next, in order

1. **Read ch-2's and ch-26's planner failure** from run 37540546857. Whole-chain
   planner exhaustion on two built channels is a bigger wall than anything the
   new channels are hitting.
2. **Do not run the fleet again.** Two of ten were SIGTERMed on runner capacity.
   Single channel or at most two per dispatch.
3. **Re-run ch-10 individually** (`off` → `dry` → `live`). Its only prior failure
   was `canvas_accent`, fixed in 436d321. Cheapest end-to-end test.
4. **Re-run ch-05 individually** after the advisory demotion (6da8809). Its
   fleet result is pre-demotion and says nothing.
5. **Note the topic churn**: every channel drew a different topic this run
   (ch-5 got `google-flow-music-vibe-coding-tools`, ch-10 got
   `children-learn-language-word-structure`). A "newspaper history" channel and a
   "video editing tools" topic is a topic-selection mismatch, separate from the
   render failures and probably worth its own look.

## Still open

- Layer 2 and Layer 3 have never run in CI on any channel.
- The beat-index resolver gap, unfixed.
- `config/channels.json` mojibake, unfixed by instruction.