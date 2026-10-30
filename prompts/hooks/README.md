# Hook formulas

`hooks.json` is the 21-formula hook library from https://github.com/Jakeschincariol/youtube-agent-skill (skills/yt-script/hooks.json),
MIT licence, Copyright (c) 2026 Jake Schincariol; the licence text is `LICENSE-youtube-agent-skill.txt` in this folder.

What we use: the formulas' `shape` and `fails_when`, rendered into the writer prompt by `scripts/lib/hook-formulas.mjs`.
What we do not use: its voice-file step, its `hookscore.py` scorer (calibrated on 74 short-form hooks; its own README calls it
"a heuristic, not a predictor") and its idea of inventing results: every number in a hook must still come from the research.
