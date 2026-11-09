/**
 * traceability.mjs: research -> claim -> sentence -> scene -> visual. Every material statement carries claim_ids;
 * every scene repeats exactly the words and the claims of its sentences; a picture or chart may not say more
 * than those claims establish (figures, units, labels, trend words, names).
 */
import { assertValid } from "./schema.mjs";
import { capitalised, contains, content, norm, numberWords, numbers, overlap, quantities, stem, wordCount } from "./text.mjs";

const f = (rule, severity, category, ids, problem, fix) => ({ rule, severity, category, sentence_ids: ids, problem, fix });
const STRONG = /\b(proves?|proved|confirm(?:s|ed)?|guarantee[sd]?|always|never|every|all|only|first|largest|biggest|record|best|worst|destroyed|sank|killed|banned|won|lost|entire|nobody|everyone)\b/gi;
const TREND = /\b(ris(?:e|es|ing)|rose|fall(?:s|ing)?|fell|grow(?:s|th|ing)?|grew|surge[sd]?|surging|drop(?:s|ped|ping)?|declin\w+|increas\w+|decreas\w+|doubl\w+|soar\w*|plung\w+|jump\w*|climb\w*|shrink\w*|shrank)\b/i;
const COMPARE = /\b(vs\.?|versus|than|outperform\w*|beats?|compared|against)\b/i;

export const UNIT_ALIASES = { "%": "%", percent: "%", pct: "%", "per cent": "%", usd: "usd", "$": "usd", dollar: "usd", dollars: "usd", "us dollars": "usd", hour: "hour", hours: "hour", minute: "minute", minutes: "minute", second: "second", seconds: "second", day: "day", days: "day", year: "year", years: "year", month: "month", months: "month", goal: "goal", goals: "goal", shot: "shot", shots: "shot", pass: "pass", passes: "pass" };
export const unitOf = (u) => { const k = norm(u).toLowerCase(); return UNIT_ALIASES[k] ?? UNIT_ALIASES[k.replace(/s$/, "")] ?? k; };

/** Proper names in short on-screen labels, where a name can stand first ("Canada: 12%"). */
const LABEL_WORDS = new Set(["The", "A", "An", "And", "Of", "In", "On", "To", "Vs", "Combined", "Total", "Rate", "Share", "Source", "Asked", "Back", "Workers", "Percent", "Survey", "Chart"]);
export function labelNames(text) {
  const out = new Set();
  for (const seg of String(text).split(/[.:;|\n]/)) {
    const s = norm(seg);
    // The first word of a label is capitalised like any sentence start, so it counts as a name only when it stands
    // alone ("Canada: 12%") or is followed by another capitalised word ("New Zealand") or is an acronym.
    for (const m of s.matchAll(/\b([A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*)*)/g)) {
      const name = m[1].replace(/\.$/, "");
      const atStart = m.index === 0;
      const standalone = atStart && name === s.replace(/\.$/, "");
      const multi = /\s/.test(name);
      if (/^[A-Z]{2,}$/.test(name) || ((!atStart || standalone || multi) && !LABEL_WORDS.has(name) && !/^\d/.test(name) && name.length > 1)) out.add(name);
    }
  }
  return [...out];
}

const claimMap = (claims) => new Map(claims.map((c) => [c.claim_id, c]));
const evidenceText = (cs) => cs.map((c) => `${c.claim} ${c.excerpt} ${c.context || ""}`).join(" ");

export function scriptTraceability(pkg, claims) {
  const out = [];
  const byId = claimMap(claims);
  const pkgIds = new Set((pkg.claims || []).map((c) => c.claim_id));
  const srcUrls = new Set((pkg.sources || []).map((s) => s.url));
  const earlier = [];
  for (const s of pkg.sentences) {
    const cs = s.claim_ids.map((id) => byId.get(id));
    s.claim_ids.forEach((id, i) => {
      if (!cs[i]) out.push(f("TRC-01", "critical", "unsupported_claim", [s.sentence_id], `claim ${id} does not exist`, "Cite a real claim."));
      else if (!pkgIds.has(id)) out.push(f("TRC-02", "major", "unsupported_claim", [s.sentence_id], `claim ${id} is missing from the package's claims`, "Include every claim the script uses."));
      else if (!srcUrls.has(cs[i].source_url)) out.push(f("TRC-02", "major", "unsupported_claim", [s.sentence_id], `claim ${id}'s source URL is not in the package's sources`, "List the source."));
    });
    const real = cs.filter(Boolean);
    const ev = evidenceText(real);
    const evNums = new Set([...numbers(ev), ...numberWords(ev)]);
    const priorText = earlier.join(" ");
    if (real.length) {
      for (const n of numbers(s.text)) if (!evNums.has(n) && !numbers(priorText).includes(n)) out.push(f("TRC-03", "critical", "unsupported_claim", [s.sentence_id], `The figure ${n} is in none of this sentence's claims.`, "Use the figure the claim states."));
      for (const name of capitalised(s.text)) {
        const bare = name.replace(/'s$/, "");
        if (!contains(ev, bare) && !contains(priorText, bare) && !contains(pkg.blueprint.central_question, bare) && !contains(pkg.topic, bare)) out.push(f("TRC-04", "major", "unsupported_claim", [s.sentence_id], `The name "${name}" is in none of this sentence's claims.`, "Remove it or cite a claim that names it."));
      }
      const claimed = new Set((ev.match(STRONG) || []).map((x) => x.toLowerCase()));
      for (const w of s.text.match(STRONG) || []) if (!claimed.has(w.toLowerCase())) out.push(f("TRC-06", "major", "misleading_claim", [s.sentence_id], `"${w}" is stronger than the claims behind this sentence.`, "Use the claim's own strength."));
    }
    for (const q of s.text.match(/"([^"]{12,})"/g) || []) {
      const inner = q.slice(1, -1);
      if (!real.some((c) => contains(c.excerpt, inner))) out.push(f("TRC-05", "critical", "unsupported_claim", [s.sentence_id], `The quotation "${inner.slice(0, 50)}" is not verbatim in a cited excerpt.`, "Quote the excerpt exactly or paraphrase."));
    }
    earlier.push(s.text);
  }
  return out;
}

/** Scene seeds for the channel agents: the exact narration, the claims it rests on, and timings from the voice. */
export function sceneSeeds(pkg, wpm, { channel, production_run, groupSize = 1 }) {
  const seeds = [];
  let t = 0;
  for (let i = 0; i < pkg.sentences.length; i += groupSize) {
    const group = pkg.sentences.slice(i, i + groupSize);
    const narration = group.map((s) => s.text).join(" ");
    const dur = Math.round((wordCount(narration) / wpm.wpm) * 60 * 10) / 10;
    const claimIds = [...new Set(group.flatMap((s) => s.claim_ids))];
    seeds.push({
      scene_id: `scene-${seeds.length + 1}`, narration, main_point: group[0].role, claim_ids: claimIds,
      data_sources: [...new Set(claimIds.map((id) => pkg.claims.find((c) => c.claim_id === id)?.source_url).filter(Boolean))],
      on_screen_text: group.map((s) => s.on_screen_text).filter(Boolean), start_s: Math.round(t * 10) / 10, end_s: Math.round((t + dur) * 10) / 10,
    });
    t += dur;
  }
  return { channel, production_run, seeds };
}

/** plan: scene-plan.schema.json (+ optional scene.chart). Returns findings; empty = the scenes agree with the script. */
export function sceneTraceability(plan, pkg, claims) {
  const out = [];
  const schema = (() => { try { assertValid("scene-plan", plan); return null; } catch (e) { return e.message; } })();
  if (schema) out.push(f("SCN-00", "critical", "visual_mismatch", [], `scene plan does not satisfy the contract: ${schema.split("\n").slice(1, 3).join("; ")}`, "Fix the plan."));
  const byId = claimMap(claims);
  const used = new Array(pkg.sentences.length).fill(false);
  let cursor = 0;
  for (const sc of plan.scenes || []) {
    const sid = [sc.scene_id];
    // narration = a contiguous run of script sentences, verbatim.
    let end = cursor, acc = "";
    const target = norm(sc.narration);
    while (end < pkg.sentences.length && norm(acc).length < target.length) { acc = `${acc} ${pkg.sentences[end].text}`.trim(); end++; }
    const run = pkg.sentences.slice(cursor, end);
    if (norm(acc) !== target) {
      out.push(f("SCN-01", "critical", "visual_mismatch", sid, `Scene ${sc.scene_id} narration is not the script's next words ("${target.slice(0, 60)}...").`, "Scene narration must be the script's sentences, unchanged and in order."));
      continue;
    }
    run.forEach((_, k) => (used[cursor + k] = true));
    cursor = end;
    const want = new Set(run.flatMap((s) => s.claim_ids)), have = new Set(sc.claim_ids || []);
    for (const id of have) if (!byId.has(id)) out.push(f("SCN-02", "critical", "unsupported_claim", sid, `Scene ${sc.scene_id} cites unknown claim ${id}.`, "Cite a real claim."));
    for (const id of have) if (byId.has(id) && !want.has(id)) out.push(f("SCN-02", "major", "visual_mismatch", sid, `Scene ${sc.scene_id} cites ${id}, which none of its sentences rests on.`, "A scene may show only what its narration says."));
    for (const id of want) if (!have.has(id)) out.push(f("SCN-02", "major", "unsupported_claim", sid, `Scene ${sc.scene_id} drops claim ${id} that its narration rests on.`, "Pass every claim the narration uses."));
    const sceneClaims = [...have].map((id) => byId.get(id)).filter(Boolean);
    const ev = evidenceText(sceneClaims);
    for (const u of sc.data_sources || []) if (!sceneClaims.some((c) => c.source_url === u)) out.push(f("SCN-03", "major", "unsupported_claim", sid, `data source ${u} is not a source of this scene's claims`, "List only sources of the scene's claims."));

    // What the picture says, against what the claims establish.
    const seen = `${sc.narration} ${ev}`;
    const shown = [...(sc.on_screen_text || []), sc.visual_objective || "", sc.animation || ""].join(" . ");
    const seenQ = quantities(seen);
    for (const q of quantities((sc.on_screen_text || []).join(" . "))) {
      const match = seenQ.filter((x) => x.value === q.value);
      if (!match.length) out.push(f("SCN-04", "critical", "visual_mismatch", sid, `On-screen "${q.text}": the figure ${q.value} is in neither the narration nor the claims.`, "Show only established figures."));
      else if (q.unit && !match.some((x) => unitOf(x.unit) === unitOf(q.unit))) out.push(f("SCN-04", "critical", "visual_mismatch", sid, `On-screen "${q.text}" has unit "${q.unit}"; the claims give ${match.map((x) => x.unit || "no unit").join("/")} for ${q.value}.`, "Use the unit the claim uses."));
    }
    for (const name of labelNames((sc.on_screen_text || []).join(" . "))) if (!contains(seen, name.replace(/'s$/, ""))) out.push(f("SCN-04", "major", "visual_mismatch", sid, `On-screen name "${name}" is in neither the narration nor the claims.`, "Show only names the narration establishes."));
    if (TREND.test(shown) && !TREND.test(seen)) out.push(f("SCN-04", "major", "visual_mismatch", sid, "The visual implies a trend (rising, falling, growth) that neither narration nor claims state.", "Do not animate a trend the claims do not establish."));
    if (COMPARE.test(shown) && !COMPARE.test(seen) && sceneClaims.length < 2) out.push(f("SCN-04", "major", "visual_mismatch", sid, "The visual compares things the claims do not compare.", "Show one thing, or cite both sides."));

    if (sc.chart) {
      const chart = sc.chart, unit = unitOf(chart.unit || "");
      if (!unit) out.push(f("SCN-05", "major", "visual_mismatch", sid, "Chart has no unit.", "State one unit."));
      if (chart.type === "bar" && chart.axis_min != null && chart.axis_min !== 0) out.push(f("SCN-05", "major", "visual_mismatch", sid, `Bar chart axis starts at ${chart.axis_min}, not zero.`, "Start bar axes at zero."));
      for (const d of chart.series || []) {
        const holders = sceneClaims.filter((c) => quantities(`${c.claim} ${c.excerpt}`).some((q) => Number(q.value) === Number(d.value)));
        if (!holders.length) { out.push(f("SCN-05", "critical", "visual_mismatch", sid, `Chart value ${d.value} (${d.label}) is in none of the scene's claims.`, "Plot only claimed values.")); continue; }
        if (!holders.some((c) => quantities(`${c.claim} ${c.excerpt}`).some((q) => Number(q.value) === Number(d.value) && unitOf(q.unit) === unit))) out.push(f("SCN-05", "critical", "visual_mismatch", sid, `Chart plots ${d.value} as "${chart.unit}" but the claim gives it as ${holders.flatMap((c) => quantities(c.claim).filter((q) => Number(q.value) === Number(d.value)).map((q) => q.unit || "no unit")).join("/")}.`, "Use the claim's unit."));
        if (!holders.some((c) => overlap(`${c.claim}`, d.label).shared >= Math.max(1, Math.ceil(content(d.label).length / 2)))) out.push(f("SCN-05", "critical", "visual_mismatch", sid, `Chart label "${d.label}" does not match what the claim holding ${d.value} is about.`, "Label each value with what the claim says it measures."));
      }
    }
  }
  used.forEach((u, i) => { if (!u) out.push(f("SCN-01", "critical", "visual_mismatch", [pkg.sentences[i].sentence_id], `Sentence ${pkg.sentences[i].sentence_id} is in no scene.`, "Every sentence belongs to a scene.")); });
  return out;
}

