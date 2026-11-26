# Hook alternatives — Short 22 (GPT-6.2 Astra and Sol)

Scale: critic hook_effectiveness 0-10 (8 = publish) plus the honesty gate against facts/22.facts.json. `hookscore.py` is not present, so it was not run. Self-scored, not independent. The ratio "four times" is derived (n7: 8/2, 40/10, 0.40/0.10) and must be stated as a ratio of the listed prices.

| # | Spoken line (frame one) | On-screen text | Facts | Honesty | Score |
|---|---|---|---|---|---|
| 1 | "One OpenAI launch. Two models. Four times apart on price." | 4x APART | n7, f1, f2 | pass | 8 |
| 2 | "OpenAI just launched two models. One costs four times more." | 4x THE PRICE | n7 | pass | 8 |
| 3 | "Eight dollars versus two. Same OpenAI launch." | $8 vs $2 | n1, n4 | pass for input price only. The video later gives output prices, so the hook is partial but not wrong. | 7 |
| 4 | "Forty dollars per million tokens, or ten. Same launch." | $40 vs $10 | n2, n5 | pass. Output price only. | 7 |
| 5 | "OpenAI says its new model beats Claude at one-sixth the cost." | 1/6 THE COST | f6 | FAIL: promises more than the video delivers. The claim is OpenAI's, on an unnamed benchmark, and we have not tested it. Rejected. | 4 |
| 6 | "Which OpenAI model is worth four times the price?" | WORTH 4x? | n7, f1, f2 | pass. Opens a question the video only half answers (use cases, not a verdict). Close to a promise the video cannot keep. | 6 |
| 7 | "A week after Claude 5.2, OpenAI launched two models." | ONE WEEK LATER | f5, t1 | pass but the "a week" figure is from an extraction, date not confirmed. Weak, and not about the ratio. | 5 |

Selected: hook 1. It states the number and the format in nine words, passes the honesty gate and is the line the ending repeats ("One launch. Four times apart."). Hook 2 is the runner-up and is a safe swap.

Rejected on honesty: hook 5 (the benchmark claim is OpenAI's and unverified; it stays in the body, attributed, with "We haven't tested that").
