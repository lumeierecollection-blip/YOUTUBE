/**
 * channel-direction — a channel's reference creative direction, compact enough to ride in the planner
 * prompt, and the reference images the whole-video critic is shown.
 *
 * Source of truth: the analyses scripts/reference/analyze-reference.mjs writes to
 * data/reference/analysis/<video stem>/ (direction.json, samples.json, contact-NN.jpg). Which reference a
 * channel uses is the same lookup the planner's frames use (reference-frames.js referenceSourceFor): its
 * style spec's reference_video, else the shared research/motion-graphics-ref set.
 *
 * What this can and cannot say (keep it honest):
 *   - Pacing numbers (cuts, cadence, longest hold) are MEASURED by ffmpeg / novelty.mjs. They are
 *     included for every analysis, measured-only or not.
 *   - Typography / composition / transition / pacing OBSERVATIONS exist only when a vision pass completed
 *     (direction.status "complete"). Only medium/high confidence ones with frame evidence are used, each
 *     cited as frame id @ its timestamp in the reference. A measured-only analysis says so in the summary
 *     and contributes no observation — nothing is filled in.
 *   - No analysis for the channel's reference -> empty text and a `why` the caller logs. Never invented.
 *   - Colour observations are never included (colour lives in config/channels.json, CHECK-REGISTER SCR-13).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { referenceSourceFor, SHARED_REFS } from "../reference-frames.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
/** Hard cap on the planner section (chars). ~200 tokens at 3.6 chars/token; test-plan-gates.mjs budgets the prompt with it. */
export const DIRECTION_SUMMARY_MAX_CHARS = 720;
/** Contact sheets the critic is shown at most (each is a labelled grid of up to 12 reference frames). */
export const CRITIC_MAX_SHEETS = 2;

const stemOf = (v) => basename(String(v)).replace(/\.[^.]+$/, "");
export const analysisDirFor = (video, root = ROOT) => join(root, "data", "reference", "analysis", stemOf(video));
const readJ = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };

/** The reference video paths a channel is directed by (repo-relative). */
export function referenceVideosFor(channelId, opts = {}) {
  const src = referenceSourceFor(channelId, opts);
  return src.shared ? { videos: SHARED_REFS, shared: true } : { videos: [src.video], shared: false };
}

const memo = new Map();
/**
 * Every committed analysis for the channel's reference(s).
 *   -> { refs: [{ video, stem, dir, doc, times }], missing: [{ video, why }], shared, why? }
 * `why` is set when no analysis was found at all. Memoised per (root, channel): the planner and its
 * retries read it once per process.
 */
export function loadChannelDirection(channelId, { root = ROOT, channels } = {}) {
  const key = `${root}|${channelId}`;
  if (!channels && memo.has(key)) return memo.get(key);
  const { videos, shared } = referenceVideosFor(channelId, { root, channels });
  const refs = [], missing = [];
  for (const video of videos) {
    const dir = analysisDirFor(video, root);
    const doc = readJ(join(dir, "direction.json"));
    if (!doc) { missing.push({ video, why: `no analysis at data/reference/analysis/${stemOf(video)}/direction.json (run scripts/reference/analyze-reference.mjs ${video})` }); continue; }
    const samples = readJ(join(dir, "samples.json"));
    const times = Object.fromEntries((samples?.frames || []).map((f) => [f.id, f.t]));
    refs.push({ video, stem: stemOf(video), dir, doc, times });
  }
  const out = { refs, missing, shared, ...(refs.length ? {} : { why: missing.map((m) => m.why).join("; ") || "no reference video for this channel" }) };
  if (!channels) memo.set(key, out);
  return out;
}

const r1 = (n) => (Number.isFinite(+n) ? String(Math.round(+n * 10) / 10) : "?");
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const usable = (o) => o && ["medium", "high"].includes(o.confidence) && Array.isArray(o.evidence) && o.evidence.some((e) => /^f\d{3,}$/.test(e));
const cite = (o, times) => o.evidence.filter((e) => /^f\d{3,}$/.test(e)).slice(0, 2).map((e) => (Number.isFinite(times[e]) ? `${e}@${r1(times[e])}s` : e)).join(",");

/** Pure. The measured pacing line for one analysis. */
export function pacingLine(ref) {
  const d = ref.doc, c = d.measured?.cadence || {}, cuts = d.measured?.cuts || [];
  const h = c.longest_hold || {};
  const status = d.direction?.status === "complete" ? "vision+measured" : `measured-only: ${clip(d.direction?.why || "no vision pass", 60)}`;
  return `${ref.stem} [${status}]: ${r1(d.measured?.metadata?.duration_s)}s; ${cuts.length} cuts (${cuts.slice(0, 6).map(r1).join(", ")}${cuts.length > 6 ? ", …" : ""}); ${r1(c.cuts_per_10s)} cuts/10s, ${r1(c.events_per_10s)} changes/10s; p90 gap ${r1(c.p90_gap_s)}s; longest hold ${r1(h.length_s)}s @${r1(h.start)}-${r1(h.end)}s.`;
}

/** Pure. Observation lines (typography, composition, transitions, pacing) for a completed analysis. */
export function observationLines(ref) {
  const d = ref.doc;
  if (d.direction?.status !== "complete") return [];
  const out = [];
  const pick = (label, arr, extra = () => "") => { const o = (arr || []).find(usable); if (o) out.push(` ${label}: ${clip(o.text, 110)}${extra(o)} [${cite(o, ref.times)}]`); };
  pick("typography", d.typography);
  pick("composition", d.composition);
  pick("transitions", d.transitions, (o) => (o.type ? ` (${clip(o.type, 20)} at ${(o.at_cuts || []).slice(0, 3).map(r1).join(", ")}s)` : ""));
  pick("pacing", d.pacing?.observations);
  return out;
}

/**
 * Pure. The planner's REFERENCE DIRECTION section, never longer than maxChars.
 *   -> { text, chars, truncated, lines, why? }   text "" (and why) when there is nothing measured to say
 * Lines go in priority order (every reference's measured pacing first, then observations); a line that
 * would cross the cap is dropped whole and `truncated` set, so nothing is cut mid-citation.
 */
export function directionSummary(loaded, { maxChars = DIRECTION_SUMMARY_MAX_CHARS } = {}) {
  if (!loaded?.refs?.length) return { text: "", chars: 0, truncated: false, lines: 0, why: loaded?.why || "no reference analysis" };
  const head = "REFERENCE DIRECTION (measured from this channel's reference; reference, not instruction; times are seconds in the reference):";
  const lines = [...loaded.refs.map(pacingLine), ...loaded.refs.flatMap(observationLines)];
  let text = head, kept = 0, truncated = false;
  for (const l of lines) {
    if (text.length + 1 + l.length + 2 > maxChars) { truncated = true; continue; }
    text += "\n" + l; kept++;
  }
  if (!kept) return { text: "", chars: 0, truncated: true, lines: 0, why: `no line fits ${maxChars} chars` };
  text += "\n\n";
  return { text, chars: text.length, truncated, lines: kept };
}

/**
 * The reference images the whole-video critic is shown.
 *   -> { files, source, why? }  contact sheets of the channel's analysed reference(s) (labelled grids of
 *      scene-sampled frames), else the planner's committed reference stills, else none with the reason.
 */
export function criticReferenceImages(channelId, { root = ROOT, channels, framesFor } = {}) {
  const loaded = loadChannelDirection(channelId, { root, channels });
  const sheets = [];
  for (const r of loaded.refs) {
    const list = existsSync(r.dir) ? readdirSync(r.dir).filter((f) => /^contact-\d+\.jpg$/.test(f)).sort() : [];
    for (const f of list) sheets.push({ file: join(r.dir, f), stem: r.stem });
  }
  if (sheets.length) {
    // Spread across references: the first sheet of each, then the next ones.
    const byRef = loaded.refs.map((r) => sheets.filter((s) => s.stem === r.stem));
    const order = [];
    for (let i = 0; order.length < sheets.length; i++) for (const l of byRef) if (l[i]) order.push(l[i]);
    const pick = order.slice(0, CRITIC_MAX_SHEETS);
    return { files: pick.map((s) => s.file), source: `contact sheets ${pick.map((s) => `${s.stem}/${basename(s.file)}`).join(", ")}`, kind: "contact-sheet" };
  }
  const frames = framesFor ? framesFor(channelId) : { files: [], why: "no frame lookup" };
  if (frames.files?.length) return { files: frames.files, source: `${frames.source} stills (no contact sheet: ${loaded.why || "analysis has none"})`, kind: "stills" };
  return { files: [], why: `no contact sheet (${loaded.why || "analysis has none"}) and no reference stills (${frames.why})` };
}
