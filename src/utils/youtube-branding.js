import { getAccessToken } from "./youtube-auth.js";

const API = "https://www.googleapis.com/youtube/v3";

export async function pushChannelBranding(channel) {
  const token = await getAccessToken(channel);

  const resource = await fetch(`${API}/channels?part=brandingSettings&mine=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const currentJson = await resource.json();
  if (!resource.ok) throw new Error(`channels.list failed: ${currentJson.error?.message || resource.status}`);
  const item = currentJson.items?.[0];
  if (!item) throw new Error("No channel found for this account");

  const keywords = (channel.tags || []).join(" ");
  item.brandingSettings = item.brandingSettings || {};
  item.brandingSettings.channel = item.brandingSettings.channel || {};
  item.brandingSettings.channel.title = channel.channel_name;
  item.brandingSettings.channel.description = channel.description;
  item.brandingSettings.channel.keywords = keywords;

  const res = await fetch(`${API}/channels?part=brandingSettings`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`channels.update failed: ${json.error?.message || res.status}`);
  return json.id;
}
