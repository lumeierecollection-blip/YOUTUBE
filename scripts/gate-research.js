#!/usr/bin/env node
/**
 * Gate — research quality (CHECK-REGISTER.md SCR-01, SCR-02).
 *
 * SCR-02 is fully enforced: >=5 key_facts, >=3 distinct source domains.
 *
 * SCR-01 ("every source_url was actually fetched, per the run's tool log")
 * is only partially enforced here: this script checks that every
 * source_url is a well-formed, non-empty URL. Fully verifying that Claude
 * actually issued a WebFetch against each URL (rather than citing one seen
 * only in a search snippet) requires capturing and parsing the Stage B
 * call's tool-use transcript (`--output-format stream-json`), which this
 * rebuild does not implement — Stage B currently runs with
 * `--output-format json`, which does not expose the tool-call log. Treat
 * SCR-01 here as "structurally plausible," not "proven."
 *
 * Usage: node scripts/gate-research.js <channel-id> <slug>
 * Exit: non-zero on any BLOCKER failure.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function isWellFormedUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function domainOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Read a JSON file, tolerating a UTF-8 BOM if one snuck in (PowerShell's
// Out-File adds one; jq and bash redirects on the runner do not).
function readJsonBomSafe(p) {
  const s = readFileSync(p, "utf-8");
  return JSON.parse(s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);
}

function main() {
  const [channelId, slug] = process.argv.slice(2);
  if (!channelId || !slug) {
    console.error("Usage: node scripts/gate-research.js <channel-id> <slug>");
    process.exit(1);
  }

  const path = join(ROOT, "data", "research", String(channelId), `${slug}.json`);
  const research = readJsonBomSafe(path);

  // Search telemetry from the raw agent output (the workflow copies
  // /tmp/research-raw.json to .agent-raw.json alongside the artifact).
  // Stage B's SCR-02 failures have been exactly-2-domain with the search
  // count invisible in the structured output, so this distinguishes "the
  // model searched twice and still found 2 domains" from "the model stopped
  // after one search" - and tells the next fix which end to attack.
  let searchTelemetry = "";
  try {
    const raw = readJsonBomSafe(join(ROOT, "data", "research", String(channelId), ".agent-raw.json"));
    const calls = raw.websearch_calls;
    const queries = Array.isArray(raw.search_queries) ? raw.search_queries : [];
    if (typeof calls === "number") {
      searchTelemetry = ` (websearch calls: ${calls}${queries.length ? `, queries: ${queries.join(" | ")}` : ""})`;
    }
  } catch {
    // No raw output preserved for this run - failure message stands alone.
  }

  const failures = [];

  // SCR-01 (structural half — see header note).
  const badUrls = (research.key_facts || []).filter((f) => !isWellFormedUrl(f.source_url));
  if (badUrls.length > 0) {
    failures.push(`SCR-01: ${badUrls.length} key_fact(s) have a missing/malformed source_url.`);
  }

  // SCR-02
  const factCount = (research.key_facts || []).length;
  if (factCount < 5) {
    failures.push(`SCR-02: only ${factCount} key_facts (need >=5).`);
  }
  const domains = new Set((research.key_facts || []).map((f) => domainOf(f.source_url)).filter(Boolean));
  if (domains.size < 3) {
    failures.push(`SCR-02: only ${domains.size} distinct source domain(s) (need >=3): ${[...domains].join(", ")}${searchTelemetry}`);
  }

  if (failures.length > 0) {
    console.error(`Research gate FAILED for ${channelId}/${slug}:`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log(`Research gate PASSED for ${channelId}/${slug}: ${factCount} facts, ${domains.size} domains.`);
}

main();
