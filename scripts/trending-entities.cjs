#!/usr/bin/env node
/**
 * trending-entities.cjs — the named entities in this week's top trending titles
 * (owner's spec 2026-10-03, task 3.1), handed to the research stage as subjects.
 *
 *   node scripts/trending-entities.cjs <channel-id>
 *     reads  data/trending/<ch>.json           (scripts/fetch-trending.cjs)
 *     writes data/trending/<ch>-entities.json  { people, places, organizations, numbers }
 *
 * From the top 5 titles by velocity. Lexical, not a trained NER, and it says so:
 *   - candidates are runs of capitalized words (a title's first word only when
 *     it is part of a run) and ALL-CAPS acronyms;
 *   - a place is a country / US state name from the renderer's own region table
 *     (visual/geo-regions.js) or a run ending in City / County / Island(s);
 *   - an organization ends in a company / agency word (Inc, Corp, Bank, Court,
 *     University, Department, Agency ...) or is a 2-6 letter acronym;
 *   - a person is a 2-3 word run of capitalized words left over;
 *   - any other name (one word mid-title: "Fed", "Engel", "Miami") goes to
 *     `names` — unclassified, because a word list cannot tell a city from a brand;
 *   - numbers are the figures in the titles.
 * A Title Case headline ("Why Everyone Is Quitting") makes every word look like
 * a name: such a title's runs are skipped when most of its words are capitalized.
 * A trending title is a topic SIGNAL, never a fact: research must still find
 * and cite every fact about an entity (CLAUDE.md).
 */
"use strict";
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const OUT = join(__dirname, "..", "data", "trending");
const ORG_WORDS = /\b(Inc|Corp|Corporation|Co|Company|Ltd|LLC|Group|Holdings|Bank|Reserve|Court|University|College|Institute|Department|Agency|Administration|Commission|Bureau|Council|Ministry|Party|Union|Association|Foundation|Fund|Board|Authority|Police|Army|Navy|Senate|Congress|House|Parliament|Motors|Airlines|Technologies|Labs|Studios|Network|News|Times|Post)$/;
const PLACE_WORDS = /\b(City|County|Island|Islands|Valley|Bay|Beach|Harbor|Province|State)$/;
const SKIP = new Set("A An The This That These Those I My Your Our Their His Her Its We You They He She It Why How What When Who Where Which Is Are Was Were Be Do Does Did Can Will Just New Top Best Worst Official Video Shorts Live Breaking Update Full Episode Part Day Week Month Year Here Now January February March April May June July August September October November December Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split(" "));

let PLACES = null;
async function placeNames() {
  if (PLACES) return PLACES;
  try {
    const { GEO_REGIONS } = await import("../src/skills/remotion-render/visual/geo-regions.js");
    PLACES = new Set(Object.values(GEO_REGIONS).map((r) => String(r.name || "").toLowerCase()).filter(Boolean));
  } catch { PLACES = new Set(); }
  return PLACES;
}

/** { people, places, organizations, numbers } from up to 5 titles. */
function extractEntities(titles, places = new Set()) {
  const out = { people: new Set(), places: new Set(), organizations: new Set(), names: new Set(), numbers: new Set() };
  for (const title of titles.slice(0, 5)) {
    const t = String(title || "").replace(/#\S+/g, " ").replace(/[|•–—:!?()"“”\[\]]/g, " , ");
    for (const m of t.matchAll(/\$?\d[\d,]*(?:\.\d+)?\s*(?:%|percent|million|billion|trillion|thousand|[kKmMbB]\b)?/g)) {
      const v = m[0].trim();
      if (v) out.numbers.add(v);   // "any figure in the title" (task 3.1), a year included
    }
    const words = t.split(/\s+/).filter(Boolean);
    const alpha = words.filter((w) => /^[A-Za-z]/.test(w));
    const titleCase = alpha.length >= 4 && alpha.filter((w) => /^[A-Z]/.test(w)).length / alpha.length > 0.7;
    const runs = [];
    let run = [];
    words.forEach((raw, i) => {
      const w = raw.replace(/^['"]+|[,.;'"]+$/g, "").replace(/'s$/, "");
      const cap = /^[A-Z][\p{L}&.'-]*$/u.test(w) && !SKIP.has(w);
      const joiner = run.length && /^(of|the|and|de|for)$/.test(w);
      if (cap) run.push(w); else if (joiner) run.push(w); else { if (run.length) runs.push(run); run = []; }
      if (/[,.;]$/.test(raw) && run.length) { runs.push(run); run = []; }
      void i;
    });
    if (run.length) runs.push(run);
    for (let r of runs) {
      while (r.length && /^(of|the|and|de|for)$/.test(r[r.length - 1])) r = r.slice(0, -1);
      const name = r.join(" ");
      if (!name) continue;
      const acronym = /^[A-Z]{2,6}$/.test(name);
      if (places.has(name.toLowerCase()) || PLACE_WORDS.test(name)) out.places.add(name);
      else if (ORG_WORDS.test(name) || acronym) { if (!titleCase || acronym) out.organizations.add(name); }
      else if (!titleCase && r.length >= 2 && r.length <= 3) out.people.add(name);
      else if (!titleCase && r.length === 1) out.names.add(name);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
}

async function writeEntities(ch) {
  const file = join(OUT, `${ch}.json`);
  if (!existsSync(file)) return null;
  const tr = JSON.parse(readFileSync(file, "utf8"));
  const titles = (tr.videos || []).map((v) => v.title);
  const e = extractEntities(titles, await placeNames());
  const doc = { fetched_at: tr.fetched_at, channel: String(ch), from_titles: titles.slice(0, 5), ...e };
  writeFileSync(join(OUT, `${ch}-entities.json`), JSON.stringify(doc, null, 2) + "\n");
  console.log(`[trending] ch-${ch}: entities from ${Math.min(5, titles.length)} titles — people ${e.people.length}, places ${e.places.length}, organizations ${e.organizations.length}, other names ${e.names.length}, numbers ${e.numbers.length}`);
  return doc;
}

module.exports = { extractEntities, writeEntities, placeNames };
if (require.main === module) writeEntities(String(process.argv[2] || "")).catch((err) => { console.log(`[trending] entities failed (${err.message}) — research runs unseeded`); });
