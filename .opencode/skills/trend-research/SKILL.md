---
name: trend-research
description: Use to pull current trending topics, titles, and view/engagement numbers from YouTube for a given niche via the YouTube Data API, to inform topic selection alongside deep-research.
---

# Trend Research Skill

## Purpose
Ground topic selection in real YouTube performance data, not guesses.

## Process
1. Call YouTube Data API `search.list` for the channel's niche, sorted by
   relevance/date, to get currently trending video titles.
2. Call `videos.list` on the top results to pull view count, like count,
   and publish date — this tells you actual performance, not just
   existence.
3. Note recurring title patterns, formats, and hooks across top performers
   — not to copy them, but to understand what's currently pulling views in
   this niche.
4. Cross-reference with deep-research's practitioner-pass findings.

## Output
A short ranked list: topic candidates with the real numbers behind them
(views, recency, why it's trending), handed to the user alongside
deep-research findings before any script is written.

## Notes
- Respect YouTube API quota — this uses `search.list` (100 units) and
  `videos.list` (1 unit per video) calls; batch video IDs into a single
  `videos.list` call rather than one call per video.
- Never fabricate numbers if the API call fails — report the failure.
