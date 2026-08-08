#!/usr/bin/env node
/**
 * Stage C input builder — emits, on stdout, the frozen Stage B research
 * artifact plus the channel's style/tone/script_template/concepts. Piped
 * into `claude -p --bare` as stdin for the write-script prompt.
 *
 * Usage: node scripts/build-script-context.js <channel-id> <slug> [--format shorts|longform] > context.json
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function main() {
  const [channelId, slug] = process.argv.slice(2);
  const format = process.argv.includes("--format")
    ? process.argv[process.argv.indexOf("--format") + 1]
    : "longform";

  if (!channelId || !slug) {
    console.error("Usage: node scripts/build-script-context.js <channel-id> <slug> [--format shorts|longform]");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const channel = channels.find((c) => String(c.id) === String(channelId) || c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const researchPath = join(ROOT, "data", "research", String(channelId), `${slug}.json`);
  if (!existsSync(researchPath)) {
    console.error(`Research artifact not found: ${researchPath} — run Stage B first.`);
    process.exit(1);
  }
  const research = JSON.parse(readFileSync(researchPath, "utf-8"));

  const context = {
    channel_id: String(channelId),
    channel_name: channel.channel_name,
    niche: channel.niche,
    style: channel.style,
    tone: channel.tone,
    format,
    script_template: channel.script_template || null,
    concepts: channel.concepts || null,
    research,
  };

  process.stdout.write(JSON.stringify(context, null, 2));
}

main();
