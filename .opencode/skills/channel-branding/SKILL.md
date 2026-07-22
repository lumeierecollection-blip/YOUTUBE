---
name: channel-branding
description: Use to generate a channel's name, description, and keywords/tags for a given niche, grounded in real research (not invented), and push that branding to YouTube via the Data API once the channel itself exists.
---

# Channel Branding Skill

## Important limitation (read first)
The YouTube Data API can **update** an existing channel's branding
(`channels.update` with `brandingSettings`), but it **cannot create a new
channel**. Creating each channel itself is a manual, one-time step done by
logging into the Google account and clicking "Create a new channel" in
YouTube's account switcher — there's no API endpoint for this. This skill
automates everything *after* that manual click: naming, description,
keywords, and any future rebranding.

## Process
1. **Research pass per niche.** Search for what naming conventions, tone,
   and keyword patterns actually work for currently successful channels in
   this niche — not a generic naming formula.
2. **Generate candidates**, grounded in that research: 3-5 channel name
   options, a description (keyword-rich, accurately describing the
   content), and a keyword/tag list.
3. **Availability check.** Search YouTube for each candidate name to flag
   likely collisions with existing channels before finalizing.
4. **Output a bulk sheet** (e.g. `config/channel-branding-batch.csv` or
   similar) listing, per channel: proposed name, handle, description,
   keywords — so the user can quickly copy the name/handle in during the
   one manual "create channel" click per account.
5. Once the user confirms a channel exists and provides its channel ID,
   push the description/keywords via `channels.update` automatically —
   no need to manually type those in.

## Rules
- Never invent a "trend" to justify a name/keyword choice — base
  suggestions on real search results for what's working in that niche.
- Flag (don't silently skip) any name that looks likely to collide with
  an existing established channel.
- Re-run the research pass per niche — don't reuse one generic naming
  formula across all channels.
