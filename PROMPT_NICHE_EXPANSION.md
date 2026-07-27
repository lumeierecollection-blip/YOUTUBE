# Prompt for OpenCode — Niche Expansion + Channel Config (Steps: expand to 50 channels)

Read this file fully before doing anything. Follow it step by step. Ask me
setup questions before writing any code or files, per the project's existing
hard rules in PLAN.md.

## Context

- 10 niches are already locked (do not change these):
  1. Personal Finance (Budgeting for Beginners) — Minimal
  2. Legal Education (Know Your Rights) — Motion-graphics
  3. AI Tool Reviews (Real Results Only) — Minimal
  4. History Untold (What Really Happened) — Cinematic Documentary
  5. Natural Disaster / Volcano Stories — Cinematic Documentary
  6. Military History & Strategy — Cinematic Documentary
  7. Business Case Studies (How Companies Failed) — Cinematic Documentary
  8. Psychology (Why We Do What We Do) — Minimal
  9. Geopolitical Explainers (Maps & Power) — Motion-graphics
  10. Betrayal/Revenge Stories — Cinematic Documentary

- I need 40 more niches researched and confirmed to reach 50 channels total.
- Nothing gets used without real research backing it (per PLAN.md hard
  rules) — no invented RPM figures, no guessed competition levels.

## Step 1 — Run niche-discovery

Use the `niche-discovery` skill to research and confirm 40 additional
channel niches. Avoid direct topical overlap with the 10 already locked
above and with each other.

For each of the 40, research and report:
- Niche name
- Estimated RPM range (sourced, not guessed)
- Competition/saturation level
- Durability (evergreen / news-adjacent / fast-growing / etc.)
- Best-fit visual style: minimal, motion-graphics, or cinematic documentary
- 2-3 candidate channel names (do not check live availability yet — that
  happens later, at account-creation time)

Present the full 40 to me as a table before doing anything else. Wait for
my explicit approval or edits before moving to Step 2.

## Step 2 — Generate the config file

Once I approve the list, create `config/channels.json` (using
`config/channels.example.json` as the schema reference) with all 50
channels filled in:

- niche
- style (minimal / motion-graphics / cinematic documentary)
- name (from the approved shortlist — I will confirm final pick per
  channel once I check live handle availability during account creation)
- voice — assign a distinct EdgeTTS voice per channel so channels sourced
  from the same style don't sound identical; vary appropriately for tone
  (e.g. serious documentary niches vs. upbeat explainer niches)
- estimated RPM (from research)
- placeholder fields left EMPTY for me to fill in after manual account
  creation: `google_account`, `channel_id`, `youtube_credentials_path`

## Step 3 — Credential/secrets scaffolding

Do NOT ask me for any real credentials yet. Instead, using the
`youtube-publish` skill's requirements, generate:

- A clear naming convention for GitHub Actions secrets per channel (e.g.
  `CHANNEL_01_CLIENT_ID`, `CHANNEL_01_CLIENT_SECRET`,
  `CHANNEL_01_REFRESH_TOKEN` — confirm or adjust this pattern based on
  what `youtube-publish` actually needs)
- A checklist/template file (e.g. `CHANNEL_SETUP_CHECKLIST.md`) listing,
  per channel: the manual steps I need to do (create Google account,
  create channel, note channel ID, generate OAuth credentials, add the
  three secrets to GitHub) so I can work through all 50 methodically,
  a batch at a time.

## Reminder — hard rules that still apply

- No fact, RPM figure, or name suggestion invented from general
  knowledge — everything from Step 1 must come from actual research.
- Each channel's config is independent — don't let one niche's research
  block the others.
- Stop after Step 3 and wait for me. Do not touch scripts, rendering, or
  actual YouTube API calls yet — that's later in the build order.
