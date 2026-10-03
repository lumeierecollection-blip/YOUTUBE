#!/usr/bin/env node
/**
 * YouTube Upload — private upload via OAuth2 refresh token.
 *
 * Always sets privacyStatus: "private" — hardcoded, not configurable.
 * If privacyStatus is ever anything other than "private", throw and exit.
 *
 * Usage:
 *   node scripts/youtube-upload.cjs --file <path> --title <string> [--description <string>] [--tags <comma-list>] [--channel <id>]
 *
 * Env vars required:
 *   YT_CLIENT_ID      — OAuth2 client ID
 *   YT_CLIENT_SECRET  — OAuth2 client secret
 *   YT_REFRESH_TOKEN  — OAuth2 refresh token
 *
 * On success: writes data/uploads/<channel>/<date>-<videoId>.json
 * On failure: exits non-zero with the API error
 */

const { readFileSync, writeFileSync, mkdirSync, existsSync } = require("node:fs");
const { join, dirname, basename } = require("node:path");
const https = require("node:https");

const ROOT = join(__dirname, "..");

/* ── Args ────────────────────────────────────────────────────────── */

function parseArgs() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  return {
    file: flag("--file"),
    title: flag("--title"),
    description: flag("--description") || "",
    tags: flag("--tags") || "",
    channel: flag("--channel") || "unknown",
  };
}

/* ── OAuth2 Token Refresh ────────────────────────────────────────── */

async function getAccessToken() {
  const clientId = process.env.YT_CLIENT_ID;
  const clientSecret = process.env.YT_CLIENT_SECRET;
  const refreshToken = process.env.YT_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing env vars: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN");
  }

  const postData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.access_token) {
              resolve(json.access_token);
            } else {
              reject(new Error(`Token refresh failed: ${json.error_description || json.error || data}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse token response: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

/* ── YouTube Upload ──────────────────────────────────────────────── */

async function uploadVideo(accessToken, { file, title, description, tags }) {
  // Read file metadata
  const fileData = readFileSync(file);
  const fileSize = fileData.length;

  // Prepare metadata
  const metadata = {
    snippet: {
      title: title || basename(file, ".mp4"),
      description: description || "",
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: "private", // HARDCODED — never anything else
      selfDeclaredMadeForKids: false,
    },
  };

  // Verify privacyStatus is private (safety check)
  if (metadata.status.privacyStatus !== "private") {
    throw new Error("FATAL: privacyStatus is not 'private' — refusing to upload");
  }

  // Initialize resumable upload
  const initMetadata = JSON.stringify(metadata);
  const initReq = https.request(
    {
      hostname: "www.googleapis.com",
      path: "/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": fileSize,
        "X-Upload-Content-Type": "video/mp4",
      },
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 308) {
          // Upload URL received, now upload the file
          const uploadUrl = res.headers.location;
          uploadFileData(accessToken, uploadUrl, fileData, fileSize)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Init upload failed (${res.statusCode}): ${data}`));
        }
      });
    }
  );
  initReq.on("error", reject);
  initReq.write(initMetadata);
  initReq.end();
}

function uploadFileData(accessToken, uploadUrl, fileData, fileSize) {
  return new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.id) {
              resolve(json);
            } else {
              reject(new Error(`Upload failed: ${data}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse upload response: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(fileData);
    req.end();
  });
}

/* ── Main ─────────────────────────────────────────────────────────── */

async function main() {
  const opts = parseArgs();

  if (!opts.file) {
    console.error("Usage: node youtube-upload.cjs --file <path> --title <string> [--description <string>] [--tags <comma-list>] [--channel <id>]");
    process.exit(1);
  }

  if (!existsSync(opts.file)) {
    console.error(`File not found: ${opts.file}`);
    process.exit(1);
  }

  // Check env vars early
  if (!process.env.YT_CLIENT_ID || !process.env.YT_CLIENT_SECRET || !process.env.YT_REFRESH_TOKEN) {
    console.warn("WARNING: YouTube credentials not set (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN). Skipping upload.");
    process.exit(0);
  }

  try {
    console.log(`=== YOUTUBE UPLOAD: ${basename(opts.file)} ===`);
    console.log(`Title: ${opts.title || basename(opts.file, ".mp4")}`);
    console.log(`Privacy: private (hardcoded)`);

    const accessToken = await getAccessToken();
    console.log("Access token obtained.");

    const result = await uploadVideo(accessToken, opts);
    const videoId = result.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`Upload successful: ${videoUrl}`);

    // Write upload record
    const date = new Date().toISOString().slice(0, 10);
    const uploadDir = join(ROOT, "data", "uploads", opts.channel);
    mkdirSync(uploadDir, { recursive: true });
    const uploadPath = join(uploadDir, `${date}-${videoId}.json`);
    writeFileSync(
      uploadPath,
      JSON.stringify(
        {
          videoId,
          url: videoUrl,
          title: opts.title || basename(opts.file, ".mp4"),
          description: opts.description,
          tags: opts.tags ? opts.tags.split(",").map((t) => t.trim()) : [],
          privacyStatus: "private",
          uploadedAt: new Date().toISOString(),
          filePath: opts.file,
        },
        null,
        2
      ) + "\n"
    );
    console.log(`Upload record: ${uploadPath}`);

    // Output for workflow
    console.log(`::set-output name=videoId::${videoId}`);
    console.log(`::set-output name=videoUrl::${videoUrl}`);
  } catch (err) {
    console.error(`Upload failed: ${err.message}`);
    process.exit(1);
  }
}

main();
