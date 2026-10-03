# Script hook formulas and retention rules

Extracted 2026-10-03 from the yt-hook-scripter skill (sergebulaev/youtube-skills,
MIT, commit e922430; installed at `.claude/skills/yt-hook-scripter/`). Quotes are
verbatim; the "How this repo applies it" lines are ours. The pipeline's script
stage gets these rules through `prompts/write-script.md` and is checked by
`scripts/validate-script.cjs`.

## 1. The Shorts 3-second hook (Y10)

> **Goal: retention.** A Short lives or dies in the first 3 seconds and on the loop.
> Open on the single most arresting frame or line, no setup, and write so the end
> flows back into the start.
>
> ```
> {One spoken line or on-screen text that states the payoff or the tension on frame one.}
> ```
>
> **Why:** There is no patience on the Shorts feed. The first frame is the entire
> funnel: it must state the stakes or the payoff before the thumb flicks. Designing
> the ending to imply the beginning makes the Short loop, and loop-throughs are the
> strongest Shorts signal.
>
> **Warning:** No logo sting, no "what's up guys", no slow zoom-in. Any second
> spent on intro is watch-time you will never get back. Put on-screen text on the
> hook line so it lands with the sound off.

How this repo applies it: the hook (beat 0) states the research's single most
specific fact (a named person, place, organization or number) in its first
sentence. The hook beat renders as typography (owner's spec), so it lands muted.

## 2. Specificity rules

From the hook micro-rules:

> - **Open mid-action.** The first spoken second should never be a greeting. Drop
>   the viewer into the promise.
> - **One specific number** in the title or first line raises CTR and sets a watch-
>   contract. "in 28 days" beats "fast".

From the skill's hard rules ("Never invent the specifics"):

> The rules below ask for a concrete number, a date and a named entity, because
> that is what separates a real post from a generated one. [...] **Do not invent a
> figure, a date, a client name or a result, and do not soften a vague claim into a
> plausible-looking number.** If the user has nothing concrete for a beat, ask them
> once, and if they still have nothing, drop the claim rather than decorate it. A
> published invented number is a retraction; a missing one is only a weaker post.

How this repo applies it: every sentence names a person, place, organization,
number or physical object, **taken from the research artifact** (CLAUDE.md's
grounding rule and SCR-14 are unchanged). If the research has no specific for a
sentence, the sentence is cut, never decorated with an invented name or number.

From the skill's humanizer pass (the source of part of our banned-phrase list):

> strip reveal bridges ("Here's what nobody tells you") and sincerity openers
> ("not gonna lie", "let me be honest")

## 3. Pairing table (title -> opening hook)

> | Title formula | Pair with | Why |
> |---|---|---|
> | Y1 Curiosity-Gap | Y7 Restate-and-Raise | confirm the gap is real, then widen it |
> | Y2 Number / Listicle | Y9 Question-and-Contract | promise the list payoff plus a bonus |
> | Y3 How-I Outcome | Y8 Cold-Open Payoff | show the result first, then the steps |
> | Y4 Mistake / Negativity | Y7 Restate-and-Raise | name the cost, then the fix |
> | Y5 Transformation | Y8 Cold-Open Payoff | flash the after, cut to the before |
> | Y6 Versus / Comparison | Y9 Question-and-Contract | answer "which wins" fast, then the nuance |
> | Y11 Third-Party Success Story | Y8 Cold-Open Payoff | flash the outsized result, then trace how they got there |
> | Any Short | Y10 Shorts 3-Second | the title matters less; the first frame is everything |

How this repo applies it: every output is a Short, so the opening is always Y10.

---

## 4. The Shorts beat structure (retention-beats.md)

> | Time | Beat | What it does |
> |---|---|---|
> | 0:00 - 0:01 | **Frame-one hook** | the single most arresting line or visual, with on-screen text. State payoff or tension immediately. |
> | 0:01 - 0:03 | **Confirm the stakes** | one line that makes the viewer need the resolution. |
> | middle | **Deliver fast** | no filler; every second earns the next swipe. |
> | end | **Loop line** | the final line/visual flows back into the opening so the Short loops. |
>
> ### Shorts rules
>
> - The payoff or tension is on screen by frame one, readable with the sound off.
> - No greeting, no logo, no slow zoom. The first second is the entire funnel.
> - Design the ending to imply the beginning. Loop-throughs are the strongest
>   Shorts signal.
> - Keep it under 60 seconds where the content allows; a tight Short that loops
>   beats a long one that holds once.

How this repo applies it: HOOK (0–3 s) → SETUP (3–20 s, two or three named
facts) → PAYOFF (20–50 s, tied to a named example) → CTA (50–60 s, one specific
sentence). The CTA points back to the hook's subject so the Short loops.

## 5. The concrete-detail rule

> - If you have proof (a result, a before, a clip of the payoff), show it in the
>   first 10 seconds. Proof beats a claim.

and, from the failure table:

> | Over-promised open | the body cannot pay it off | soften the open to what the video honestly delivers |

How this repo applies it: a claim ("costs are rising") is replaced by the
research's proof of it ("Ford's steel bill rose 18% in Q2"). If the research has
no proof, the claim is dropped. `scripts/validate-script.cjs` scores every
sentence for named specifics and checks the concrete-to-abstract noun ratio.

## 6. The re-hook pattern

> Retention does not only live in the first 30 seconds. Place a small re-hook at
> each natural section break:
>
> - A one-line tease of what is coming ("but the third one is the one that actually
>   moved the numbers").
> - A pattern interrupt: a cut to B-roll, a change of location, an on-screen
>   callout.
> - A payoff bump: deliver a small win mid-video so the curve rises.

How this repo applies it: around 20 s (the SETUP → PAYOFF turn), one sentence
teases the payoff with a specific from the research. The renderer's composition
variety rule supplies the visual pattern interrupt.
