#!/usr/bin/env node
/** Runs one channel's long-form job. Usage: node platform/longform/run.mjs <key>. Loads platform/channels/<key>/longform.mjs. Same tools and
 * stage publishing as the Shorts previews (platform/preview/lib.mjs); outputs go to output/longform/<key>/<runId> and automation/previews. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, channelEntry, makeTools } from "../preview/lib.mjs";
import { publish } from "../preview/publish.mjs";

const key = process.argv[2];
const entry = channelEntry(key);
const runId = `long-${process.env.GITHUB_RUN_ID || Date.now()}-${process.env.GITHUB_RUN_ATTEMPT || 1}`;
const outDir = join(ROOT, "output/previews", key, runId);
const tools = makeTools({ key, runId, outDir, agent: entry.agent, publish: () => publish({ key, runId, outDir }) });
const file = join(ROOT, "platform/channels", key, "longform.mjs");
if (!existsSync(file)) throw new Error(`${file} does not exist: this channel has no long-form job yet`);

tools.stage("started", "running");
try {
  const { default: job } = await import(pathToFileURL(file).href);
  await job({ key, runId, outDir, tools, entry });
  tools.stage("finished", "ok");
} catch (e) {
  tools.write("error.txt", String(e.stack || e));
  tools.stage("failed", "failed", { error: String(e.message).slice(0, 400) });
  process.exitCode = 1;
}
