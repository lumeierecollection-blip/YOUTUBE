// node scripts/test-canvas-sfx.mjs — the CC0 SFX palette and trigger rules (visual/canvas-sfx.js,
// scripts/sfx-cc0.mjs). The sound files are fetched on the runner, so this tests the rules, the
// sources and the WAV peak reader — not the files.
import { canvasSfxEvents, sfxRuleProblems, SFX_PALETTE, MAX_SFX, MIN_GAP, ALIGN_MS } from "../src/skills/remotion-render/visual/canvas-sfx.js";
import { SFX_SOURCES, wavPeak, creditFor } from "./sfx-cc0.mjs";
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };

// The palette: five recorded CC0 sounds, each with a source, an author and a CC0 licence.
eq("five roles", Object.keys(SFX_PALETTE).sort(), ["shutter", "swish", "switch", "whip", "whoosh"]);
for (const [r, s] of Object.entries(SFX_PALETTE)) {
  const src = SFX_SOURCES.find((x) => `cc0/${x.file}` === s.file);
  eq(`${r}: ${s.file} has a source`, !!src, true);
  eq(`${r}: CC0, author and origin named`, !!src && src.license === "CC0 1.0" && !!src.author && /^https:\/\//.test(src.source) && /^https:\/\/remotion\.media\//.test(src.url), true);
}
eq("the old synthesized tone and tick loop are gone", Object.values(SFX_PALETTE).some((s) => /reveal|number-roll|number-count/.test(s.file)), false);
eq("credit line for a played file", creditFor("cc0/whoosh.wav")?.author, "1bob");

// WAV peak reader: a 16-bit mono WAV whose loudest sample is at 0.1 s.
const wav = (() => {
  const rate = 8000, n = 1600, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(i === 800 ? -30000 : Math.round(1000 * Math.sin(i / 3)), 44 + i * 2);
  return b;
})();
const pk = wavPeak(wav);
eq("wav: duration", pk.duration_ms, 200);
eq("wav: loudest sample at 100 ms", pk.peak_ms, 100);

const beat = (i, canvas, dur = 120) => ({ start_frame: i * dur, duration_frames: dur, scene: { canvas: { headline: "A headline here", beat_index: i, beat_total: 10, ...canvas } } });
const T = { visual_type: "TYPE", composition: "TYPE-FULL" };
const beats = [
  beat(0, T),
  beat(1, { visual_type: "COUNTER", composition: "NUMBER-FULL", data: { value: "$352 million", label: "stolen" } }),
  beat(2, { visual_type: "BAR", composition: "DATA-FULL", data: { bars: [{ label: "a", value: "10" }, { label: "b", value: "30" }] } }),
  beat(3, { ...T, concept_visuals: [{ name: "warning-triangle", class: "symbol", w: 1, h: 1 }] }),
  beat(4, { visual_type: "MAP", composition: "MAP-CENTERED", data: { place: "Ohio" } }),
  beat(5, { visual_type: "PROCESS", composition: "PROCESS-FULL", data: { nodes: ["rates", "sales"] } }),
  beat(6, T),
  beat(7, T),
  beat(8, { visual_type: "COUNTER", composition: "NUMBER-FULL", data: { value: "40%", label: "of sales" } }),
  beat(9, T),
];
const peaks = { "cc0/whoosh.wav": 2, "cc0/whip.wav": 3, "cc0/shutter.wav": 1, "cc0/draw-knife.wav": 5, "cc0/switch.wav": 0 };
const r = canvasSfxEvents(beats, { peaks });
console.log(r.events.map((e) => `  ${e.trigger} @${e.atFrame} (event ${e.eventFrame}) beat ${e.beat} (${e.reason})`).join("\n"));
eq(`at most ${MAX_SFX}`, r.events.length <= MAX_SFX, true);
eq("silence: not every beat has a sound", new Set(r.events.map((e) => e.beat)).size < beats.length, true);
eq("a chart beat has no word or object sound", r.events.some((e) => e.beat === 2 && !["whoosh", "whip"].includes(e.trigger)), false);
eq("the number card gets the card swish", r.events.some((e) => e.trigger === "swish" && e.beat === 1), true);
eq("no transition between two beats of one family (TYPE -> TYPE)", r.events.some((e) => ["whoosh", "whip"].includes(e.trigger) && e.beat === 7), false);
eq(`no two SFX within ${MIN_GAP} frames`, r.events.every((e, i) => i === 0 || e.eventFrame - r.events[i - 1].eventFrame >= MIN_GAP), true);
eq("never the same sound twice in a row", r.events.every((e, i) => i === 0 || e.file !== r.events[i - 1].file), true);
const tr = r.events.filter((e) => ["whoosh", "whip"].includes(e.trigger)).map((e) => e.trigger);
eq("transitions alternate whoosh / whip", tr.every((t, i) => i === 0 || t !== tr[i - 1]), true);
eq("every sound's peak lands ON its event (±100 ms)", r.events.every((e) => e.eventFrame === 0 || Math.abs(e.atFrame + e.peakFrames - e.eventFrame) <= (ALIGN_MS / 1000) * 30), true);
eq("only palette files", r.events.every((e) => Object.values(SFX_PALETTE).some((s) => s.file === e.file)), true);
eq("over the cap / gap is reported as dropped, not silently lost", r.dropped.length > 0, true);

// Only judged-recorded files play.
const only = canvasSfxEvents(beats, { peaks, recorded: new Set(["cc0/whoosh.wav", "cc0/swish.wav"]) });
eq("unjudged / robotic files never play", only.events.every((e) => e.file === "cc0/whoosh.wav"), true);
eq("...and their drops are reported", only.dropped.some((d) => /not judged "recorded"/.test(d)), true);
eq("no judged file -> no SFX at all", canvasSfxEvents(beats, { recorded: new Set() }).events.length, 0);

// Layer 1 sfx-rules on manifest entries.
const m = (role, file, at, ev, peak, b) => ({ role, file, at_frame: at, event_frame: ev, peak_frames: peak, beat: b });
const rec = new Set(Object.values(SFX_PALETTE).map((s) => s.file));
eq("rules pass a clean list", sfxRuleProblems([m("whoosh", "cc0/whoosh.wav", 118, 120, 2, 1), m("swish", "cc0/draw-knife.wav", 400, 405, 5, 3)], { recorded: rec }), []);
eq("rules fail a robotic file", sfxRuleProblems([m("whoosh", "cc0/whoosh.wav", 118, 120, 2, 1)], { recorded: new Set() }).length, 1);
eq("rules fail a sound 200 ms off its event", sfxRuleProblems([m("whoosh", "cc0/whoosh.wav", 124, 120, 2, 1)], { recorded: rec }).length, 1);
eq("rules fail the same sound twice in a row", sfxRuleProblems([m("switch", "cc0/switch.wav", 10, 10, 0, 0), m("switch", "cc0/switch.wav", 200, 200, 0, 3)], { recorded: rec }).length, 1);
eq("rules fail sound on three beats in a row", sfxRuleProblems([m("switch", "cc0/switch.wav", 10, 10, 0, 0), m("whoosh", "cc0/whoosh.wav", 118, 120, 2, 1), m("swish", "cc0/draw-knife.wav", 235, 240, 5, 2)], { recorded: rec }).length, 1);

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
