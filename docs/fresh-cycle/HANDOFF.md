# Fresh production cycle: handoff for the GitHub app

Written 14 Nov 2026 for whoever runs `MASTER-PROMPT.md` next (the owner will run it in the GitHub app, not in the local code session).
Everything below is what is true in the repository now. Nothing here is a claim about work that was not done.

## 1. Which channels may produce (already validated, run 43618780096, 14 Nov 2026)

`platform/production/eligibility.mjs` discovers every `CHANNEL_NN_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN` trio in GitHub, refreshes a token,
asks YouTube which channel it reaches and compares that with the expected channel id in `config/channel-registry.json`.
A channel with no expected id on record is NOT eligible. It runs in `channel-preview.yml` and `longform-render.yml` before any rendering,
and on its own in `channel-eligibility.yml` (push a branch named `eligibility/<anything>`; the result is the artifact `eligibility.json`, no secret values).

| Slot | Channel | Result on 14 Nov 2026 |
|---|---|---|
| 01 | Hidden Past | eligible |
| 02 | AI Tested | eligible |
| 03 | Court & Spotlight (YouTube channel "Lumeiere Collection", owner-confirmed) | eligible |
| 04 | Rival Lines | eligible |
| 07, 09, 26, 44 | no channel on record | NOT eligible (token rejected: `invalid_grant` / `invalid_client`) |
| 48, 54 | no expected id on record | NOT eligible (48 reaches "Mindworks", 54 reaches "betrayed"; neither confirmed by the owner) |

Revalidate before each cycle: push `eligibility/check-N`. Do not borrow another channel's credentials.

## 2. What was NOT done in the fresh cycle

- The market research was started locally and killed by the PC's low-memory guard. One partial file only. No reference video has been studied in this cycle,
  no topic chosen, no script, storyboard, asset, thumbnail or preview made. `platform/fresh-cycle/research.py` is the research script; run it on GitHub
  (`.github/workflows/fresh-research.yml`, push a branch named `research/<anything>`).
- Caveat on running it on GitHub: YouTube sometimes refuses cloud IP addresses ("Sign in to confirm you're not a bot"). If the run returns empty files, say so and
  stop; do not invent results. A local run on the owner's PC is the fallback, one channel at a time (`python platform/fresh-cycle/research.py hidden-past`).

## 3. Standing restrictions (owner's, still in force)

- Do not open, stage or modify `task.txt`. Do not modify `server.js`, `rix.json`, `signal_aggregator/lib/**`.
- Do not change the existing Shorts system. New Short looks are added beside it (example: `src/skills/remotion-render/channels/ai-tested/gemini4.jsx`).
- Do not merge to `main`. Do not upload or publish to YouTube unless the owner asks for that specific video (private only; route: `upload/<key>-<n>` plus `config/upload-approval.json`, read back from YouTube).
- Never use unlicensed footage, music or images; no invented facts, quotations, statistics, licences or sources. Do not claim a visual works without a rendered frame.
- Long-form uses no music, only a few light sound effects chosen by `config/longform-cue-rules.json`. No memes or playful graphics: serious, faceless.
- Shorts and long-form must both be faceless. The owner does not want presenter footage, news footage or press photos.
- The owner handles YouTube authentication codes. Custom thumbnails need the channel to be phone-verified (the Hidden Past upload got HTTP 403 on the thumbnail).

## 4. Existing tooling to reuse (do not rebuild)

- Long-form: `platform/longform/v2/` (episode modules in `episodes/`, `render-episode.mjs`, `make-thumbs.mjs`, `make-meta.mjs`, `qa-outputs.mjs`), rendered in 5 shards by `longform-render.yml` (push `lfr/<slug>`).
  Lawful footage so far: US National Archives, USGS and US Navy public-domain material, Wikimedia Commons with a licence record (`assets.mjs`, `ATTRIBUTIONS.json`).
- Shorts: `platform/channels/<channel>/…-preview.mjs` through `platform/production/fixed-short.mjs`; branch `preview/<channel>-<topic>` triggers `channel-preview.yml`.
- Retention data: `.github/workflows/retention-report.yml` (read-only, main only). Latest report: `docs/longform/analytics-2026-11-13/RETENTION.md`.
- Faceless references already measured on 14 Nov 2026 (frames only, no reuse): Economics Explained "The Scary Solution to the Chinese Debt Crisis" (1.5M views), Economist, CNBC and Vox AI Shorts, Fireship (rejected by the owner as too playful), Primate Economics (monkeys and bananas; for a different, future channel).
- Finished this session: Hidden Past "Why Mount St. Helens Exploded Sideways" (private upload, owner posted it); AI Tested Gemini 4 vs older model Short (`preview/ai-tested-gemini4`, run 43611009331, not uploaded); Rival Lines Argentina-France Short re-render (`preview/rival-lines-final-12`, run 43615114796, not uploaded). These are NOT deliverables of the fresh cycle.

## 5. Order of work for the master prompt

Follow `MASTER-PROMPT.md` section 11. Stop at step 17 (previews for the owner's approval); do not render long-form or upload before approval.
