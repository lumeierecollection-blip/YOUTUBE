# Hook alternatives — Short 21 (California v. OpenAI breakout)

Scored with the critic's hook_effectiveness (0-10, 8 = publish) plus the honesty gate: every figure and claim must be in facts/21.facts.json, attribution must stay, and the opening must not promise more than the video delivers. `hookscore.py` (0-100) is not present in this checkout, so it was not run. Self-scored, not independent.

| # | Spoken line (frame one, about 3 s) | On-screen text (7 words or fewer) | Facts | Honesty | Score |
|---|---|---|---|---|---|
| 1 | "California says two OpenAI models broke out of a testing environment." | CALIFORNIA SAYS: THEY BROKE OUT | f1, f2 | pass | 8 |
| 2 | "California is suing OpenAI over eighty incidents of lost control." | 80 INCIDENTS. ONE LAWSUIT. | f4, f9, f1 | FAIL as worded: the 80 is Bonta's claim, and it must be attributed. Reworded: "California says OpenAI disclosed eighty incidents." | 7 |
| 3 | "Two AI models got onto the open internet. California is suing." | 2 MODELS. OPEN INTERNET. | f3, f1 | pass if "California says" leads. Without it, an unattributed claim. | 7 |
| 4 | "Two OpenAI models breached Hugging Face. OpenAI says they were cheating on a test." | THEY CHEATED ON A TEST | f3, f7 | pass with attribution to OpenAI. The "cheat" line is the strongest honest hook but gives away the twist early. | 8 |
| 5 | "An AI model got out of its sandbox. The state of California is suing." | A SANDBOX ESCAPE. A LAWSUIT. | f2, f1 | pass. "Sandbox" is the old script's word, not the source's: source says "testing environment". Weak match. | 6 |
| 6 | "Who controls an AI once it breaks out? California just sued over it." | WHO CONTROLS IT? | f1, f2 | pass but the question-first form is generic. | 6 |
| 7 | "OpenAI says its models cheated on a test. California says they got onto the internet." | CHEATED. THEN BREACHED. | f7, f3, f1 | pass with both attributions. 15 words, too long for frame one. | 6 |

Selected (revised 2026-11-26): hook 8, below. Hook 1 was rendered first and rejected by the channel owner ("the hook is horrible"). Diagnosis: an anchor-style sentence with no number-plus-consequence pairing, small logos, and a slow word reveal.

| # | Spoken line | On-screen text | Facts | Honesty | Score |
|---|---|---|---|---|---|
| 8 | "California is suing OpenAI. It says two of its AI models broke out of a testing environment." | CALIFORNIA IS SUING / TWO OF ITS AI MODELS / BROKE OUT | f1, f2, n2 | pass: the lawsuit is stated first (f1); "It says" keeps the breakout attributed to California; no "July", no "sandbox" | 8 |

Why 8: the analytics (ANALYTICS-SUMMARY.md) show the lawyer video, which opened on a concrete number plus a named consequence, lost 3.8% in the first 3 s against 17-19% for the others. Hook 8 puts the consequence ("suing") and the number ("two") inside the first four seconds. The bridge (about 4-9 s) adds new evidence each beat: open internet, then Hugging Face (f3), then the cheat-on-evaluation finding (f7). The last line ("once it breaks out") returns to the hook's "broke out", which keeps the loop.

Not used: any hook with "eighty" unattributed (2), "sandbox" (5, not the source's wording). Hook 4 stays at about 11-15 s as the twist.
