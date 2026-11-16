// Rival Lines long-form, 16 Nov 2026: "Does Going First Win a Penalty Shoot-Out? (We Counted 32)".
// STRUCTURE REFERENCE (not a fact source, not a visual source): intrcptProductions, "Why Are Left-Footed Players So Special?" (gp4cftwGLcQ) and "The Premier League Is Evolving Again"
// (b96B2R6OtB8), measured 16 Nov 2026 (channel-reverse/reports/intrcptProductions.md). What we keep is the FORMULA only: a counted number said to the viewer first -> a popular belief
// -> the question restated several times in the first two minutes -> the belief tested against numbers (a claimed figure, then bigger data, then our own count) -> a section on pressure
// -> the honest limits -> a verdict and a question. Not reused: their charts, clips, palette, script or title. Their match clips are broadcast footage we cannot licence; ours are stills with credits
// and drawings of our own counted data.
// Facts: ONLY (a) the Wikipedia article "Penalty shoot-out (association football)" fetched 16 Nov 2026 and (b) OUR OWN COUNT from StatsBomb open data (github.com/statsbomb/open-data),
// computed by output/replicate-2026-11-16/rival-lines/shootouts.py -> analysis.json. The count covers nine tournaments we checked (not every shoot-out ever played), 32 shoot-outs and 328 kicks.
// Nothing here is a measured effect: n = 32 cannot separate 50 percent from 60 percent, and the narration says so. StatsBomb commercial-use terms still need the owner's confirmation (docs/longform/MEDIA-ACQUISITION.md).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const att = JSON.parse(readFileSync(join(ROOT, "src/skills/remotion-render/public/lf2/rival-lines/ATTRIBUTIONS.json"), "utf8"));
const PH = (id) => `lf2/rival-lines/${att[id].file}`, PC = (id) => `${att[id].author}, ${att[id].licence}, via Wikimedia Commons`;
const W = (t, slug) => ({ title: `Wikipedia: ${t}`, url: `https://en.wikipedia.org/wiki/${slug}`, retrieved: "2026-11-16" });
const OUR = "Our count · StatsBomb open data · 32 shoot-outs, 2018–2025";

export const SOURCES = {
  PS: W("Penalty shoot-out (association football)", "Penalty_shoot-out_(association_football)"),
  SB: { title: "StatsBomb open data (event data), our own count of 32 shoot-outs and 328 kicks in nine tournaments; attribution: Data provided by StatsBomb", url: "https://github.com/statsbomb/open-data", retrieved: "2026-11-16" },
  PHOTO: { title: "Licensed photographs via Wikimedia Commons (credits on screen; public/lf2/rival-lines/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/", retrieved: "2026-11-16" },
  INTRCPT: { title: "Structure reference (not a fact source): intrcptProductions, Why Are Left-Footed Players So Special?", url: "https://www.youtube.com/watch?v=gp4cftwGLcQ", retrieved: "2026-11-16" },
};

export const EPISODE = {
  channel: "rival-lines", slug: "shootout-first", title: "Does Going First Win a Penalty Shoot-Out? (We Counted 32)", target_minutes: 6,
  sound: { bed: "MUSIC_DOC_WINTER", bed_rel_db: -22, dip_scenes: [] },
  beats: [
    { id: "S01", part: "the number", ref: "gp4cftwGLcQ 0:00: a counted figure said to the viewer first, then the claim to test", src: ["SB"],
      vo: "Seventeen out of thirty-two. That is how many penalty shoot-outs were won by the team that kicked first, in the free match data we counted from nine recent tournaments. A little over half. So is going first a real advantage, or are we looking at luck?",
      scene: { type: "number", value: 17, countFrom: 0, unit: "of 32 shoot-outs won by the team that kicked first", sub: OUR, credit: "Data: StatsBomb open data" } },
    { id: "S02", part: "the setup", ref: "gp4cftwGLcQ 0:45-1:45: the question, restated with the stakes", src: ["PS", "PHOTO"],
      vo: "Here is the situation. A knockout match is level after extra time, and nothing separates the teams. The referee tosses a coin to decide which team takes the first kick. Then the two teams alternate, five kicks each, and if it is still level, sudden death. Does that coin toss decide more than anyone admits?",
      scene: { type: "photo", image: PH("ps-wembley-2021"), credit: PC("ps-wembley-2021"), kicker: "EURO 2020 FINAL · WEMBLEY · 11 JULY 2021", callout: "Level after\nextra time", pos: "50% 45%" } },
    { id: "S03", part: "the claim", ref: "gp4cftwGLcQ: the popular claim, as a single number", src: ["PS"],
      vo: "The idea has a famous source. The economist Ignacio Palacios-Huerta suggested that the alternating order is unfair to the team kicking second, with statistical evidence that the team kicking first wins in sixty percent of cases. His explanation: the team kicking second is under more pressure when it is trailing in the shoot-out.",
      scene: { type: "number", value: 60, countFrom: 0, unit: "percent: the first-kicker win rate he reported", sub: "Palacios-Huerta · as reported in Wikipedia, 'Penalty shoot-out (association football)'", credit: "Source: Wikipedia" } },
    { id: "S04", part: "the test", ref: "gp4cftwGLcQ 4:35: the popular explanation checked against more data", src: ["PS"],
      vo: "But that is not the only number. A larger analysis by InStat looked at more than two thousand shoot-outs, and the team that went first won fifty-one point four eight percent of the time. And the article on shoot-outs adds that, in the academic literature, support for a first-mover advantage is ambiguous. An extensive study in 2024 found none in modern European football.",
      scene: { type: "bars", home: "First kicker", away: "Second kicker", title: "SHARE OF SHOOT-OUTS WON, PERCENT", rows: [{ label: "Reported by Palacios-Huerta", a: 60, b: 40 }, { label: "InStat, 2,000+ shoot-outs", a: 51.48, b: 48.52, dec: 2 }] } },
    { id: "S05", part: "our count", ref: "gp4cftwGLcQ 2:08: how the thing is measured, so the later numbers are earned", src: ["SB"],
      vo: "So we counted for ourselves. StatsBomb publishes free event data for major tournaments. We took nine of them: the 2018 and 2022 World Cups, Euro 2020 and 2024, Copa América 2024, the 2023 Africa Cup of Nations, the Women's World Cups of 2019 and 2023, and the Women's Euros of 2025. Every match that went to penalties is in the data, kick by kick, in order.",
      scene: { type: "number", value: 32, countFrom: 0, unit: "shoot-outs counted, 328 kicks", sub: "Nine tournaments, 2018–2025 · not every shoot-out ever played", credit: "Data: StatsBomb open data" } },
    { id: "S06", part: "the result", ref: "gp4cftwGLcQ: our number beside the claimed ones", src: ["SB", "PS"],
      vo: "The result: the first kicker won seventeen of thirty-two, which is fifty-three point one percent. That sits between the fifty-one of the big study and the sixty of the famous claim. But with only thirty-two shoot-outs, a standard ninety-five percent interval runs from about thirty-six to sixty-nine percent. Our count cannot tell fifty from sixty.",
      scene: { type: "bars", home: "First kicker", away: "Second kicker", title: "SHARE OF SHOOT-OUTS WON, PERCENT", rows: [{ label: "Reported by Palacios-Huerta", a: 60, b: 40 }, { label: "Our count: 17 of 32", a: 53.1, b: 46.9, dec: 1 }, { label: "InStat, 2,000+ shoot-outs", a: 51.48, b: 48.52, dec: 2 }] } },
    { id: "S07", part: "examples", ref: "gp4cftwGLcQ: a concrete case after the number", src: ["SB"],
      vo: "The numbers hide the stories. In the Euro 2020 final, Italy kicked first, and won on penalties by three to two over England.",
      scene: { type: "scorecard", home: "Italy", away: "England", score: "3 – 2", minute: "PENALTIES", title: "Euro 2020 final", date: "11 JULY 2021 · ITALY KICKED FIRST", scorers: [{ team: "Italy", text: "Kicked first" }] } },
    { id: "S08", part: "examples", ref: "gp4cftwGLcQ: the counter-example", src: ["SB", "PHOTO"],
      vo: "And in the 2022 World Cup final, France kicked first, and Argentina won four to two. The first kicker lost.",
      scene: { type: "scorecard", home: "Argentina", away: "France", score: "4 – 2", minute: "PENALTIES", title: "World Cup final", date: "18 DECEMBER 2022 · FRANCE KICKED FIRST", scorers: [{ team: "France", text: "Kicked first" }] } },
    { id: "S09", part: "pressure", ref: "gp4cftwGLcQ 4:49: the mechanism behind the claim, tested", src: ["SB"],
      vo: "The claim rests on pressure, so we checked it. We took every one of the three hundred and twenty-eight kicks and noted the score at the moment of the kick. Kickers who were trailing scored eighty-four of one hundred and twenty-five. Kickers on level terms scored ninety-five of one hundred and fifty. Kickers who were leading scored thirty-nine of fifty-three. In this sample, trailing did not make kickers miss more.",
      scene: { type: "bars", home: "Scored", away: "Missed", title: "KICKS BY THE SCORE AT THE MOMENT OF THE KICK", rows: [{ label: "Trailing: 125 kicks", a: 84, b: 41 }, { label: "Level: 150 kicks", a: 95, b: 55 }, { label: "Leading: 53 kicks", a: 39, b: 14 }] } },
    { id: "S09b", part: "round by round", ref: "gp4cftwGLcQ: a second cut of the same data", src: ["SB"],
      vo: "Now look round by round. Across all thirty-two shoot-outs, two hundred and eighteen of three hundred and twenty-eight kicks went in: sixty-six point five percent. But the very first kick of each team scored less often, thirty-nine of sixty-four, or sixty point nine percent. Every later round scored between sixty-four and seventy percent. That is a small gap in a small sample, and we would not read much into it. Seven of the thirty-two shoot-outs went to sudden death.",
      scene: { type: "bars", home: "Scored", away: "Missed", title: "KICKS BY ROUND · 32 SHOOT-OUTS", rows: [{ label: "Round 1: 64 kicks", a: 39, b: 25 }, { label: "Round 2: 64 kicks", a: 44, b: 20 }, { label: "Round 3: 64 kicks", a: 41, b: 23 }, { label: "Round 4: 60 kicks", a: 42, b: 18 }, { label: "Round 5: 40 kicks", a: 27, b: 13 }] } },
    { id: "S09c", part: "the goalkeeper", ref: "gp4cftwGLcQ: the other side of the duel", src: ["PS"],
      vo: "The goalkeeper is the other half of the duel. The article on shoot-outs cites a 2011 study in the journal Psychological Science. It found that goalkeepers dived to the right seventy-one percent of the time when their team was losing, but only forty-eight percent when ahead and forty-nine percent when tied. The same article reports research linking goalkeeper distraction with ten percent fewer goals for the kicker, and delaying the kicker with twenty percent fewer.",
      scene: { type: "bars", home: "Dived right", away: "Other", title: "GOALKEEPER DIVES BY SCORE · 2011 STUDY (WIKIPEDIA)", rows: [{ label: "Team losing", a: 71, b: 29 }, { label: "Team tied", a: 49, b: 51 }, { label: "Team ahead", a: 48, b: 52 }] } },
    { id: "S09d", part: "the goal", ref: "gp4cftwGLcQ: one more rule shaped by the same worry", src: ["PS", "PHOTO"],
      vo: "Even the goal is decided by chance. The entire shoot-out is played at one end, so the crowd behind that goal may favour one team and try to distract the other. To forestall any advantage, in 2016 the Laws of the Game were changed so that a coin toss decides which goal is used.",
      scene: { type: "photo", image: PH("ps-wembley-2021"), credit: PC("ps-wembley-2021"), kicker: "ONE GOAL · ONE CROWD", callout: "Since 2016:\na coin toss\nchooses the goal", pos: "30% 60%" } },
    { id: "S10", part: "the fix", ref: "gp4cftwGLcQ 5:36: what the sport did about it", src: ["PS", "PHOTO"],
      vo: "Football has tried to fix the order. In 2017 the rule-makers, IFAB, sanctioned a trial of a sequence called ABBA, copied from the tennis tiebreak: team A kicks first, then team B kicks twice, then team A twice. It was used at youth tournaments and in the 2017 Community Shield. In November 2018, IFAB agreed to drop it, because of a lack of strong support, mainly its complexity.",
      scene: { type: "photo", image: PH("ps-penalty-bernier"), credit: PC("ps-penalty-bernier") + " · an MLS penalty, illustrative", kicker: "ABBA · 2017–2018", callout: "Trial dropped:\ntoo complex", pos: "50% 50%" } },
    { id: "S11", part: "history", ref: "gp4cftwGLcQ: where the thing came from", src: ["PS", "PHOTO"],
      vo: "Shoot-outs are younger than most people think. IFAB adopted them on the twenty-seventh of June 1970. In England, the first one in a professional match was on the fifth of August 1970 at Boothferry Park, in Hull, in a Watney Cup semi-final. Manchester United beat Hull City. George Best took the first kick, and Denis Law was the first to miss.",
      scene: { type: "photo", image: PH("ps-boothferry"), credit: PC("ps-boothferry") + " · the site of the centre spot today", kicker: "5 AUGUST 1970 · BOOTHFERRY PARK, HULL", callout: "The first English\nshoot-out", pos: "50% 55%" } },
    { id: "S12", part: "the verdict", ref: "gp4cftwGLcQ 15:07: a clear verdict, then the limit", src: ["SB", "PS"],
      vo: "So does going first win? In our thirty-two shoot-outs, slightly more than half the time. Across more than two thousand, barely more than half. The sixty percent claim is the outlier. The honest answer from this evidence: if there is a first-kicker advantage, it is small, and thirty-two shoot-outs are far too few to find it.",
      scene: { type: "bars", home: "First kicker", away: "Second kicker", title: "WHO WINS: THE EVIDENCE SO FAR, PERCENT", rows: [{ label: "Reported by Palacios-Huerta", a: 60, b: 40 }, { label: "Our count: 17 of 32", a: 53.1, b: 46.9, dec: 1 }, { label: "InStat, 2,000+ shoot-outs", a: 51.48, b: 48.52, dec: 2 }] } },
    { id: "S13", part: "close", ref: "gp4cftwGLcQ 16:00: the closing line, then a question", src: ["SB", "PHOTO"],
      vo: "One thing no count can measure is how it feels to lose the coin toss. If you could choose to kick first or second, which would you choose? Tell us in the comments.",
      scene: { type: "photo", image: PH("ps-lusail-final"), credit: PC("ps-lusail-final"), kicker: "2022 WORLD CUP FINAL · LUSAIL", callout: "France kicked first.\nArgentina won.", pos: "50% 50%" } },
  ],
  thumbs: [{ name: "thumb1-shootout", big: "Go first?\nOr second?", small: "We counted 32", figure: "17/32", image: PH("ps-wembley-2021") }],
};
