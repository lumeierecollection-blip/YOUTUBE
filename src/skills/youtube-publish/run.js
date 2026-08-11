/**
 * YouTube Publish — Uploads rendered videos via YouTube Data API v3.
 *
 * Flow:
 *  1. Load the channel config + its own OAuth credentials (never shared).
 *  2. Exchange the refresh token for an access token.
 *  3. Upload the video with privacyStatus: private (resumable upload).
 *  4. Attach a thumbnail via thumbnails.set.
 *  5. Apply title/description/tags from the matching SEO metadata.
 *  6. Log the upload to the publish queue with a go-public time =
 *     now + publish_delay_hours from channel config.
 *  7. A separate call processes the queue: any entry past its go-public
 *     time (and not cancelled) is flipped to public.
 *
 * Usage:
 *   node run.js <channel-id>                      # upload latest render
 *   node run.js <channel-id> --dry-run            # validate creds + metadata only
 *   node run.js <channel-id> <video.mp4>          # upload a specific render
 *   node run.js process-queue                     # flip due entries to public
 *   node run.js cancel <channel-id> <video-id>    # cancel a queued publish
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { getAccessToken, loadCredentials, hasCredentials } from "../../utils/youtube-auth.js";
import { unresolvedPlaceholdersForChannel } from "../../utils/placeholders.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");

const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv"];
const THUMB_EXTENSIONS = [".jpg", ".jpeg", ".png"];

function loadChannel(channelId) {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channel = (data.channels || data).find((c) => String(c.id) === channelId || c.channel_id === channelId);
  if (!channel) throw new Error(`Channel "${channelId}" not found`);
  return channel;
}

function topicSlugFromVideo(videoBasename) {
  // Video files are named <scriptSlug>-<format>-<YYYY-MM-DD>.mp4
  // (render.js: slug = script basename minus "-script"; output =
  // `${slug}-${format}-${timestamp}`). Strip the trailing -<format>-<date>
  // to recover the script slug. Handles both new-pipeline names
  // (…-shorts-shorts-2026-08-11) and old ones (…-shorts-2026-08-11).
  const m = videoBasename.match(/-(shorts|longform)-\d{4}-\d{2}-\d{2}$/);
  return m ? videoBasename.slice(0, m.index) : videoBasename;
}

function loadSeoMetadata(channelId, scriptSlug) {
  const researchDir = join(ROOT, "data", "research", channelId);
  if (!existsSync(researchDir)) return null;
  const files = readdirSync(researchDir)
    .filter((f) => f.endsWith("-seo.json"))
    .sort();
  if (files.length === 0) return null;
  if (scriptSlug) {
    // SEO files are named <topic_slug>-seo.json, and the script carries the
    // authoritative topic_slug. Older runs' script filenames don't follow
    // the <topic_slug>-<format> convention, so route through the script
    // file rather than guessing from the video basename.
    const slugs = [scriptSlug];
    const scriptPath = join(researchDir, `${scriptSlug}-script.json`);
    if (existsSync(scriptPath)) {
      try {
        const script = JSON.parse(readFileSync(scriptPath, "utf-8"));
        // New pipeline: script carries the authoritative topic_slug
        // (landlord-security-deposit-rights-longform-script.json ->
        // topic_slug "landlord-security-deposit-rights"). Older pipeline
        // scripts leave topic_slug empty but carry a human `topic` title
        // whose slugified form matches the SEO filename.
        if (script.topic_slug) slugs.push(script.topic_slug);
        if (script.topic) {
          slugs.push(String(script.topic).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        }
      } catch { /* unreadable script: fall through with scriptSlug only */ }
    }
    for (const slug of slugs) {
      const match = files.find((f) => f === `${slug}-seo.json`);
      if (match) return JSON.parse(readFileSync(join(researchDir, match), "utf-8"));
    }
    // No arbitrary alphabetical fallback: attaching another topic's SEO
    // metadata to this video would put wrong title/description/tags on a
    // real upload. Callers log a warning and use channel defaults instead.
    return null;
  }
  return JSON.parse(readFileSync(join(researchDir, files[files.length - 1]), "utf-8"));
}

function findVideo(channelId, explicit) {
  const rendersDir = join(ROOT, "data", "renders", channelId);
  if (!existsSync(rendersDir)) throw new Error(`No renders directory for ${channelId}`);
  const candidates = readdirSync(rendersDir).filter((f) => VIDEO_EXTENSIONS.includes(extname(f).toLowerCase()));
  if (candidates.length === 0) throw new Error(`No video files in ${rendersDir}`);
  if (explicit) {
    const match = candidates.find((f) => f === explicit);
    if (!match) throw new Error(`Video "${explicit}" not found in ${rendersDir}`);
    return join(rendersDir, match);
  }
  const newest = candidates
    .map((f) => ({ f, mtime: statSync(join(rendersDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0].f;
  return join(rendersDir, newest);
}

function findThumbnail(channelId, scriptSlug) {
  const thumbDir = join(ROOT, "data", "thumbnails", channelId);
  if (!existsSync(thumbDir)) return null;
  const files = readdirSync(thumbDir).filter((f) => THUMB_EXTENSIONS.includes(extname(f).toLowerCase()));
  if (files.length === 0) return null;
  if (scriptSlug) {
    // Per-video thumbnails are named <scriptSlug>-thumb.png (e.g.
    // warrantless-home-entry-emergency-aid-ruling-shorts-thumb.png).
    const match = files.find((f) => f === `${scriptSlug}-thumb.png`);
    if (match) return join(thumbDir, match);
  }
  // Fall back to the channel's generic branded thumbnail
  // (<channel_id>-thumb.png) — never another video's thumbnail.
  const generic = files.find((f) => f === `${channelId}-thumb.png`);
  if (generic) return join(thumbDir, generic);
  return null;
}

function queuePath(channelId) {
  // The queue must survive between runs and across runners: the daily
  // workflow's process-queue step reads it on later runs to flip due
  // videos public. data/run-logs/ is gitignored and lives only on the
  // ephemeral runner, so the queue lives in git-tracked data/publish-queue/
  // (the publish job commits it back after each run).
  return join(ROOT, "data", "publish-queue", channelId, "publish-queue.json");
}

function readQueue(channelId) {
  const p = queuePath(channelId);
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return [];
  }
}

function writeQueue(channelId, entries) {
  const p = queuePath(channelId);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(entries, null, 2));
}

async function buildMetadata(channel, videoPath, seo, topicHint) {
  const topic = topicHint || basename(videoPath, extname(videoPath)).replace(/[-_]+/g, " ");
  const title = seo?.title || `${topic} — ${channel.channel_name}`;
  const description = seo?.description || channel.description || "";
  const tags = seo?.tags?.length ? seo.tags : channel.tags || [];
  return {
    snippet: { title, description, tags, categoryId: "22" },
    status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
  };
}

async function uploadVideo(token, metadata, videoPath) {
  const buffer = readFileSync(videoPath);
  const initRes = await fetch(`${UPLOAD}/videos?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(buffer.length),
    },
    body: JSON.stringify(metadata),
  });
  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(`videos.insert init failed: ${err.error?.message || initRes.status}`);
  }
  const location = initRes.headers.get("location");
  if (!location) throw new Error("No upload URL returned by YouTube");

  const upRes = await fetch(location, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(buffer.length) },
    body: buffer,
  });
  const body = await upRes.json().catch(() => ({}));
  if (!upRes.ok) throw new Error(`videos.insert upload failed: ${body.error?.message || upRes.status}`);
  return body.id;
}

async function setThumbnail(token, videoId, thumbPath) {
  const buffer = readFileSync(thumbPath);
  const ext = extname(thumbPath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  const res = await fetch(`${UPLOAD}/thumbnails/set?videoId=${videoId}&uploadType=media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": mime },
    body: buffer,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`thumbnails.set failed: ${body.error?.message || res.status}`);
  return body.items?.[0]?.default?.url || null;
}

async function uploadChannel(channelId, explicitVideo, dryRun) {
  const channel = loadChannel(channelId);

  if (!hasCredentials(channel)) {
    const credPath = channel.youtube_credentials_path || `config/creds/${channel.channel_id}.json`;
    console.log(`\n[YOUTUBE-PUBLISH] Channel: ${channelId} (${channel.channel_name})`);
    console.log(`\n⚠️  BLOCKED: YouTube OAuth credentials not configured.`);
    console.log(`\nExpected credentials file: ${credPath}`);
    console.log(`Format: {"client_id": "...", "client_secret": "...", "refresh_token": "..."}`);
    console.log(`See README.md "How to get credentials" for how to obtain these.`);
    return;
  }

  // Placeholder Doctrine Requirement 4 (PROMPT-SELF-HEALING-RUN.md Part 1):
  // un-publishable is a hard gate, not a warning. Checked before anything
  // else — a placeholder anywhere in this channel's dependency chain means
  // nothing gets uploaded, dry-run or real.
  const openPlaceholders = unresolvedPlaceholdersForChannel(channelId);
  if (openPlaceholders.length > 0) {
    console.log(`\n[YOUTUBE-PUBLISH] Channel: ${channelId} (${channel.channel_name})`);
    console.log(`\n⚠️  BLOCKED: ${openPlaceholders.length} unresolved placeholder(s) in this channel's chain.`);
    for (const p of openPlaceholders) {
      console.log(`  - ${p.stands_in_for} (${p.artifact_path}): ${p.reason}`);
      console.log(`    Would be replaced by: ${p.would_be_replaced_by}`);
    }
    console.log(`\nResolve every placeholder (src/utils/placeholders.js resolvePlaceholder) before publishing.`);
    return;
  }

  const creds = loadCredentials(channel);
  const videoPath = findVideo(channelId, explicitVideo);
  const topicHint = basename(videoPath, extname(videoPath));
  const scriptSlug = topicSlugFromVideo(topicHint);
  const seo = loadSeoMetadata(channelId, scriptSlug);
  const thumb = findThumbnail(channelId, scriptSlug);
  if (!seo) console.log(`  WARNING: no SEO metadata for "${scriptSlug}" - using fallback title/description.`);
  if (!thumb) console.log(`  WARNING: no thumbnail for "${scriptSlug}" - YouTube will pick a frame.`);

  // NICHE-AUDIT.md §3.3 — Medicare Navigator's condition for existing at
  // all is human review before every single upload. Enforced as a file a
  // human creates, not a config flag anything automated could flip.
  if (channel.requires_human_review) {
    const approvalPath = join(ROOT, "data", "approvals", String(channelId), `${topicHint}.approved`);
    if (!existsSync(approvalPath)) {
      console.log(`\n[YOUTUBE-PUBLISH] Channel: ${channelId} (${channel.channel_name})`);
      console.log(`\n⚠️  BLOCKED: this channel requires human review before every upload.`);
      console.log(`${channel.human_review_notes || ""}`);
      console.log(`\nA human must review "${videoPath}" and create: ${approvalPath}`);
      console.log(`(e.g. mkdir -p "$(dirname ${approvalPath})" && echo "approved by <name>, $(date -u +%F)" > ${approvalPath})`);
      return;
    }
    console.log(`  Human review: approved (${approvalPath})`);
  }

  console.log(`[YOUTUBE-PUBLISH] Channel: ${channelId} (${channel.channel_name})`);
  console.log(`  Account: ${creds.google_account || "?"} | Channel ID: ${channel.youtube_channel_id || "SET_ME"}`);
  console.log(`  Video: ${videoPath}`);
  console.log(`  Thumbnail: ${thumb || "none"}`);

  const token = await getAccessToken(channel);
  console.log(`  OAuth: access token OK`);

  const metadata = await buildMetadata(channel, videoPath, seo, scriptSlug);
  console.log(`  Title: ${metadata.snippet.title}`);
  console.log(`  Tags: ${metadata.snippet.tags.length} | Privacy: private`);

  if (dryRun) {
    console.log(`\n  DRY-RUN: no upload performed. Channel ready to post.`);
    return;
  }

  const videoId = await uploadVideo(token, metadata, videoPath);
  console.log(`  Uploaded: ${videoId}`);

  if (thumb) {
    const thumbUrl = await setThumbnail(token, videoId, thumb);
    console.log(`  Thumbnail: ${thumbUrl || "set"}`);
  }

  const delayHours = channel.publish_delay_hours ?? 1;
  const stayPrivate = channel.stay_private === true;
  const goPublicAt = new Date(Date.now() + delayHours * 3600 * 1000).toISOString();
  const entry = {
    video_id: videoId,
    channel_id: channelId,
    youtube_channel_id: channel.youtube_channel_id,
    title: metadata.snippet.title,
    uploaded_at: new Date().toISOString(),
    publish_delay_hours: delayHours,
    go_public_at: goPublicAt,
    privacy_status: "private",
    cancelled: stayPrivate,
  };
  const queue = readQueue(channelId);
  queue.push(entry);
  writeQueue(channelId, queue);

  console.log(`\n  Private link: https://youtu.be/${videoId}`);
  if (stayPrivate) {
    console.log(`  STAYS PRIVATE: stay_private=true — this video will never auto-go-public.`);
  } else {
    console.log(`  Goes public: ${goPublicAt} (in ${delayHours} hour(s))`);
  }
  console.log(`  Queued: ${queuePath(channelId)}`);
  console.log(`  To cancel: node run.js cancel ${channelId} ${videoId}`);
}

async function processQueue() {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const now = Date.now();
  let flipped = 0;

  for (const channel of channels) {
    const queue = readQueue(String(channel.id)); // pipeline id ("2"), not channel_id ("ch-02") - uploads write under the CLI arg
    if (queue.length === 0) continue;
    let changed = false;

    for (const entry of queue) {
      if (entry.cancelled || entry.privacy_status === "public") continue;
      if (Date.parse(entry.go_public_at) > now) continue;

      try {
        const token = await getAccessToken(channel);
        const res = await fetch(`${API}/videos?part=status`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: entry.video_id, status: { privacyStatus: "public" } }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error?.message || res.status);
        entry.privacy_status = "public";
        entry.published_at = new Date().toISOString();
        changed = true;
        flipped++;
        console.log(`  ${String(channel.id)} ${entry.video_id} -> PUBLIC`);
      } catch (err) {
        console.log(`  ${String(channel.id)} ${entry.video_id} FAILED: ${err.message}`);
      }
    }
    if (changed) writeQueue(String(channel.id), queue);
  }

  if (flipped === 0) console.log("No due entries to publish.");
  console.log(`Published: ${flipped}`);
}

function cancelQueued(channelId, videoId) {
  const queue = readQueue(channelId);
  const entry = queue.find((e) => e.video_id === videoId);
  if (!entry) {
    console.log(`No queued entry for ${videoId}`);
    process.exit(1);
  }
  entry.cancelled = true;
  writeQueue(channelId, queue);
  console.log(`Cancelled publish for ${videoId}. It will remain private.`);
}

function main() {
  const [arg1, arg2] = process.argv.slice(2);

  if (arg1 === "process-queue") {
    return processQueue().catch((err) => {
      console.error(`\n[YOUTUBE-PUBLISH] ERROR: ${err.message}`);
      process.exit(1);
    });
  }
  if (arg1 === "cancel") {
    cancelQueued(arg2, process.argv[4]);
    return;
  }

  const channelId = arg1;
  if (!channelId) {
    console.error("Usage:");
    console.error("  node run.js <channel-id> [--dry-run] [<video.mp4>]");
    console.error("  node run.js process-queue");
    console.error("  node run.js cancel <channel-id> <video-id>");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const videoArg = process.argv.slice(2).find((a) => !a.startsWith("--") && a !== channelId);

  uploadChannel(channelId, videoArg, dryRun)
    .catch((err) => {
      console.error(`\n[YOUTUBE-PUBLISH] ERROR: ${err.message}`);
      process.exit(1);
    });
}

main();
