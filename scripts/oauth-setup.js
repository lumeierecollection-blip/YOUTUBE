#!/usr/bin/env node
/**
 * YouTube OAuth Setup — authorize multiple channels simultaneously.
 *
 * Opens one browser tab per channel. You log into each tab with the right
 * Google account, approve, and this script captures the refresh_token for
 * each channel automatically. At the end it prints the exact GitHub Secret
 * values to paste into your repo settings.
 *
 * Usage:
 *   node scripts/oauth-setup.js --client-id <ID> --client-secret <SECRET> --channels 1,2,3,4,9,11
 *
 * Channels is the numeric pipeline ID (1, 2, 3, 4, 7, 9, 11, 17, 26, 30, 31, 35, 39, 44, 46, 47, 48).
 *
 * BEFORE RUNNING:
 *   In Google Cloud Console → APIs & Services → Credentials → your OAuth client:
 *   Add these as Authorized redirect URIs:
 *     http://localhost:3001
 *     http://localhost:3002
 *     http://localhost:3003
 *     http://localhost:3004
 *     http://localhost:3005
 *     http://localhost:3006
 *     http://localhost:3007
 *     http://localhost:3008
 *     http://localhost:3009
 *   (add as many as the max batch size you'll run at once, up to 9)
 */

import { createServer } from "node:http";
import { exec, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── args ──────────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : null;
}

const clientId = arg("client-id");
const clientSecret = arg("client-secret");
const channelArg = arg("channels");

if (!clientId || !clientSecret || !channelArg) {
  console.error("Usage: node scripts/oauth-setup.js --client-id <ID> --client-secret <SECRET> --channels 1,2,3");
  process.exit(1);
}

const channelIds = channelArg.split(",").map((s) => s.trim()).filter(Boolean);
const BASE_PORT = 3001;
const SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Channel name lookup (from channels.json — informational only)
const CHANNEL_NAMES = {
  1: "Money Mind",
  2: "Legal Brief",
  3: "AI Tested",
  4: "Hidden Past",
  7: "Dead Companies",
  9: "Border Lines",
  11: "Cosmic Frontiers",
  17: "Epoch Chronicles",
  26: "Fraud Files",
  30: "Cold Case DNA",
  31: "Justice Denied",
  35: "The Engineering Archive",
  39: "Case File Medicine",
  44: "Skill Stack",
  46: "Interview Insider",
  47: "Medicare Navigator",
  48: "Factory Floor",
};

// ── OAuth URL builder ─────────────────────────────────────────────────────────
function authUrl(port, channelId) {
  const redirectUri = `http://localhost:${port}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: String(channelId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────
async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok || !data.refresh_token) {
    throw new Error(`Token exchange failed: ${data.error} — ${data.error_description || JSON.stringify(data)}`);
  }
  return data.refresh_token;
}

// ── Identify real YouTube channel from access token ───────────────────────────
async function identifyChannel(refreshToken) {
  try {
    // Get a short-lived access token
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return null;

    // Ask YouTube which channel this account owns
    const chRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const chData = await chRes.json();
    const ch = chData.items?.[0];
    if (!ch) return null;
    return {
      youtube_channel_id: ch.id,
      real_name: ch.snippet.title,
      description: ch.snippet.description?.slice(0, 120) || "",
    };
  } catch {
    return null;
  }
}

// ── One server per channel ────────────────────────────────────────────────────
function listenForCode(port, channelId) {
  return new Promise((resolve, reject) => {
    const redirectUri = `http://localhost:${port}`;
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, redirectUri);
      if (url.pathname !== "/" && url.pathname !== "") return;

      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h2>Authorization denied for channel ${channelId}</h2><p>${error}</p>`);
        server.close();
        reject(new Error(`Channel ${channelId}: user denied — ${error}`));
        return;
      }
      if (!code) return; // waiting for the redirect

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html><body style="font-family:sans-serif;padding:32px;background:#0f0f0f;color:#fff">
        <h2 style="color:#4ade80">✓ Channel ${channelId} authorized!</h2>
        <p>You can close this tab.</p>
        </body></html>
      `);
      server.close();

      try {
        const refreshToken = await exchangeCode(code, redirectUri);
        resolve({ channelId, refreshToken });
      } catch (err) {
        reject(err);
      }
    });

    server.listen(port, "localhost", () => {
      console.log(`  Listening on port ${port} for channel ${channelId} (${CHANNEL_NAMES[channelId] || "?"})`);
    });

    server.on("error", (err) => {
      reject(new Error(`Port ${port} error: ${err.message}`));
    });
  });
}

// ── Open a URL in the default browser ────────────────────────────────────────
function openBrowser(url) {
  const platform = process.platform;
  let child;
  if (platform === "win32") {
    // Use PowerShell Start-Process — works from Git Bash, cmd, and PS
    child = exec(`powershell.exe -NoProfile -Command "Start-Process '${url}'"`, (err) => {
      if (err) {
        // Fallback: explorer.exe
        exec(`explorer.exe "${url}"`, () => {});
      }
    });
  } else if (platform === "darwin") {
    child = exec(`open "${url}"`, () => {});
  } else {
    child = exec(`xdg-open "${url}"`, () => {});
  }
  return child;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nYouTube OAuth Setup — ${channelIds.length} channel(s)\n`);
  console.log(`Client ID: ${clientId.slice(0, 20)}...`);
  console.log(`Channels:  ${channelIds.join(", ")}\n`);

  // Start all servers first, then open all tabs at once
  const promises = channelIds.map((chId, i) => {
    const port = BASE_PORT + i;
    return listenForCode(port, chId);
  });

  // Small delay so servers are all listening before we open browsers
  await new Promise((r) => setTimeout(r, 500));

  console.log("\n" + "=".repeat(70));
  console.log("Opening browser tabs — sign into the correct Google account for each.");
  console.log("If tabs don't open automatically, copy each URL and paste it into Chrome.");
  console.log("=".repeat(70) + "\n");

  channelIds.forEach((chId, i) => {
    const port = BASE_PORT + i;
    const name = CHANNEL_NAMES[chId] || `Channel ${chId}`;
    const url = authUrl(port, chId);
    console.log(`TAB ${i + 1}  CH-${String(chId).padStart(2, "0")} ${name}`);
    console.log(url);
    console.log("");
    setTimeout(() => openBrowser(url), i * 400);
  });

  console.log("Waiting for you to authorize all tabs...\n");

  const results = await Promise.allSettled(promises);

  // Push secrets to GitHub via gh CLI
  function ghSecretSet(name, value) {
    try {
      execFileSync("gh", ["secret", "set", name, "--body", value], { stdio: ["ignore", "pipe", "pipe"] });
      return true;
    } catch (err) {
      console.error(`  gh secret set ${name} FAILED: ${err.stderr?.toString().trim() || err.message}`);
      return false;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("Identifying real YouTube channels and saving credentials...");
  console.log("=".repeat(70) + "\n");

  const credsDir = join(__dirname, "..", "config", "creds");
  mkdirSync(credsDir, { recursive: true });

  const succeeded = [];
  const failed = [];
  const mapping = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { channelId, refreshToken } = result.value;
      const n = String(channelId).padStart(2, "0");

      // Identify the real YouTube channel
      process.stdout.write(`  CH-${n} identifying...`);
      const ytChannel = await identifyChannel(refreshToken);
      if (ytChannel) {
        console.log(` → "${ytChannel.real_name}" (${ytChannel.youtube_channel_id})`);
      } else {
        console.log(` → (could not identify — no YouTube channel on this account?)`);
      }

      // Save credentials locally to config/creds/<channel_id>.json
      const credFile = join(credsDir, `ch-${n}.json`);
      writeFileSync(credFile, JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        google_account: ytChannel?.real_name || "",
        youtube_channel_id: ytChannel?.youtube_channel_id || "",
      }, null, 2));

      // Push to GitHub Secrets
      const ok1 = ghSecretSet(`CHANNEL_${n}_CLIENT_ID`, clientId);
      const ok2 = ghSecretSet(`CHANNEL_${n}_CLIENT_SECRET`, clientSecret);
      const ok3 = ghSecretSet(`CHANNEL_${n}_REFRESH_TOKEN`, refreshToken);
      const allOk = ok1 && ok2 && ok3;
      console.log(`  CH-${n}: creds saved locally, GitHub secrets ${allOk ? "✓ pushed" : "⚠ partial"}`);

      if (allOk) succeeded.push(`CH-${n}`);
      else failed.push(`CH-${n} (partial)`);

      mapping.push({
        slot: `CH-${n}`,
        real_name: ytChannel?.real_name || "UNKNOWN",
        youtube_channel_id: ytChannel?.youtube_channel_id || "UNKNOWN",
        description: ytChannel?.description || "",
      });
    } else {
      failed.push(`Authorization failed: ${result.reason.message}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("CHANNEL MAPPING — update channels.json to match:");
  console.log("=".repeat(70));
  for (const m of mapping) {
    console.log(`\n  ${m.slot}`);
    console.log(`    Real YouTube name : ${m.real_name}`);
    console.log(`    YouTube channel ID: ${m.youtube_channel_id}`);
    if (m.description) console.log(`    Description       : ${m.description.slice(0, 80)}...`);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`Done. ${succeeded.length}/${succeeded.length + failed.length} channel(s) fully configured.`);
  if (failed.length) {
    console.log(`  FAILED: ${failed.join(", ")}`);
    console.log(`  Run the script again for failed channels.`);
  }
  console.log(`\nLocal credential files saved to: config/creds/`);
  console.log(`(config/creds/ is gitignored — never committed)\n`);
}

main().catch((err) => {
  console.error(`\nFATAL: ${err.message}`);
  process.exit(1);
});
