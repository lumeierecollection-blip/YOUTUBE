# Prompt: replicate a proven faceless video, build it with our system, then learn from analytics

Paste everything below the line into a NEW Claude Code session started in `C:\Users\info\YOUTUBE`. Fill in the three `<...>` fields.

---

Channel to work on: <01 Hidden Past | 02 AI Tested | 04 Rival Lines>
Niche keywords: <e.g. "AI explained, tech business">
Optional reference URL (skip the search if given): <https://www.youtube.com/watch?v=...>

You are cloning one proven, high-view, faceless documentary/motion-graphics video and rebuilding it on our own Remotion long-form system (`.worktrees/orch`, branch from `lfr/*`). Work in this exact order and do not skip a gate.

## 1. Find the reference (only if no URL was given)
- Use YouTube's own search data through the logged-in Chrome tab (`/results?search_query=…&sp=CAMSBAgEEAE%3D` = this month by views; parse `ytInitialData`). Window: last 10 days, widen to 30 only if nothing qualifies, and say so.
- REJECT instantly: memes or reaction/movie clips, presenter on camera, cartoon/AI-illustration or 3D-render looks (paid generation), gossip, stat tickers, conspiracy topics.
- ACCEPT only if every visual type can be built free with our system: maps (GeoMap), page/article captures (Playwright `capture.mjs`), charts/number cards, credited Commons photos, public-domain or free stock footage, text animation, tactics boards (StatsBomb open data).
- Check the frames before accepting: run `scripts/clone/shots.py <id>` and LOOK at the keyframe sheets for memes, faces, and footage we cannot licence.

## 2. Measure the reference (evidence, not memory)
- Download locally at 480p (`python -m yt_dlp`; GitHub runners are bot-blocked by YouTube; pause between fetches, the PC gets HTTP 403/429 after ~30).
- Shot list + keyframe sheets: `scripts/clone/shots.py`. Transcript: chunked local whisper (`output/fresh-cycle-2026-11-14/clone/trc.py`, 5-minute chunks, low memory).
- Write `CLONE-SPEC.md` for the reference with: duration, shot count, median shot length, the first 60 s shot by shot (time, visual type, on-screen text, what is said), the section structure with timestamps, the visual-type mix in % (map / footage / capture / chart / photo / text card / board), the motion inside each shot type (pans, zooms, highlights drawing, counters), the hook, the close, and the sound (music under voice? effects on which visuals?).

## 3. Rebuild it (same formula, our own facts)
- Fetch sources first (Wikipedia raw + the outlets it cites where reachable; CBS/NPR/official pages). Every sentence must trace to a fetched page; attribute secondary sources on screen. No invented numbers, no general-knowledge fill (CLAUDE.md hard rules).
- Match the reference's RHYTHM, not just its structure: a new picture or a clear visible change at least every 3-5 s (the references measured 2.6-5.4 s median). One beat = one to two sentences, 6-12 s. Never hold one static page or board for 20 s+.
- Match its VISUAL MIX: if the reference is 40% footage, ours must have footage-like moving pictures for that share (free stock or public-domain clips, Ken Burns on credited photos, animated maps). If the reference uses broadcast clips we cannot licence, substitute MOVING material (animated tactics board with real event data, public-domain or CC footage from Wikimedia Commons, credited photos with motion), never a static card.
- Length: within the owner's 6-10 minute long-form window; give enough context and explanation (owner feedback, 15 Nov 2026: the history video needed more context).
- Music: a no-drum documentary bed from `platform/longform/v2/audio/music/` (MUSIC_DOC_*), measured with `measure_music.py`: percussive share <= 0.05. Never MUSIC_MYSTERY or MUSIC_HISTORY_DOC (owner heard them as rock).
- Sound effects: follow `docs/longform/SOUND-MAP-FRESH-CYCLE.md` (an effect only on a visible action; whoosh on section change; impact on a reveal; paper on a highlighted document).
- Thumbnail: `thumbs` in the episode file; check the rendered JPEG.

## 4. Render in parallel on GitHub
- Add the episode slug to the matrix in `.github/workflows/longform-render.yml` (10 shards per episode), push `lfr/<slug>` for every episode at the same time so all runs go in parallel. Never render heavy video on the owner's PC (about 2 GB free RAM; background jobs get killed).
- Download the artifact, extract frames every 10 s, LOOK at them, measure loudness, and compare the shot rhythm of our MP4 with the reference (`shots.py` on our own file). Fix and re-render before showing the owner.

## 5. Show, then learn from analytics
- Send a 720p preview (SendUserFile limit 30 MiB). Upload only after the owner approves, private first.
- After publication, read our analytics: views vs swipes (Shorts), CTR, first-30-second retention, average view duration, retention curve. Repo: `scripts/analytics/retention.mjs` + `.github/workflows/retention-report.yml` (main-only; needs the owner's merge approval). Compare with the reference's spec and write what to change next time.

Report at the end: reference chosen and why (and what was rejected and why), CLONE-SPEC summary, our measured rhythm vs the reference's, sources used, what could not be matched and the substitute used, render links, and the analytics plan.

---

## Ready-made tools worth trying (not yet installed or tested here)
- Analytics and competitor research as a Claude Code skill: [agricidaniel/claude-youtube](https://awesome.ecosyste.ms/projects/github.com%2Fagricidaniel%2Fclaude-youtube) (parallel competitor analysis; no video generation).
- Retention curves into Claude via MCP: [pauling-ai youtube-studio-mcp](https://glama.ai/mcp/servers/pauling-ai/youtube-mcp-server/tools/youtube_analytics_retention), [adityaarsharma/youtube-mcp-server](https://awesome.ecosyste.ms/projects/github.com%2Fadityaarsharma%2Fyoutube-mcp-server) (need your own Google OAuth).
- Agentic Remotion production: [OpenMontage](https://github.com/badgids/OpenMontage). Channel-style cloning pipelines (small, check before trusting): [faceless-youtube-agents](https://github.com/yashaiguy-dev/faceless-youtube-agents), [yt-faceless-automation](https://github.com/collij22/yt-faceless-automation).
No single project found does reference search + clone + Remotion render + analytics end to end; the prompt above is that loop on our own system.
