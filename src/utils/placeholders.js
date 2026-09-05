/**
 * Placeholder Doctrine — PROMPT-SELF-HEALING-RUN.md Part 1.
 *
 * "A placeholder must be impossible to mistake for the real thing, and
 * impossible to publish." Four requirements, enforced here:
 *   1. Marked in the filename — see markPlaceholderPath().
 *   2. Registered — every placeholder is logged in data/placeholders.json.
 *   3. Loud — a `::warning::` in the Actions log on creation and on use.
 *   4. Un-publishable — hasPlaceholderInChain() is a hard gate,
 *      wired into src/skills/youtube-publish/run.js.
 *
 * Legitimate placeholders: OAuth credentials, narration on a channel whose
 * voice isn't verified working yet, licensed imagery, art-directed
 * thumbnails.
 *
 * NEVER a placeholder: research facts, script content, topics, numbers,
 * sources. If those can't be produced for real, the run fails — it does
 * not call anything in this file.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const REGISTRY_DIR = join(ROOT, "data", "placeholders");

// One registry file PER CHANNEL, not one shared data/placeholders.json.
// research-and-script's matrix runs up to 5 channels in parallel — a
// single shared file would race exactly like the original topic-log.json
// bug (concurrent read-modify-write, last writer wins, silent data loss).
// Each channel owns its own file exclusively; readAllPlaceholders()
// aggregates across all of them for the publish/preflight steps.
function registryPath(channelId) {
  return join(REGISTRY_DIR, `${channelId}.json`);
}

function loadRegistry(channelId) {
  const path = registryPath(channelId);
  if (!existsSync(path)) {
    return { version: "1.0.0", channel_id: String(channelId), placeholders: [] };
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveRegistry(channelId, reg) {
  mkdirSync(REGISTRY_DIR, { recursive: true });
  writeFileSync(registryPath(channelId), JSON.stringify(reg, null, 2) + "\n");
}

function ghWarning(message) {
  // GitHub Actions workflow command syntax — surfaces as an annotation on
  // the run, not just a buried log line. Harmless (just a text line) when
  // run outside Actions.
  console.warn(`::warning::${message}`);
}

/**
 * Requirement 1 — inserts ".PLACEHOLDER" before the extension, so a real
 * artifact and a stand-in can never share a path.
 *   markPlaceholderPath("data/tts/1/slug-vo.mp3") -> "data/tts/1/slug-vo.PLACEHOLDER.mp3"
 */
export function markPlaceholderPath(path) {
  const ext = extname(path);
  const base = path.slice(0, -ext.length || undefined);
  return `${base}.PLACEHOLDER${ext}`;
}

export function isPlaceholderPath(path) {
  return /\.PLACEHOLDER\./.test(basename(path));
}

/**
 * Requirements 2+3 — registers a placeholder and logs a loud warning.
 * Call this at the moment a placeholder is CREATED, with the
 * already-marked path (see markPlaceholderPath).
 */
export function registerPlaceholder({ channelId, artifactPath, standsInFor, reason, wouldBeReplacedBy }) {
  if (!isPlaceholderPath(artifactPath)) {
    throw new Error(`registerPlaceholder: "${artifactPath}" is not a marked placeholder path — use markPlaceholderPath() first.`);
  }
  const reg = loadRegistry(channelId);
  const entry = {
    id: `${channelId}-${Date.now()}`,
    channel_id: String(channelId),
    artifact_path: artifactPath,
    stands_in_for: standsInFor,
    reason,
    would_be_replaced_by: wouldBeReplacedBy,
    created_at: new Date().toISOString(),
    resolved_at: null,
  };
  reg.placeholders.push(entry);
  saveRegistry(channelId, reg);
  ghWarning(`Placeholder created for channel ${channelId}: ${standsInFor} (${artifactPath}) — ${reason}`);
  return entry;
}

/** Marks a placeholder resolved once the real artifact replaces it. */
export function resolvePlaceholder(channelId, id) {
  const reg = loadRegistry(channelId);
  const entry = reg.placeholders.find((p) => p.id === id);
  if (!entry) throw new Error(`No placeholder with id "${id}" for channel ${channelId}`);
  entry.resolved_at = new Date().toISOString();
  saveRegistry(channelId, reg);
  return entry;
}

/**
 * Requirement 4 — the publish-time gate. Returns the list of unresolved
 * placeholders registered for a channel (empty = clear to publish).
 * youtube-publish/run.js refuses to upload when this is non-empty.
 *
 * Reads this channel's own registry file directly — safe under the
 * parallel matrix (each channel owns its file), and also correct in the
 * downstream publish job as long as each channel's
 * data/placeholders/<id>.json is included in its uploaded artifact (see
 * daily-pipeline.yml's "Upload research artifacts" step).
 */
export function unresolvedPlaceholdersForChannel(channelId) {
  const reg = loadRegistry(channelId);
  return reg.placeholders.filter((p) => !p.resolved_at);
}

/**
 * Aggregates unresolved placeholders across every channel's registry file
 * — used by scripts/preflight.js. Not used by the per-channel publish
 * gate (that reads only its own channel's file, above).
 */
export function readAllPlaceholders() {
  if (!existsSync(REGISTRY_DIR)) return [];
  return readdirSync(REGISTRY_DIR)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(readFileSync(join(REGISTRY_DIR, f), "utf-8")).placeholders || []);
}

/**
 * Loud, explicit check for a specific file about to be consumed
 * downstream (e.g. render.js about to stage a voiceover). Warns if the
 * input is a marked placeholder, so consumption is never silent.
 */
export function warnIfPlaceholder(path, context) {
  if (isPlaceholderPath(path)) {
    ghWarning(`Consuming placeholder in ${context}: ${path}`);
    return true;
  }
  return false;
}
