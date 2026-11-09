/**
 * blueprint.mjs: the story is planned and checked BEFORE any narration exists.
 * Deterministic checks, then one model check. A beat that does not serve the central question is removed;
 * if what remains cannot answer the question, the blueprint is rejected and nothing is written.
 */
import { BadModelOutput, ask } from "./llm.mjs";
import { prompt } from "./prompt.mjs";
import { validate } from "./schema.mjs";
import { overlap, wordCount } from "./text.mjs";

export class BlueprintRejected extends Error {
  constructor(issues) { super(`blueprint rejected: ${issues.slice(0, 4).map((i) => i.message).join("; ")}`); this.kind = "rejected_blueprint"; this.issues = issues; }
}

const issue = (severity, code, message, beat_id = null) => ({ severity, code, message, beat_id });
const PROTECTED = new Set(["opening", "payoff", "ending"]);
const LINKS = ["cause", "consequence", "chronology", "comparison", "contradiction", "explanation", "discovery", "evidence", "change_over_time"];

/** Beats the length can hold: about 14 spoken words each is the least that states a claim clearly. */
export const maxBeatsFor = (profile, capacityWords) => Math.max(profile.minBeats, Math.min(profile.maxBeats, Math.floor(capacityWords / (profile.mode === "short" ? 14 : 60))));

export function blueprintIssues(bp, { claims, profile, channel, maxBeats }) {
  const out = [];
  for (const e of validate("story-blueprint", bp)) out.push(issue("critical", "schema", e));
  if (out.length) return out;
  const ids = new Set(claims.map((c) => c.claim_id));
  const byId = new Map(claims.map((c) => [c.claim_id, c]));
  const beats = bp.beats;
  if (!/\?\s*$/.test(bp.central_question) || wordCount(bp.central_question) < 5) out.push(issue("critical", "question", "central_question must be a real question of at least five words"));
  if (new Set(beats.map((b) => b.beat_id)).size !== beats.length) out.push(issue("critical", "ids", "beat_id values repeat"));
  if (beats[0].role !== "opening") out.push(issue("critical", "order", "first beat must be the opening", beats[0].beat_id));
  if (beats.at(-1).role !== "ending") out.push(issue("critical", "order", "last beat must be the ending", beats.at(-1).beat_id));
  if (beats.filter((b) => b.role === "payoff").length !== 1) out.push(issue("critical", "order", "exactly one beat must be the payoff"));
  else if (beats.findIndex((b) => b.role === "payoff") !== beats.length - 2) out.push(issue("major", "order", "the payoff must come immediately before the ending"));
  if (beats.filter((b) => b.role === "opening").length !== 1 || beats.filter((b) => b.role === "ending").length !== 1) out.push(issue("critical", "order", "exactly one opening and one ending"));
  beats.forEach((b, i) => {
    if (i === 0 && b.link_from_previous !== "none") out.push(issue("major", "link", "the opening has no previous beat; link must be none", b.beat_id));
    if (i > 0 && b.link_from_previous === "none") out.push(issue("critical", "link", "a beat after the first must say why it follows the previous one", b.beat_id));
    for (const c of b.claim_ids) if (!ids.has(c)) out.push(issue("critical", "claim", `claim ${c} does not exist`, b.beat_id));
    if (b.role !== "ending" && !b.claim_ids.length) out.push(issue("critical", "claim", "a beat that is not the ending must carry at least one claim", b.beat_id));
    if (b.purpose.split(/\s+/).length < 5) out.push(issue("major", "purpose", "purpose must say how the beat serves the question", b.beat_id));
  });
  if (beats.length > maxBeats) out.push(issue("critical", "length", `${beats.length} beats do not fit the length (limit ${maxBeats}); narrow the question`));
  if (beats.length < profile.minBeats) out.push(issue("critical", "length", `fewer than ${profile.minBeats} beats`));
  const used = new Set(beats.flatMap((b) => b.claim_ids));
  if (used.size < 2) out.push(issue("critical", "claim", "the story rests on fewer than two claims"));
  for (const k of bp.key_evidence) if (!ids.has(k) || !used.has(k)) out.push(issue("major", "evidence", `key_evidence ${k} is not used by any beat`));
  const order = new Map(beats.map((b, i) => [b.beat_id, i]));
  for (const q of bp.questions_raised) {
    if (!order.has(q.raised_in) || !order.has(q.answered_in)) out.push(issue("critical", "question", `question "${q.question}" points at a beat that does not exist`));
    else if (order.get(q.answered_in) < order.get(q.raised_in)) out.push(issue("critical", "question", `question "${q.question}" is answered before it is raised`));
  }
  const payoff = beats.find((b) => b.role === "payoff");
  if (payoff && overlap(`${payoff.purpose} ${payoff.claim_ids.map((c) => byId.get(c)?.claim || "").join(" ")}`, `${bp.central_question} ${bp.thesis}`).shared === 0) out.push(issue("critical", "payoff", "the payoff beat shares nothing with the central question or thesis"));
  if (overlap(bp.conclusion, `${bp.central_question} ${bp.thesis}`).shared === 0) out.push(issue("major", "conclusion", "the conclusion does not answer the central question"));
  out.push(...channelBlueprintIssues(bp, { claims, channel }));
  return out;
}

/** Beats that share no content with the question, thesis or conclusion, by their purpose and claims. */
export function unservingBeats(bp, claims) {
  const byId = new Map(claims.map((c) => [c.claim_id, c]));
  const target = `${bp.central_question} ${bp.thesis} ${bp.conclusion}`;
  return bp.beats.filter((b) => !PROTECTED.has(b.role) && overlap(`${b.purpose} ${b.claim_ids.map((c) => byId.get(c)?.claim || "").join(" ")}`, target).shared === 0).map((b) => b.beat_id);
}

function channelBlueprintIssues(bp, { claims, channel }) {
  const out = [];
  const byId = new Map(claims.map((c) => [c.claim_id, c]));
  const status = (b) => b.claim_ids.map((c) => byId.get(c)?.editorial_status);
  const key = channel.key;
  if (key === "dopamine-loop" && !/\b(feel|feeling|sensation|moment|imagine|picture|experience|rush|pull|ache|warm)/i.test(bp.beats[0].purpose)) out.push(issue("major", "channel", "Dopamine Loop must open on the feeling, before any explanation", bp.beats[0].beat_id));
  if (key === "rival-lines" && (bp.thesis.split(/\s+/).length < 8 || /\?\s*$/.test(bp.thesis))) out.push(issue("major", "channel", "Rival Lines needs a thesis that argues something, not a question"));
  if (key === "court-and-spotlight") {
    const all = bp.beats.flatMap(status);
    if (all.some((s) => ["allegation", "charge"].includes(s)) && !all.some((s) => ["conviction", "proven_fact", "public_statement", "disputed_claim"].includes(s))) out.push(issue("critical", "channel", "an allegation or charge is planned with no outcome or response beat"));
  }
  if (key === "red-space-facts") {
    const i = bp.beats.findIndex((b) => status(b).includes("hypothetical"));
    if (i >= 0 && !bp.beats.slice(0, i).some((b) => status(b).some((s) => ["observation", "scientific_model"].includes(s)))) out.push(issue("major", "channel", "a hypothetical comes before any observation or model it rests on", bp.beats[i].beat_id));
  }
  if (key === "world-view") {
    const contested = ["historical_interpretation", "allegation", "political_claim", "propaganda", "scholarly_disagreement", "speculation", "public_opinion"];
    const all = bp.beats.flatMap(status);
    if (all.length && all.every((s) => contested.includes(s))) out.push(issue("major", "channel", "every planned claim is contested; add the documented ground they stand on"));
  }
  return out;
}

const claimList = (claims) => claims.map((c) => `${c.claim_id} [${c.editorial_status}] ${c.claim}`).join("\n");

/** Applies removals. Relinking is NOT guessed: the model check must confirm the links that remain. */
export function removeBeats(bp, ids) {
  if (!ids.length) return bp;
  const drop = new Set(ids);
  const beats = bp.beats.filter((b) => !drop.has(b.beat_id));
  const gone = new Set(bp.beats.filter((b) => drop.has(b.beat_id)).map((b) => b.beat_id));
  return { ...bp, beats, questions_raised: bp.questions_raised.filter((q) => !gone.has(q.raised_in)).map((q) => (gone.has(q.answered_in) ? { ...q, answered_in: beats.find((b) => b.role === "payoff")?.beat_id ?? q.answered_in } : q)) };
}

export async function buildBlueprint(ctx, { channel, topic, angle, claims, capacityWords, targetSeconds, narrowTo = null }) {
  const profile = channel.profile;
  const maxBeats = maxBeatsFor(profile, capacityWords);
  const history = [];
  let feedback = narrowTo ? `The previous plan did not fit the length. Plan this narrower question instead: ${narrowTo}` : "";
  let removedAll = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const user = prompt("blueprint", {
      format_label: profile.mode === "short" ? "YouTube Short" : "long-form YouTube video", channel_name: channel.name, editorial: channel.editorial, guidance: channel.guidance,
      topic, angle, target_seconds: String(Math.round(targetSeconds)), capacity_words: String(Math.round(capacityWords)), max_beats: String(maxBeats), min_beats: String(profile.minBeats),
      claims: claimList(claims), feedback,
    });
    let bp;
    try { ({ value: bp } = await ask(ctx, { role: "writer", tag: "blueprint", user, maxTokens: 6000, temperature: 0.3, check: (v) => validate("story-blueprint", v) })); }
    catch (e) {
      if (!(e instanceof BadModelOutput)) throw e;
      history.push({ attempt, stage: "format", issues: [issue("critical", "schema", e.detail)] });
      feedback = `The previous answer was not a valid plan: ${e.detail}. Follow the JSON shape exactly, including "role" and "link_from_previous" on every beat.`;
      continue;
    }
    // key_evidence is a pointer list, not a claim of its own: drop pointers to claims no beat uses.
    const usedIds = new Set((bp.beats || []).flatMap((b) => b.claim_ids || []));
    bp.key_evidence = [...new Set((bp.key_evidence || []).filter((k) => usedIds.has(k)))];
    if (!bp.key_evidence.length) bp.key_evidence = [...usedIds].slice(0, 3);
    let current = bp;
    let det = blueprintIssues(current, { claims, profile, channel, maxBeats });
    // Remove beats that do not serve the question (deterministic test), then re-check what is left.
    const off = unservingBeats(current, claims).filter(() => !det.some((d) => d.severity === "critical" && d.code === "schema"));
    if (off.length) {
      removedAll.push(...off.map((id) => ({ beat_id: id, reason: "shares nothing with the central question, thesis or conclusion", by: "deterministic" })));
      current = removeBeats(current, off);
      det = blueprintIssues(current, { claims, profile, channel, maxBeats });
    }
    const blocking = det.filter((d) => d.severity !== "minor");
    if (blocking.length) {
      history.push({ attempt, stage: "deterministic", issues: blocking });
      feedback = `The previous plan was rejected by these checks. Fix all of them:\n${blocking.map((d) => `- ${d.beat_id ? d.beat_id + ": " : ""}${d.message}`).join("\n")}`;
      continue;
    }
    // One model check; a second only if it removed something.
    let model = null;
    for (let pass = 0; pass < 2; pass++) {
      const r = await ask(ctx, {
        role: "judge", tag: "blueprint-check", avoid: [], maxTokens: 6000, temperature: 0,
        user: prompt("blueprint-check", { central_question: current.central_question, thesis: current.thesis, claims: claimList(claims), beats: current.beats.map((b) => ({ beat_id: b.beat_id, role: b.role, purpose: b.purpose, link_from_previous: b.link_from_previous, claims: b.claim_ids.map((c) => claims.find((x) => x.claim_id === c)?.claim) })), max_beats: String(maxBeats), target_seconds: String(Math.round(targetSeconds)) }),
        check: (v) => (Array.isArray(v?.beats) && v.beats.length ? [] : ["answer must include a beats array"]),
      });
      model = r.value;
      const verdicts = new Map(model.beats.map((b) => [b.beat_id, b]));
      const off2 = current.beats.filter((b) => verdicts.get(b.beat_id)?.serves === false && !PROTECTED.has(b.role)).map((b) => b.beat_id);
      if (!off2.length) break;
      removedAll.push(...off2.map((id) => ({ beat_id: id, reason: verdicts.get(id).reason || "model: does not serve the question", by: "model" })));
      current = removeBeats(current, off2);
      const again = blueprintIssues(current, { claims, profile, channel, maxBeats }).filter((d) => d.severity !== "minor");
      if (again.length) { det = again; model = null; break; }
    }
    if (!model) { history.push({ attempt, stage: "after-removal", issues: det }); feedback = `Removing off-question beats broke the plan:\n${det.map((d) => `- ${d.message}`).join("\n")}\nPlan a tighter story.`; continue; }
    const verdicts = new Map(model.beats.map((b) => [b.beat_id, b]));
    const modelIssues = [], relinked = [];
    for (const b of current.beats) {
      const v = verdicts.get(b.beat_id);
      if (!v) modelIssues.push(issue("major", "model", "the check did not judge this beat", b.beat_id));
      else {
        if (v.serves === false) modelIssues.push(issue("critical", "model", `a ${b.role} beat does not serve the question: ${v.reason}`, b.beat_id));
        if (v.link_true === false) {
          // The checker names the link that IS true; use it (recorded). Only when none fits is the plan sent back.
          if (LINKS.includes(v.correct_link) && b !== current.beats[0]) { relinked.push({ beat_id: b.beat_id, from: b.link_from_previous, to: v.correct_link, reason: v.reason }); b.link_from_previous = v.correct_link; }
          else modelIssues.push(issue("major", "model", `link "${b.link_from_previous}" is not true of these beats and no other link fits: ${v.reason}`, b.beat_id));
        }
      }
    }
    if (model.answers_question === false) modelIssues.push(issue("critical", "model", "the beats do not answer the central question from the claims"));
    // "fits the length" is a judgement the measured duration settles later (and narrows the story if it fails); it is a note here.
    const lengthNote = model.fits_length === false ? (model.narrow_to || "reviewer doubts it fits") : null;
    // What a first-time viewer would not know is not a reason to reject the plan: it is an instruction to the writer,
    // who must explain each item in the sentence where it first appears (and the continuity gates verify that it did).
    current = { ...current, explain_in_script: (model.gaps || []).map(String).slice(0, 6) };
    if (modelIssues.length) {
      history.push({ attempt, stage: "model", issues: modelIssues });
      feedback = `A reviewer rejected the previous plan:\n${modelIssues.map((d) => `- ${d.beat_id ? d.beat_id + ": " : ""}${d.message}`).join("\n")}${model.narrow_to ? `\nConsider the narrower question: ${model.narrow_to}` : ""}`;
      continue;
    }
    return { blueprint: current, removed: removedAll, checks: { max_beats: maxBeats, deterministic: "pass", model: { answers_question: true, fits_length: true, beats: model.beats, relinked_by_checker: relinked } }, attempts: attempt, history };
  }
  throw new BlueprintRejected(history.flatMap((h) => h.issues));
}

export { claimList };
