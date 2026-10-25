/**
 * imagery-score.mjs — can this topic's subjects be SHOWN?
 *
 * Board 38047691386 (ten channels): the entities of the stories it picked — a city council, a police oversight committee, a consultant named
 * Catherine Hulme, "Leadership Edge", "DOOR International", "Italian prosecutors" — have no logo and no free photo anywhere, so every one of
 * those beats was typed text. Wikidata correctly found nothing for any of them. No lookup can fix a story whose subjects have no pictures:
 * the choice of story has to. Discovery returns three candidates and the workflow takes the first non-duplicate, so the three are RANKED by
 * how many of their subjects have a free logo or portrait before the first is reserved. Nothing is dropped, so no channel is skipped.
 *
 * A subject is "illustrated" when Wikidata has an item matching it exactly (label or alias) with a logo / seal (an organisation) or an image
 * (a person), or Wikipedia's article for it has a lead image hosted on Commons (a free file; a local en.wikipedia upload is non-free).
 * This PREDICTS what the resolver will find; the resolver still checks the licence and verifies every image itself.
 * Network is injected so this runs offline in tests.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Wikidata = require("./wikidata.cjs");

/** deps: { getJson(url) -> object|null, summaryOf(name) -> Wikipedia REST summary|null } */
export async function subjectIllustrated(name, { getJson, summaryOf }) {
  const n = String(name || "").trim();
  if (!n) return { ok: false, via: "no name" };
  try {
    const org = await Wikidata.find(n, { type: "organization", getJson });
    if (org?.logos?.length) return { ok: true, via: `wikidata ${org.id} logo` };
    const person = await Wikidata.find(n, { type: "person", getJson });
    if (person?.images?.length) return { ok: true, via: `wikidata ${person.id} image` };
  } catch { /* fall through to Wikipedia */ }
  try {
    const s = await summaryOf(n);
    const src = s?.originalimage?.source || s?.thumbnail?.source || "";
    if (s && s.type !== "disambiguation" && /\/wikipedia\/commons\//.test(src)) return { ok: true, via: `wikipedia "${s.title}" commons image` };
  } catch { /* nothing */ }
  return { ok: false, via: "no free logo or portrait found" };
}

/** { subjects, illustrated, fraction, detail:[{name, ok, via}] } for one candidate topic. */
export async function scoreTopic(topic, deps) {
  const subjects = [...new Set((Array.isArray(topic?.subjects) ? topic.subjects : []).map((s) => String(s).trim()).filter(Boolean))].slice(0, 6);
  const detail = [];
  for (const name of subjects) detail.push({ name, ...(await subjectIllustrated(name, deps)) });
  const illustrated = detail.filter((d) => d.ok).length;
  return { subjects: subjects.length, illustrated, fraction: subjects.length ? illustrated / subjects.length : 0, detail };
}

/**
 * Best first: topics with an illustrated subject, most illustrated (then highest share) first; then topics that listed no subjects (unknown,
 * neither rewarded nor punished); then topics whose every subject is unillustrated. Equal scores keep discovery's own order. Never drops one.
 */
export function rankTopics(topics, scores) {
  const key = (i) => {
    const sc = scores[i];
    const group = !sc || sc.subjects === 0 ? 1 : sc.illustrated > 0 ? 0 : 2;
    return [group, -(sc?.illustrated || 0), -(sc?.fraction || 0), i];
  };
  return topics.map((t, i) => ({ t, k: key(i) })).sort((a, b) => { for (let j = 0; j < 4; j++) if (a.k[j] !== b.k[j]) return a.k[j] - b.k[j]; return 0; }).map((x) => x.t);
}
