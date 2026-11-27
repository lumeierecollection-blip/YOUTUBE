// Uploads the finished Rival Lines episode to YouTube as PRIVATE. The privacy status is fixed in this file: there is no flag that makes it public.
// usage: node upload-private.mjs <episode_dir> <slug>
// env:   YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN  (the CHANNEL_04_* secrets)
// reads: out/<slug>.mp4, out/publish.json, out/thumbs/thumb-a.png
// writes: out/upload-result.json
// The video gets title A and thumbnail A. Title B and thumbnail B are for YouTube Studio's Test & compare, which is not available through the API.
// If the channel cannot be confirmed as @rivallines (token without the readonly scope) the result says so plainly; it is not hidden.
import fs from "node:fs";
import path from "node:path";

const ep = path.resolve(process.argv[2] || "");
const slug = process.argv[3] || path.basename(ep);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) throw new Error("missing YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN");

const out = path.join(ep, "out");
const pub = JSON.parse(fs.readFileSync(path.join(out, "publish.json"), "utf8"));
const videoPath = path.join(out, `${slug}.mp4`);
const thumbPath = path.join(out, "thumbs", "thumb-a.png");
const result = { privacyStatus: "private", title: pub.titles.a, title_b: pub.titles.b, channel_verified: false, notes: [] };
const save = () => fs.writeFileSync(path.join(out, "upload-result.json"), JSON.stringify(result, null, 1));

const tokRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
});
const tok = await tokRes.json();
if (!tok.access_token) { result.notes.push(`token refresh failed: ${JSON.stringify(tok)}`); save(); throw new Error(`token refresh failed: ${tok.error || ""} ${tok.error_description || ""}`); }
const auth = { authorization: `Bearer ${tok.access_token}` };
result.scope = tok.scope;

const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: auth });
const chj = await ch.json();
if (ch.ok && chj.items?.length) {
  const c = chj.items[0];
  result.channel = { id: c.id, title: c.snippet.title, handle: c.snippet.customUrl };
  if (!/rivallines/i.test(c.snippet.customUrl || "") && !/rival lines/i.test(c.snippet.title || "")) { save(); throw new Error(`token belongs to ${c.snippet.title} (${c.snippet.customUrl}), not Rival Lines: aborting`); }
  result.channel_verified = true;
} else {
  result.notes.push(`could not confirm the channel (channels.list ${ch.status}: ${chj.error?.message || "no channel returned"}). Uploaded on the strength of the secret name CHANNEL_04 alone.`);
}

const size = fs.statSync(videoPath).size;
const meta = { snippet: { title: pub.titles.a, description: pub.description, tags: pub.tags, categoryId: "17", defaultLanguage: "en" }, status: { privacyStatus: "private", selfDeclaredMadeForKids: false } };
const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
  method: "POST",
  headers: { ...auth, "content-type": "application/json; charset=UTF-8", "x-upload-content-length": String(size), "x-upload-content-type": "video/mp4" },
  body: JSON.stringify(meta),
});
if (!init.ok) { result.notes.push(`upload init ${init.status}: ${await init.text()}`); save(); throw new Error(`upload init failed ${init.status}`); }
const loc = init.headers.get("location");
const put = await fetch(loc, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(size) }, body: fs.readFileSync(videoPath) });
const vid = await put.json();
if (!put.ok || !vid.id) { result.notes.push(`upload ${put.status}: ${JSON.stringify(vid)}`); save(); throw new Error(`upload failed ${put.status}`); }
result.video_id = vid.id;
result.privacy_returned = vid.status?.privacyStatus;
result.url = `https://studio.youtube.com/video/${vid.id}/edit`;
if (vid.status?.privacyStatus !== "private") result.notes.push(`WARNING: YouTube returned privacy ${vid.status?.privacyStatus}`);
save();

const th = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${vid.id}`, { method: "POST", headers: { ...auth, "content-type": "image/png" }, body: fs.readFileSync(thumbPath) });
result.thumbnail_set = th.ok;
if (!th.ok) result.notes.push(`thumbnails.set ${th.status}: ${(await th.text()).slice(0, 300)}`);
save();
console.log(JSON.stringify(result, null, 1));
