import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function loadCredentials(channel) {
  const credPath = channel.youtube_credentials_path
    ? join(ROOT, channel.youtube_credentials_path)
    : join(ROOT, "config", "creds", `${channel.channel_id}.json`);
  return JSON.parse(readFileSync(credPath, "utf-8"));
}

export function hasCredentials(channel) {
  try {
    loadCredentials(channel);
    return true;
  } catch {
    return false;
  }
}

export async function getAccessToken(channel) {
  const creds = loadCredentials(channel);
  const params = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OAuth token exchange failed: ${data.error} — ${data.error_description || "see Google response"}`);
  }
  return data.access_token;
}

export async function getMyChannel(accessToken) {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`channels.list failed: ${data.error?.message || res.status}`);
  }
  return data.items?.[0] || null;
}
