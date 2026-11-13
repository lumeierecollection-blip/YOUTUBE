# At What Size Does AI Multiplication Break? We Tested It

Channel: **ai-tested** · sample episode for the long-form v2 visual approval · 14 beats · 500 words of narration (about 3.0 min at 165 wpm; target for the full episode 9 min).

> Status: condensed script. It covers the whole story arc in its final order, at storyboard density. Lengthening it to the target runs on the same sources and beats; every added sentence must cite a source below.

## Sources
- **RUN1**: AI Tested multiplication test, run 1 (GitHub Actions). https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/43343589332
- **RUN2**: AI Tested multiplication test, run 2 (GitHub Actions). https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/43346149304
- **MODELS**: Google AI Studio: Models (captured 13 Nov 2026). https://aistudio.google.com/docs/models

## Script and storyboard
| Beat | Part | Narration | Picture (scene type) | Sources | Reference technique |
|---|---|---|---|---|---|
| A01 | cold open | We asked an AI model to multiply two ten-digit numbers. It answered instantly, with the right number of digits, and the first four of them right. Everything after that was wrong. | miss | RUN1 | AI Search: open on the result itself, real output on screen |
| A02 | cold open | With small numbers, the same kind of model is perfect. So where does it break? We sent a hundred and fifteen multiplications to every model we could reach, and checked every answer with code. | chat | RUN2 | cUeZMUGCxrw: the result next to the settings that produced it |
| A03 | cold open | This is the short answer. At two digits, both models got everything right. By six digits, neither got a single one. | accuracy | RUN1, RUN2 | tDWtcyeNNew: chart with the result drawn on |
| A04 | the test | Here is how the test worked. A fixed seed generated pairs of random numbers from two to ten digits long, ten pairs at each size. Every model got the identical prompt. Code worked out the exact product, and a reply was right only if it matched every digit. | flow | RUN1 | h5zkzon0gM4: explainer diagram after the demo |
| A05 | the test | Two models finished the whole test: Google's Gemini 3.5 Flash-Lite and 3.1 Flash-Lite, the small, fast end of the Gemini range. The larger 3.5 Flash ran out of free quota after a few answers, so it is not in the results. | browser | MODELS | 1Aqhg0FVm-w: the real page, pushed in, a highlight box on the line under discussion |
| A06 | the test | This is the runner's own log from the second run. Every model the key could reach was tried. Some refused with errors or quota limits. What finished is what we report. | terminal | RUN2 | Real terminal output, typed as run (terminal-inserts skill) |
| A07 | where it breaks | Here is every answer from 3.1 Flash-Lite. Green is right, red is wrong. Ten out of ten at two digits. Eight at three and at four. One at five. From six digits on, nothing. | grid | RUN2 | Our grid: every single answer shown, nothing averaged away |
| A08 | where it breaks | And the wrong answers are not random. This eight-digit product has sixteen digits, and so does the model's answer. The first four digits are right. Then it drifts. | chat | RUN2 | cUeZMUGCxrw: the reply beside its settings; our digit-by-digit check |
| A09 | where it breaks | That pattern held across the board. Of the hundred wrong answers at six digits and above, from both models, every single one had exactly the right length. And in eighty-two of them, at least the first four digits were right too. | verdict | RUN1, RUN2 | Our measurement, stated with its count |
| A10 | the fix | Then we asked the same questions again, but let the model show its working. Same problems, five per size from six digits up. The difference is enormous. | compare | RUN1, RUN2 | cUeZMUGCxrw: the same task under two settings, side by side, column titles |
| A11 | the fix | This is what working looks like: the model breaks the problem into partial products, adds them up, and gets all sixteen digits right. | chat | RUN2 | cUeZMUGCxrw: the real reply shown in full beside its settings |
| A12 | the fix | With working, 3.1 Flash-Lite got twenty-one of twenty-five right at six digits and above, and 3.5 Flash-Lite got thirteen. Without working, both got none of the same problems. | accuracy | RUN1, RUN2 | tDWtcyeNNew: two lines, the better one outlined |
| A13 | a different failure | One model failed in a different way. Gemma 4, Google's open model, was told to reply with only the number. In all ninety cases it wrote other text, usually its working, instead, so by the test's rule every answer counts as wrong. That is a test of following instructions, not of arithmetic, and we report it separately. | chat | RUN2 | Reply beside its settings; our format check |
| A14 | verdict | So, the verdict. Asked for just the number, these small models are perfect at two digits, start slipping at three and four, and get nothing right at six and above. Let them show their working and most of that accuracy comes back. If you need exact arithmetic from a model like these, ask for the steps. | verdict | RUN1, RUN2 | Verdict with its limits listed, so the claim does not grow |

## Transitions shown in the approval package
- tx1-miss-to-chat: A01 → A02, blurwhip, 12 frames. blur whip from the wrong digits to the clean 2-digit answer
- tx2-browser-push: A05 → A06, push, 14 frames. page pushes up into the terminal
- tx3-grid-to-chat: A07 → A08, zoomthrough, 18 frames. zoom through the red cells into one wrong reply

## Thumbnail concepts
- thumb1-wrong: "AI can't multiply?" / "WRONG"
- thumb2-digits: "Breaks at 6 digits" / "0 / 50"
- thumb3-fix: "The fix: show working" / "21 / 25"

Stills: `output/longform-approval/ai-tested/` (and the `longform-stills` workflow artifact). Storyboard sheet: `storyboard.jpg`.
