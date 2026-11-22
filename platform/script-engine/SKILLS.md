# Specialist skills used by the script engine

Three public skill repositories were read through `curl` on raw GitHub URLs at the pinned commits below. Nothing from them
was installed or executed; the method was extracted into this engine's own prompts and code, so no Claude session is
needed to run it. All three are MIT licensed. A Claude-only skill that cannot run unattended is not used as such: its
reusable method is what is used.

Repository facts that belong in `docs/operations/SPECIALIST-SKILL-AUDIT.md` (being written on `feat/platform`) were not
re-researched; only the three skill files named in the brief were fetched.

## social-media-skills/skills

- Commit: `f28cef2b7067ec64e79c9d85421c022c06659e03` (2026-10-15). Licence: MIT.
- Read: `skills/short-form-video-script/SKILL.md` and `references/the-watch-framework.md`.
- What it is: a Claude skill (markdown instructions, no runnable code) for scripting short vertical video for watch-through.
  Input: an idea and a brand voice. Output: spoken lines, on-screen text, shot direction, hook variants and one CTA.
- Extracted into `prompts/script-engine/method-short.md` (the WATCH framework, W/A/T/C/H):
  W win the first 3 seconds (specific hook, no greeting, on-screen text), A arc with open loops (hook, bridge, escalation,
  payoff), T two tracks (the muted version must tell the story: required `on_screen_text` on every sentence), C cash the
  promise (payoff delivers what the hook sold), H hold the loop (the last line returns to the hook's wording; one short
  CTA tied to the story, never "like and subscribe").
- Enforced in code, not just requested: `hooks.mjs` (hook must be honest, is delivered by the payoff), `continuity.mjs`
  CON-12 (hook promise kept), CON-04 (the ending adds nothing new), CON-14 (stock phrases), `writer.mjs` (on-screen text
  required, sentence and hook length limits).
- Not used: its "WoopSocial publishes" routing, platform-routing to other skills, and anything about brand-profile files.
- Long-form videos do not get this method; `prompts/script-engine/method-long.md` is a separate prompt and
  `channels.mjs` `formatProfile("long")` a separate set of limits.

## vyralcontent/content-skills

- Commit: `349e495d97029a3e6303a7510e3f39c73f36d8fe` (2026-06-22). Licence: MIT.
- Read: `skills/viral-youtube-shorts/SKILL.md`, `references/shorts-retention.md`, `references/shorts-anti-patterns.md`.
  (`viral-short-form` exists in the same repository and was listed but not needed for the method used.)
- What it is: Claude skill markdown for YouTube Shorts. Input: topic and brief. Output: guidance, no code.
- Extracted: hook on frame one with no logo or welcome-back; a turn or stakes raise about 5-8 s in (the "bridge" and the
  payoff in `method-short.md`); the loop (last beat invites the first); 30-45 s as typical, and, from the registry,
  the platform's own 30 s ceiling for this system; captions in the middle of the frame (a channel-agent concern, noted
  in the scene seeds' `on_screen_text`); "Subscribe!" as a CTA is an anti-pattern (CON-14 and the writer prompt).
- Deliberately NOT applied: trending-sound advice for TikTok, watermark rules, view-metric targets (these are
  correlational claims in the source about unmeasured audiences; the engine does not optimise to them). No TikTok-only
  rule is used for YouTube.

## Jakeschincariol/youtube-agent-skill

- Commit: `a2feb2104981a375ffd4f87ee04f4f5344ac43c6` (2026-09-16). Licence: MIT.
- Read: `skills/yt-script/SKILL.md`, `skills/yt-script/hooks.json` (names and shapes of 21 formulas),
  `skills/yt-script/hookscore.py` (scoring).
- What it is: a Claude skill plus two Python scripts (`hookscore.py`, `hooks.json`). Input: hook lines. Output: a ranked
  list with five 0-100 property scores. Its own docstring says it separates deliberately bad hooks from real ones but
  barely separates a creator's hits from misses: "treat a low score as a reason to look again, never a high score as a
  promise."
- Extracted into `hooks.mjs`: the 21 formula ids as the `family` vocabulary; "write several, keep the best" (the writer
  writes four); a JavaScript port of the five properties (specificity, address, stakes, curiosity, brevity) with the
  same weakest-link weighting (60 % mean, 40 % weakest). The python file is not run.
- Changed on purpose: the score only RANKS hooks that are already honest (every figure and name in the claims; the payoff
  delivers the promise; no clickbait; the channel's own rules not violated). A high score never rescues a hook that
  fails those, and it never changes a script's claims. `hooks.test` equivalents are in `engine.test.mjs` ("the
  highest-scoring hook loses if it is not honest") and `channels.test.mjs` ("channel identity beats a hook score").
- Not adopted: its fixed 150 words-per-minute estimate (duration here uses a measured rate per voice,
  `duration.mjs`), and its `voice.md` profile (channel voice comes from `config/channel-registry.json`).

## Proof of use

- `prompts/script-engine/method-short.md` carries the WATCH steps and is loaded by `writer.mjs` for every Short;
  `engine.test.mjs` "LONG FORM is a separate path" asserts WATCH is in the Shorts method and absent from the long method.
- `hooks.mjs` `FORMULAS` is the 21 ids from `hooks.json` at the pinned commit; the live preview writes four hooks per
  channel and `script-package.hook_options[].family` records the formula and the score of each.
