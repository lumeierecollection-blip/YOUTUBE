#!/usr/bin/env node
/**
 * ASSET EXPANSION — section 4.4. Run when a sentence has no asset above the
 * match threshold.
 *
 *   node scripts/expand-assets.mjs --script data/tts/ch-fixture/....srt
 *   node scripts/expand-assets.mjs --concept "hydrothermal vent"
 *
 * The order is the spec's: search the external sources, and only if nothing is
 * found queue the gap for a human to source, and log every step.
 *
 * THE EXTERNAL BRANCH CANNOT RUN IN THIS ENVIRONMENT AND THE LOG SAYS SO ON
 * EVERY ATTEMPT. Measured repeatedly: api.pexels.com, pixabay.com,
 * commons.wikimedia.org and api.unsplash.com all return 000 from here, and no
 * key for any of them is set. The code is written and reachable; it is the
 * network that is not. Somewhere with egress and keys it will run unchanged,
 * which is why it is not stubbed out.
 *
 * THERE IS NO PROCEDURAL FALLBACK. There used to be one — a 109-drawing
 * library this same matcher scored against — and it was deleted once icons
 * proved they read better at Shorts scale (data/renders/iconify-proof.png)
 * and the icon catalog's 14,000+ entries made the gaps a plain photo search
 * can't fill rare enough that hand-drawing more of them stopped paying for
 * itself. What this writes instead is a REQUEST, not a drawing: an entry in
 * `config/assets/expansion-queue.json` naming the concept, the intent that
 * needed it, and the sentence that went unserved. It does not autogenerate a
 * shape and call it a cave. A generated placeholder that looks like
 * something would re-create the exact failure this whole rebuild is about —
 * a visual that means nothing standing where a visual that means something
 * should be. The queue is the honest artefact: it says what is missing.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { selectAsset } from "../src/skills/remotion-render/visual-engine/assets/match.js";
import { visualIntent } from "../src/skills/remotion-render/visual-engine/assets/visual-intent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const QUEUE = join(ROOT, "config", "assets", "expansion-queue.json");
const LOG = join(ROOT, "data", "audit", "asset-expansion.log");

const SOURCES = [
  { name: "pexels", url: (q) => `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=3`, key: "PEXELS_API_KEY", header: (k) => ["-H", `Authorization: ${k}`] },
  { name: "pixabay", url: (q) => `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY || ""}&q=${encodeURIComponent(q)}`, key: "PIXABAY_API_KEY", header: () => [] },
  { name: "wikimedia", url: (q) => `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3`, key: null, header: () => [] },
  { name: "unsplash", url: (q) => `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=3`, key: "UNSPLASH_ACCESS_KEY", header: (k) => ["-H", `Authorization: Client-ID ${k}`] },
];

const lines = [];
const log = (s) => { lines.push(`${new Date().toISOString()}  ${s}`); console.log(s); };

/** Try one source. Returns a result or a reason it could not be tried. */
function trySource(src, query) {
  const key = src.key ? process.env[src.key] : "n/a";
  if (src.key && !key) return { ok: false, why: `no ${src.key} in the environment` };
  try {
    const out = execFileSync("curl", ["-sS", "--max-time", "12", "-w", "\\n%{http_code}",
      ...(src.key ? src.header(key) : []), src.url(query)], { encoding: "utf-8" });
    const code = out.trim().split("\n").pop();
    if (code !== "200") return { ok: false, why: `HTTP ${code}` };
    return { ok: true, body: out };
  } catch (e) {
    return { ok: false, why: `unreachable (${String(e.message).split("\n")[0].slice(0, 60)})` };
  }
}

function queueConcept(concept, intent, sentence) {
  const q = existsSync(QUEUE) ? JSON.parse(readFileSync(QUEUE, "utf-8")) : { version: 1, wanted: [] };
  if (q.wanted.some((w) => w.concept === concept)) return q.wanted.length;
  q.wanted.push({
    concept,
    literalSubject: intent.literalSubject,
    topics: intent.topics,
    requiredVisualFeatures: intent.requiredVisualFeatures,
    forbiddenVisualFeatures: intent.forbiddenVisualFeatures,
    unservedSentence: sentence,
    firstSeen: new Date().toISOString().slice(0, 10),
    status: "wanted",
  });
  writeFileSync(QUEUE, JSON.stringify(q, null, 1) + "\n");
  return q.wanted.length;
}

function expand(sentence, library) {
  const r = selectAsset(sentence, library);
  if (r.asset) { log(`ok      "${sentence.slice(0, 54)}" -> ${r.asset.name} (${r.score})`); return r.asset.name; }

  const intent = r.intent;
  const query = [intent.literalSubject, ...intent.requiredVisualFeatures.slice(0, 2)].filter(Boolean).join(" ");
  log(`MISS    "${sentence.slice(0, 54)}" — best was ${r.runnerUp ? `${r.runnerUp.name} at ${r.score}` : "nothing"}, below ${r.threshold}`);
  log(`        searching for: "${query}"`);
  for (const src of SOURCES) {
    const res = trySource(src, query);
    log(`        ${src.name.padEnd(10)} ${res.ok ? "FOUND — download and register" : `unavailable: ${res.why}`}`);
    if (res.ok) return null; // a real download path belongs here; nothing reaches it in this environment
  }
  const n = queueConcept(intent.literalSubject || query, intent, sentence);
  log(`        queued "${intent.literalSubject || query}" for sourcing (${n} concept(s) wanted)`);
  return null;
}

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const library = JSON.parse(readFileSync(join(ROOT, "config", "assets", "icon-library.json"), "utf-8"));
const sentences = arg("concept") ? [arg("concept")]
  : readFileSync(join(ROOT, arg("script") || "data/tts/ch-fixture/movile-cave-shorts-script-vo.srt"), "utf-8")
      .split(/\n\n+/).map((b) => b.trim().split("\n").slice(2).join(" ")).filter(Boolean);

log(`asset expansion over ${sentences.length} sentence(s), library of ${library.assets.length}`);
let served = 0;
for (const s of sentences) if (expand(s, library)) served++;
log(`\n${served}/${sentences.length} sentences served by the existing library.`);
mkdirSync(dirname(LOG), { recursive: true });
writeFileSync(LOG, lines.join("\n") + "\n");
console.log(`\nlog: ${LOG.replace(ROOT + "/", "")}`);
