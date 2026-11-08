/** Private upload through scripts/youtube-upload.cjs, then an independent read-back from the YouTube API. */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, StageError, fetchWithTimeout, log, run, sha256File } from "./lib.mjs";

const API = "https://www.googleapis.com/youtube/v3";
const n2 = (id) => String(id).padStart(2, "0");
export const credsFor = (channelId) => {
  const k = n2(channelId);
  return { client_id: process.env[`CHANNEL_${k}_CLIENT_ID`], client_secret: process.env[`CHANNEL_${k}_CLIENT_SECRET`], refresh_token: process.env[`CHANNEL_${k}_REFRESH_TOKEN`] };
};

export async function accessToken(channelId) {
  const c = credsFor(channelId);
  if (!(c.client_id && c.client_secret && c.refresh_token)) throw new StageError("upload", `CHANNEL_${n2(channelId)} secrets are missing`);
  const r = await fetchWithTimeout("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...c, grant_type: "refresh_token" }) });
  const j = await r.json();
  if (!j.access_token) throw new StageError("upload", `token refresh failed: ${j.error}`);
  return j.access_token;
}

export async function ytGet(path, token) {
  const r = await fetchWithTimeout(`${API}/${path}`, { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json();
  if (!r.ok) throw new StageError("upload", `${path.split("?")[0]} HTTP ${r.status}: ${j.error?.message}`);
  return j;
}

async function preflight(channel, title, token) {
  const ch = (await ytGet("channels?part=snippet,contentDetails&mine=true", token)).items?.[0];
  if (ch?.id !== channel.youtube_channel_id) throw new StageError("upload", `token belongs to ${ch?.id}, expected ${channel.youtube_channel_id}`);
  let page = "";
  do {
    const j = await ytGet(`playlistItems?part=snippet&maxResults=50&playlistId=${ch.contentDetails.relatedPlaylists.uploads}${page ? `&pageToken=${page}` : ""}`, token);
    const dup = (j.items || []).find((it) => it.snippet.title === title);
    if (dup) throw new StageError("upload", `duplicate title: video ${dup.snippet.resourceId.videoId} already exists on the channel`);
    page = j.nextPageToken || "";
  } while (page);
  log("upload", `channel confirmed: ${ch.snippet.title}`);
}

export async function deliver({ channel, mp4, title, description, tags, productionId, ledger }) {
  const sha = sha256File(mp4);
  const prior = ledger.uploads.find((u) => u.sha256 === sha || u.production_id === productionId);
  if (prior) throw new StageError("upload", `already uploaded as ${prior.video_id} (matched by hash or production id)`);

  const token = await accessToken(channel.id);
  await preflight(channel, title, token);

  const credPath = join(ROOT, "config", "creds", `ch-${n2(channel.id)}.json`);
  mkdirSync(join(ROOT, "config", "creds"), { recursive: true });
  writeFileSync(credPath, JSON.stringify(credsFor(channel.id)));
  let videoId;
  try {
    const output = join(ROOT, `upload-output-${channel.id}.txt`);
    const r = run("node", ["scripts/youtube-upload.cjs", "--file", mp4, "--title", title, "--description", description, "--tags", tags.join(","), "--channel", channel.id], { env: { GITHUB_OUTPUT: output }, capture: true });
    console.log(r.stdout);
    if (r.status !== 0) throw new StageError("upload", `youtube-upload.cjs exited ${r.status}`);
    videoId = (r.stdout.match(/watch\?v=([\w-]{6,})/) || [])[1];
    if (!videoId) throw new StageError("upload", "uploader reported no video id");
    rmSync(output, { force: true });
  } finally { rmSync(credPath, { force: true }); }

  const v = (await ytGet(`videos?part=snippet,status&id=${encodeURIComponent(videoId)}`, await accessToken(channel.id))).items?.[0];
  const checks = v ? {
    channel: v.snippet.channelId === channel.youtube_channel_id, title: v.snippet.title === title, description: v.snippet.description === description,
    private: v.status.privacyStatus === "private", not_scheduled: !v.status.publishAt,
  } : { found: false };
  const evidence = { video_id: videoId, url: `https://www.youtube.com/watch?v=${videoId}`, channel_id: v?.snippet.channelId, channel_title: v?.snippet.channelTitle, title: v?.snippet.title, privacy_status: v?.status.privacyStatus, upload_status: v?.status.uploadStatus, sha256: sha, production_id: productionId, checks, verified: Object.values(checks).every(Boolean), verified_at: new Date().toISOString() };
  return evidence;
}
