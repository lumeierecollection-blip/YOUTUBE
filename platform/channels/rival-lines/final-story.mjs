/**
 * Rival Lines, Format B (match analysis): Argentina v France, 2022 FIFA World Cup final. Every number is computed from StatsBomb Open Data
 * event data by analysis_final.py, which stops the run if any quoted figure differs. Written directly, NOT reviewed by the script engine's critic.
 * Thesis, taken from the data and not assumed: Argentina built the lead; France built the comeback.
 */
const SB = { source_id: "statsbomb", url: "https://github.com/statsbomb/open-data/blob/master/data/events/3869685.json", published: "2026-11-10", title: "StatsBomb Open Data, FIFA World Cup 2022 final events (match 3869685)", licence: "StatsBomb Open Data terms: credit StatsBomb and show their logo" };
const claim = (claim_id, text, excerpt, context) => ({ claim_id, claim: text, source_id: SB.source_id, source_url: SB.url, published: SB.published, excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status: "measured_statistic" });

export const topic = "Argentina vs France, 2022 World Cup final: what the recorded events show";
export const sources = [SB];
export const claims = [
  claim("F1", "The 2022 World Cup final finished 3-3 after extra time, and Argentina won the penalty shootout 4-2.", "score 3-3; shootout events: Argentina 4 goals, France 2 goals", "Counted from the recorded match events and match record."),
  claim("F2", "Argentina started in a 4-3-3 and France in a 4-2-3-1.", "Starting XI formations 433 and 4231", "As recorded in StatsBomb's Starting XI events."),
  claim("F3", "In the first 40 minutes, before any substitution, Argentina completed 230 passes and France 116.", "completed passes, period 1, minute < 40: Argentina 230, France 116", "Event data: completed passes recorded in that window. 230 is 1.98 times 116, narrated as about twice."),
  claim("F4", "Before the 79th minute Argentina had 10 shots and France 2, and France's first shot came in the 67th minute.", "shots before minute 79 (shootout excluded): Argentina 10, France 2; France first shot 67'", "Event data. Shootout excluded."),
  claim("F5", "France scored in the 79th and 80th minutes.", "France goals at minutes 79, 80 and 117", "Event data."),
  claim("F6", "Over regulation and extra time Argentina created 2.76 expected goals and France 2.27.", "sum of statsbomb_xg over shots, periods 1-4: Argentina 2.76, France 2.27", "StatsBomb's expected-goals model, a modelled value for each shot and not a measured outcome."),
];
const S = (text, scene, claim_ids) => ({ text, scene, claim_ids });
export const sentences = [
  S("Argentina against France, 2022: three-all, then penalties.", 0, ["F1"]),
  S("Argentina in a four-three-three, France in a four-two-three-one.", 1, ["F2"]),
  S("First forty minutes: Argentina completed about twice as many passes.", 2, ["F3"]),
  S("By the seventy-eighth minute, Argentina had ten shots.", 3, ["F4"]),
  S("France had two.", 3, ["F4"]),
  S("Then France scored twice in two minutes.", 4, ["F5"]),
  S("Argentina built the lead.", 5, ["F4"]),
  S("France built the comeback.", 5, ["F5"]),
];
export const scenes = [
  { kind: "intro", treatment: "broadcast-scoreboard-and-question", objective: "Introduce the match: the 3-3 scoreboard, the penalty result and the analytical question", background: "navy broadcast" },
  { kind: "formation", treatment: "formation-pitches-stacked", objective: "Show both starting formations on real pitches with the recorded starting XI", background: "pitch" },
  { kind: "network", treatment: "passing-networks-first-40", objective: "Show each team's completed-pass network for the first 40 minutes with the completed-pass counts", background: "pitch" },
  { kind: "shots", treatment: "shot-map-with-counters", objective: "Show every shot before the 79th minute on one pitch, sized by expected goals, with the shot counts", background: "pitch" },
  { kind: "xg", treatment: "cumulative-xg-line-chart", objective: "Draw each team's cumulative expected goals through the match with the goals marked", background: "navy chart" },
  { kind: "close", treatment: "stat-bars-and-thesis", objective: "Close on comparison bars and the thesis drawn from the data", background: "navy broadcast" },
];
export const blueprint = {
  central_question: "How did a final that looked controlled end 3-3?",
  thesis: "Argentina built the lead through 78 minutes of control; France created almost all of its chances after the 79th minute.",
  why_it_matters: "The recorded events show a final in two parts, not one continuous contest.",
  structure: ["scoreboard and question", "formations", "passing control", "shots to minute 78", "the comeback in expected goals", "thesis"],
};
export const metadata = {
  title: "Argentina vs France: Breaking Down the Greatest Final",
  description: "The 2022 World Cup final ended 3-3 before Argentina won on penalties. StatsBomb's event data shows Argentina with 10 shots to France's 2 before the 79th minute, then France scoring twice in two minutes. Argentina built the lead; France built the comeback. Shots, passing networks and expected goals are computed from recorded events, not tracking data.\n\n#Shorts #Football #WorldCup #Messi #Mbappe #RivalLines\n\nData: StatsBomb Open Data (https://github.com/statsbomb/open-data). StatsBomb logo shown as required by their terms.",
  tags: ["Argentina vs France", "World Cup final 2022", "football tactics", "passing network", "shot map", "StatsBomb", "Messi", "Mbappe"],
};
