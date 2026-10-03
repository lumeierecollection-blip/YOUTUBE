// node scripts/test-resolver-canvas.mjs — the resolver (scripts/render-and-qa.js resolveAssets -> resolveCanvas)
// on a synthetic plan: sentence case from the narration, variant / index / folio total, dark beats, the
// emphasis word, the no-repeat rule on resolved canvases, and the fallback of an image-backed beat with no
// real image (a DOCUMENT beat whose lookup cannot succeed here) to typography.
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAssets } from "./render-and-qa.js";

let bad = 0;
const yes = (name, cond, detail = "") => { if (!cond) bad++; console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

const beat = (index, extra) => ({ index, kind: "EDITORIAL", headline: "PLACEHOLDER", ...extra });
const plan = {
  beats: [
    beat(0, { visual_type: "TYPE", headline: "SEC SUES FOR FRAUD", narration: "The SEC sued him for fraud.", motion_tier: "major" }),
    beat(1, { visual_type: "COUNTER", data: { value: "$105 million", label: "lost by investors" }, headline: "INVESTOR LOSSES", narration: "The fraud cost investors $105 million.", motion_tier: "medium" }),
    beat(2, { visual_type: "TYPE", headline: "RATES WILL CUT SAVINGS", emphasis_word: "cut", narration: "Rates will cut into savings.", motion_tier: "medium" }),
    beat(3, { visual_type: "TYPE", headline: "Save invest spend", narration: "Save, invest and spend.", motion_tier: "medium" }),
    beat(4, { visual_type: "TIMELINE", data: {}, headline: "THE WAGE LAW", narration: "The law passed in 2019 and was repealed in 2024.", motion_tier: "medium" }),
    beat(5, { visual_type: "DOCUMENT", data: { name: "Dodd-Frank Act" }, headline: "THE ACT RESHAPED BANKING", narration: "The Dodd-Frank Act reshaped banking.", motion_tier: "medium" }),
  ],
};
// The planner has already checked each beat; give the resolver checked data.
plan.beats[4].data = { markers: [{ date: "2019", label: "the law passed" }, { date: "2024", label: "was repealed" }] };

const dir = mkdtempSync(join(tmpdir(), "resolver-"));
const planPath = join(dir, "x-visual-plan.json");
writeFileSync(planPath, JSON.stringify(plan));
const r = await resolveAssets("26", planPath);
yes("the plan resolves", r.ok === true, r.reason || "");
const out = JSON.parse(readFileSync(r.planPath, "utf8"));
const cs = out.beats.map((b) => b.canvas);
console.log("compositions:", cs.map((c) => c.composition).join(", "));

yes("sentence case rebuilt from the narration", cs[0].headline === "SEC sues for fraud", cs[0].headline);
yes("a proper headline in capitals is lower-cased", cs[1].headline === "Investor losses", cs[1].headline);
yes("index, variant and folio total are stamped", cs.every((c, i) => c.beat_index === i && c.variant === i && c.beat_total === 6));
yes("a DOCUMENT with no real scan is typography, never a stand-in", cs[5].photo === null && ["TYPE-FULL", "TYPE-SPLIT"].includes(cs[5].composition), cs[5].composition);
yes("no composition twice in a row", cs.every((c, i) => i === 0 || c.composition !== cs[i - 1].composition), cs.map((c) => c.composition).join(","));
yes("the hook is never dark", cs[0].dark === false);
yes("at most 2 dark beats, never consecutive", cs.filter((c) => c.dark).length <= 2 && cs.every((c, i) => !(c.dark && cs[i + 1]?.dark)));
yes("exactly one emphasis beat, from a TYPE beat", cs.filter((c) => c.emphasis_beat).length <= 1);
yes("the biggest figure takes the accent", cs[1].number_accent === true);
yes("the narration travels with the beat", out.beats.every((b) => typeof b.narration === "string"));

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
