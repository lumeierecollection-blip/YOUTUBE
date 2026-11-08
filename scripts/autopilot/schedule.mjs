/**
 * Slot arithmetic and the ledger. Pure functions apart from the two ledger file helpers,
 * so the scheduling rules are unit-tested without git or GitHub.
 *
 * A slot id is <SAST date>-ch<channel>. It is the idempotency key: a slot claimed in the
 * ledger is never produced again, however many triggers fire.
 */
import { join } from "node:path";
import { CONFIG, STATE_DIR, readJson, writeJson } from "./lib.mjs";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR = 3600e3;

/** The UTC instant of a slot on the SAST date `day` (Date at SAST midnight expressed in UTC ms). */
const slotInstant = (sastMidnightMs, time) => {
  const [h, m] = time.split(":").map(Number);
  return sastMidnightMs + (h * HOUR) + m * 60e3 - CONFIG.timezone_offset_hours * HOUR;
};

/** Every configured slot whose instant falls in [fromMs, toMs]. */
export function slotsBetween(fromMs, toMs, config = CONFIG) {
  const out = [];
  const offset = config.timezone_offset_hours * HOUR;
  const firstDay = Math.floor((fromMs + offset) / (24 * HOUR)) - 1;
  const lastDay = Math.floor((toMs + offset) / (24 * HOUR)) + 1;
  for (let d = firstDay; d <= lastDay; d++) {
    const date = new Date(d * 24 * HOUR);
    const dayName = DAYS[date.getUTCDay()];
    for (const [channel, c] of Object.entries(config.channels)) {
      for (const s of c.slots) {
        if (s.day !== dayName) continue;
        const at = slotInstant(d * 24 * HOUR, s.time);
        if (at >= fromMs && at <= toMs) out.push({ id: `${date.toISOString().slice(0, 10)}-ch${channel}`, channel, at, day: s.day, time: s.time });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * The slot this run should produce, or null. Retries are ordered after fresh slots of any
 * channel, so a failing production never holds up the other channel.
 */
export function pickDueSlot(ledger, nowMs, config = CONFIG) {
  const slots = slotsBetween(nowMs - config.slot_window_hours * HOUR, nowMs, config);
  const runnable = slots.filter((s) => {
    const rec = ledger.slots[s.id];
    if (!rec) return true;
    return rec.status === "failed" && (rec.attempts || 0) < config.max_attempts_per_slot;
  });
  runnable.sort((a, b) => (ledger.slots[a.id]?.attempts || 0) - (ledger.slots[b.id]?.attempts || 0) || a.at - b.at);
  return runnable[0] || null;
}

const STALE_MS = 3 * HOUR;

/**
 * A job killed by GitHub never reports back, so its slot would stay "running" forever and quietly
 * stop that channel. Abandoned slots become ordinary failures and use the normal attempt limit.
 * A slot that passed QA but never reported an upload is not retried: the video may exist.
 */
export function reapStale(ledger, nowMs, config = CONFIG) {
  const reaped = [];
  for (const [id, rec] of Object.entries(ledger.slots)) {
    if (!["running", "qa-passed"].includes(rec.status)) continue;
    if (nowMs - Date.parse(rec.updated_at || 0) < STALE_MS) continue;
    if (rec.status === "qa-passed") {
      rec.status = "failed-final";
      rec.error = "passed QA but no upload result was recorded; check the channel before re-producing";
      if (!ledger.attention.includes(`${id}: ${rec.error}`)) ledger.attention.push(`${id}: ${rec.error}`);
    } else {
      rec.status = (rec.attempts || 0) >= config.max_attempts_per_slot ? "failed-final" : "failed";
      rec.error = `run ${rec.run_id} ended without reporting a result (last stage: ${rec.stage || "start"})`;
    }
    reaped.push(id);
  }
  return reaped;
}

export function nextSlots(nowMs, count = 3, config = CONFIG) {
  return slotsBetween(nowMs, nowMs + 8 * 24 * HOUR, config).slice(0, count);
}

export const formatSast = (ms) => new Date(ms + CONFIG.timezone_offset_hours * HOUR).toISOString().replace("T", " ").slice(0, 16) + " SAST";

const ledgerPath = () => join(STATE_DIR, "autopilot", "ledger.json");
export const loadLedger = () => readJson(ledgerPath(), { slots: {}, uploads: [], topics: [], attention: [] });
export const saveLedger = (l) => writeJson(ledgerPath(), l);
