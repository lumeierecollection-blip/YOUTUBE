#!/usr/bin/env node
/**
 * Rank a channel's candidate topics by how well their subjects can be illustrated (scripts/lib/imagery-score.mjs), before the first is reserved.
 *
 *   node scripts/rank-topics-imagery.js /tmp/topics.json
 *
 * Rewrites the file's `topics` in the new order. Never fails the run and never drops a topic: with no network, no `subjects`, or any error the
 * file is left as discovery wrote it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { scoreTopic, rankTopics } from "./lib/imagery-score.mjs";

const UA = "youtube-automation/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE)";
const getJson = async (url) => {
  try { const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) }); return r.ok ? await r.json() : null; } catch { return null; }
};
const summaryOf = (name) => getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(String(name).replace(/ /g, "_"))}?redirect=true`);

const path = process.argv[2];
try {
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const topics = doc.topics || [];
  if (topics.length < 2) { console.log(`[imagery] ${topics.length} candidate — nothing to rank`); process.exit(0); }
  const scores = [];
  for (const t of topics) scores.push(await scoreTopic(t, { getJson, summaryOf }));
  topics.forEach((t, i) => {
    const s = scores[i];
    console.log(`[imagery] candidate ${i} "${t.topic}": ${s.subjects ? `${s.illustrated}/${s.subjects} subjects can be shown` : "no subjects listed"}${s.detail.map((d) => `\n    ${d.ok ? "+" : "-"} ${d.name} (${d.via})`).join("")}`);
  });
  const ranked = rankTopics(topics, scores);
  const moved = ranked.some((t, i) => t !== topics[i]);
  doc.topics = ranked;
  if (moved) writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
  console.log(`[imagery] order: ${ranked.map((t) => `"${t.topic}"`).join(" > ")}${moved ? " (reordered)" : " (unchanged)"}`);
} catch (e) {
  console.log(`[imagery] not ranked (${e.message}) — discovery's order stands`);
}
