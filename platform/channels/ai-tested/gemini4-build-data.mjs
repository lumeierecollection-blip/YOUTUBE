// Builds gemini4-data.json from the two stored runs. Counts are computed here, not typed. Usage: node platform/channels/ai-tested/gemini4-build-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
const J = (f) => JSON.parse(readFileSync(`data/longform/ai-tested/${f}`, "utf8"));
const run1 = J("gemini4-hydrogen-run1-4096tokens.json"), earlier = J("multiply-run2.json");
const H = run1.models.find((m) => m.id === "gemini-4-hydrogen"), O = earlier.models.find((m) => m.id === "gemini-3.1-flash-lite");
const key = (a) => `${a.mode}${a.digits}:${a.a}x${a.b}`, hm = new Map(H.answers.map((a) => [key(a), a]));
if (!O.answers.every((a) => hm.get(key(a))?.correct === a.correct)) throw new Error("the two runs did not use the same problems");
const dH = H.answers.filter((a) => a.mode === "direct"), dO = O.answers.filter((a) => a.mode === "direct");
const by = (rows) => Object.fromEntries([2,3,4,5,6,7,8,9,10].map((n) => { const r = rows.filter((a) => a.digits === n); return [n, { right: r.filter((a) => a.ok).length, of: r.length }]; }));
const sum = (o, ks) => ks.reduce((s, k) => ({ right: s.right + o[k].right, of: s.of + o[k].of }), { right: 0, of: 0 });
const hs = by(dH), os = by(dO);
const ex = dO.filter((a) => a.digits === 10 && !a.ok).map((a) => ({ o: a, h: hm.get(key(a)) })).find((x) => x.h && x.h.ok);
const out = {
  date: String(run1.date).slice(0, 10), run_url: run1.run_url, earlier_date: String(earlier.date).slice(0, 10), earlier_run_url: earlier.run_url,
  new_model: "Gemini 4 Hydrogen", old_model: "Gemini 3.1 Flash-Lite", token_cap: 4096,
  hydrogen: { by: hs, small: sum(hs, [2,3,4,5]), big: sum(hs, [6,7,8,9,10]), all: sum(hs, [2,3,4,5,6,7,8,9,10]), empty: dH.filter((a) => !a.reply).length, wrong_numbers: dH.filter((a) => a.reply && !a.ok).length },
  older: { by: os, small: sum(os, [2,3,4,5]), big: sum(os, [6,7,8,9,10]) },
  example: { a: ex.o.a, b: ex.o.b, older: ex.o.answer, hydrogen: ex.h.reply, correct: ex.o.correct },
};
writeFileSync("platform/channels/ai-tested/gemini4-data.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, example: { ...out.example, older: out.example.older.length + " digits" } }).slice(0, 900));
