#!/usr/bin/env node
/**
 * Preflight — PROMPT-SELF-HEALING-RUN.md T3.6.
 *
 * For every channel in config/channels.json, reports READY or BLOCKED with
 * the exact reason. Writes a table to stdout and, when running in GitHub
 * Actions, to $GITHUB_STEP_SUMMARY.
 *
 * Usage: node scripts/preflight.js
 */

import { readFileSync, existsSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { unresolvedPlaceholdersForChannel } from "../src/utils/placeholders.js";
import { hasCredentials } from "../src/utils/youtube-auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function checkChannel(channel) {
  const blockers = [];

  if (!channel.google_account || channel.google_account.startsWith("UNASSIGNED-")) {
    blockers.push("no Google account assigned (google_account is UNASSIGNED)");
  }
  if (!hasCredentials(channel)) {
    blockers.push(`no OAuth credentials at ${channel.youtube_credentials_path || `config/creds/${channel.channel_id}.json`}`);
  }
  const openPlaceholders = unresolvedPlaceholdersForChannel(channel.id);
  if (openPlaceholders.length > 0) {
    blockers.push(`${openPlaceholders.length} unresolved placeholder(s): ${openPlaceholders.map((p) => p.stands_in_for).join(", ")}`);
  }
  if (channel.style === "motion-graphics" && !channel.concepts) {
    blockers.push("motion-graphics style but no concepts (archetype allocation) declared — DETAIL-REFERENCE.md §C4");
  }
  if (channel.requires_human_review) {
    blockers.push("HUMAN REVIEW REQUIRED before every upload (not a blocker to fix — a standing process)");
  }

  return blockers;
}

function main() {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;

  const rows = channels.map((c) => {
    const blockers = checkChannel(c);
    const hardBlockers = blockers.filter((b) => !b.startsWith("HUMAN REVIEW"));
    return { channel: c, blockers, ready: hardBlockers.length === 0 };
  });

  const readyCount = rows.filter((r) => r.ready).length;

  const lines = [];
  lines.push(`Preflight — ${channels.length} channels, ${readyCount} ready, ${channels.length - readyCount} blocked\n`);
  lines.push("| ID | Channel | Style | Status | Reason(s) |");
  lines.push("|---|---|---|---|---|");
  for (const { channel: c, blockers, ready } of rows) {
    const status = ready ? "READY" : "BLOCKED";
    const reason = blockers.length > 0 ? blockers.join("; ") : "—";
    lines.push(`| ${c.id} | ${c.channel_name} | ${c.style} | ${status} | ${reason} |`);
  }
  const output = lines.join("\n") + "\n";

  console.log(output);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, output);
  }

  if (readyCount === 0) {
    console.error("\nNo channel is ready — every channel needs at least a Google account and OAuth credentials before it can publish.");
  }
}

main();
