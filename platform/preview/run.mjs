#!/usr/bin/env node
/** Runs one channel's preview. Usage: node platform/preview/run.mjs <key> */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, channelEntry, makeTools } from "./lib.mjs";
import { publish } from "./publish.mjs";

const key = process.argv[2];
const entry = key.startsWith("_") ? { agent: key === "_smoke" ? "lead-architect" : "agent-script-engine" } : channelEntry(key);
const runId = `run-${process.env.GITHUB_RUN_ID || Date.now()}-${process.env.GITHUB_RUN_ATTEMPT || 1}`;
const outDir = join(ROOT, "output/previews", key, runId);
const tools = makeTools({ key, runId, outDir, agent: entry.agent, publish: () => publish({ key, runId, outDir }) });
const entryFile = join(ROOT, "platform/channels", key, "preview.mjs");
if (!existsSync(entryFile)) throw new Error(`${entryFile} does not exist`);

tools.stage("started", "running");
try {
  const { default: preview } = await import(pathToFileURL(entryFile).href);
  await preview({ key, runId, outDir, tools, entry });
  tools.stage("finished", "ok");
} catch (e) {
  tools.write("error.txt", String(e.stack || e));
  tools.stage("failed", "failed", { error: String(e.message).slice(0, 400) });
  process.exitCode = 1;
}
