---
name: performance-tracking
description: Use to track each channel's real views (Shorts and long-form tracked separately) and revenue via the YouTube Analytics/Reporting APIs, grouped by which Google account owns each channel.
---

# Performance Tracking Skill

## Purpose
Give a real, queryable view of how every channel is doing, organized by
which Gmail/Google account owns it — not just a single flat list of 50
channels.

## Process
1. **Group by owner.** Read each channel's `owner_gmail` field from its
   config. All tracking output should be organized/filterable by this
   field first, channel second.
2. **Pull real numbers per channel** via the YouTube Analytics API:
   - views, split by video format (Shorts vs. long-form) — these need
     separate queries/filters, don't merge them into one number
   - estimated revenue, via the Analytics API's monetization metrics
     (requires the channel's AdSense account to actually be linked —
     flag any channel where this isn't set up rather than reporting a
     blank/zero as if it were real)
3. **Store results** in a structured log (e.g. `data/performance-log.json`
   or a small local DB) updated on a regular cadence (daily is reasonable
   given the posting schedule), so trends are visible over time, not just
   a snapshot.
4. **Surface a rollup** per Google account: total channels, combined
   views by format, combined revenue — and per-channel detail underneath.

## Rules
- Never report a revenue or view number that wasn't actually returned by
  the API — if a metric isn't available (e.g. AdSense not linked yet),
  say so explicitly instead of showing 0 or a guess.
- Keep Shorts and long-form numbers separate everywhere — they have very
  different view patterns and conflating them hides what's actually
  working.
- Data grouped by owner account should make it trivial to answer "how is
  [this Gmail's] set of channels doing" without cross-referencing manually.
