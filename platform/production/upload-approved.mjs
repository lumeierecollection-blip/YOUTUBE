#!/usr/bin/env node
/**
 * Uploads one MP4 that a person has already inspected, as PRIVATE, and reads it back from YouTube.
 * config/upload-approval.json names the preview run and the exact SHA-256 that was inspected; a file
 * with any other hash is refused. Usage: node platform/production/upload-approved.mjs
 */
import { assertHashtags } from "./hashtags.mjs";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { channelConfig, sha256File, ROOT } from "../../scripts/autopilot/lib.mjs";
import { deliver, accessToken, ytGet } from "../../scripts/autopilot/deliver.mjs";

const key = process.env.GITHUB_REF_NAME.replace(/^upload\//, "").replace(/-\d+$/, "");
const approval = JSON.parse(readFileSync(join(ROOT, "config/upload-approval.json"), "utf8"))[key];
if (!approval) throw new Error(`no approval entry for ${key}`);
if (approval.privacy !== "private") throw new Error("only private uploads are permitted");

const dir = join(ROOT, "output/approved", key);
mkdirSync(dir, { recursive: true });
const d = spawnSync("gh", ["run", "download", String(approval.run_id), "-n", approval.artifact, "-D", dir], { encoding: "utf8", env: process.env });
if (d.status !== 0) throw new Error(`could not download ${approval.artifact}: ${d.stderr}`);
const find = (p) => { for (const n of readdirSync(p)) { const f = join(p, n); if (statSync(f).isDirectory()) { const r = find(f); if (r) return r; } else if (n === "preview.mp4" || n === "episode.mp4") return f; } return null; };
const mp4 = find(dir);
const findThumb = (p) => { for (const n of readdirSync(p)) { const f = join(p, n); if (statSync(f).isDirectory()) { const r = findThumb(f); if (r) return r; } else if (approval.thumbnail && n === approval.thumbnail) return f; } return null; };
if (!mp4) throw new Error("preview.mp4 is not in the artifact");
const sha = sha256File(mp4);
if (sha !== approval.sha256) throw new Error(`SHA-256 mismatch: approved ${approval.sha256}, artifact ${sha}`);

const channel = channelConfig(approval.legacy_channel_id);
if (!approval.long_form) assertHashtags(approval.description);
const ev = await deliver({ channel, mp4, title: approval.title, description: approval.description, tags: approval.tags, productionId: `approved-${key}-${approval.run_id}`, ledger: { uploads: [] } });
// Optional custom thumbnail (long-form): set, then read back that YouTube now lists one.
if (approval.thumbnail && ev.video_id) {
  const jpg = findThumb(dir);
  if (!jpg) throw new Error(`thumbnail ${approval.thumbnail} is not in the artifact`);
  const tok = await accessToken(channel.id);
  const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${ev.video_id}`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "image/jpeg" }, body: readFileSync(jpg) });
  ev.thumbnail_set = r.ok; ev.thumbnail_http = r.status;
  if (!r.ok) ev.thumbnail_error = (await r.text()).slice(0, 300);
  else ev.thumbnail_read_back = !!(await ytGet(`videos?part=snippet&id=${ev.video_id}`, tok)).items?.[0]?.snippet?.thumbnails?.maxres;
}
writeFileSync(join(ROOT, `upload-evidence-${key}.json`), JSON.stringify(ev, null, 2));
console.log(JSON.stringify(ev, null, 2));
if (!ev.verified || ev.privacy_status !== "private") { console.error(`read-back failed: ${JSON.stringify(ev.checks)}`); process.exit(1); }
