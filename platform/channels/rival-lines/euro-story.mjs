/**
 * Rival Lines, Format B (match analysis), Short that points to the long-form "How To Analyse a Football Match (Using the Euro 2024 Final)".
 * ONE analysis point, the one the long-form teaches in its substitution chapters: both goals after the 60th minute came from substitutes, and Spain's winner
 * came 18 min 37 s after Oyarzabal came on. Every number is computed from StatsBomb Open Data event data (match 3943043) by analysis_euro.py, which stops the run
 * if a quoted figure differs. Written directly, NOT reviewed by the script engine's critic.
 * Structure (retention lessons of 16 Nov 2026): the hook is the surprising fact as a question; a new visual every 2 to 3 s; the question is answered;
 * a spoken and on-screen pointer to the full breakdown; the last line repeats the hook so a replay loops.
 */
const SB = { source_id: "statsbomb", url: "https://github.com/statsbomb/open-data/blob/master/data/events/3943043.json", published: "2026-11-16", title: "StatsBomb Open Data, UEFA Euro 2024 final events (match 3943043) and match record", licence: "StatsBomb Open Data terms: credit StatsBomb and show their logo" };
const claim = (claim_id, text, excerpt, context) => ({ claim_id, claim: text, source_id: SB.source_id, source_url: SB.url, published: SB.published, excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status: "measured_statistic" });

export const topic = "Spain v England, Euro 2024 final: how a substitute decided it";
export const sources = [SB];
export const claims = [
  claim("E1", "Spain beat England 2-1 in the Euro 2024 final; the goals came in the 47th (Spain), 73rd (England) and 86th (Spain) minutes.", "match record 2-1; goal events at 46:09, 72:08 and 85:56 on the match clock (displayed as 47', 73', 86')", "Counted from the recorded shot events with outcome Goal, and the match record."),
  claim("E2", "Mikel Oyarzabal came on as a substitute at 67:19 and scored Spain's winner at 85:56, 18 minutes 37 seconds later.", "substitution event 67:19 (on: Oyarzabal); goal 85:56; difference 1117 seconds", "Event data: substitution and shot events on the match clock."),
  claim("E3", "Cole Palmer came on at 69:53 and scored England's equaliser at 72:08, 2 minutes 15 seconds later.", "substitution event 69:53 (on: Palmer); goal 72:08; difference 135 seconds", "Event data: substitution and shot events on the match clock."),
  claim("E4", "Marc Cucurella's pass along the ground reached Oyarzabal inside the box one second before his right-foot goal.", "key pass 85:55, Ground Pass, left foot, from (100.0, 12.7) to (111.2, 36.3); shot 85:56 from (111.2, 36.3)", "Event data; the box is x 102 to 120, y 18 to 62 in StatsBomb units."),
  claim("E5", "StatsBomb's model rated Oyarzabal's goal chance at 0.28 expected goals.", "statsbomb_xg 0.283 for the 85:56 shot", "A modelled value for the shot, not a measured outcome."),
  claim("E6", "Two of the match's three goals, both after the 60th minute, were scored by substitutes; Spain's first goal was scored by a starter, Nico Williams.", "goal scorers: Williams (started), Palmer (on 69:53), Oyarzabal (on 67:19)", "Event data: no substitution event brings Williams on."),
];
const V = (text, claim_ids) => ({ text, claim_ids });
const HOOK = "How does a substitute win a final in under nineteen minutes?";
/** Story slots in order; the fitter picks the wording and optional lines that land at 35 to 40 seconds at the voice's own pace. */
export const slots = [
  { id: "hook", scene: 0, variants: [V(HOOK, ["E2"])] },
  { id: "score", scene: 1, variants: [V("Euro 2024 final: Spain scored in the forty-seventh minute, and England equalised in the seventy-third.", ["E1"]), V("Spain scored in the forty-seventh minute, and England equalised in the seventy-third.", ["E1"]), V("Spain led, then England equalised in the seventy-third minute.", ["E1"])] },
  { id: "palmer", scene: 2, variants: [V("The equaliser came from a substitute, Cole Palmer, two minutes and fifteen seconds after he came on.", ["E3"]), V("Cole Palmer, a substitute, scored two minutes after coming on.", ["E3"])] },
  { id: "oya", scene: 3, variants: [V("Spain answered with a substitute of their own: Mikel Oyarzabal, on in the sixty-seventh minute.", ["E2"]), V("Spain's answer: substitute Mikel Oyarzabal, on in the sixty-seventh minute.", ["E2"])] },
  { id: "pass", scene: 4, variants: [V("In the eighty-sixth, Marc Cucurella passed along the ground to him inside the box, and he scored.", ["E1", "E4"]), V("Cucurella passed along the ground, and Oyarzabal scored in the eighty-sixth.", ["E1", "E4"])] },
  { id: "xg", scene: 4, optional: true, variants: [V("StatsBomb's model rated the chance at point two eight expected goals.", ["E5"])] },
  { id: "gap", scene: 5, variants: [V("Eighteen minutes and thirty-seven seconds after coming on.", ["E2"]), V("Eighteen minutes after coming on.", ["E2"])] },
  { id: "two", scene: 6, optional: true, variants: [V("Two of the three goals in that final came from substitutes.", ["E6"]), V("Two of three goals came from substitutes.", ["E6"])] },
  { id: "ask", scene: 6, optional: true, allow_no_claim: true, editorial: "question left to the viewer, no new claim", variants: [V("Did the changes decide it?", [])] },
  { id: "cta", scene: 7, allow_no_claim: true, editorial: "pointer to the full breakdown on the channel", variants: [V("Full breakdown on our channel.", [])] },
  { id: "loop", scene: 8, variants: [V(HOOK, ["E2"])] },
];
export const scenes = [
  { kind: "hook", treatment: "counting-clock-and-photo-hook", objective: "Open on the counted 18:37 on the pitch with a labelled photograph of Oyarzabal", background: "white editorial page, club blue" },
  { kind: "score", treatment: "match-timeline-two-goals", objective: "Draw the match clock with the 47th and 73rd minute goals and the score", background: "white card" },
  { kind: "palmer", treatment: "palmer-on-to-goal-on-the-pitch-board", objective: "Show Palmer's 2:15 from coming on to scoring, then the recorded pass and shot on the pitch board", background: "white card, green pitch board" },
  { kind: "oya", treatment: "oyarzabal-comes-on", objective: "Show the substitution at 67:19 on the match clock and Oyarzabal's photograph", background: "white card" },
  { kind: "winner", treatment: "winner-on-the-pitch-board", objective: "Draw Cucurella's pass and Oyarzabal's shot at their recorded locations on the pitch board with the xG", background: "white card, green pitch board" },
  { kind: "gap", treatment: "eighteen-thirty-seven-bar", objective: "Show the 18:37 between coming on and scoring as a bar on the match clock", background: "white card" },
  { kind: "two", treatment: "two-of-three-goals", objective: "Show the three goals with the two substitutes' goals marked and the question to the viewer", background: "white card" },
  { kind: "cta", treatment: "full-breakdown-pointer", objective: "Point to the full breakdown on the channel, spoken and on screen", background: "blue block" },
  { kind: "loop", treatment: "loop-back-to-the-clock", objective: "Repeat the opening clock and question so a replay is seamless", background: "white editorial page, club blue" },
];
export const blueprint = {
  central_question: "How does a substitute win a final in under nineteen minutes?",
  thesis: "Both goals after the 60th minute were scored by substitutes; Spain's winner came 18 minutes 37 seconds after Oyarzabal came on.",
  why_it_matters: "The long-form teaches how to read substitutions from event data; this is the clearest case in the Euro 2024 final.",
  structure: ["hook question", "the score", "Palmer", "Oyarzabal on", "the winner on the pitch board", "the gap", "two of three", "pointer to the full breakdown", "loop"],
};
export const metadata = {
  title: "Euro 2024 Final: The Sub Winner",
  description: "How does a substitute win a final in under nineteen minutes? In the Euro 2024 final, Mikel Oyarzabal came on for Spain at 67:19 and scored the winner at 85:56, 18 minutes 37 seconds later. England's equaliser also came from a substitute: Cole Palmer, 2 minutes 15 seconds after coming on. Two of the three goals came from the bench. Event data is StatsBomb Open Data, not tracking data; the expected-goals value (0.28) is StatsBomb's model.\n\nFull breakdown: on our channel, \"How To Analyse a Football Match (Using the Euro 2024 Final)\".\n\n#Shorts #Euro2024 #Football #FootballTactics #Spain #England #RivalLines\n\nData: StatsBomb Open Data (https://github.com/statsbomb/open-data). StatsBomb logo shown as required by their terms.\nPhotos: Mikel Oyarzabal in 2018 (Giovanni Batista Rodriguez, CC BY-SA 2.0) and Cole Palmer in November 2024 (Truth619, CC0), both via Wikimedia Commons; neither is from the final.",
  tags: ["Euro 2024 final", "Spain vs England", "Oyarzabal", "Cole Palmer", "substitutes", "football analysis", "StatsBomb", "football tactics"],
  pinned_comment: "Full breakdown: our video \"How To Analyse a Football Match (Using the Euro 2024 Final)\" is on this channel. Which change would you have made?",
};
