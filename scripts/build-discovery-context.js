#!/usr/bin/env node
/**
 * Stage A input builder — emits, on stdout, every channel's id, niche,
 * content_pillars, tone, and the topics/slugs it has used in the last 90
 * days (from data/topic-log.json). Piped into `claude -p` as stdin for the
 * discover-topics prompt.
 *
 * Usage: node scripts/build-discovery-context.js [--channel <id>] > context.json
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const require = createRequire(import.meta.url);
const topicLog = require(join(ROOT, "src", "utils", "topic-log.cjs"));

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function main() {
  const channelOverride = process.argv.includes("--channel")
    ? process.argv[process.argv.indexOf("--channel") + 1]
    : null;

  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const cutoff = Date.now() - NINETY_DAYS_MS;

  const out = channels
    .filter((c) => !channelOverride || String(c.id) === String(channelOverride))
    .map((c) => {
      const used = topicLog.usedTopics(String(c.id));
      const recent = used
        .map((u) => (typeof u === "string" ? { topic: u, slug: topicLog.slugify(u), reserved_at: null } : u))
        .filter((u) => !u.reserved_at || Date.parse(u.reserved_at) >= cutoff);

      // This week's trending videos in the channel's category (scripts/
      // fetch-trending.cjs), top 5 by velocity: a topic SIGNAL for the
      // discover prompt, never a source of facts. Absent -> unseeded.
      let trending = [];
      try {
        const t = JSON.parse(readFileSync(join(ROOT, "data", "trending", `${c.id}.json`), "utf-8"));
        trending = (t.videos || []).slice(0, 5).map((v) => ({ title: v.title, tags: (v.tags || []).slice(0, 8), views: v.viewCount, velocity_per_day: v.velocity }));
      } catch { /* no trending feed for this channel */ }
      if (channelOverride) console.error(trending.length ? `[research] ch-${c.id}: trending topics loaded (${trending.length})` : `[research] ch-${c.id}: no trending feed, unseeded discovery`);
      // focus_pillar: the pillar the channel's recent topics touch LEAST (ties
      // rotate with the run number). The local discovery model kept
      // re-proposing covered subjects — often the pillar name itself — until
      // the duplicate gate failed prep (runs 36959124080 / 36976172356, ch-1,
      // 2, 26, 48). Narrowing the search to the least-covered pillar steers it
      // elsewhere; the duplicate gate itself is unchanged.
      const pillars = c.content_pillars || [];
      const sig = (s) => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
      const recentWords = recent.map((u) => new Set(sig(`${u.topic} ${u.slug}`)));
      const runN = Number(process.env.GITHUB_RUN_NUMBER || 0);
      const scored = pillars.map((p, i) => ({ p, i, hits: recentWords.filter((ws) => sig(p).some((w) => ws.has(w))).length }));
      const minHits = Math.min(...scored.map((s) => s.hits));
      const least = scored.filter((s) => s.hits === minHits);
      const focus = least.length ? least[runN % least.length].p : null;
      if (channelOverride && focus) console.error(`[research] ch-${c.id}: focus pillar "${focus}" (${minHits} recent topic(s) touch it)`);
      return {
        channel_id: String(c.id),
        channel_name: c.channel_name,
        niche: c.niche,
        content_pillars: pillars,
        ...(focus ? { focus_pillar: focus } : {}),
        tone: c.tone || "",
        style: c.style || "",
        recent_topics: recent.map((u) => ({ topic: u.topic, slug: u.slug })),
        ...(trending.length ? { trending_this_week: trending } : {}),
      };
    });

  process.stdout.write(JSON.stringify({ channels: out }, null, 2));
}

main();
