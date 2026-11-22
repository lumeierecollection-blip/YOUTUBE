/**
 * Rival Lines topic discovery: a scored, de-duplicated backlog of football stories, each checked against what StatsBomb Open Data
 * actually contains. Editorial scores (1-5) are the editor's judgement and say so; data availability is MEASURED from the data repository.
 * A topic is only proposed for production when it is researchable and producible, not merely popular.
 */
export const CATEGORIES = ["player documentary", "player comparison", "historic match", "tactical innovation", "rivalry", "forgotten story", "modern development", "international tournament", "club achievement", "coaching innovation"];
export const WEIGHTS = { story: 0.2, audience: 0.1, significance: 0.15, visual: 0.15, evidence: 0.15, data: 0.15, feasibility: 0.1 };
const RAW = "https://raw.githubusercontent.com/statsbomb/open-data/master/data/";

const topic = (id, title, category, question, thesis, why, format, scores, coverage, extra = {}) => ({ id, title, category, question, thesis, why, format, editorial_scores: scores, coverage, sources: extra.sources || [], photos: extra.photos || "Wikimedia Commons (to be searched and licence-checked per image)", visual: extra.visual || "", licensing: extra.licensing || "Photographs: Commons licences recorded per image. Stats: StatsBomb credit and logo required. No broadcast footage.", ...extra.rest });

/** Seed candidates from the brief, plus others found by category. They are candidates, not approved scripts. */
export const SEED = [
  topic("messi-evolution", "Lionel Messi: from finisher to creator", "player documentary", "How did Messi's game change between 2009 and 2018?", "In matched samples of league starts, his shooting stayed the same while his chance creation more than doubled.", "The most decorated player's change is visible in the event data.", "player_documentary", { story: 5, audience: 5, significance: 5, visual: 5, evidence: 4, feasibility: 4 }, { competition: "La Liga", seasons: ["2009/2010", "2018/2019"], team: "Barcelona" }, { visual: "layered photographs, heatmaps, per-90 comparison" }),
  topic("ronaldo-winger-to-scorer", "Cristiano Ronaldo: from winger to goalscorer", "player documentary", "How did Ronaldo's role shift across his career?", "He moved from dribbling winger to penalty-box finisher; the question is how much the data in the open set can show.", "A defining career transformation.", "player_documentary", { story: 5, audience: 5, significance: 5, visual: 4, evidence: 3, feasibility: 3 }, { competition: "La Liga", seasons: ["2009/2010", "2012/2013", "2017/2018"], team: "Real Madrid" }),
  topic("xavi-iniesta", "The tactical importance of Xavi and Iniesta", "tactical innovation", "What did Barcelona's midfield pair do that others could not?", "Their passing created the possession structure Barcelona's attack relied on.", "The engine of a defining era.", "match_analysis", { story: 4, audience: 4, significance: 5, visual: 4, evidence: 4, feasibility: 4 }, { competition: "La Liga", seasons: ["2009/2010", "2010/2011"], team: "Barcelona" }),
  topic("counter-pressing", "Why counter-pressing took over football", "tactical innovation", "Why do teams now press right after losing the ball?", "Winning the ball back high creates better chances than a settled attack.", "A change in how the game is played.", "match_analysis", { story: 4, audience: 4, significance: 4, visual: 4, evidence: 3, feasibility: 3 }, { competition: "FIFA World Cup", seasons: ["2022"], team: null }),
  topic("goalkeeper-build-up", "How goalkeepers became playmakers", "modern development", "Why do goalkeepers now start attacks?", "Goalkeepers' pass share and distance have changed, and the event data can show it.", "A modern positional revolution.", "match_analysis", { story: 4, audience: 3, significance: 4, visual: 4, evidence: 4, feasibility: 4 }, { competition: "FIFA World Cup", seasons: ["2018", "2022"], team: null }),
  topic("two-striker-return", "The return of two-striker systems", "modern development", "Why are two-striker formations back?", "Formation records can show how common they are in recent tournaments.", "A tactical trend that can be counted.", "match_analysis", { story: 3, audience: 3, significance: 3, visual: 4, evidence: 4, feasibility: 4 }, { competition: "FIFA World Cup", seasons: ["2018", "2022"], team: null }),
  topic("leicester-2016", "Leicester City's Premier League title", "club achievement", "How did Leicester win the 2015/16 title?", "The data can test which style of play won it.", "Football's most famous upset.", "match_analysis", { story: 5, audience: 5, significance: 5, visual: 4, evidence: 4, feasibility: 4 }, { competition: "Premier League", seasons: ["2015/2016"], team: "Leicester City" }),
  topic("argentina-france-2022", "Argentina vs France: Breaking Down the Greatest Final", "historic match", "How did a final that looked controlled turn into a 3-3 draw?", "Argentina built the lead; France built the comeback.", "A final with a clear two-part shape in the recorded events.", "match_analysis", { story: 5, audience: 5, significance: 5, visual: 5, evidence: 5, feasibility: 5 }, { competition: "FIFA World Cup", seasons: ["2022"], team: "Argentina" }),
  topic("barca-psg-2017", "Barcelona vs PSG, 2017", "historic match", "How did Barcelona overturn a 4-0 first-leg deficit?", "A comeback told through the second leg's events.", "One of the great European comebacks.", "match_analysis", { story: 5, audience: 5, significance: 5, visual: 4, evidence: 3, feasibility: 3 }, { competition: "UEFA Champions League", seasons: ["2016/2017"], team: "Barcelona" }),
  topic("liverpool-milan-2005", "Liverpool vs AC Milan, 2005", "historic match", "How did Liverpool recover from 3-0 down?", "A comeback told from match reports and any available event data.", "The Istanbul final.", "match_analysis", { story: 5, audience: 5, significance: 5, visual: 4, evidence: 3, feasibility: 3 }, { competition: "UEFA Champions League", seasons: ["2004/2005"], team: "Liverpool" }),
];

export const normalise = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Weighted score 0-100. `data` comes from measured coverage (0-5), the rest are editorial 1-5 scores. */
export function scoreTopic(t, dataScore = t.data_score ?? 0) {
  const s = { ...t.editorial_scores, data: dataScore };
  let total = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) { if (!(k in s)) throw new Error(`topic ${t.id} is missing score "${k}"`); total += w * s[k]; }
  return Math.round((total / 5) * 1000) / 10;
}

/** Adds proposals to a backlog without repeating a story already there (same id or same normalised title). */
export function mergeBacklog(backlog, proposals) {
  const seen = new Set(backlog.flatMap((t) => [t.id, normalise(t.title)]));
  const added = [];
  for (const p of proposals) {
    if (seen.has(p.id) || seen.has(normalise(p.title))) continue;
    seen.add(p.id); seen.add(normalise(p.title));
    backlog.push(p); added.push(p.id);
  }
  return { backlog, added };
}

const defaultGet = async (path) => { const r = await fetch(RAW + path, { headers: { "User-Agent": "RivalLines/1.0" } }); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); };

/** How much event data StatsBomb Open Data holds for a topic's competition seasons (and team, if one is named). */
export async function coverage(c, get = defaultGet) {
  const comps = (await get("competitions.json")).filter((x) => x.competition_name === c.competition && c.seasons.some((s) => x_season(x.season_name, s)));
  if (!comps.length) return { available: false, matches: 0, note: `no ${c.competition} ${c.seasons.join("/")} in the open data` };
  let matches = 0;
  for (const x of comps) {
    const list = await get(`matches/${x.competition_id}/${x.season_id}.json`);
    matches += c.team ? list.filter((m) => m.home_team.home_team_name === c.team || m.away_team.away_team_name === c.team).length : list.length;
  }
  return { available: matches > 0, matches, seasons_found: comps.map((x) => x.season_name), note: c.team ? `${matches} matches involving ${c.team}` : `${matches} matches` };
}
const x_season = (found, wanted) => found === wanted || found.startsWith(wanted) || wanted.startsWith(found);

/** 0-5 from measured coverage: none = 0, a handful of matches = 2, a full set for the team = 5. */
export const dataScoreOf = (cov) => (!cov.available ? 0 : cov.matches >= 30 ? 5 : cov.matches >= 10 ? 4 : cov.matches >= 3 ? 3 : 2);

/** Scores the whole seed list against the real data repository, ranks it, and returns the backlog entry for each topic. */
export async function discover({ existing = [], get = defaultGet } = {}) {
  const out = [];
  for (const t of SEED) {
    let cov; try { cov = await coverage(t.coverage, get); } catch (e) { cov = { available: false, matches: 0, note: `coverage check failed: ${e.message}` }; }
    const data_score = dataScoreOf(cov);
    out.push({ ...t, coverage_result: cov, data_score, score: scoreTopic(t, data_score) });
  }
  out.sort((a, b) => b.score - a.score);
  return mergeBacklog(existing, out);
}
