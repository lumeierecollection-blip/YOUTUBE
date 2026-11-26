# Agent evidence 06: storyboard-artist and visual-designer roles, video 21

Honest status: the OpenCode runtime cannot run here (no provider credentials). These roles ran as a Claude agent working from the role definitions in `.opencode/agents/film-making/`. This is the same agent that did the surrounding work, not an independent reviewer.

Inputs read:
- `shorts-v5/boards/lib.mjs`, the previous `21.board.mjs`, `plan7-lib.mjs` (validation gates).
- New script text, `audio/21.vtt` word times, `facts/21.facts.json` (numbers n1 = 80, n2 = 2; f2 month unverified).
- `production-v7/reference/REFERENCE-ANALYSIS.md`, `reviews/STILLS-REVIEW-v1.md` (defects S1 to S8).
- Existing sourced assets in `shorts-v5/assets/v7/21/` and the manifest. Viewed: CNBC, OAG and Hugging Face captures, existing OAG crops.

Outputs written:
- `shorts-v5/boards/21.board.mjs`, rewritten for the new script (14 beats, 19 SFX).
- New crops, both pixel crops of existing captures: `crops/hf-panel-square.png` (1323x1311), `crops/oag-top-2to1.png` (2340x1250). Added to `assets/21.asset-manifest.json` with sha256.
- `storyboards/21-storyboard.md`.

Validation: `PLAN_ONLY=1 ONLY_IDS=21 node render7.mjs` gave "plan ok: 14 beats, 19 sfx", no errors and no warnings. This proves timing, phrase anchoring and gate rules only. No frame has been rendered.

Stills-review defects addressed: S1 two flashes and one glitch in 14 beats (was about 40% flash); S2 and S3 counter fixes in `widgets.tsx` are used by beat 9; S5 wide captures replaced by 2:1 and square crops at 92 to 98% width; S6 pictures at y 0.40 to 0.42; S7 char plate used on beats 5 and 9; S8 no text-only beat on a plain plate, the three text-led beats sit over a picture background.

Not done, to be checked in CI stills: legibility of the OAG strip in beat 9; whether the paper-plate tile beats (1, 6, 12) look like repeated tiles; the opening beat's two-tile stack.
