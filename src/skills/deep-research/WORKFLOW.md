# Deep Research Skill — Workflow

## Purpose
Every topic must be backed by real, current, multi-source research before
any script is written. This skill never invents facts and never writes the
final script — it gathers and summarizes.

## Process (minimum 4 distinct search passes per topic)

### Pass 1 — Broad Web Pass
General search on the topic/niche to understand the current landscape and any recent news.
- Search terms: broad topic + niche context
- Look for: key facts, recent developments, major players, statistics
- Source: general web search

### Pass 2 — Narrow/Factual Pass
Re-search with more specific terms surfaced from pass 1 (names, numbers, events)
to verify and deepen facts.
- Search terms: specific names, dates, dollar amounts, statistics from pass 1
- Look for: verification of claims, deeper data, contradicting sources
- Source: news sites, financial filings, official reports

### Pass 3 — Practitioner Pass
Search specifically for what other people already running YouTube channels or
automation in this niche are doing/recommending.
- Search terms: "how I grew [niche] channel", creator forums, YouTube automation communities
- Look for: what formats work, what topics get views, what pitfalls to avoid
- Source: creator forums, YouTube-automation communities, niche-specific posts

### Pass 4 — Social/Community Pass
Search Reddit, X/Twitter, or niche forums for what people are actually discussing
about this topic right now.
- Search terms: site:reddit.com [topic], [topic] discussion 2026
- Look for: genuine "why would a stranger care" hooks, current debates, emotional angles
- Source: Reddit, X/Twitter, niche forums

### Extra Passes (if needed)
If a pass turns up a contradiction or gap, run an extra pass to resolve it before moving on.

## Output Format (every time)
Save to `data/research/{channel_id}/{topic-slug}.json`:

```json
{
  "channel_id": "business-01",
  "topic": "How Toys R Us Failed",
  "topic_slug": "toys-r-us-failure",
  "date": "2026-07-22",
  "passes": [
    {
      "pass": 1,
      "type": "broad-web",
      "query": "...",
      "findings": ["..."],
      "sources": ["url1", "url2"]
    },
    {
      "pass": 2,
      "type": "narrow-factual",
      "query": "...",
      "findings": ["..."],
      "sources": ["url1"]
    }
  ],
  "key_facts": [
    {
      "fact": "...",
      "source": "url or publication",
      "date": "YYYY-MM-DD"
    }
  ],
  "strongest_angle": "...",
  "practitioner_notes": "...",
  "open_questions": ["..."]
}
```

## Rules
- Never state a fact that wasn't found in an actual search result this session
- Never combine research passes into a single generic search
- If sources conflict, say so; don't silently pick one
- Log every finding with its source for audit trail
