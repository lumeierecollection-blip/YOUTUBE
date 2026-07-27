import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export function loadChannels() {
  const raw = readFileSync(join(ROOT, 'config', 'channels.json'), 'utf8');
  return JSON.parse(raw);
}

export function loadChannel(channelId) {
  const data = loadChannels();
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const ch = channels.find(c => c.id === numId || c.channel_id === channelId);
  if (!ch) throw new Error(`Channel not found: ${channelId}`);
  return ch;
}

export function loadSchema() {
  try {
    const raw = readFileSync(join(ROOT, 'config', 'channel-schema.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getResearchDir(channelId) {
  return join(ROOT, 'data', 'research', channelId);
}

export function getRunLogDir(channelId) {
  return join(ROOT, 'data', 'run-logs', channelId);
}
