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

function main() {
  const [channelId, slug] = process.argv.slice(2);
  if (!channelId || !slug) {
    console.error("Usage: node scripts/gate-research.js <channel-id> <slug>");
    process.exit(1);
  }

  const path = join(ROOT, "data", "research", String(channelId), `${slug}.json`);
  const research = JSON.parse(readFileSync(path, "utf-8"));

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
    failures.push(`SCR-02: only ${domains.size} distinct source domain(s) (need >=3): ${[...domains].join(", ")}`);
  }

  if (failures.length > 0) {
    console.error(`Research gate FAILED for ${channelId}/${slug}:`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log(`Research gate PASSED for ${channelId}/${slug}: ${factCount} facts, ${domains.size} domains.`);
}

main();
