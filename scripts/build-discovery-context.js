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
const channelLookup = require(join(ROOT, "scripts", "lib", "channel-lookup.cjs"));

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function main() {
  const channelOverride = process.argv.includes("--channel")
    ? process.argv[process.argv.indexOf("--channel") + 1]
    : null;

  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const cutoff = Date.now() - NINETY_DAYS_MS;

  // Resolve the dispatch key to EXACTLY ONE channel. This used to be
  //   .filter((c) => String(c.id) === String(channelOverride))
  // which matched BOTH ch-05 Broadsheet and ch-26 Harmony for key 5 (both have
  // id=5), and the agent downstream silently took channels[0] - so ch-05 was
  // handed Harmony's music-theory context and produced a music topic on runs
  // 37548436088 and 37549155059. resolveChannel throws instead of guessing.
  const selected = channelOverride
    ? [channelLookup.resolveChannel(channelOverride, channels)]
    : channels;

  const out = selected
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
        // Key on the normalised dispatch key, NOT c.id. fetch-trending.cjs
        // writes data/trending/<dispatch key>.json, and for the nine legacy
        // rows whose id and channel_id disagree, c.id and the dispatch key are
        // different numbers. resolveChannel guarantees they agree for the row
        // it returns, but normalising here makes that explicit rather than
        // incidental.
        const trendKey = channelLookup.normalizeChannelId(c.id);
        const t = JSON.parse(readFileSync(join(ROOT, "data", "trending", `${trendKey}.json`), "utf-8"));
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
        // A strict-visual channel is NOT steered to its least-covered pillar: for ch-48 that pillar was "body mechanics", which only
        // yields research abstracts with no drawable figure (runs 41008440903, 41009396847, 41011390999: every candidate starved
        // SCR-17 STRICT). Drawable facts outrank pillar balance there; the duplicate gate still stops repeats.
        ...(focus && !c.strict_visual ? { focus_pillar: focus } : {}),
        tone: c.tone || "",
        style: c.style || "",
        // STRICT VISUAL (config strict_visual: ch-02, ch-48; CHECK-REGISTER
        // SCR-19). The renderer refuses a beat whose sentence states no
        // drawable figure and no resolvable asset, so the TOPIC has to carry
        // drawable facts. Run 39408046186 chose an ergonomics paper whose
        // every fact was "Researcher X tracked Y" and an API connector note;
        // both were refused at render after prep had already succeeded. The
        // rule is stated to discovery here, before anything is researched.
        strict_visual: !!c.strict_visual,
        ...(c.strict_visual ? {
          topic_visual_rule: "This channel draws EVERY beat and refuses text cards. Choose a topic whose researched facts will state dated events, places, measured figures, physical objects or step-by-step processes - an accident, a launch, a study WITH numbers, a device, a place. AVOID topics whose facts are only authorship or method ('researcher X analysed Y'), an API/product release note, or an abstract with no measurements: those produce sentences no frame can draw without inventing, and the video is refused. List in `subjects` the pictureable subjects too - the place, the object, the company, the agency - not only the authors.",
        } : {}),
        recent_topics: recent.map((u) => ({ topic: u.topic, slug: u.slug })),
        ...(trending.length ? { trending_this_week: trending } : {}),
      };
    });

  process.stdout.write(JSON.stringify({ channels: out }, null, 2));
}

main();
