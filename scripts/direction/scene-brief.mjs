// Semantic scene briefs: one per beat. PURE (no fs, no network, no clock). Schema: schemas/scene-brief.json.
// Hard rules: narration and evidence come only from the script / research; a reference observation is used only at
// confidence >= medium with valid frame ids (schemas/creative-direction.json); colour is never set here.
import { createHash } from "node:crypto";

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9%$ ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => norm(s).split(" ").filter(Boolean);
const figures = (s) => new Set((String(s ?? "").replace(/(\d),(\d)/g, "$1$2").match(/\d{2,}(?:\.\d+)?/g) || []));
const FRAME = /^f[0-9]{3,}$/;

export const hash6 = (narration) => createHash("sha1").update(norm(narration)).digest("hex").slice(0, 6);

// An observation is usable only if it cites real frame ids and is at least medium confidence. Never invent one.
export function usableObs(o) {
  return !!o && typeof o === "object" && ["medium", "high"].includes(o.confidence)
    && Array.isArray(o.evidence) && o.evidence.length > 0 && o.evidence.every((f) => FRAME.test(String(f)));
}

const PURPOSE_BY_SECTION = [
  [/^(rehook|re_hook|escalat|build|stakes|tension)/, "escalation"],
  [/^(hook|intro|cold)/, "hook"],
  [/^(setup|context|background)/, "setup"],
  [/^(turn|twist|reveal|pivot)/, "turn"],
  [/^(evidence|proof|data|fact)/, "evidence"],
  [/^(payoff|resolution|answer|close|ending|outro)/, "payoff"],
  [/^(cta|follow|subscribe)/, "cta"],
];
const CTA_RE = /\b(follow|subscribe|comment|share)\b/i;

export function sectionFor(script, narration, i, n) {
  const secs = Array.isArray(script?.sections) ? script.sections : [];
  const q = norm(narration);
  if (q) {
    const hit = secs.find((s) => norm(s.voiceover).includes(q));
    if (hit) return hit.id ?? null;
  }
  return null;
}

function purposeOf(section, narration, i, n, matched) {
  let p = null;
  for (const [re, v] of PURPOSE_BY_SECTION) if (section && re.test(String(section).toLowerCase())) { p = v; break; }
  if (!p) p = i === 0 ? "hook" : i === n - 1 ? "payoff" : i < n / 3 ? "setup" : "escalation";
  if (p === "payoff" && CTA_RE.test(narration)) p = "cta";
  if ((p === "setup" || p === "escalation") && matched.some((m) => m.figure)) p = "evidence";
  return p;
}

// Deterministic match of research facts/numbers to a sentence: shared figures (>= 2 digits) or shared named entities.
export function matchEvidence(research, narration) {
  const out = [];
  const sFig = figures(narration), q = norm(narration);
  const facts = research?.key_facts || [];
  // An entity named in most facts (the topic itself, the city) identifies no fact in particular: it does not match on its own.
  const ents = (research?.named_entities || []).map((e) => e?.name).filter(Boolean)
    .filter((e) => facts.length < 3 || facts.filter((f) => norm(f.fact).includes(norm(e))).length <= facts.length / 2);
  (research?.key_facts || []).forEach((f, i) => {
    const fFig = figures(f.fact);
    const figHit = [...sFig].filter((x) => fFig.has(x)).length;
    const entHit = ents.filter((e) => q.includes(norm(e)) && norm(f.fact).includes(norm(e))).length;
    const score = figHit * 3 + entHit;
    if (score > 0) out.push({ fact: f.fact, source_url: f.source_url, ref: `research:${i}`, score, figure: figHit > 0 });
  });
  (research?.numbers || []).forEach((nm, j) => {
    if (sFig.has(String(nm.value).replace(/(\d),(\d)/g, "$1$2")) && String(nm.value).length >= 2) {
      out.push({ fact: `${nm.label}: ${nm.value}${nm.unit ? ` ${nm.unit}` : ""}`, source_url: nm.source_url, ref: `research:num${j}`, score: 3, figure: true });
    }
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

function assetRequirements(planBeat, canvas) {
  const out = [];
  const vt = String(canvas?.visual_type || planBeat?.visual_type || "").toUpperCase();
  const ents = Array.isArray(planBeat?.named_entities) ? planBeat.named_entities : [];
  for (const e of ents) {
    if (!e?.name) continue;
    if (e.type === "person" || e.type === "place" || e.type === "building") out.push({ kind: "photo", entity: e.name, must_be_verified: true });
    else if (e.type === "company" || e.type === "institution") out.push({ kind: "logo", entity: e.name, must_be_verified: false });
  }
  if (canvas?.photo && !out.some((r) => r.kind === "photo")) out.push({ kind: "photo", ...(canvas.photo.entity ? { entity: canvas.photo.entity } : {}), must_be_verified: true });
  if (vt === "MAP") out.push({ kind: "map", must_be_verified: false });
  else if (["COUNTER", "BAR", "PIE", "LINE", "GAUGE", "TREND", "COMPARE", "TIMELINE"].includes(vt)) out.push({ kind: "chart", must_be_verified: false });
  else if (vt === "DOCUMENT") out.push({ kind: "document", must_be_verified: false });
  return out.length ? out : [{ kind: "none", must_be_verified: false }];
}

const heroOf = (canvas) => canvas?.photo?.asset || (canvas?.concept_visuals || []).find((v) => v?.asset)?.asset || null;

function windowWords(wt, start, end) {
  if (!Array.isArray(wt) || start == null || end == null) return null;
  const w = wt.map((x) => ({ w: String(x.w ?? x.word ?? x.text ?? ""), t: Number(x.t ?? x.start) })).filter((x) => x.w && Number.isFinite(x.t));
  const inWin = w.filter((x) => x.t >= start - 0.05 && x.t < end);
  return inWin.length ? inWin : null;
}

function transitionFor({ i, n, refUse, refName, profile, grammar }) {
  const first = i === 0, last = i === n - 1;
  const t = refUse.transitions[0];
  if (t) {
    const label = t.type || t.text;
    return {
      t: { in: first ? "start" : label, out: last ? "end" : label, rationale: `Reference ${refName}: "${t.text}" (${t.confidence}, frames ${t.evidence.join(", ")}).` },
      just: { choice: "transition", because: `reference transition "${t.text}" applied to this scene's boundaries`, evidence: t.evidence.map((f) => `ref:${refName}#${f}`) },
    };
  }
  if (profile && grammar?.profiles?.[profile]) {
    return {
      t: { in: first ? "start" : "cut", out: last ? "end" : "cut", rationale: `No usable reference direction; clone profile "${profile}" cuts between shots at the measured cadence (grammar laws.cuts_per_10s).` },
      just: { choice: "transition", because: `clone profile ${profile} is built from hard-cut reference videos; no reference observation was available`, evidence: ["grammar:cuts_per_10s"] },
    };
  }
  return { t: { in: null, out: null, rationale: "No reference direction and no clone profile for this channel: transition intent not specified." }, just: null };
}

export function buildSceneBriefs({ script, research, plan, manifest, channel, grammar, referenceDirection, wordTimings } = {}) {
  const mBeats = Array.isArray(manifest?.beats) ? manifest.beats : [];
  const pBeats = Array.isArray(plan?.beats) ? plan.beats : [];
  const n = mBeats.length || pBeats.length;
  const fps = manifest?.fps || 30;
  const stem = String(manifest?.video || `${script?.topic_slug || "video"}-${script?.format || "shorts"}`).replace(/\.mp4$/, "");
  const profile = channel?.clone?.profile || null;
  const laws = grammar?.laws || {};
  const refName = referenceDirection?.source?.file ? String(referenceDirection.source.file).replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "") : null;
  const complete = referenceDirection && referenceDirection.direction?.status !== "measured-only";
  const refUse = {
    composition: complete ? [...(referenceDirection.composition || []), ...(referenceDirection.typography || [])].filter(usableObs) : [],
    transitions: complete ? (referenceDirection.transitions || []).filter(usableObs) : [],
    sounds: complete ? (referenceDirection.sound_cues || []).filter((c) => usableObs(c) && Number.isFinite(c.t)) : [],
  };
  // Where the reference direction stops, say so on every brief (never filled in): none, or measured-only
  // (numbers but no observation a scene could cite).
  const refFlag = !referenceDirection ? "no-reference-direction" : !complete ? "reference-direction-measured-only" : null;
  const sourcesUsed = Array.isArray(script?.sources_used) ? new Set(script.sources_used) : null;
  const briefs = [];
  for (let i = 0; i < n; i++) {
    const mb = mBeats[i] || {};
    const pb = pBeats.find((b) => b.index === i) || pBeats[i] || {};
    const canvas = mb.canvas || null;
    const narration = String(canvas?.sentence || pb.narration || pb.sentence || "").trim();
    const flags = [];
    if (!narration) flags.push("no-narration-in-manifest-or-plan");
    const section = sectionFor(script, narration, i, n);
    if (narration && !section) flags.push("narration-not-found-in-script-sections");
    const matched = narration ? matchEvidence(research, narration) : [];
    const purpose = purposeOf(section, narration, i, n, matched);
    const source_evidence = matched.map(({ fact, source_url, ref }) => ({ fact, source_url, ref }));
    if (!source_evidence.length) flags.push("no-research-evidence-for-sentence");
    // SCR-14: a script's claims trace to sources_used. Evidence matched from research whose URL the script
    // did not list is reported, not dropped (the research fact is real; the script's citation is missing).
    if (sourcesUsed && source_evidence.some((e) => !sourcesUsed.has(e.source_url))) flags.push("evidence-url-not-in-sources_used");
    if (refFlag) flags.push(refFlag);
    const start = Number.isFinite(mb.start_sec) ? mb.start_sec : null;
    const end = start != null && Number.isFinite(mb.duration_sec) ? +(start + mb.duration_sec).toFixed(2) : null;
    const ww = windowWords(wordTimings, start, end);
    const hero = heroOf(canvas);
    const reqs = assetRequirements(pb, canvas);
    const display = words(mb.narrative_text?.join(" ") || pb.headline || pb.visual_headline || canvas?.headline || "");
    const emph = [...new Set([...(canvas?.emphasis_words || []), ...(pb.emphasis_words || []), pb.emphasis_word].filter(Boolean))];
    const emphasis_words = emph.map((w) => ({ w, t: ww ? (ww.find((x) => norm(x.w) === norm(w))?.t ?? null) : null }));
    const tr = transitionFor({ i, n, refUse, refName, profile, grammar });

    const sound_cues = (manifest?.sfx || []).filter((e) => e.beat === i && Number.isFinite(e.at_frame)).map((e) => ({
      t: +(e.at_frame / fps).toFixed(2), kind: String(e.role || "sfx"), rationale: `Rendered cue (manifest.sfx): ${e.reason || e.file || "no reason recorded"}`,
    }));
    let soundJust = null;
    if (!sound_cues.length && refUse.sounds.length && start != null && (hero || i > 0)) {
      const c = refUse.sounds[i % refUse.sounds.length];
      sound_cues.push({ t: start, kind: c.text, rationale: `Reference ${refName} uses this cue (${c.confidence}, frames ${c.evidence.join(", ")}); placed at the scene cut.` });
      soundJust = { choice: "sound_cue", because: `reference cue "${c.text}" at the scene boundary`, evidence: c.evidence.map((f) => `ref:${refName}#${f}`) };
    } else if (!sound_cues.length) {
      sound_cues.push({ t: null, kind: "none", rationale: "No rendered cue and no usable reference sound observation: no sound intent specified." });
    }

    const justification = [{ choice: `purpose:${purpose}`, because: `section "${section ?? "unknown"}" and the sentence role${matched.some((m) => m.figure) ? " (states a researched figure)" : ""}`, evidence: ["narration", ...matched.map((m) => m.ref)] }];
    if (reqs[0].kind !== "none") justification.push({ choice: `assets:${reqs.map((r) => r.kind).join("+")}`, because: "the sentence names these things; people and places need a verified real photo", evidence: ["narration"] });
    const vtype = canvas?.visual_type || mb.visual_type || pb.visual_type || null;
    const layout = canvas?.composition || pb.canvas_composition || null;
    if (vtype || layout) {
      const states = matched.some((m) => m.figure) ? "states a researched figure" : reqs[0].kind !== "none" ? `names ${reqs.map((r) => r.entity || r.kind).join(", ")}` : "states no figure or named thing";
      const co = refUse.composition[i % Math.max(1, refUse.composition.length)];
      justification.push(co
        ? { choice: `composition:${[vtype, layout].filter(Boolean).join("/")}`, because: `the sentence ${states}; reference ${refName}: "${String(co.text).slice(0, 100)}" (${co.confidence})`, evidence: ["narration", ...co.evidence.map((f) => `ref:${refName}#${f}`)] }
        : { choice: `composition:${[vtype, layout].filter(Boolean).join("/")}`, because: `the sentence ${states}; no usable reference composition observation`, evidence: ["narration", ...matched.map((m) => m.ref)] });
    }
    if (tr.just) justification.push(tr.just);
    if (soundJust) justification.push(soundJust);
    if (laws.gap_max_s != null) justification.push({ choice: `max_hold:${laws.gap_max_s}s`, because: "measured reference law: no wait is longer", evidence: ["grammar:gap_max_s"] });

    const sid = `${stem}-s${i}-${hash6(narration)}`;
    const crit = [];
    const add = (check, expect, objective, params) => crit.push({ id: `${sid}:c${crit.length + 1}`, check, expect, objective, ...(params ? { params } : {}) });
    if (reqs[0].kind !== "none") {
      add("hero_visible_by", "hero asset resolved in the manifest beat and visible by t+0.47s", true, { by_s: 0.47 });
      add("asset_file_exists", "the hero asset file exists on disk", true);
    }
    if (reqs.some((r) => r.kind === "photo" && r.must_be_verified)) add("entity_photo_verified", "photo carries verified_as provenance", true);
    add("display_words_subset", "on-screen words are a subset of the narration words", true);
    if (laws.gap_max_s != null) add("max_hold", `beat length <= ${laws.gap_max_s}s`, true, { max_s: laws.gap_max_s });
    add("scene_serves_purpose", `the frame visibly serves the "${purpose}" role of: ${narration.slice(0, 90)}`, false);
    add("transition_reads", "the cut into and out of this scene reads as intended (see transition.rationale)", false);

    briefs.push({
      scene_id: sid, beat_index: i, section, narrative_purpose: purpose, narration,
      source_evidence, evidence_status: source_evidence.length ? "matched" : "none",
      asset_requirements: reqs,
      timing: { start, end, ...(ww ? { words: ww.map(({ w, t }) => ({ w, t })) } : {}) },
      composition: { engine: manifest?.engine || null, layout: canvas?.composition || pb.canvas_composition || null, visual_type: canvas?.visual_type || mb.visual_type || pb.visual_type || null, hero_asset: hero },
      text: { display_words: display, emphasis_words },
      animation: { entrance: pb.text_entrance || canvas?.text_entrance || null, camera: canvas?.camera?.move || (mb.camera || [])[0] || pb.camera || null },
      transition: tr.t, sound_cues, justification, acceptance_criteria: crit, flags,
    });
  }
  return briefs;
}

export function briefsToMarkdown(briefs, stem = "") {
  const c = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 140);
  const L = [`# Scene briefs: ${stem}`, "", "| scene | purpose | time | composition | transition | sfx | criteria | justification |", "|---|---|---|---|---|---|---|---|"];
  for (const b of briefs) {
    const t = b.timing.start == null ? "-" : `${b.timing.start}-${b.timing.end}s`;
    L.push(`| ${c(b.scene_id)} | ${b.narrative_purpose} | ${t} | ${c([b.composition.engine, b.composition.layout, b.composition.hero_asset].filter(Boolean).join(" / "))} | ${c(`${b.transition.in}->${b.transition.out}: ${b.transition.rationale}`)} | ${c(b.sound_cues.map((s) => `${s.kind}@${s.t ?? "-"}`).join(", "))} | ${b.acceptance_criteria.filter((x) => x.objective).length} obj / ${b.acceptance_criteria.filter((x) => !x.objective).length} subj | ${c(b.justification.map((j) => `${j.choice} [${j.evidence.join(",")}]`).join("; "))} |`);
  }
  return L.join("\n") + "\n";
}
