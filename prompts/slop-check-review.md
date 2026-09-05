# Cold review — anti-slop residual judgement

You are reviewing measured evidence from ONE rendered video against
`ANTI-SLOP.md`'s acceptance bar. You were not involved in making this video
and have no context beyond what's in the INPUT section below — review it
as a stranger would, not as someone defending a decision.

You have no tools. You cannot see the actual frames — only the measurements
already taken from them (pixel stats, structural facts about the beat
timeline). Judge only from those measurements; do not assume anything about
what the video looks like beyond what's stated.

## What to decide

For each row in the INPUT's `rows` object that has a numeric or boolean
signal but no clear pass/fail yet, decide: given these specific numbers,
does this look like a genuine slop pattern, or does it look like a false
positive from an unusual-but-legitimate frame (e.g. a HERO_NUMBER beat
naturally has less on-screen area than a PROGRESS chart, so a plain
foreground-fraction threshold undersells it)?

Return your verdict as the schema requires. Say plainly when the evidence
given isn't enough to decide either way — `"insufficient_evidence": true` on
a row is a legitimate answer, not a failure to review.
