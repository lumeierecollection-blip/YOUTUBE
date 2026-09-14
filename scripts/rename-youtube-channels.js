#!/usr/bin/env node
/**
 * Rename YouTube channels to match channels.json.
 *
 * Reads config/creds/ch-XX.json for each channel, gets a fresh access token,
 * then calls channels.update (brandingSettings) to set the channel title and
 * description to whatever channels.json says.
 *
 * Requires the 'youtube' scope on the stored tokens — run oauth-setup.js
 * first (which now requests youtube + youtube.upload + youtube.readonly).
 *
 * Usage:
 *   node scripts/rename-youtube-channels.js --channels 1,2,3,4,7
 *   node scripts/rename-youtube-channels.js --channels 1,2,3,4,7 --dry-run
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : null;
}

const channelArg = arg("channels");
const dryRun = process.argv.includes("--dry-run");

if (!channelArg) {
  console.error("Usage: node scripts/rename-youtube-channels.js --channels 1,2,3,4,7 [--dry-run]");
  process.exit(1);
}

const ids = channelArg.split(",").map((s) => s.trim());

const channelsConfig = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
const channels = channelsConfig.channels || channelsConfig;

async function getAccessToken(creds) {
  const body = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${data.error} — ${data.error_description || ""}`);
  }
  return data.access_token;
}

async function getCurrentBranding(token) {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=brandingSettings,snippet&mine=true",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`channels.list failed: ${data.error?.message || res.status}`);
  return data.items?.[0] || null;
}

async function renameChannel(token, channelId, newTitle, newDescription) {
  const body = {
    id: channelId,
    brandingSettings: {
      channel: {
        title: newTitle,
        description: newDescription,
      },
    },
  };
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=brandingSettings",
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`channels.update failed: ${data.error?.message || res.status}`);
  return data;
}

async function main() {
  console.log(`\nRenaming ${ids.length} YouTube channel(s)${dryRun ? " [DRY RUN]" : ""}...\n`);

  for (const id of ids) {
    const n = String(id).padStart(2, "0");
    const config = channels.find((c) => String(c.id) === id);
    if (!config) {
      console.log(`CH-${n}: not found in channels.json — skipping`);
      continue;
    }

    const credsPath = join(ROOT, "config", "creds", `ch-${n}.json`);
    let creds;
    try {
      creds = JSON.parse(readFileSync(credsPath, "utf-8"));
    } catch {
      console.log(`CH-${n}: no credentials at ${credsPath} — run oauth-setup.js first`);
      continue;
    }

    console.log(`CH-${n} → "${config.channel_name}"`);

    try {
      const token = await getAccessToken(creds);
      const current = await getCurrentBranding(token);

      if (!current) {
        console.log(`  ⚠ No YouTube channel found on this account`);
        continue;
      }

      const currentTitle = current.brandingSettings?.channel?.title || current.snippet?.title || "(unknown)";
      console.log(`  Current name: "${currentTitle}"`);
      console.log(`  New name:     "${config.channel_name}"`);
      console.log(`  Description:  "${config.description?.slice(0, 60)}..."`);

      if (dryRun) {
        console.log(`  DRY RUN — no change made\n`);
        continue;
      }

      if (currentTitle === config.channel_name) {
        console.log(`  Already correct — skipping\n`);
        continue;
      }

      await renameChannel(token, current.id, config.channel_name, config.description || "");
      console.log(`  ✓ Renamed successfully\n`);
    } catch (err) {
      console.log(`  ✗ Failed: ${err.message}\n`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(`\nFATAL: ${err.message}`);
  process.exit(1);
});
