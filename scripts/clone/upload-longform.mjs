#!/usr/bin/env node
/**
 * Upload one rendered long-form episode to YouTube as PRIVATE, with its thumbnail.
 * Usage: node scripts/clone/upload-longform.mjs <dir> <slot> <expect_channel> <category> [thumb]
 *   <dir> holds episode.mp4 + episode-meta.json (the longform-<episode>-<run> artifact).
 * Credentials come from env CH_CLIENT_ID / CH_CLIENT_SECRET / CH_REFRESH_TOKEN (GitHub secrets).
 * Safety: privacy is hard-coded private; aborts unless the token's own channel title
 * contains <expect_channel>, so a mis-mapped secret can never post to the wrong channel.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [dir, slot, expect, category, thumbArg] = process.argv.slice(2);
if (!dir || !slot || !expect) { console.error("usage: <dir> <slot> <expect_channel> <category> [thumb]"); process.exit(1); }
const meta = JSON.parse(readFileSync(join(dir, "episode-meta.json"), "utf8"));
const mp4 = join(dir, "episode.mp4");
if (!existsSync(mp4)) throw new Error(`missing ${mp4}`);

const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: process.env.CH_CLIENT_ID, client_secret: process.env.CH_CLIENT_SECRET, refresh_token: process.env.CH_REFRESH_TOKEN, grant_type: "refresh_token" }),
})).json();
if (!tok.access_token) throw new Error(`token refresh failed: ${tok.error || "unknown"}`);
const auth = { Authorization: `Bearer ${tok.access_token}` };

const me = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: auth })).json();
const chTitle = me.items?.[0]?.snippet?.title || "";
console.log(`slot ${slot} -> channel "${chTitle}"`);
if (!chTitle.toLowerCase().includes(expect.toLowerCase())) throw new Error(`channel "${chTitle}" does not match expected "${expect}" - refusing to upload`);

// YouTube rejects < and > in title/description; description max 5000 chars, title 100.
const clean = (s) => String(s).replace(/[<>]/g, "");
const PRIVACY = "private";
const body = {
  snippet: { title: clean(meta.title).slice(0, 100), description: clean(meta.description).slice(0, 4990), tags: meta.tags || [], categoryId: category || "27" },
  status: { privacyStatus: PRIVACY, selfDeclaredMadeForKids: false },
};
if (body.status.privacyStatus !== "private") throw new Error("privacy must be private");

const data = readFileSync(mp4);
const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
  method: "POST", headers: { ...auth, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(data.length), "X-Upload-Content-Type": "video/mp4" }, body: JSON.stringify(body),
});
if (!init.ok) throw new Error(`upload init ${init.status}: ${await init.text()}`);
const put = await fetch(init.headers.get("location"), { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(data.length) }, body: data });
const vid = await put.json();
if (!put.ok || !vid.id) throw new Error(`upload ${put.status}: ${JSON.stringify(vid).slice(0, 300)}`);
console.log(`uploaded PRIVATE https://youtu.be/${vid.id} (${vid.status?.privacyStatus})`);

let thumb = "none";
if (thumbArg && existsSync(thumbArg)) {
  const t = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${vid.id}&uploadType=media`, { method: "POST", headers: { ...auth, "Content-Type": "image/jpeg" }, body: readFileSync(thumbArg) });
  thumb = t.ok ? "set" : `failed ${t.status}: ${(await t.text()).slice(0, 200)}`; // video stays up; thumbnail can be set in Studio
  console.log(`thumbnail ${thumb}`);
}
const rec = { video_id: vid.id, url: `https://youtu.be/${vid.id}`, channel: chTitle, slot, title: body.snippet.title, privacy: vid.status?.privacyStatus, thumbnail: thumb, uploaded_at: new Date().toISOString() };
writeFileSync(join(dir, "upload-record.json"), JSON.stringify(rec, null, 2));
