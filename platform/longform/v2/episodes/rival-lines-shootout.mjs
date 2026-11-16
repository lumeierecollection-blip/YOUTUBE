// Rival Lines long-form, 16 Nov 2026 (v2, rebuilt after watching the first render against the reference): "Does Going First Win a Penalty Shoot-Out? (We Counted 32)".
// STRUCTURE REFERENCE (not a fact source, not a visual source): intrcptProductions, "Why Are Left-Footed Players So Special?" (gp4cftwGLcQ) and "The Premier League Is Evolving Again"
// (b96B2R6OtB8), measured 16 Nov 2026 (channel-reverse/reports/intrcptProductions.md): average shot 5.4 s and 7.2 s, a counted number said to the viewer first, the question restated,
// the claim tested against numbers, a data picture that changes at least every few seconds, the honest limits, a verdict and a question. Not reused: their charts, clips, palette, script or title.
// Their match clips are broadcast footage we cannot licence; ours are drawings of our OWN counted data (a tile for every shoot-out, a kick-by-kick board) plus a few credited stills.
// First render (same day) failed that comparison: 16 beats averaging 22 s, scenes frozen for 20-40 s, captions cut off at the screen edge, an irrelevant photo. This version has 33 beats
// of 5-15 s, each animating (tiles, kicks and rows arriving), captions shortened, and the irrelevant photo replaced by drawings.
// Facts: ONLY (a) the Wikipedia article "Penalty shoot-out (association football)" fetched 16 Nov 2026 and (b) OUR OWN COUNT from StatsBomb open data (github.com/statsbomb/open-data),
// computed by docs/longform/episodes/replicate-2026-11-16/shootouts.py -> analysis.json. The count covers nine tournaments we checked (not every shoot-out ever played): 32 shoot-outs, 328 kicks.
// Nothing here is a measured effect: n = 32 cannot separate 50 percent from 60 percent (Wilson 95% interval 36.4-69.1), and the narration says so.
// StatsBomb commercial-use terms still need the owner's confirmation (docs/longform/MEDIA-ACQUISITION.md).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const att = JSON.parse(readFileSync(join(ROOT, "src/skills/remotion-render/public/lf2/rival-lines/ATTRIBUTIONS.json"), "utf8"));
const GRID = JSON.parse(readFileSync(join(ROOT, "data/longform/rival/shootouts-grid.json"), "utf8"));
const FIN = JSON.parse(readFileSync(join(ROOT, "data/longform/rival/shootout-finals-kicks.json"), "utf8"));
const NAME = { "Kylian Mbappé Lottin": "Mbappé", "Lionel Andrés Messi Cuccittini": "Messi", "Kingsley Coman": "Coman", "Paulo Bruno Exequiel Dybala": "Dybala", "Aurélien Djani Tchouaméni": "Tchouaméni", "Leandro Daniel Paredes": "Paredes", "Randal Kolo Muani": "Kolo Muani", "Gonzalo Ariel Montiel": "Montiel", "Domenico Berardi": "Berardi", "Harry Kane": "Kane", "Andrea Belotti": "Belotti", "Harry Maguire": "Maguire", "Leonardo Bonucci": "Bonucci", "Marcus Rashford": "Rashford", "Federico Bernardeschi": "Bernardeschi", "Jadon Sancho": "Sancho", "Jorge Luiz Frello Filho": "Jorginho", "Bukayo Saka": "Saka" };
const RES = { Goal: "GOAL", Saved: "SAVED", "Saved to Post": "SAVED", Post: "POST", "Off T": "OFF TARGET" };
const KICKS = (k) => FIN[k].map((x) => ({ team: x.team, name: NAME[x.player] || x.player, result: RES[x.outcome] || x.outcome.toUpperCase() }));
const PH = (id) => `lf2/rival-lines/${att[id].file}`, PC = (id) => `${att[id].author}, ${att[id].licence}, via Wikimedia Commons`;
const W = (t, slug) => ({ title: `Wikipedia: ${t}`, url: `https://en.wikipedia.org/wiki/${slug}`, retrieved: "2026-11-16" });
const OUR = "Our count · StatsBomb open data · 32 shoot-outs, 2018–2025";
const DATA = "Data: StatsBomb open data";

export const SOURCES = {
  PS: W("Penalty shoot-out (association football)", "Penalty_shoot-out_(association_football)"),
  SB: { title: "StatsBomb open data (event data), our own count of 32 shoot-outs and 328 kicks in nine tournaments; attribution: Data provided by StatsBomb", url: "https://github.com/statsbomb/open-data", retrieved: "2026-11-16" },
  PHOTO: { title: "Licensed photographs via Wikimedia Commons (credits on screen; public/lf2/rival-lines/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/", retrieved: "2026-11-16" },
  INTRCPT: { title: "Structure reference (not a fact source): intrcptProductions, Why Are Left-Footed Players So Special?", url: "https://www.youtube.com/watch?v=gp4cftwGLcQ", retrieved: "2026-11-16" },
};

const B3 = (a, b) => [{ label: "Reported by Palacios-Huerta", a: 60, b: 40 }, { label: "Our count: 17 of 32", a: 53.1, b: 46.9, dec: 1 }, { label: "InStat, 2,000+ shoot-outs", a: 51.48, b: 48.52, dec: 2 }].slice(a, b);
const FK = (rows, title = "SHARE OF SHOOT-OUTS WON, PERCENT") => ({ type: "bars", home: "First kicker", away: "Second kicker", title, rows });
const GRIDSCENE = (o = {}) => ({ type: "grid", shootouts: GRID.shootouts, hi: GRID.hi, title: "EVERY SHOOT-OUT WE COUNTED", ...o });

export const EPISODE = {
  channel: "rival-lines", slug: "shootout-first", title: "Does Going First Win a Penalty Shoot-Out? (We Counted 32)", target_minutes: 6,
  sound: { bed: "MUSIC_DOC_WINTER", bed_rel_db: -22, dip_scenes: [] },
  beats: [
    { id: "S01", part: "the number", ref: "gp4cftwGLcQ 0:00: a counted figure said to the viewer first", src: ["SB"],
      vo: "Seventeen out of thirty-two. That is how many penalty shoot-outs were won by the team that kicked first, in free match data from nine recent tournaments.",
      scene: { type: "number", value: 17, countFrom: 0, unit: "FIRST KICKER WON", sub: "of 32 shoot-outs · " + OUR, credit: DATA } },
    { id: "S02", part: "the number", ref: "gp4cftwGLcQ 0:45: the question, with the stakes", src: ["SB"],
      vo: "A little over half. So is going first a real advantage, or are we just looking at luck?",
      scene: GRIDSCENE({ step: 7 }) },
    { id: "S02b", part: "the setup", ref: "gp4cftwGLcQ 1:14: the question reframed before the setup", src: ["PS"],
      vo: "Are shoot-outs just luck? Critics say they rely on luck rather than skill. But the article on shoot-outs also notes evidence that team strength predicts the winner.",
      scene: GRIDSCENE({ step: 5, title: "LUCK, OR SKILL?", label: "CRITICS: LUCK · BUT TEAM STRENGTH PREDICTS THE WINNER (WIKIPEDIA) · OUR COUNT BELOW" }) },
    { id: "S03", part: "the setup", ref: "gp4cftwGLcQ 1:14: the situation, in plain terms", src: ["PS", "PHOTO"],
      vo: "Here is the situation. A knockout match is level after extra time, and nothing separates the teams.",
      scene: { type: "photo", image: PH("ps-wembley-2021"), credit: PC("ps-wembley-2021"), kicker: "EURO 2020 FINAL · WEMBLEY · 11 JULY 2021", callout: "Level after\nextra time", pos: "50% 45%" } },
    { id: "S04", part: "the setup", ref: "gp4cftwGLcQ 2:08: how the thing works, shown on a real case", src: ["PS", "SB"],
      vo: "The referee tosses a coin to decide who kicks first. Then the teams alternate, five kicks each, and if it is still level, sudden death.",
      scene: { type: "kicks", home: "Italy", away: "England", kicks: KICKS("euro20"), title: "A REAL SHOOT-OUT, KICK BY KICK", date: "EURO 2020 FINAL · 11 JULY 2021", step: 30 } },
    { id: "S05", part: "the claim", ref: "gp4cftwGLcQ: the popular claim, as a single number", src: ["PS"],
      vo: "Where does the idea come from? The economist Ignacio Palacios-Huerta suggested that the alternating order is unfair to the team kicking second.",
      scene: { type: "number", value: 60, countFrom: 0, unit: "PERCENT · THE CLAIM", sub: "Palacios-Huerta · as reported in Wikipedia, 'Penalty shoot-out (association football)'", credit: "Source: Wikipedia" } },
    { id: "S06", part: "the claim", ref: "gp4cftwGLcQ: the claim and its explanation", src: ["PS"],
      vo: "His evidence: the team kicking first wins in sixty percent of cases. His explanation: the team kicking second is under more pressure when it is trailing.",
      scene: FK(B3(0, 1)) },
    { id: "S07", part: "the test", ref: "gp4cftwGLcQ 4:35: the claim checked against more data", src: ["PS"],
      vo: "But a larger analysis by InStat, covering more than two thousand shoot-outs, found the first kicker won fifty-one point four eight percent of the time.",
      scene: FK([B3(0, 1)[0], B3(2, 3)[0]]) },
    { id: "S08", part: "the test", ref: "gp4cftwGLcQ 4:49: the academic view", src: ["PS"],
      vo: "And the academic evidence is ambiguous. An extensive study in 2024 found no first-mover advantage in modern European football.",
      scene: { type: "number", value: 2024, unit: "STUDY: NO ADVANTAGE FOUND", sub: "in modern European football · as reported in Wikipedia", credit: "Source: Wikipedia" } },
    { id: "S09", part: "our count", ref: "gp4cftwGLcQ 2:08: how it is measured, so the later numbers are earned", src: ["SB"],
      vo: "So what happens if we count for ourselves? StatsBomb publishes free event data for major tournaments, and we took nine of them.",
      scene: { type: "number", value: 32, countFrom: 0, unit: "SHOOT-OUTS · 328 KICKS", sub: "Nine tournaments, 2018–2025 · not every shoot-out ever played", credit: DATA } },
    { id: "S10", part: "our count", ref: "gp4cftwGLcQ: the sample, named", src: ["SB"],
      vo: "The 2018 and 2022 World Cups, Euro 2020 and 2024, Copa América 2024, the 2023 Africa Cup of Nations, the Women's World Cups of 2019 and 2023, and the Women's Euros of 2025.",
      scene: GRIDSCENE({ step: 12, title: "NINE TOURNAMENTS · 32 SHOOT-OUTS", label: "WC = WORLD CUP · EURO · COPA · AFCON · WWC = WOMEN'S WORLD CUP · WEURO = WOMEN'S EURO" }) },
    { id: "S11", part: "the result", ref: "gp4cftwGLcQ: our number beside the claimed ones", src: ["SB", "PS"],
      vo: "The result: the first kicker won seventeen of thirty-two, which is fifty-three point one percent.",
      scene: FK(B3(0, 2)) },
    { id: "S12", part: "the result", ref: "gp4cftwGLcQ: the number placed between the others", src: ["SB", "PS"],
      vo: "That sits between the fifty-one of the big study and the sixty of the famous claim.",
      scene: FK(B3(0, 3)) },
    { id: "S13", part: "the limit", ref: "gp4cftwGLcQ: the honest limit, stated as a number", src: ["SB"],
      vo: "But with only thirty-two shoot-outs, a standard ninety-five percent interval runs from about thirty-six to sixty-nine percent.",
      scene: { type: "number", value: "36–69", unit: "PERCENT · 95% INTERVAL", sub: "for 17 wins of 32 · Wilson interval, our calculation", credit: DATA } },
    { id: "S13b", part: "the limit", ref: "gp4cftwGLcQ: the honest limit, back on the chart", src: ["SB", "PS"],
      vo: "So our count cannot tell fifty from sixty. Both fit inside it.",
      scene: FK(B3(0, 3), "OUR RESULT FITS BOTH · PERCENT") },
    { id: "S14", part: "examples", ref: "gp4cftwGLcQ: a concrete case after the number", src: ["SB"],
      vo: "The numbers hide stories. In the 2022 World Cup final, France kicked first. Argentina scored all four of theirs, and won four to two.",
      scene: { type: "kicks", home: "France", away: "Argentina", kicks: KICKS("wc22"), title: "A REAL SHOOT-OUT, KICK BY KICK", date: "WORLD CUP FINAL · 18 DECEMBER 2022", step: 30 } },
    { id: "S15", part: "examples", ref: "gp4cftwGLcQ: both sides of the claim", src: ["SB"],
      vo: "In the Euro 2020 final it went the other way: Italy kicked first and won three to two. Both finals are ringed here.",
      scene: GRIDSCENE({ step: 3, title: "TWO FINALS, TWO ANSWERS", label: "RINGED WHITE: EURO 2020 FINAL AND 2022 WORLD CUP FINAL" }) },
    { id: "S16", part: "pressure", ref: "gp4cftwGLcQ 4:49: the mechanism behind the claim, tested", src: ["SB"],
      vo: "The claim rests on pressure. But is it really pressure? We took every one of the three hundred and twenty-eight kicks and noted the score at the moment of the kick.",
      scene: { type: "number", value: 328, countFrom: 0, unit: "KICKS CHECKED", sub: "each one by the score at the moment of the kick", credit: DATA } },
    { id: "S17", part: "pressure", ref: "gp4cftwGLcQ: the three cases, one by one", src: ["SB"],
      vo: "Kickers who were trailing scored eighty-four of one hundred and twenty-five. Level, ninety-five of one hundred and fifty. Leading, thirty-nine of fifty-three.",
      scene: { type: "bars", home: "Scored", away: "Missed", title: "KICKS BY THE SCORE AT THE MOMENT OF THE KICK", rows: [{ label: "Trailing: 125 kicks", a: 84, b: 41 }, { label: "Level: 150 kicks", a: 95, b: 55 }, { label: "Leading: 53 kicks", a: 39, b: 14 }] } },
    { id: "S18", part: "pressure", ref: "gp4cftwGLcQ: the finding, one line", src: ["SB"],
      vo: "In this sample, kickers who were trailing did not score less often.",
      scene: { type: "number", value: 67, countFrom: 0, unit: "PERCENT SCORED WHEN TRAILING", sub: "84 of 125 · level: 63% · leading: 74%", credit: DATA } },
    { id: "S19", part: "round by round", ref: "gp4cftwGLcQ: a second cut of the same data", src: ["SB"],
      vo: "Now round by round. Overall, two hundred and eighteen of three hundred and twenty-eight kicks went in: sixty-six point five percent.",
      scene: { type: "number", value: 66.5, unit: "PERCENT OF KICKS SCORED", sub: "218 of 328 kicks, 32 shoot-outs", credit: DATA } },
    { id: "S20", part: "round by round", ref: "gp4cftwGLcQ: the small anomaly, with its caveat", src: ["SB"],
      vo: "But the first kick of each team scored less often: thirty-nine of sixty-four, sixty point nine percent. Every later round scored between sixty-four and seventy percent.",
      scene: { type: "bars", home: "Scored", away: "Missed", title: "KICKS BY ROUND · 32 SHOOT-OUTS", rows: [{ label: "Round 1: 64 kicks", a: 39, b: 25 }, { label: "Round 2: 64 kicks", a: 44, b: 20 }, { label: "Round 3: 64 kicks", a: 41, b: 23 }, { label: "Round 4: 60 kicks", a: 42, b: 18 }, { label: "Round 5: 40 kicks", a: 27, b: 13 }] } },
    { id: "S21", part: "round by round", ref: "gp4cftwGLcQ: do not over-read it", src: ["SB"],
      vo: "A small gap in a small sample, so we would not read much into it. Seven of the thirty-two shoot-outs went to sudden death.",
      scene: { type: "number", value: 7, countFrom: 0, unit: "WENT TO SUDDEN DEATH", sub: "of 32 shoot-outs", credit: DATA } },
    { id: "S22", part: "the goalkeeper", ref: "gp4cftwGLcQ: the other side of the duel", src: ["PS"],
      vo: "The goalkeeper is the other half of the duel. A 2011 study in Psychological Science found goalkeepers dived to the right seventy-one percent of the time when their team was losing.",
      scene: { type: "bars", home: "Dived right", away: "Other", title: "GOALKEEPER DIVES BY SCORE · 2011 STUDY (WIKIPEDIA)", rows: [{ label: "Team losing", a: 71, b: 29 }] } },
    { id: "S23", part: "the goalkeeper", ref: "gp4cftwGLcQ: the contrast", src: ["PS"],
      vo: "But only forty-eight percent when ahead, and forty-nine when tied.",
      scene: { type: "bars", home: "Dived right", away: "Other", title: "GOALKEEPER DIVES BY SCORE · 2011 STUDY (WIKIPEDIA)", rows: [{ label: "Team losing", a: 71, b: 29 }, { label: "Team tied", a: 49, b: 51 }, { label: "Team ahead", a: 48, b: 52 }] } },
    { id: "S24", part: "the goalkeeper", ref: "gp4cftwGLcQ: what the keeper can do", src: ["PS"],
      vo: "The same article reports research linking goalkeeper distraction with ten percent fewer goals for the kicker, and delaying the kicker with twenty percent fewer.",
      scene: { type: "number", value: 20, countFrom: 0, unit: "% FEWER GOALS", sub: "when the goalkeeper delays the kicker · distraction: 10% fewer · as reported in Wikipedia", credit: "Source: Wikipedia" } },
    { id: "S25", part: "the goal", ref: "gp4cftwGLcQ: one more rule shaped by the same worry", src: ["PS", "PHOTO"],
      vo: "Even the goal is decided by chance. The whole shoot-out is played at one end, so the crowd behind that goal may favour one team.",
      scene: { type: "photo", image: PH("ps-wembley-2021"), credit: PC("ps-wembley-2021"), kicker: "ONE GOAL · ONE CROWD", callout: "One end.\nOne crowd.", pos: "30% 60%" } },
    { id: "S26", part: "the goal", ref: "gp4cftwGLcQ: the rule", src: ["PS"],
      vo: "To forestall any advantage, in 2016 the Laws of the Game were changed so that a coin toss decides which goal is used.",
      scene: { type: "number", value: 2016, unit: "COIN TOSS PICKS THE GOAL", sub: "Laws of the Game · as reported in Wikipedia", credit: "Source: Wikipedia" } },
    { id: "S27", part: "the fix", ref: "gp4cftwGLcQ 5:36: what the sport did about the order", src: ["PS"],
      vo: "Can the order be fixed? Football has tried. In 2017 the rule-makers, IFAB, sanctioned a trial of a sequence called ABBA, copied from the tennis tiebreak.",
      scene: { type: "order", title: "WHO KICKS WHEN · A = KICKED FIRST", rows: [{ label: "Standard order", seq: "ABABABABAB", note: "Team A always kicks first in every pair." }, { label: "ABBA trial, 2017", seq: "ABBAABBAAB", note: "Team B kicks twice in a row, then team A twice, like a tennis tiebreak." }] } },
    { id: "S28", part: "the fix", ref: "gp4cftwGLcQ: how it ended", src: ["PS"],
      vo: "It was used at youth tournaments and in the 2017 Community Shield. In November 2018, IFAB agreed to drop it, because of a lack of strong support, mainly its complexity.",
      scene: { type: "number", value: 2018, unit: "IFAB DROPPED ABBA", sub: "lack of strong support, mainly its complexity · as reported in Wikipedia", credit: "Source: Wikipedia" } },
    { id: "S29", part: "history", ref: "gp4cftwGLcQ: where the thing came from", src: ["PS"],
      vo: "Shoot-outs are younger than most people think. IFAB adopted them on the twenty-seventh of June 1970.",
      scene: { type: "number", value: 1970, unit: "IFAB ADOPTED SHOOT-OUTS", sub: "27 June 1970 · as reported in Wikipedia", credit: "Source: Wikipedia" } },
    { id: "S30", part: "history", ref: "gp4cftwGLcQ: the first case", src: ["PS", "PHOTO"],
      vo: "In England the first one in a professional match was on the fifth of August 1970 at Boothferry Park, in Hull. Manchester United beat Hull City. George Best took the first kick, and Denis Law was the first to miss.",
      scene: { type: "photo", image: PH("ps-boothferry"), credit: PC("ps-boothferry") + " · the site of the centre spot today", kicker: "5 AUGUST 1970 · BOOTHFERRY PARK, HULL", callout: "The first English\nshoot-out", pos: "50% 55%" } },
    { id: "S30b", part: "history", ref: "gp4cftwGLcQ: where the thing came from, a second date", src: ["PS"],
      vo: "The first major tournament decided by a shoot-out was the 1976 European Championship final, between Czechoslovakia and West Germany.",
      scene: { type: "number", value: 1976, unit: "FIRST MAJOR SHOOT-OUT FINAL", sub: "European Championship · Czechoslovakia v West Germany · as reported in Wikipedia", credit: "Source: Wikipedia" } },
    { id: "S30c", part: "history", ref: "gp4cftwGLcQ: where the thing came from, a third date", src: ["PS"],
      vo: "The first shoot-out in a World Cup finals tournament came on the eighth of July 1982, when West Germany beat France in a semi-final.",
      scene: { type: "number", value: 1982, unit: "FIRST WORLD CUP SHOOT-OUT", sub: "8 July 1982 · West Germany beat France · as reported in Wikipedia", credit: "Source: Wikipedia" } },
    { id: "S31", part: "the verdict", ref: "gp4cftwGLcQ 15:07: a clear verdict", src: ["SB", "PS"],
      vo: "So does going first win? In our thirty-two shoot-outs, slightly more than half the time. Across more than two thousand, barely more than half.",
      scene: FK(B3(0, 3), "WHO WINS: THE EVIDENCE SO FAR, PERCENT") },
    { id: "S32", part: "the verdict", ref: "gp4cftwGLcQ 15:07: then the limit", src: ["SB", "PS"],
      vo: "The sixty percent claim is the outlier. If there is a first-kicker advantage, it is small, and thirty-two shoot-outs are far too few to find it.",
      scene: GRIDSCENE({ step: 4, title: "17 OF 32 · TOO FEW TO TELL", label: "EVERY SHOOT-OUT WE COUNTED · LIME EDGE: THE FIRST KICKER WON" }) },
    { id: "S33", part: "close", ref: "gp4cftwGLcQ 16:00: the closing line, then a question", src: ["SB", "PHOTO"],
      vo: "One thing no count can measure is how it feels to lose the coin toss. If you could choose to kick first or second, which would you choose? Tell us in the comments.",
      scene: { type: "photo", image: PH("ps-wembley-2021"), credit: PC("ps-wembley-2021"), kicker: "FIRST OR SECOND?", callout: "Your call.", pos: "50% 80%" } },
  ],
  thumbs: [{ name: "thumb1-shootout", big: "Go first?\nOr second?", small: "We counted 32", figure: "17/32", image: PH("ps-wembley-2021") }],
};
