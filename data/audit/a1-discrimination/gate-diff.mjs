/** A1 gate half: which QA checks discriminate between the fixtures, and in which direction. */
import { readFileSync } from "node:fs";

const ids = ["A", "B", "Bprime"];
const reports = Object.fromEntries(ids.map((id) => [id, JSON.parse(readFileSync(`data/audit/a1-discrimination/work/frame-${id}-audit.json`, "utf8"))]));

const all = [...new Set(ids.flatMap((id) => (reports[id].checks || []).map((c) => c.id)))].sort();
const cell = (id, cid) => (reports[id].checks || []).find((c) => c.id === cid);

console.log(`overall: ${ids.map((id) => `${id}=${reports[id].pass ? "PASS" : "FAIL"} (${(reports[id].checks || []).filter((c) => c.pass).length}/${(reports[id].checks || []).length})`).join("  ")}\n`);

console.log("check".padEnd(24), "A".padEnd(8), "B".padEnd(8), "B'".padEnd(8), "discriminates?");
const discriminating = [];
for (const cid of all) {
  const a = cell("A", cid), b = cell("B", cid), p = cell("Bprime", cid);
  const sig = [a, b, p].map((c) => (c ? (c.pass ? "pass" : "FAIL") : "-").padEnd(8)).join("");
  const varies = new Set([a, b, p].map((c) => (c ? c.pass : null))).size > 1;
  if (varies) discriminating.push(cid);
  console.log(cid.padEnd(24), sig, varies ? "YES" : "");
}

console.log(`\n=== checks that DISCRIMINATE (${discriminating.length}) ===`);
for (const cid of discriminating) {
  console.log(`\n${cid}`);
  for (const id of ids) {
    const c = cell(id, cid);
    console.log(`  ${id.padEnd(7)} ${c ? (c.pass ? "PASS" : "FAIL") : "-"}  ${c ? String(c.detail || "").slice(0, 150) : ""}`);
  }
}

console.log("\n=== A1's stated expectation ===");
const aPass = reports.A.pass, bPass = reports.B.pass;
console.log(`gate passes B and fails A: ${bPass && !aPass ? "HOLDS" : "DOES NOT HOLD"}  (A=${aPass ? "PASS" : "FAIL"}, B=${bPass ? "PASS" : "FAIL"})`);
console.log(`\n=== A2's fallback-signature requirement ===`);
console.log(`A2 says QA must fail A with a machine-readable FALLBACK_DETECTED reason.`);
const hasReason = JSON.stringify(reports.A).includes("FALLBACK");
console.log(`the gate emits any FALLBACK* reason today: ${hasReason ? "yes" : "NO — a fallback frame fails only via unrelated checks"}`);
const mech = cell("A", "mechanism-share");
console.log(`A's nearest existing signal: mechanism-share — "${mech ? mech.detail : "absent"}"`);