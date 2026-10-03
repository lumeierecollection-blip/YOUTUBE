// node scripts/test-composition-rotation.mjs — the no-repeat rule (scripts/composition-rotation.js).
import { enforceRotation, candidatesFor } from "./composition-rotation.js";
import { compositionFor } from "../src/skills/remotion-render/visual/canvas-layout.js";

let bad = 0;
const yes = (name, cond, detail = "") => { if (!cond) bad++; console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

// A tiny harness: beats are { vt, extra, sentence, headline }.
function run(beats, accept = () => true) {
  const logs = [];
  const comp = (i) => compositionFor(beats[i].vt, false, beats[i].extra || {});
  const r = enforceRotation(beats.length, {
    compositionOf: comp,
    candidates: (i) => candidatesFor({ sentence: beats[i].sentence, headline: beats[i].headline }),
    accept,
    apply: (i, alt) => { beats[i].vt = alt.visual_type; beats[i].extra = alt.extra; beats[i].data = alt.data; },
    log: (m) => logs.push(m),
  });
  return { r, logs, comps: beats.map((_, i) => comp(i)) };
}
const noRepeat = (comps) => comps.every((c, i) => i === 0 || c !== comps[i - 1]);

// Two statements in a row: the second becomes TYPE-SPLIT.
let b = [{ vt: "TYPE", sentence: "Rates rose.", headline: "Rates rose sharply" }, { vt: "TYPE", sentence: "Prices followed the rise.", headline: "Prices followed the rise" }];
let x = run(b);
yes("TYPE, TYPE -> TYPE-FULL, TYPE-SPLIT", x.comps.join() === "TYPE-FULL,TYPE-SPLIT", x.comps.join());
yes("the log line is the one the brief names", x.logs[0].startsWith("[plan] beat 1 avoided repeating beat 0 type"), x.logs[0]);

// A long run of statements alternates FULL / SPLIT.
b = Array.from({ length: 7 }, (_, i) => ({ vt: "TYPE", sentence: `Statement number ${i} ends here.`, headline: `Statement ${i} ends here` }));
x = run(b);
yes("7 statements alternate and never repeat", noRepeat(x.comps) && x.r.repeats.length === 0, x.comps.join());

// DATA, DATA: the second is re-grounded from its sentence.
b = [{ vt: "TYPE", sentence: "Intro.", headline: "Intro here" }, { vt: "BAR", sentence: "Needs are 50%, wants 30%.", headline: "Split" }, { vt: "GAUGE", sentence: "Forty five percent of renters, 45%, are burdened.", headline: "Burden" }];
x = run(b);
yes("DATA-FULL twice is broken by the sentence's own figure", noRepeat(x.comps) && x.comps[2] !== "DATA-FULL", x.comps.join());

// A list, a timeline and a comparison are found in plain statements — but only
// where a repeat needs breaking (rotation fixes repeats, it does not upgrade beats).
b = [{ vt: "TYPE", sentence: "Intro.", headline: "Intro here" }, { vt: "TYPE", sentence: "Save, invest and spend.", headline: "Save invest spend" }, { vt: "TYPE", sentence: "The law passed in 2019 and was repealed in 2024.", headline: "The law" }];
x = run(b);
yes("a list is found; the next statement is no repeat, so it stays", x.comps.join() === "TYPE-FULL,LIST-BUILD,TYPE-FULL", x.comps.join());
b = [{ vt: "TYPE", sentence: "Intro.", headline: "Intro here" }, { vt: "TYPE", sentence: "The law passed in 2019 and was repealed in 2024.", headline: "The law" }];
x = run(b);
yes("a timeline is found in a repeated statement", x.comps.join() === "TYPE-FULL,TIMELINE", x.comps.join());
b = [{ vt: "TYPE", sentence: "Intro.", headline: "Intro here" }, { vt: "TYPE", sentence: "Renters pay 42% of income versus 31% for owners.", headline: "Who pays more" }];
x = run(b);
yes("a comparison is found in a repeated statement", x.comps.join() === "TYPE-FULL,COMPARISON-SPLIT", x.comps.join());

// The hook is never changed.
b = [{ vt: "TYPE", sentence: "Save, invest and spend.", headline: "Hook words" }, { vt: "TYPE", sentence: "Nothing else here.", headline: "Nothing" }];
x = run(b);
yes("the hook (beat 0) stays", x.comps[0] === "TYPE-FULL", x.comps.join());

// A one-word headline with nothing grounded: the repeat is reported, not hidden.
b = [{ vt: "TYPE", sentence: "Wow.", headline: "Wow" }, { vt: "TYPE", sentence: "Yes.", headline: "Yes" }];
x = run(b);
yes("an ungroundable repeat is logged, not hidden", x.r.repeats.length === 1 && x.logs.some((l) => l.includes("could not avoid")), x.logs.join(" | "));

// The caller's gate is honoured.
b = [{ vt: "TYPE", sentence: "Intro.", headline: "Intro here" }, { vt: "TYPE", sentence: "Save, invest and spend.", headline: "Save invest spend" }];
x = run(b, (i, alt) => alt.visual_type !== "LIST");
yes("an alternative the gate rejects is skipped", x.comps[1] !== "LIST-BUILD", x.comps.join());

// Candidate order: the grounded visuals come before the text fallbacks.
const cs = candidatesFor({ sentence: "Renters pay 42% of income versus 31% for owners in 2019 and 2024.", headline: "Who pays more" }).map((c) => c.composition);
yes("candidates: visuals first, text last", cs[cs.length - 1] === "TYPE-FULL" && cs[cs.length - 2] === "TYPE-SPLIT" && cs.includes("COMPARISON-SPLIT"), cs.join());

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
