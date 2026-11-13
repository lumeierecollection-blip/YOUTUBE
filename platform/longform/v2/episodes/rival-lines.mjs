// Rival Lines long-form sample: "How Spain Won the Euro 2024 Final, in Data". All numbers are counted from StatsBomb open data for match
// 3943043 (events, lineups, 360 freeze-frames), prepared by platform/longform/rival/prepare.mjs into data/longform/rival/euro2024-final.json.
// Limits, stated on screen where they apply: 360 frames have no player identities (dots between events are linked by nearest position),
// average positions are on-ball positions, and "passes per 15 minutes" is a proxy for possession, not possession itself.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const d = JSON.parse(readFileSync(join(ROOT, "data/longform/rival/euro2024-final.json"), "utf8"));
const xi = (team) => d.xi.find((x) => x.team === team), [g1, g2, g3] = d.goals, S = d.stats.Spain, E = d.stats.England;
const id = (team, last) => xi(team).players.find((p) => p.name.endsWith(last)).id;
const FULL = { fx: 60, fy: 40, yaw: 0, tilt: 40, dist: 160, scale: 12.6, cx: 960, cy: 575 };
const att = JSON.parse(readFileSync(join(ROOT, "src/skills/remotion-render/public/lf2/rival-lines/ATTRIBUTIONS.json"), "utf8"));
const PH = (id) => `lf2/rival-lines/${att[id].file}`, PC = (id) => `${att[id].author}, ${att[id].licence}, via Wikimedia Commons`;
const NOTE_SEQ = "positions at each event: StatsBomb 360 freeze-frames; movement between events interpolated; player links estimated";

export const SOURCES = {
  WEF: { title: "Wikipedia: UEFA Euro 2024 final", url: "https://en.wikipedia.org/wiki/UEFA_Euro_2024_final", retrieved: "2026-11-13" },
  PHOTO: { title: "Licensed photographs via Wikimedia Commons (La Moncloa government press photos; CC licences): public/lf2/rival-lines/ATTRIBUTIONS.json", url: "https://commons.wikimedia.org/" },
  SB: { title: "StatsBomb open data: UEFA Euro 2024 final, Spain v England, match 3943043 (events, lineups, 360)", url: "https://github.com/statsbomb/open-data", note: "Free for public use with attribution to StatsBomb (repository README, Terms & Conditions)" },
};

export const EPISODE = {
  channel: "rival-lines", slug: "euro-2024-final", title: "How Spain Won the Euro 2024 Final, in Data", target_minutes: 10,
  beats: [
    { id: "R01", part: "cold open", ref: "N8PZt_9_adI 0:00: a counted number alone on black", src: ["SB"], frames: [8, 50],
      vo: `${S.passes} passes. That is how many Spain played in the final in Berlin. England played ${E.passes}.`,
      scene: { type: "number", value: S.passes, countFrom: 0, unit: "Spain passes", sub: `England: ${E.passes} · Euro 2024 final · data: StatsBomb` } },
    { id: "R02", part: "cold open", ref: "oZaPKaIVIA0 / KC2Vgjw282s: crest scoreline card with minute, title ghosted behind, scorers under it", src: ["SB"], frames: [40],
      vo: "Spain won two-one. On the scoreboard it was close. In the data, it was not, except for one fifteen-minute spell in the second half.",
      scene: { type: "scorecard", home: "Spain", away: "England", score: "2 – 1", minute: "FULL TIME", title: "Euro 2024 final", date: "14 JULY 2024 · OLYMPIASTADION BERLIN", scorers: [{ team: "Spain", text: "Williams 47'" }, { team: "Spain", text: "Oyarzabal 86'" }, { team: "England", text: "Palmer 73'" }] } },
    { id: "R02b", part: "cold open", ref: "Football Made Simple cuts to real pictures between graphics; ours is a licensed still because match footage is not licensable to us", src: ["WEF", "PHOTO"], frames: [60],
      vo: "The day after the final, the Spanish squad brought the trophy to the prime minister's residence in Madrid. It was their fourth European Championship, a record. They had won all seven of their matches at the tournament and scored fifteen goals, also a record for a single Euros.",
      scene: { type: "photo", image: PH("spain-moncloa-2024-1"), credit: PC("spain-moncloa-2024-1"), kicker: "15 JULY 2024 · MADRID", callout: "Champions\nof Europe" } },
    { id: "R03", part: "cold open", ref: "KC2Vgjw282s: dark pitch, the move animated, one capital callout, COMING UP tag", src: ["SB"], frames: [90, 360],
      vo: "This is how Spain scored first: seven passes in twenty seconds, started by a player who had only come on at half-time.",
      scene: { type: "sequence", seq: g1, teamName: "Spain", oppName: "England", cam: { ...FULL, scale: 19, tilt: 50, cy: 600 }, follow: 0.7, speed: 1.4, callout: "Seven passes.\nTwenty seconds.", calloutAt: 200, coming: "COMING UP...", note: NOTE_SEQ } },
    { id: "R04", part: "the set-up", ref: "Football Made Simple: formation dots on the dark pitch, both teams, then the units joined by lines", src: ["SB"], frames: [120],
      vo: "Both teams started in a four-two-three-one. These dots are where each starter actually was when they touched the ball in the first half.",
      scene: { type: "formation", cam: FULL, sides: [{ team: "Spain", players: xi("Spain").players }, { team: "England", players: xi("England").players, mirror: true }], labelAll: false, callout: "Both 4-2-3-1", note: "dots = average on-ball position, first half · England shown attacking right to left" } },
    { id: "R05", part: "the set-up", ref: "Nx8h403Sj_s: player links drawn on the pitch; one callout", src: ["SB"], frames: [120],
      vo: `Spain's most-used passing link in the first half was not in midfield. It was between the two centre-backs, Le Normand and Laporte: ${d.network.Spain.reduce((m, p) => Math.max(m, p.n), 0)} completed passes.`,
      scene: { type: "network", cam: FULL, side: xi("Spain"), pairs: d.network.Spain, callout: "Le Normand – Laporte:\n31 passes" } },
    { id: "R06", part: "the set-up", ref: "Football Made Simple: pressure shown as zones on the pitch", src: ["SB"], frames: [100],
      vo: "England pressed most in the middle third: seventy-five of their hundred and sixty-five pressures. They let Spain have the ball at the back.",
      scene: { type: "press", cam: FULL, grid: d.pressGrid.England, team: "England", callout: "75 of 165\nin midfield" } },
    { id: "R07", part: "the first goal", ref: "KC2Vgjw282s: substitution as a turning point", src: ["SB"], frames: [70],
      vo: "At half-time Spain took off their midfield anchor, Rodri. Martín Zubimendi replaced him.",
      scene: { type: "sub", cam: FULL, minute: 46, team: "Spain", off: "Rodri", on: "Zubimendi", fact: "Forty-nine seconds into the second half, Zubimendi played the first pass of the move. Twenty seconds later Spain were ahead." } },
    { id: "R08", part: "the first goal", ref: "Football Made Simple: the move re-run slowly with the ball-carrier named", src: ["SB"], frames: [120, 420],
      vo: "Cucurella, Williams, back to Laporte, Fabián Ruiz, Carvajal, then Lamine Yamal across to Williams. Williams shot first time with his left foot.",
      scene: { type: "sequence", seq: g1, teamName: "Spain", oppName: "England", cam: { ...FULL, scale: 22, tilt: 52, cy: 600 }, follow: 0.85, speed: 0.9, start: 8, callout: "Yamal to Williams", calloutAt: 330, note: NOTE_SEQ } },
    { id: "R09", part: "england's spell", ref: "oZaPKaIVIA0: the scoreline card reused as the minute marker, with a strike", src: ["SB"], frames: [40],
      vo: "Then England had their best spell of the match.",
      scene: { type: "scorecard", home: "Spain", away: "England", score: "1 – 1", minute: "73'", strike: true, title: "Euro 2024 final", scorers: [{ team: "Spain", text: "Williams 47'" }, { team: "England", text: "Palmer 73'" }] } },
    { id: "R10", part: "england's spell", ref: "KC2Vgjw282s: substitution card", src: ["SB"], frames: [70],
      vo: "Cole Palmer came on for Kobbie Mainoo with twenty minutes left. Two minutes and fifteen seconds later, he scored.",
      scene: { type: "sub", cam: FULL, minute: 70, team: "England", off: "Mainoo", on: "Palmer", fact: "On at 69:53. Goal at 72:08: his third time receiving the ball." } },
    { id: "R10b", part: "england's spell", ref: "Licensed photograph of the player, credit on screen", src: ["PHOTO"], frames: [60],
      vo: "Palmer had come on with England a goal down and the match drifting away from them.",
      scene: { type: "photo", image: PH("palmer-2024"), credit: PC("palmer-2024"), kicker: "COLE PALMER · PHOTO: NOVEMBER 2024", callout: "On at 69:53", pos: "50% 25%" } },
    { id: "R11", part: "england's spell", ref: "Football Made Simple: the move animated", src: ["SB"], frames: [300],
      vo: "Saka to Bellingham, Bellingham lays it back, and Palmer shoots from outside the box.",
      scene: { type: "sequence", seq: g2, teamName: "England", oppName: "Spain", cam: { ...FULL, scale: 22, tilt: 52, cy: 600 }, follow: 0.85, speed: 1, start: 10, callout: "Bellingham to Palmer", calloutAt: 120, note: NOTE_SEQ } },
    { id: "R12", part: "the winner", ref: "Football Made Simple: the move animated, callout on the assist", src: ["SB"], frames: [330],
      vo: "Spain answered. Oyarzabal, who had replaced Morata, played it out to Cucurella, then got on the end of it. Cucurella's cross was along the ground. Oyarzabal scored with his right foot.",
      scene: { type: "sequence", seq: g3, teamName: "Spain", oppName: "England", cam: { ...FULL, scale: 22, tilt: 52, cy: 600 }, follow: 0.85, speed: 1, start: 4, callout: "Low cross.\nOyarzabal again.", calloutAt: 260, note: NOTE_SEQ } },
    { id: "R13", part: "the numbers", ref: "Football Made Simple shot maps: circle size = chance quality", src: ["SB"], frames: [120],
      vo: `Over the match Spain had ${S.shots} shots worth ${S.xg} expected goals. England had ${E.shots} worth ${E.xg}.`,
      scene: { type: "shots", cam: FULL, shots: d.shots, home: "Spain", away: "England", callout: `${S.shots} shots to ${E.shots}` } },
    { id: "R14", part: "the numbers", ref: "Football Made Simple: head-to-head stat bars", src: ["SB"], frames: [120],
      vo: `Spain completed ${S.final_third_passes} passes into the final third. England completed ${E.final_third_passes}.`,
      scene: { type: "bars", home: "Spain", away: "England", title: "EURO 2024 FINAL · COUNTED FROM EVENT DATA", rows: [{ label: "Shots", a: S.shots, b: E.shots }, { label: "Expected goals (xG)", a: S.xg, b: E.xg, dec: 2 }, { label: "Completed passes", a: S.passes_completed, b: E.passes_completed }, { label: "Completed passes into the final third", a: S.final_third_passes, b: E.final_third_passes }, { label: "Pressures", a: S.pressures, b: E.pressures }] } },
    { id: "R15", part: "ending", ref: "Dki5tjN0rDE: a timeline spine with the turning points on it", src: ["SB"], frames: [100],
      vo: "Seven substitutions, three goals, and the only fifteen minutes in which England passed more than Spain included the equaliser.",
      scene: { type: "timeline", home: "Spain", away: "England", title: "The final, minute by minute", focus: 3, events: [
        ...d.goals.map((g) => ({ minute: g.minute, kind: "goal", team: g.team, text: `${g.scorer.split(" ").slice(-1)[0]} ${g.clock}` })),
        ...d.subs.map((s) => ({ minute: s.minute, kind: "sub", team: s.team, text: `${s.on.split(" ").slice(-1)[0]} on (${s.team === "Spain" ? "ESP" : "ENG"})` }))].sort((a, b) => a.minute - b.minute) } },
  ],
  transitions: [
    { name: "tx1-number-to-score", a: "R01", b: "R02", kind: "push", dir: "up", dur: 14, aAt: 60, note: "number card pushed up by the scoreline" },
    { name: "tx2-sub-to-move", a: "R07", b: "R08", kind: "blurwhip", dir: "left", dur: 14, aAt: 80, note: "directional blur whip from the sub card into the move" },
    { name: "tx3-score-to-sub", a: "R09", b: "R10", kind: "wipe", dur: 14, aAt: 50, note: "accent-line wipe" },
  ],
  thumbs: [
    { name: "thumb1-passes", big: "592\nvs 323", small: "Spain's final", seq: g1, teamName: "Spain", oppName: "England", at: 18, cam: { ...FULL, fx: 78, scale: 19, tilt: 50, cx: 1300 } },
    { name: "thumb2-palmer", big: "2 min\n15 sec", small: "Palmer's goal", seq: g2, teamName: "England", oppName: "Spain", at: 14, cam: { ...FULL, fx: 90, scale: 21, tilt: 50, cx: 1300 } },
    { name: "thumb3-winner", big: "How Spain\nwon it", small: "In data", seq: g3, teamName: "Spain", oppName: "England", at: 12.5, cam: { ...FULL, fx: 95, scale: 21, tilt: 50, cx: 1300 } },
  ],
};
