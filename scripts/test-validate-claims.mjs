// node scripts/test-validate-claims.mjs — the claim validator's offline parts
// (scripts/validate-script-claims.cjs): research text, verdict evaluation, feedback, and the
// CLI's "unavailable" exit when Gemini cannot answer (FORCE_PLANNER=ollama, no request made).
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const C = require("./validate-script-claims.cjs");
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };

const RESEARCH = {
  strongest_angle: "Iran and Russia deepen trade",
  key_facts: [{ fact: "Raisi selected Moscow for one of his first foreign trips in 2022.", source_url: "https://x" }, { fact: "Cooperation covers nuclear power plants and grain trade, amid Iran's confrontation with Israel.", source_url: "https://y" }],
  numbers: [{ label: "1", value: 1, unit: "trip" }],
  named_entities: [{ name: "Raisi", kind: "person" }],
};
const text = C.researchText(RESEARCH);
eq("research text carries facts, numbers, entities, angle", [/F1\. Raisi selected Moscow/.test(text), /N1\. 1 — trip/.test(text), /Raisi \(person\)/.test(text), /ANGLE: Iran and Russia/.test(text)], [true, true, true, true]);

const sents = ["Raisi flew to Moscow on one of his first trips.", "Both capitals share grain to defy Israel.", "What comes next?"];
const data = { sentences: [
  { n: 1, triples: [{ triple: "Raisi | flew to | Moscow", verdict: "SUPPORTED", evidence: "F1" }] },
  { n: 2, triples: [{ triple: "capitals | share | grain", verdict: "SUPPORTED", evidence: "F2" }, { triple: "grain trade | defies | Israel", verdict: "INVENTED", evidence: "F2 says amid confrontation, not to defy" }, { triple: "capitals | share | nuclear tech", verdict: "partial", evidence: "F2" }] },
  { n: 3, triples: [] },
] };
const res = C.evaluate(data, sents);
eq("one INVENTED, one PARTIAL (case-insensitive), 4 triples", [res.invented, res.partial, res.triples], [1, 1, 4]);
const fb = C.feedbackLines(res);
eq("feedback names the sentence and the invented triple only", [fb.length, fb[0].includes('sentence 2'), fb[0].includes('"grain trade | defies | Israel"')], [1, true, true]);
eq("a sentence the judge skipped is marked missing", C.evaluate({ sentences: [{ n: 1, triples: [] }] }, sents).rows.map((r) => r.missing), [false, true, true]);
eq("the prompt lists every sentence numbered", ["1. Raisi flew", "2. Both capitals", "3. What comes next?"].every((s) => C.promptFor(RESEARCH, sents).includes(s)), true);

// CLI: Gemini unavailable twice -> exit 4 with the owner's log line.
const sf = join(tmpdir(), "claims-script.json"), rf = join(tmpdir(), "claims-research.json");
writeFileSync(sf, JSON.stringify({ sections: [{ id: "hook", voiceover: sents.join(" ") }] }));
writeFileSync(rf, JSON.stringify(RESEARCH));
const r = spawnSync(process.execPath, ["scripts/validate-script-claims.cjs", "9", sf, rf], { encoding: "utf8", env: { ...process.env, FORCE_PLANNER: "ollama", GEMINI_API_KEY: "x", CLAIMS_RETRY_WAIT_MS: "0" } });
eq("unavailable -> exit 4 and 'claim check unavailable, proceeding without'", [r.status, r.stdout.includes("[script] ch-9: claim check unavailable, proceeding without")], [4, true]);

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
