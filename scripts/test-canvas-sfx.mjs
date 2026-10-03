// node scripts/test-canvas-sfx.mjs — the part-D SFX trigger rules (visual/canvas-sfx.js).
import { existsSync } from "node:fs";
import { canvasSfxEvents, SFX_PALETTE, MAX_SFX, MIN_GAP } from "../src/skills/remotion-render/visual/canvas-sfx.js";
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };

// Every palette file exists in the Remotion public dir; exactly the six roles.
eq("six roles", Object.keys(SFX_PALETTE).sort(), ["chime", "impact-low", "number-roll", "pop", "tick", "whoosh-soft"]);
for (const [r, s] of Object.entries(SFX_PALETTE)) eq(`${r}: ${s.file} on disk`, existsSync(new URL(`../src/skills/remotion-render/public/sfx/${s.file}`, import.meta.url)), true);
eq("levels as specified", Object.fromEntries(Object.entries(SFX_PALETTE).map(([k, v]) => [k, v.db])), { pop: -18, "number-roll": -16, "whoosh-soft": -22, tick: -20, chime: -14, "impact-low": -12 });

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
];
const r = canvasSfxEvents(beats);
eq(`at most ${MAX_SFX}`, r.events.length <= MAX_SFX, true);
eq("hook chime fires", r.events.some((e) => e.trigger === "chime" && e.beat === 0), true);
eq("CTA impact fires", r.events.some((e) => e.trigger === "impact-low" && e.beat === 6), true);
eq("the counter gets number-roll", r.events.some((e) => e.trigger === "number-roll" && e.beat === 1), true);
eq("a chart beat is silent (D.5)", r.events.some((e) => e.beat === 2 && e.trigger !== "whoosh-soft"), false);
eq(`no two SFX within ${MIN_GAP} frames`, r.events.every((e, i) => i === 0 || e.atFrame - r.events[i - 1].atFrame >= MIN_GAP), true);
eq("only palette files", r.events.every((e) => Object.values(SFX_PALETTE).some((s) => s.file === e.file)), true);
eq("over the cap is reported as dropped, not silently lost", r.dropped.length > 0, true);
console.log(r.events.map((e) => `  ${e.trigger} @${e.atFrame} beat ${e.beat} (${e.reason})`).join("\n"));
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
