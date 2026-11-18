// Rival Lines long-form, reference clone of 18 Nov 2026: "Why Do Home Teams Win So Much?"
// CLONE of intrcptProductions, "Why Are Left-Footed Players So Special?" (gp4cftwGLcQ). Spec: channel-reverse/spec/CLONE-SPEC.md. The formula kept, in order:
//   0:00 a counted figure said to the viewer, then the question (restated three times in two minutes) -> a definition -> myth-testing (the popular explanation is
//   checked and mostly fails) -> the real mechanism -> the eye-test / limits -> a verdict plus one forward line. Section backgrounds swap (cream idea / navy data / green verdict).
// Facts: only (1) our own count of 12,704 Premier League results (football-data.co.uk; data/longform/rival/pl-home-advantage*.json, scripts beside it), (2) the abstracts of the
// cited studies as retrieved from Crossref / OpenAlex (research record: channel-reverse/research/src/papers.json) and (3) the Wikipedia pages named in SOURCES. Nothing else.
// Where the evidence disagrees, the video says so (Boyko 2007 vs Johnston 2008; the two empty-stadium samples; the studies' mixed results).
import { readFileSync } from "node:fs";
import { autoCut } from "../autocut.mjs";

const D = JSON.parse(readFileSync(new URL("../../../../data/longform/rival/pl-home-advantage.json", import.meta.url), "utf8"));
const att = JSON.parse(readFileSync(new URL("../../../../src/skills/remotion-render/public/lf2/rival-lines/ATTRIBUTIONS.json", import.meta.url), "utf8"));
const PH = (id) => `lf2/rival-lines/${att[id].file}`, PC = (id) => att[id].credit_line;
const W = (title, page) => ({ title: `Wikipedia, ${title}`, url: `https://en.wikipedia.org/wiki/${page}`, retrieved: "2026-11-18" });
const DOI = (title, doi) => ({ title, url: `https://doi.org/${doi}`, retrieved: "2026-11-18" });

export const SOURCES = {
  FD: { title: "football-data.co.uk, England Premier League results 1993/94 to 2025/26 (our own count: 12,704 matches; cards from 2000/01)", url: "https://www.football-data.co.uk/englandm.php", retrieved: "2026-11-18" },
  HA: W("Home advantage", "Home_advantage"),
  W19: W("2019-20 Premier League", "2019%E2%80%9320_Premier_League"),
  W20: W("2020-21 Premier League", "2020%E2%80%9321_Premier_League"),
  JO: DOI("Johnston (2008), On referee bias, crowd size, and home advantage in the English soccer Premiership, Journal of Sports Sciences", "10.1080/02640410701736780"),
  SL: DOI("Jimenez Sanchez and Lavin (2020), Home advantage in European soccer without crowd, Soccer & Society", "10.1080/14660970.2020.1830067"),
  MA: DOI("Martins et al. (2022), Home team's advantage reduced without crowd support after the COVID-19 outbreak, Soccer & Society", "10.1080/14660970.2022.2088526"),
  FH: DOI("Fischer and Haucap (2021), Does crowd support drive the home advantage in professional football?, Journal of Sports Economics", "10.1177/15270025211026552"),
  EG: DOI("Endrich and Gesche (2020), Home-bias in referee decisions: evidence from ghost matches during the COVID-19 pandemic, SSRN", "10.2139/ssrn.3639500"),
  PHOTO: { title: "Licensed photographs via Wikimedia Commons (credits on screen; public/lf2/rival-lines/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/", retrieved: "2026-11-18" },
  INTRCPT: { title: "Structure reference (not a fact source): intrcptProductions, Why Are Left-Footed Players So Special?", url: "https://www.youtube.com/watch?v=gp4cftwGLcQ", retrieved: "2026-11-18" },
};

// short licensed clips: Pixabay (generic, labelled illustrative) and real footage from Wikimedia Commons (CC0 / public domain / CC BY only, credited on screen)
export const FOOTAGE_REQUIRE = /soccer|football|stadium/i;   // "fans|crowd" let a waving national flag through twice (renders 1 and 2)
export const FOOTAGE = [
  { id: "fb-crowd", q: "soccer stadium crowd", alt: ["football fans stadium", "stadium crowd"] },
  { id: "fb-fans", q: "soccer fans celebrating", alt: ["football fans cheering", "fans cheering stadium"] },
  { id: "fb-night", q: "football stadium floodlights", alt: ["stadium night lights", "stadium night"] },
  { id: "fb-ref", q: "soccer referee", alt: ["football referee"], optional: true },
  { id: "fb-aerial", q: "soccer stadium aerial", alt: ["football stadium drone"], optional: true },
  { id: "fb-empty", q: "empty stadium seats", alt: ["empty football stadium", "empty stadium"], optional: true },
  { id: "fb-run", q: "football player running ball", alt: ["soccer player dribbling", "soccer player"], pick: 1 },
  { id: "fb-tackle", q: "soccer tackle", optional: true },
  { id: "fb-celebrate", q: "soccer goal celebration", optional: true },
  { id: "fb-ball", q: "soccer ball grass", alt: ["football ball field"] },
  { id: "fb-goal", q: "soccer goal net", alt: ["football goal", "goal net"] },
];
export const COMMONS = { queries: ["Premier League match", "football match crowd stadium", "Arsenal football match", "Liverpool football match", "Manchester City football match", "football supporters stadium"], perFile: 2, seg: 5, max: 14 };
const VID = (id) => `lf2/footage/${id}.mp4`;
const VCRED = "Pixabay Content License · illustrative footage";
// Commons match footage (COMMONS below) found 0 usable files in render 2 (62 candidates, none CC0/PD/CC BY and on topic), so no cm-* clip is relied on
const mont = (ids, dur = 2.6) => ({ type: "montage", shots: ids.map((id, i) => ({ video: VID(id), dur, ss: (i * 1.7) % 4, zoom: i % 2 ? [1.12, 1.0] : [1.0, 1.12] })) });

const pc = (n) => `${n}%`;
const LINE = (extra = {}) => ({ type: "ixline", bg: "navy", xs: D.seasons, xstep: 4, ymin: 20, ymax: 55, unit: "%", series: [{ name: "home wins", color: "home", vals: D.home_win }, { name: "away wins", color: "away", vals: D.away_win }], source: "Our count of every Premier League result, 1993/94 to 2025/26 · football-data.co.uk", ...extra });
const I2021 = D.seasons.indexOf("20/21");
const R = D.restart_1920_empty, S21 = D.season_2021, A = D.all;

export const EPISODE = {
  channel: "rival-lines", slug: "home-advantage", title: "Why Do Home Teams Win So Much?", target_minutes: 7,
  // description opening in intrcpt's formula (narrative paragraph, "in this video", data line); their "no AI whatsoever" line is replaced by an honest disclosure
  blurb: [
    "Home teams have won 45.6% of all 12,704 Premier League matches since 1993/94. Away teams have won 28.8%. Everyone has a theory why: the crowd, the referee, the travel. So we tested them against every result, and against the studies of the seasons played behind closed doors. The answer was not as simple as we expected.",
    "",
    "In this video we take an analytical look at home advantage in the Premier League: whether it is real, whether it is shrinking, what happened when the stands were empty, and whether referees play a part. Every chart is built from our own count of the results.",
    "",
    "Data: football-data.co.uk (results and cards), Wikipedia, and the five published studies listed below. The narration is a synthetic voice; no fact, figure or quote in this video is generated.",
  ],
  sound: { bed: "MUSIC_DOC_WINTER", bed_rel_db: -16, dip_scenes: [] },
  beats: [
    // ---- the 45.6% mystery
    { id: "H01", part: "the 45.6% mystery", ref: "gp4cftwGLcQ 0:00: a figure said to the viewer first", src: ["FD"],
      vo: "Forty-five point six percent. That is how often the home team won, across all twelve thousand seven hundred and four Premier League matches since the nineteen ninety-three, ninety-four season. The away team won twenty-eight point eight.",
      scene: { type: "ixstat", bg: "cream", value: A.home_win, decimals: 1, suffix: "%", label: "premier league matches since 1993/94: the home team won", sub: `the away team won ${A.away_win}%`, source: "Our count of 12,704 results · football-data.co.uk" } },
    { id: "H02", part: "the 45.6% mystery", ref: "gp4cftwGLcQ 0:45: the question, with the stakes", src: ["FD"],
      vo: "Same league. Same rules. The same clubs taking turns to host each other. And still a home win is far more common than an away win. So why does the team playing in front of its own fans win so much more often?",
      scene: { type: "ixbars", bg: "cream", title: "who wins a premier league match?", bold: "who wins", items: [{ label: "home win", value: A.home_win, color: "home" }, { label: "draw", value: A.draw, color: "draw" }, { label: "away win", value: A.away_win, color: "away" }], max: 60, source: "Our count of 12,704 results · football-data.co.uk" } },
    { id: "H03", part: "the 45.6% mystery", ref: "gp4cftwGLcQ 1:14: the question restated, then the plan", src: ["HA"],
      vo: "That gap is called home advantage, and everyone has a favourite explanation: the crowd, the referee, the travel, the familiar pitch. So we are going to test them, one at a time, against the results.",
      scene: { type: "ixquote", bg: "cream", text: "why does home advantage exist?", bold: "home advantage", sub: "the usual suspects: the crowd · the referee · the travel · the pitch. We test them against every result since 1993.", source: "Suspects as listed in Wikipedia, Home advantage" } },
    // ---- is it real
    { id: "H04", part: "is home advantage real?", ref: "gp4cftwGLcQ 2:08: determine the measure before the claims", src: ["FD"],
      vo: "First question: is it real, or just luck? Here is every season. Home wins in green, away wins in black. The home line sits above the away line in thirty-two of the thirty-three seasons.",
      scene: LINE({ title: "is it real, or just luck?", bold: "real" }) },
    { id: "H05", part: "is home advantage real?", ref: "gp4cftwGLcQ: the exception that gets its own beat", src: ["FD"],
      vo: `The one exception is twenty twenty-one. Away teams won forty point three percent of matches that season, and home teams only thirty-seven point nine. Remember that season. We are coming back to it.`,
      scene: LINE({ title: "the one season it flipped", bold: "flipped", mark: { from: I2021, to: I2021, label: "2020/21" }, callouts: [{ i: I2021, s: 1, text: `away ${S21.away_win}% · home ${S21.home_win}%`, at: 60, below: false }] }) },
    { id: "H06", part: "is home advantage real?", ref: "gp4cftwGLcQ: the trend, with the honest framing", src: ["FD", "HA"],
      vo: "Zoom out and the edge is slowly shrinking. A straight line through the thirty-three seasons slides from about forty-six point eight percent to forty-four point five. The Wikipedia article on home advantage says it has been steadily declining for over a century.",
      scene: LINE({ title: "it is real, and it is shrinking", bold: "shrinking", series: [{ name: "home wins", color: "home", vals: D.home_win }, { name: "trend", color: "accent", vals: D.home_win_fit, dash: "16 12" }], ymin: 30, ymax: 55 }) },
    { id: "H06b", part: "is home advantage real?", ref: "gp4cftwGLcQ 5:00: a burst of footage as proof", src: ["PHOTO"],
      vo: "So something real is going on, and it is getting smaller. Which brings us to the suspect everyone names first: the crowd.",
      scene: mont(["fb-crowd", "fb-night", "fb-celebrate", "fb-run"], 2.4) },
    // ---- the crowd test
    { id: "H07", part: "the crowd test", ref: "gp4cftwGLcQ 3:29: the popular explanation, stated fairly", src: ["HA", "PHOTO"],
      vo: "The idea is simple. Home fans vastly outnumber visiting fans. They cheer, they boo, and the players feel it. One study of five thousand Premier League games, by Ryan Boyko, then a Harvard research assistant, reported that every extra ten thousand people in the stadium added a tenth of a goal to the home advantage.",
      scene: { type: "ixclip", bg: "cream", image: PH("ha-crowd-cincinnati"), head: "the crowd, the twelfth man", bold: "crowd", body: "Home fans vastly outnumber visiting fans in most matches (Wikipedia, Home advantage).", credit: `${PC("ha-crowd-cincinnati")} · a 2016 FC Cincinnati match, not the Premier League` } },
    { id: "H08", part: "the crowd test", ref: "gp4cftwGLcQ 4:00: so there is no real evidence", src: ["JO"],
      vo: "But a replication in the same journal, using more recent data, found no evidence to sustain either of his claims, not the crowd size and not the referee bias. So the crowd story was already shaky before twenty twenty.",
      scene: { type: "ixcard", bg: "navy", journal: "Journal of Sports Sciences · 2008", title: "On referee bias, crowd size, and home advantage in the English soccer Premiership", authors: "Johnston", abstract: "[...] identified differences in attendance and referee bias as factors influencing home advantage at soccer matches in the English Premiership. A replication of their study using more recent data [[found no evidence to sustain either of their claims.]]", doi: "doi.org/10.1080/02640410701736780", via: "Crossref / OpenAlex" } },
    { id: "H09", part: "the crowd test", ref: "gp4cftwGLcQ: the natural experiment, set up", src: ["W19"],
      vo: "Then twenty twenty happened. When the league restarted on the seventeenth of June, every match was played behind closed doors, with no more than three hundred key people inside the stadium. It was the experiment nobody could have designed.",
      scene: { type: "ixquote", bg: "navy", text: "an experiment nobody designed", bold: "experiment", sub: "17 June 2020: all matches behind closed doors, at most 300 key people inside (Wikipedia, 2019-20 Premier League)", source: "" } },
    { id: "H10", part: "the crowd test", ref: "gp4cftwGLcQ: two samples, two answers", src: ["FD", "W19", "W20"],
      vo: `Here is what our results say. In the ninety-two matches after the restart, home teams won forty-six point seven percent. No drop at all. But across the whole of twenty twenty-one, a season largely played behind closed doors, they won just thirty-seven point nine.`,
      scene: { type: "ixbars", bg: "navy", title: "home win rate when the stands were empty", bold: "empty", items: [{ label: "all 33 seasons", value: A.home_win, color: "draw" }, { label: "92 matches, June-July 2020", sub: "all behind closed doors", value: R.home_win, color: "home" }, { label: "2020/21, 380 matches", sub: "largely behind closed doors", value: S21.home_win, color: "accent" }], max: 60, source: "Our count · football-data.co.uk · closed-doors facts: Wikipedia, 2019-20 and 2020-21 Premier League" } },
    { id: "H11", part: "the crowd test", ref: "gp4cftwGLcQ: the limit of our own number, said plainly", src: ["W20"],
      vo: "Be careful with both numbers. Ninety-two matches is a small sample, and twenty twenty-one had some fans back in December and again at the end of the season. One season cannot settle it.",
      scene: { type: "ixquote", bg: "navy", text: "two samples. two answers.", bold: "two answers", sub: "92 matches vs 380 · in 2020/21 some fans returned in low-risk areas from 2 December 2020 and for the final rounds in May 2021 (Wikipedia, 2020-21 Premier League)", source: "" } },
    { id: "H12", part: "the crowd test", ref: "gp4cftwGLcQ 4:54: what the studies found, one card each", src: ["SL"],
      vo: "Researchers who studied eight leagues from five countries, including England, found no significant difference with or without a crowd, except in the German and Spanish top divisions.",
      scene: { type: "ixcard", bg: "cream", journal: "Soccer & Society · 2020", title: "Home advantage in European soccer without crowd", authors: "Jimenez Sanchez, Lavin", abstract: "The sample is made up of eight football leagues (soccer) from Germany, Spain, Italy, England and Austria. The results show that there are [[no significant differences between playing with or without a crowd]], except in the German and Spanish top leagues.", doi: "doi.org/10.1080/14660970.2020.1830067", via: "Crossref / OpenAlex" } },
    { id: "H13", part: "the crowd test", ref: "gp4cftwGLcQ: the opposing result", src: ["MA"],
      vo: "A different team, testing eight of the world's top leagues, did find a decrease in the probability of a home win. So the published studies disagree.",
      scene: { type: "ixcard", bg: "cream", journal: "Soccer & Society · 2022", title: "Home team's advantage reduced without crowd support after the COVID-19 outbreak", authors: "Martins, Duarte, Barbosa, Souza", abstract: "We performed comparative hypothesis tests with eight of the world's top soccer leagues, [[confirming a decrease in the probability of a home win]], greatly affecting the matches' outcomes.", doi: "doi.org/10.1080/14660970.2022.2088526", via: "Crossref / OpenAlex" } },
    { id: "H14", part: "the crowd test", ref: "gp4cftwGLcQ: the mechanism, from the study that looked hardest", src: ["FH"],
      vo: "In Germany, the home advantage fell in the Bundesliga but not in the lower divisions. The authors argue it is psychological. Their words: they cannot find strong evidence for a change in referee behaviour or tactics.",
      scene: { type: "ixcard", bg: "cream", journal: "Journal of Sports Economics · 2021", title: "Does Crowd Support Drive the Home Advantage in Professional Football?", authors: "Fischer, Haucap", abstract: "We find that there is a [[reduced home advantage in the first division]], whereas no change is observed in the second and third divisions. [...] We cannot find strong evidence for a change in referee behavior or teams' tactics as main impact channels of occupancy rates on the home advantage. Hence, we argue that [[psychological reasons are of higher importance.]]", doi: "doi.org/10.1177/15270025211026552", via: "Crossref" } },
    // ---- the referee question
    { id: "H15", part: "the referee question", ref: "gp4cftwGLcQ 7:07: the eye test: what we can count ourselves", src: ["FD", "W19", "W20"],
      vo: "That leaves the referee. In normal matches since two thousand and one, the home team picked up one point four eight yellow cards a match and the away team one point eight two. In the ninety-two restart matches, one point four six against one point four two. Across twenty twenty-one, one point four two against one point four five. The gap closes.",
      scene: { type: "ixbars", bg: "navy", title: "yellow cards per match", bold: "yellow cards", decimals: 2, unit: "", max: 2.2, items: [{ label: "normal crowds · home", sub: "9,408 matches", value: 1.48, color: "home" }, { label: "normal crowds · away", value: 1.82, color: "away" }, { label: "restart 2020 · home", sub: "92 matches, closed doors", value: 1.46, color: "home" }, { label: "restart 2020 · away", value: 1.42, color: "away" }, { label: "2020/21 · home", sub: "380 matches, largely closed", value: 1.42, color: "home" }, { label: "2020/21 · away", value: 1.45, color: "away" }], source: "Our count · football-data.co.uk, cards recorded from 2000/01 · closed-doors facts: Wikipedia" } },
    { id: "H16", part: "the referee question", ref: "gp4cftwGLcQ: the study with the same pattern", src: ["EG"],
      vo: "A study of the Bundesliga's ghost matches found the same pattern. Before Covid, referees gave home teams fewer fouls and yellow cards than away teams. In the ghost matches those differences changed, and home teams were treated less favourably than before.",
      scene: { type: "ixcard", bg: "cream", journal: "SSRN · 2020 (working paper)", title: "Home-Bias in Referee Decisions: Evidence from 'Ghost Matches' During the COVID-19 Pandemic", authors: "Endrich, Gesche", abstract: "We find that [[pre-Covid19 referees gave fewer fouls and yellow cards for the home team]] relative to the away team. These differences in fouls and cards changed during the ghost matches so that [[home teams were treated less favorably than before.]]", doi: "doi.org/10.2139/ssrn.3639500", via: "Crossref / OpenAlex" } },
    { id: "H17", part: "the referee question", ref: "gp4cftwGLcQ 9:02: bias and adaptability, the honest reading", src: ["FD", "FH"],
      vo: "A card gap alone does not prove bias. Away teams might simply foul more, or chase games more desperately when they are behind. Our numbers cannot separate those. A before-and-after comparison, like the German one, is the better test. And the Fischer and Haucap paper found no strong evidence for it. So this one is open.",
      scene: { type: "ixquote", bg: "cream", text: "a card gap is not proof of bias", bold: "not proof", sub: "away teams may foul more, or chase games harder when behind. Our data cannot tell which.", source: "" } },
    // ---- how big is the edge
    { id: "H18", part: "how big is the edge?", ref: "gp4cftwGLcQ 11:54: the size of the effect", src: ["FD", "HA"],
      vo: "How big is the edge in goals? Home teams averaged one point five three goals a match, away teams one point one seven. That is about thirty-one percent more. A two thousand and six study by The Times, quoted on Wikipedia, put it at thirty-seven percent.",
      scene: { type: "ixbars", bg: "navy", title: "goals per match", bold: "goals", decimals: 2, unit: "", max: 2, items: [{ label: "home teams", value: A.hg, color: "home" }, { label: "away teams", value: A.ag, color: "away" }], source: "Our count of 12,704 results · The Times 2006 figure as quoted in Wikipedia, Home advantage" } },
    { id: "H18b", part: "how big is the edge?", ref: "gp4cftwGLcQ 7:07: the same test split by case (clubs)", src: ["FD"],
      vo: "It is not the same for every club. Across all those seasons, the average team took one point six two points a home match and one point one two away. Newcastle, with five hundred and ninety-three home matches in the data, took one point seven five at home and one point oh five away. Crystal Palace, with three hundred and six, took one point two one and one point one. Barely any gap at all.",
      scene: { type: "ixbars", bg: "navy", title: "points per match, home vs away", bold: "home vs away", decimals: 2, unit: "", max: 2.4, items: [{ label: "average team · home", value: 1.62, color: "home" }, { label: "average team · away", value: 1.12, color: "away" }, { label: "Newcastle · home", sub: "593 home matches", value: 1.75, color: "home" }, { label: "Newcastle · away", value: 1.05, color: "away" }, { label: "Crystal Palace · home", sub: "306 home matches", value: 1.21, color: "home" }, { label: "Crystal Palace · away", value: 1.1, color: "away" }], source: "Our count of every Premier League result, 1993/94 to 2025/26 · football-data.co.uk · clubs with at least 300 home matches" } },
    { id: "H18c", part: "how big is the edge?", ref: "gp4cftwGLcQ: the open question stated plainly", src: ["FD"],
      vo: "Why would one club get a bigger boost than another? Nothing we found answers that. It could be the crowd, the stadium, or just the squads those clubs happened to have. Our data cannot say, and we would rather tell you that than guess.",
      scene: { type: "ixquote", bg: "cream", text: "why does one club get more?", bold: "more", sub: "the crowd, the stadium, or just the squads? Our data cannot say.", source: "" } },
    { id: "H19", part: "how big is the edge?", ref: "gp4cftwGLcQ: a vivid extreme case", src: ["HA"],
      vo: "And for the extreme case, go up. La Paz sits at three thousand six hundred metres. On the first of April two thousand and nine, Bolivia beat Argentina, then ranked sixth in the world, six goals to one. Argentina's heaviest defeat since nineteen fifty-eight.",
      scene: { type: "ixquote", bg: "green", text: "bolivia 6–1 argentina", bold: "6–1", sub: "La Paz, 3,600 m above sea level · 1 April 2009 · Argentina ranked sixth in the world then; its heaviest defeat since 1958", source: "Wikipedia, Home advantage" } },
    { id: "H19b", part: "how big is the edge?", ref: "gp4cftwGLcQ 5:00: footage as proof", src: ["PHOTO"],
      vo: "Altitude, travel, familiar surroundings, and the crowd all stack together. The article notes that the most commonly cited factors are the hardest to measure, so even their existence is debated.",
      scene: mont(["fb-aerial", "fb-tackle", "fb-goal", "fb-ball"], 2.6) },
    // ---- why home still wins
    { id: "H20", part: "why home still wins", ref: "gp4cftwGLcQ 15:07: the clear verdict", src: ["FD", "FH", "EG"],
      vo: "So why do home teams win so much? Because the edge is real: about forty-six percent against twenty-nine, in thirty-two of thirty-three seasons. It is shrinking slowly. And the strongest signals point at people rather than place: what a crowd does to players, and what it may do to referees. The studies disagree on how much.",
      scene: { type: "ixquote", bg: "green", text: "it is real. it is shrinking. and people are part of it.", bold: "people", sub: "home 45.6% · away 28.8% · 32 of 33 seasons · studies disagree on the crowd's share", source: "" } },
    { id: "H21", part: "why home still wins", ref: "gp4cftwGLcQ 16:00: the limit, then the forward line", src: ["FD", "HA"],
      vo: "What we cannot tell you is how much of the edge belongs to the crowd. One empty-stadium season says a lot. Ninety-two matches say almost nothing. Home advantage has not disappeared. It has just stopped being a guarantee.",
      scene: { type: "ixquote", bg: "cream", text: "not gone. just no longer a guarantee.", bold: "no longer a guarantee", sub: "", source: "" } },
    { id: "H22", part: "why home still wins", ref: "gp4cftwGLcQ: closing question to the viewer", src: ["HA", "PHOTO"],
      vo: "One last thing. In a two-legged tie, the team hosting the second leg gets the home advantage. Given everything you have just seen, would you rather host the first leg or the second? Tell us in the comments.",
      scene: { type: "ixclip", bg: "cream", image: PH("ha-crowd-cincinnati"), flip: true, head: "first leg, or second?", bold: "second", body: "In two-legged ties the team hosting the second leg has the home advantage (Wikipedia, Home advantage).", credit: `${PC("ha-crowd-cincinnati")} · a 2016 FC Cincinnati match, not the Premier League` } },
  ],
  thumbs: [
    // the measured intrcpt thumbnail formula: one background-removed subject (Fulham players, at home, Craven Cottage, 10 May 2025; CC0), motion trail, red arrow, serif headline
    { name: "thumb1-home", type: "ixthumb", headline: "home advantage.", bold: "home", aside: "(is it real?)", asideAt: { x: 150, y: 640 }, cut: { src: "lf2/rival-lines/ha-fulham-3-cutout.png", x: 760, bottom: 40, h: 760 }, arrow: { x1: 520, y1: 650, x2: 800, y2: 560, bend: -90 }, credit: `${PC("ha-fulham-3")} · Fulham v Everton, 10 May 2025` },
    { name: "thumb2-number", type: "ixthumb", headline: "45.6% at home.", bold: "45.6%", aside: "(28.8% away)", asideAt: { x: 150, y: 640 }, cut: { src: "lf2/rival-lines/ha-fulham-3-cutout.png", x: 820, bottom: 40, h: 740 }, arrow: { x1: 540, y1: 650, x2: 860, y2: 560, bend: -90 }, credit: `${PC("ha-fulham-3")} · Fulham v Everton, 10 May 2025` },
    { name: "thumb3-twelfth", type: "ixthumb", headline: "the 12th man.", bold: "12th", aside: "(the data says...)", asideAt: { x: 150, y: 640 }, cut: { src: "lf2/rival-lines/ha-fulham-3-cutout.png", x: 780, bottom: 40, h: 760 }, arrow: { x1: 560, y1: 650, x2: 820, y2: 560, bend: -90 }, credit: `${PC("ha-fulham-3")} · Fulham v Everton, 10 May 2025` },
  ],
};

// a new picture every few seconds (reference rhythm): short clips over the statement cards only, never over the study cards, bar charts or line charts (they must be read)
autoCut(EPISODE.beats, ["fb-crowd", "fb-run", "fb-night", "fb-celebrate", "fb-tackle", "fb-aerial", "fb-goal", "fb-ball", "fb-ref", "fb-empty"], { wps: 2.45, types: new Set(["ixquote"]) });
