#!/usr/bin/env node
/**
 * Rival Lines long form: turns one StatsBomb open-data match (events + lineups + 360 freeze-frames) into the data the scenes animate.
 * Source: github.com/statsbomb/open-data (free for public use with attribution "StatsBomb"). Nothing here is invented: every number is counted
 * from the event file. LIMIT, stated plainly: 360 freeze-frames give player positions at each event but NOT player identities (only teammate /
 * opponent / keeper / actor). Between two events we match each dot to the nearest dot of the same side; that link is an estimate, the positions
 * at each event are data. Scenes label this.
 * Usage: node platform/longform/rival/prepare.mjs <events.json> <lineups.json> <three-sixty.json> <out.json>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [, , evF, luF, tsF, outF] = process.argv;
const ev = JSON.parse(readFileSync(evF, "utf8")), lineups = JSON.parse(readFileSync(luF, "utf8")), ff = new Map(JSON.parse(readFileSync(tsF, "utf8")).map((f) => [f.event_uuid, f]));
const secs = (e) => e.minute * 60 + e.second + (parseFloat("0." + (e.timestamp.split(".")[1] || "0")) || 0);
const teams = [...new Set(ev.filter((e) => e.type.name === "Starting XI").map((e) => e.team.name))];
const short = (full) => { const l = lineups.flatMap((t) => t.lineup).find((p) => p.player_name === full); return (l && l.player_nickname) || full; };
const r1 = (n) => Math.round(n * 10) / 10;

// 1. Starting XI with average on-ball position in the first half (all events with a location by that player).
const xi = ev.filter((e) => e.type.name === "Starting XI").map((e) => ({ team: e.team.name, formation: String(e.tactics.formation), players: e.tactics.lineup.map((l) => {
  const mine = ev.filter((x) => x.period === 1 && x.player && x.player.id === l.player.id && x.location && ["Pass", "Carry", "Ball Receipt*", "Shot", "Dribble"].includes(x.type.name));
  const ax = mine.reduce((s, x) => s + x.location[0], 0) / (mine.length || 1), ay = mine.reduce((s, x) => s + x.location[1], 0) / (mine.length || 1);
  return { id: l.player.id, name: short(l.player.name), number: l.jersey_number, position: l.position.name, avg: mine.length ? [r1(ax), r1(ay)] : null, touches: mine.length };
}) }));

// 2. Counted match figures.
const count = (t, f) => ev.filter((e) => e.team.name === t && f(e)).length;
const stats = Object.fromEntries(teams.map((t) => {
  const shots = ev.filter((e) => e.team.name === t && e.type.name === "Shot" && e.period <= 4), passes = ev.filter((e) => e.team.name === t && e.type.name === "Pass");
  return [t, { shots: shots.length, on_target: shots.filter((s) => ["Goal", "Saved", "Saved to Post"].includes(s.shot.outcome.name)).length, xg: Math.round(shots.reduce((s, e) => s + e.shot.statsbomb_xg, 0) * 100) / 100, passes: passes.length, passes_completed: passes.filter((p) => !p.pass.outcome).length, pressures: count(t, (e) => e.type.name === "Pressure"), final_third_passes: passes.filter((p) => !p.pass.outcome && p.pass.end_location[0] >= 80).length }];
}));
const shots = ev.filter((e) => e.type.name === "Shot").map((e) => ({ team: e.team.name, player: short(e.player.name), minute: e.minute, second: e.second, x: r1(e.location[0]), y: r1(e.location[1]), xg: Math.round(e.shot.statsbomb_xg * 1000) / 1000, outcome: e.shot.outcome.name, body: e.shot.body_part.name }));
const subs = ev.filter((e) => e.type.name === "Substitution").map((e) => ({ minute: e.minute, team: e.team.name, off: short(e.player.name), on: short(e.substitution.replacement.name) }));
// possession share per 15 minutes by pass count (a proxy, labelled as such in the scene)
const quarters = [0, 15, 30, 45, 60, 75].map((m) => { const p = Object.fromEntries(teams.map((t) => [t, ev.filter((e) => e.team.name === t && e.type.name === "Pass" && e.minute >= m && e.minute < m + 15 + (m === 75 ? 30 : 0)).length])); return { from: m, ...p }; });
// pass network, first half: completed passes between starters
const network = Object.fromEntries(teams.map((t) => { const pairs = {}; for (const e of ev) if (e.team.name === t && e.period === 1 && e.type.name === "Pass" && !e.pass.outcome && e.pass.recipient) { const k = [e.player.id, e.pass.recipient.id].sort().join("-"); pairs[k] = (pairs[k] || 0) + 1; } return [t, Object.entries(pairs).filter(([, n]) => n >= 4).map(([k, n]) => ({ a: +k.split("-")[0], b: +k.split("-")[1], n }))]; }));
// pressure map: where each team pressed (12 x 8 grid of counts), in that team's own attacking-right frame
const pressGrid = Object.fromEntries(teams.map((t) => { const g = Array.from({ length: 8 }, () => Array(12).fill(0)); for (const e of ev) if (e.team.name === t && e.type.name === "Pressure" && e.location) g[Math.min(7, Math.floor(e.location[1] / 10))][Math.min(11, Math.floor(e.location[0] / 10))]++; return [t, g]; }));

// 3. Goal sequences: the possession that ended in each goal, last 25 s, with matched freeze-frames.
function sequence(goal) {
  const tg = secs(goal), chain = ev.filter((e) => e.period === goal.period && e.possession === goal.possession && secs(e) >= tg - 25 && secs(e) <= tg && e.location && ["Pass", "Carry", "Shot", "Ball Receipt*", "Dribble"].includes(e.type.name) && e.team.name === goal.team.name);
  const t0 = secs(chain[0]); let nextId = 1, prev = null; const frames = [];
  for (const e of chain) {
    const f = ff.get(e.id); if (!f) continue;
    const dots = f.freeze_frame.map((p) => ({ x: r1(p.location[0]), y: r1(p.location[1]), mate: p.teammate, keeper: p.keeper, actor: p.actor }));
    const dt = prev ? Math.max(0.4, secs(e) - prev.t) : 0, limit = 6 + dt * 7; // a player covers at most ~8 m/s; 1 unit is roughly 0.9 m
    const taken = new Set();
    for (const d of dots) {
      let best = null, bd = limit;
      if (prev) for (const q of prev.dots) if (q.mate === d.mate && q.keeper === d.keeper && !taken.has(q.id)) { const dist = Math.hypot(q.x - d.x, q.y - d.y); if (dist < bd) { bd = dist; best = q; } }
      if (best) { d.id = best.id; taken.add(best.id); } else d.id = nextId++;
    }
    const fr = { t: r1(secs(e) - t0), dots, type: e.type.name, player: short(e.player.name), from: [r1(e.location[0]), r1(e.location[1])], to: e.pass ? e.pass.end_location.map(r1) : e.carry ? e.carry.end_location.map(r1) : e.shot ? e.shot.end_location.slice(0, 2).map(r1) : null, duration: r1(e.duration || 0), recipient: e.pass && e.pass.recipient ? short(e.pass.recipient.name) : null };
    frames.push(fr); prev = { t: secs(e), dots };
  }
  return { team: goal.team.name, scorer: short(goal.player.name), minute: goal.minute, second: goal.second, clock: `${goal.minute + 1}'`, xg: Math.round(goal.shot.statsbomb_xg * 1000) / 1000, assist: (() => { const a = ev.find((e) => e.id === goal.shot.key_pass_id); return a ? short(a.player.name) : null; })(), seconds: r1(tg - t0), frames };
}
const goals = ev.filter((e) => e.type.name === "Shot" && e.shot.outcome.name === "Goal" && e.period <= 4).map(sequence);

const out = { source: "StatsBomb open data, match 3943043 (UEFA Euro 2024 final, Spain v England, 14 July 2024)", source_url: "https://github.com/statsbomb/open-data", pitch: { length: 120, width: 80, note: "StatsBomb units; every event is recorded with the acting team attacking left to right" }, teams, xi, stats, shots, subs, quarters, network, pressGrid, goals };
mkdirSync(dirname(outF), { recursive: true });
writeFileSync(outF, JSON.stringify(out));
console.log(JSON.stringify({ teams, stats, subs: subs.length, goals: goals.map((g) => ({ scorer: g.scorer, clock: g.clock, assist: g.assist, frames: g.frames.length, seconds: g.seconds, chain: g.frames.map((f) => `${f.t}s ${f.type} ${f.player}`).join(" > ") })) }, null, 1));
