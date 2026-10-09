// node scripts/test-script-shows.mjs — the script-shows rules carried from short-video-scripter
// into the Stage C prompt (prompts/write-script.md) and the SCR-17 heuristic (gate-script.js).
import { readFileSync } from "node:fs";
import { wordsOnlyShare } from "./gate-script.js";
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };

const prompt = readFileSync(new URL("../prompts/write-script.md", import.meta.url), "utf8");
for (const [name, re] of [
  ["hook survives muted autoplay", /survives muted autoplay/],
  ["confirm beat", /Confirm the hook/],
  ["escalation", /Escalate/],
  ["one idea per step", /one idea per step/],
  ["loop or act", /Close on the loop or the act/],
  ["at most one words-only in three", /at most one words-only card in any three sentences/],
  ["grounding preserved: nothing invented to draw", /never\s+invent an object/],
]) eq(`prompt carries: ${name}`, re.test(prompt), true);

const shown = [{ voiceover: "Banks held $352 million. Powell raised rates in Washington. The vault in Ohio held 40 bars. Then the audit began." }];
eq("figures and proper nouns count as showable", wordsOnlyShare(shown).bare, ["Then the audit began."]);
const vague = [{ voiceover: "That changes everything. It really matters. Nobody saw it coming. Things got worse. Then it ended. It was over." }];
const v = wordsOnlyShare(vague);
eq("a run of abstractions is measured", [v.bare.length, v.run], [6, 6]);
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
