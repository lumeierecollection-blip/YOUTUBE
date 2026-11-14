// Rival Lines long-form, fresh cycle 14 Nov 2026: "How Leicester Won the Premier League at 5,000-1".
// Formula taken from the owner-approved reference (Simba FC, "How An Unknown Manager With NO MONEY Created A Dynasty", oFcltk1xL4M: crisis -> a decision -> a system ->
// the turning point -> the counter-move, the stakes and a question in the first 30 seconds), applied to a DIFFERENT story with our own script, our own visual kit and no match footage.
// Every fact below comes from the Wikipedia articles fetched on 14 Nov 2026 (output/fresh-cycle-2026-11-14/rival-lines/sources/): the league and season articles and the
// articles on Ranieri, Vardy, Kante and Pearson. Wikipedia is a secondary source; opinion lines are attributed ("The Guardian", "pundits"). Facts the sources do not carry are not here.
// The 4-4-2 diagram is SCHEMATIC (not measured positions) and says so on screen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const att = JSON.parse(readFileSync(join(ROOT, "src/skills/remotion-render/public/lf2/rival-lines/ATTRIBUTIONS.json"), "utf8"));
const PH = (id) => `lf2/rival-lines/${att[id].file}`, PC = (id) => `${att[id].author}, ${att[id].licence}, via Wikimedia Commons`;
const W = (t, slug) => ({ title: `Wikipedia: ${t}`, url: `https://en.wikipedia.org/wiki/${slug}`, retrieved: "2026-11-14" });
const CRED = "Source: Wikipedia, 2015–16 Premier League and 2015–16 Leicester City season";

export const SOURCES = {
  WPL: W("2015–16 Premier League", "2015%E2%80%9316_Premier_League"),
  WSS: W("2015–16 Leicester City F.C. season", "2015%E2%80%9316_Leicester_City_F.C._season"),
  WRN: W("Claudio Ranieri", "Claudio_Ranieri"),
  WVD: W("Jamie Vardy", "Jamie_Vardy"),
  WKT: W("N'Golo Kanté", "N%27Golo_Kant%C3%A9"),
  WPE: W("Nigel Pearson", "Nigel_Pearson"),
  PHOTO: { title: "Licensed photographs via Wikimedia Commons (credits on screen; public/lf2/rival-lines/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/" },
};

// schematic 4-4-2, attacking left to right on a 120 x 80 pitch; NOT measured positions
const P = (id, x, y, position) => ({ id, avg: [x, y], position });
const SHAPE442 = [P("gk", 7, 40, "Goalkeeper"), P("rb", 30, 66), P("cb1", 27, 47), P("cb2", 27, 33), P("lb", 30, 14), P("rm", 58, 66), P("cm1", 55, 47), P("cm2", 55, 33), P("lm", 58, 14), P("st1", 84, 46), P("st2", 84, 34)];
const FULL = { fx: 60, fy: 40, yaw: 0, tilt: 40, dist: 160, scale: 12.6, cx: 960, cy: 575 };

export const EPISODE = {
  channel: "rival-lines", slug: "leicester-2015-16", title: "How Leicester Won the Premier League at 5,000-1", target_minutes: 6,
  beats: [
    { id: "L01", part: "cold open", ref: "Simba FC 0:00: the stakes in one line, then the question; Football Made Simple: a counted number alone on black", src: ["WPL"],
      vo: "Five thousand to one. That was the bookmakers' price on Leicester City winning the Premier League before the 2015–16 season. One punter turned a twenty-pound bet into more than a hundred thousand pounds. The bookmakers lost up to twenty-five million. This is how a club that had narrowly avoided relegation the year before became champions, and what the numbers say about how they did it.",
      scene: { type: "number", value: 5000, countFrom: 0, unit: "to one: the bookmakers' price on Leicester City winning the title", sub: "Before the 2015–16 season · Wikipedia, 2015–16 Premier League", credit: CRED } },
    { id: "L02", part: "the crisis", ref: "Simba FC: context before the event", src: ["WPL", "WPE", "PHOTO"],
      vo: "To see how unlikely it was, go back a year. In 2014–15, Leicester were bottom of the league at Christmas. They stayed up, only the third team ever to escape relegation from that position, and finished fourteenth. Even so, many pundits predicted they would go down the next season.",
      scene: { type: "photo", image: PH("lei-stadium"), credit: PC("lei-stadium"), kicker: "LEICESTER · KING POWER STADIUM", callout: "Bottom at\nChristmas", pos: "50% 45%" } },
    { id: "L03", part: "the decision", ref: "Simba FC: the hire", src: ["WRN", "WPE", "PHOTO"],
      vo: "In June 2015 the club sacked its manager, Nigel Pearson, saying the working relationship with the board was no longer viable. On the thirteenth of July it appointed Claudio Ranieri. A Guardian writer called the choice baffling. Ranieri had just been dismissed as Greece's manager after a home defeat to the Faroe Islands. Gary Lineker, a Leicester fan and former player, was sceptical too.",
      scene: { type: "photo", image: PH("lei-ranieri-appeal"), credit: PC("lei-ranieri-appeal"), kicker: "13 JULY 2015", callout: "Ranieri\nappointed", pos: "50% 30%" } },
    { id: "L04", part: "the system", ref: "Football Made Simple: the shape on a black pitch, one capital callout", src: ["WRN"],
      vo: "What Ranieri brought was an old-fashioned shape. His teams usually play a tactically rigorous four-four-two: two banks of four, compact in defence and in midfield, pressing hard to win the ball back, and quick on the counter-attack. At Leicester, several players, pundits and managers likened the approach to Diego Simeone's Atlético Madrid, another side that beat richer opponents. This diagram is a schematic, not measured positions.",
      scene: { type: "formation", cam: FULL, sides: [{ team: "Leicester City", players: SHAPE442 }], labelAll: false, callout: "Compact 4-4-2", credit: "Source: Wikipedia, Claudio Ranieri · schematic shape, not measured positions", note: "schematic 4-4-2" } },
    { id: "L05", part: "the start", ref: "Football Made Simple / Simba FC: scoreline card as the minute marker", src: ["WSS"],
      vo: "It started with a win. On the opening day, the eighth of August, Leicester beat Sunderland four-two. Jamie Vardy scored the first goal, Riyad Mahrez added two, and Marc Albrighton the fourth.",
      scene: { type: "scorecard", home: "Leicester City", away: "Sunderland", score: "4 – 2", minute: "FULL TIME", title: "Opening day", date: "8 AUGUST 2015", scorers: [{ team: "Leicester City", text: "Vardy · Mahrez 2 · Albrighton" }, { team: "Sunderland", text: "Defoe · Fletcher" }], credit: CRED } },
    { id: "L06", part: "the warning", ref: "Simba FC: the first setback", src: ["WSS", "WPL"],
      vo: "In September came the warning. Arsenal won five-two at the King Power Stadium, with a hat-trick from Alexis Sánchez. Vardy scored twice in defeat. Leicester dropped back, and it was the first of only three league defeats all season.",
      scene: { type: "scorecard", home: "Leicester City", away: "Arsenal", score: "2 – 5", minute: "FULL TIME", title: "The warning", date: "26 SEPTEMBER 2015", scorers: [{ team: "Leicester City", text: "Vardy 2" }, { team: "Arsenal", text: "Sánchez 3 · Walcott · Giroud" }], credit: CRED } },
    { id: "L07", part: "the striker", ref: "Simba FC: the player behind the system", src: ["WVD", "PHOTO"],
      vo: "The man who turned the season around had been a non-league player until 2012. That year Leicester signed Jamie Vardy for one million pounds, a record fee for a non-league player. Before that he had been released by Sheffield Wednesday at sixteen and begun his senior career at Stocksbridge Park Steels.",
      scene: { type: "photo", image: PH("lei-vardy-2015"), credit: PC("lei-vardy-2015"), kicker: "JAMIE VARDY", callout: "£1 million,\nnon-league record", pos: "50% 25%" } },
    { id: "L08", part: "the run", ref: "Football Made Simple: a counted number alone on black", src: ["WSS", "WVD"],
      vo: "From the end of August he scored in every league match. On the twenty-eighth of November, against Manchester United, he scored in an eleventh consecutive Premier League game, breaking Ruud van Nistelrooy's record. The run ended on the fifth of December. Leicester stayed unbeaten until the twenty-sixth of December, when Liverpool beat them one-nil.",
      scene: { type: "number", value: 11, countFrom: 0, unit: "Premier League games in a row with a Vardy goal: a record", sub: "Previous record: Ruud van Nistelrooy · broken 28 November 2015 v Manchester United", credit: "Source: Wikipedia, Jamie Vardy and 2015–16 Leicester City season" } },
    { id: "L09", part: "the team", ref: "Simba FC: the supporting cast", src: ["WSS", "WKT", "PHOTO"],
      vo: "He did not carry the team alone. On the fifth of December, the match in which Vardy's run ended, Riyad Mahrez scored a hat-trick at Swansea. Nine days later Leicester beat the champions Chelsea two-one, in what turned out to be José Mourinho's last game as Chelsea manager. In midfield, N'Golo Kanté was praised for a consistently high number of tackles and interceptions. He scored once for the club, against Watford in November.",
      scene: { type: "photo", image: PH("lei-mahrez"), credit: PC("lei-mahrez"), kicker: "RIYAD MAHREZ", callout: "Hat-trick\nat Swansea", pos: "50% 30%" } },
    { id: "L10", part: "the rival", ref: "Football Made Simple: head-to-head bars for counted figures", src: ["WPL"],
      vo: "Here is what separated Leicester from Tottenham, the last team in the race. Leicester won twenty-three games to Tottenham's nineteen, and lost three to their six. The gap was not in goals. Tottenham scored sixty-nine to Leicester's sixty-eight, and conceded thirty-five to Leicester's thirty-six. The title was won in wins and in fewer defeats.",
      scene: { type: "bars", home: "Leicester City", away: "Tottenham Hotspur", title: "FINAL TABLE · 2015–16", rows: [{ label: "Points", a: 81, b: 70 }, { label: "Wins", a: 23, b: 19 }, { label: "Defeats", a: 3, b: 6 }, { label: "Goals scored", a: 68, b: 69 }, { label: "Goals conceded", a: 36, b: 35 }], credit: "Source: Wikipedia, 2015–16 Premier League (final table)" } },
    { id: "L11", part: "the final stretch", ref: "Simba FC: the last obstacle", src: ["WSS"],
      vo: "Two points from the title, Leicester went to Old Trafford on the first of May. Anthony Martial put Manchester United ahead early. Wes Morgan equalised minutes later. Danny Drinkwater was sent off for a second yellow card, and Leicester held on for one-one. The title would be settled if Tottenham failed to win at Chelsea the next day.",
      scene: { type: "scorecard", home: "Manchester United", away: "Leicester City", score: "1 – 1", minute: "FULL TIME", title: "Old Trafford", date: "1 MAY 2016", scorers: [{ team: "Manchester United", text: "Martial" }, { team: "Leicester City", text: "Morgan" }], credit: CRED } },
    { id: "L12", part: "the turning point", ref: "Simba FC: the decisive moment, told in order", src: ["WSS", "WPL"],
      vo: "On the second of May, Tottenham led at Stamford Bridge. Harry Kane and Son Heung-min had put them two-nil up in the first half. Gary Cahill pulled one back after the break, and the substitute Eden Hazard equalised late. At the final whistle, Leicester were champions, with two games still to play.",
      scene: { type: "scorecard", home: "Chelsea", away: "Tottenham Hotspur", score: "2 – 2", minute: "FULL TIME", title: "Stamford Bridge", date: "2 MAY 2016", scorers: [{ team: "Chelsea", text: "Cahill · Hazard" }, { team: "Tottenham Hotspur", text: "Kane · Son" }], credit: CRED } },
    { id: "L13", part: "the result", ref: "Simba FC: the totals", src: ["WSS", "PHOTO"],
      vo: "They finished on eighty-one points: twenty-three wins, twelve draws and three defeats. Arsenal were second, one point ahead of Tottenham. In their last match Leicester drew one-all at Chelsea, the ground where the title had been decided two weeks before.",
      scene: { type: "photo", image: PH("lei-ranieri-hiddink-2016"), credit: PC("lei-ranieri-hiddink-2016"), kicker: "15 MAY 2016 · CHELSEA 1 LEICESTER 1", callout: "81 points", pos: "50% 35%" } },
    { id: "L14", part: "the aftermath", ref: "Simba FC: what came next, and a question for the comments", src: ["WRN", "PHOTO"],
      vo: "Ranieri was named Premier League Manager of the Season. The next season was harder. By late November Leicester had lost six of their first twelve league matches, and on the twenty-third of February 2017 Ranieri was dismissed, with the club one point above the relegation zone. So which part of that title season do you think was the real secret: the shape, the striker, or the rivals falling away? Tell us in the comments.",
      scene: { type: "photo", image: PH("lei-ranieri-appeal"), credit: PC("lei-ranieri-appeal"), kicker: "23 FEBRUARY 2017", callout: "Dismissed", pos: "50% 30%" } },
  ],
};
