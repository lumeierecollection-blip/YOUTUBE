// node scripts/test-validate-story.mjs — the narrative and voice validators
// (scripts/validate-script-narrative.cjs, scripts/validate-script-voice.cjs).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const N = require("./validate-script-narrative.cjs");
const V = require("./validate-script-voice.cjs");
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };
const RESEARCH = { named_entities: [{ name: "Jerome Powell", kind: "person" }, { name: "Federal Reserve", kind: "organization" }, { name: "Ohio", kind: "place" }] };
const sec = (o) => ({ sections: Object.entries(o).map(([id, voiceover]) => ({ id, voiceover })) });

// The owner's mortgage example, as five sections.
const good = sec({
  hook: "One line in your Ohio mortgage contract costs you $200 a month.",
  setup: "Buyers in 2024 signed loans at 7.2%. Lenders in Columbus now offer 5.9%. But the payoff isn't the rate?",
  rehook: "Refinancing resets the 30-year clock, and that's the trap.",
  payoff: "The Federal Reserve data puts the gap at $38,000 in extra interest. Same house in Ohio, same neighborhood. That's the cost of signing in 2024 and refinancing now.",
  close: "Check page 4 of your closing documents this week.",
});
{
  const n = N.validateNarrative(good, RESEARCH);
  eq("the five-beat example passes every beat", Object.fromEntries(Object.entries(n.checks).map(([k, v]) => [k, v.ok])), { hook: true, setup: true, rehook: true, payoff: true, close: true });
  eq("beats read from section ids", n.by, "section ids");
}
// The wire brief the owner quoted (B.1).
const wire = sec({
  hook: "Jerome Powell raised rates by 0.25% on September 18.",
  setup: "Jerome Powell said the rate would stay high. Jerome Powell also noted that inflation remains a concern.",
  rehook: "Powell's comments came after the Federal Reserve meeting in Washington.",
  payoff: "Rates may rise again in 2027, according to the Federal Reserve.",
  close: "Stay informed.",
});
{
  const v = V.validateVoice(wire, RESEARCH);
  eq("wire voice: 4 sentences start with Powell (max 1)", v.nameStarts, 4);
  eq("wire voice: full-name starts are failures", v.rows.filter((r) => r.fails.some((f) => /full name/.test(f))).length, 3);
  const n = N.validateNarrative(wire, RESEARCH);
  eq("wire: hook fails (person's name first), setup no question, rehook no flip, payoff hedged, close banned", Object.fromEntries(Object.entries(n.checks).map(([k, x]) => [k, x.ok])), { hook: false, setup: false, rehook: false, payoff: false, close: false });
  eq("wire: payoff names the hedge", n.checks.payoff.why.some((w) => /hedged \("may"\)/.test(w)), true);
}
// Voice rules one at a time.
{
  const v = V.validateVoice(sec({ a: "According to the Ohio report, 40% of 2024 buyers in Columbus refinanced at least once since signing their first mortgage loan with a regional bank downtown last spring." }), RESEARCH);
  eq("banned opening and > 25 words", v.rows[0].fails.map((f) => f.replace(/".*"/, "X").replace(/\d+ words/, "N words")), ["banned opening X", "N words (> 25)"]);
  const same = V.validateVoice(sec({ a: "The Fed cut rates in Ohio. The banks raised fees by 2%." }), RESEARCH);
  eq("two consecutive sentences starting with the same word", same.rows[1].fails.some((f) => /same word/.test(f)), true);
}
// Without section ids: positional beats.
{
  const n = N.validateNarrative({ sections: [{ id: "a", voiceover: "The FBI found $3 million in an Ohio storage unit. Its owner had died in 2019. Police in Akron traced the cash. Why was it there? Except the money wasn't his. It belonged to the Columbus bank he robbed in 1998. Check unclaimed property in Ohio today." }] }, RESEARCH);
  eq("positional fallback finds five beats", n.by, "position");
}
// The CLI the workflow calls, WITHOUT --blocked (CI run 37141128792: args[0] was dropped and an
// empty script was validated).
{
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const f = join(tmpdir(), "story-cli-test.json");
  writeFileSync(f, JSON.stringify(good));
  const r = spawnSync(process.execPath, ["scripts/validate-script-story.cjs", "7", f], { encoding: "utf8" });
  eq("CLI without --blocked reads channel 7 and the five beats", [r.stdout.includes("[script] ch-7: beats read by section ids"), r.status], [true, 0]);
}
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
