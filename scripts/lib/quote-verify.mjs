/**
 * quote-verify — a quotation is shown on screen only if its words are in the raw search results, character for character.
 *
 * Why: the owner wants the highlighted line to be a quoted statement from a site or a person (ref-03, the Zalando video). The research model reports
 * quotes[] with the result it took each from, but a small model paraphrases and invents. CLAUDE.md: no claim that did not come from a fetched source. So the
 * model's quote is compared with the RAW search text (saved by scripts/ollama-agent.js --search-out, nothing model-written in it) after a light normalisation
 * (case, curly vs straight quotes, dashes, whitespace). Not found => dropped. This proves the words appear in a search result; it does NOT prove the named
 * speaker said them (a result could quote someone else): the speaker is the model's attribution, so a quote is also kept only if the speaker's surname or the
 * source name appears in the raw text within 400 characters of the quote.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

export function norm(t) {
  return String(t || "")
    .replace(/[‘’‛]/g, "'").replace(/[“”„]/g, '"')
    .replace(/[‐-―−]/g, "-").replace(/…/g, "...")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

const stripEdgeQuotes = (t) => norm(t).replace(/^["']+|["']+$/g, "").trim();
const words = (t) => stripEdgeQuotes(t).split(" ").filter(Boolean);

/** @returns the quotes that survive: [{text, speaker, source_name, source_url}] */
export function verifyQuotes(quotes, corpus) {
  const hay = norm(corpus);
  const out = [];
  for (const q of Array.isArray(quotes) ? quotes : []) {
    if (!q || typeof q.text !== "string" || !q.speaker) continue;
    const n = words(q.text).length;
    if (n < 6 || n > 40) continue;
    const needle = stripEdgeQuotes(q.text);
    if (needle.includes("...")) continue;
    const at = hay.indexOf(needle);
    if (at < 0) continue;
    const near = hay.slice(Math.max(0, at - 400), at + needle.length + 400);
    const sur = norm(q.speaker).split(" ").filter((w) => w.length >= 3).pop();
    const src = norm(q.source_name);
    if (!((sur && near.includes(sur)) || (src && near.includes(src)))) continue;
    out.push({ text: String(q.text).trim().replace(/^["“]+|["”]+$/g, ""), speaker: String(q.speaker).trim(), source_name: String(q.source_name || "").trim(), source_url: String(q.source_url || "").trim() });
  }
  return out;
}

/** The verified quotes of the research behind a script file, or [] when there is none (older artifacts, no search text saved). */
export function verifiedQuotesFor(scriptPath, root) {
  try {
    const full = existsSync(scriptPath) ? scriptPath : join(root, ...String(scriptPath).split(String.fromCharCode(92)).join("/").split("/"));
    const dir = join(full, "..");
    let slug = basename(full).replace(/-script\.json$/, "").replace(/\.json$/, "");
    for (let i = 0; i < 4; i++) {
      const rf = join(dir, `${slug}.json`), sf = join(dir, `${slug}-search.json`);
      if (existsSync(rf) && existsSync(sf)) {
        const research = JSON.parse(readFileSync(rf, "utf8"));
        const search = JSON.parse(readFileSync(sf, "utf8"));
        const corpus = (search.searches || []).map((s) => s.text).join("\n");
        return verifyQuotes(research.quotes, corpus);
      }
      const shorter = slug.replace(/-[^-]+$/, "");
      if (shorter === slug) break;
      slug = shorter;
    }
  } catch { /* no quotes is the safe answer */ }
  return [];
}
