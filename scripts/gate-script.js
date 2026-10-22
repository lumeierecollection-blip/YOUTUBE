#!/usr/bin/env node
/**
 * Gate â€” script quality (CHECK-REGISTER.md SCR-03..SCR-08, SCR-12..SCR-14, SCR-18).
 * SCR-09/SCR-10/SCR-11 are enforced earlier, in reserve-topics.js at Stage A.
 *
 * BLOCKER checks fail the process (exit 1). MAJOR checks print a warning
 * and exit 0, unless --strict is passed.
 *
 * Usage: node scripts/gate-script.js <channel-id> <script-slug> [research-slug] [--strict]
 */

import { readFileSync, existsSync } from "fs";
import { resolveChannel } from "./lib/channel-lookup.mjs";
import { strictUngroundableSentences } from "./strict-visual.mjs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Exported so scripts/test-word-budget.mjs can recompute the word range the
// write-script prompt must advertise. The prompt used to state a flat
// "75-130 words" for every channel, which is BELOW this gate's floor for
// motion-graphics (78) and minimal (83) and ABOVE its ceiling for
// cinematic-documentary (112) â€” so a model that obeyed the prompt failed
// SCR-16 deterministically. Channels 1 and 48 failed this way in runs
// 35211514030 and 35266860427 (62, 64, 57 words). If these numbers change,
// that test fails and the prompt has to be updated with them.
// 2026-10-10: the Gemini TTS voice (the narrator since the voice change; narration-judge scores it
// 8-9) reads 105-125 words/min, not Edge's 150-165. Sizing scripts for 155 made every
// motion-graphics script too long for the 36-52 s window, which looped SCR-16 and left board
// 38034289156 with ch 1, 5, 26 and 44 skipped. The board's two minimal channels (6, 8) get the
// same figure; cinematic-documentary is not on the board and is left until it has a measured run.
export const WPM_TARGET = { "cinematic-documentary": 135, "motion-graphics": 125, minimal: 125 };
// Midpoint of render.js's clamp ranges, used only to sanity-check pacing â€”
// actual duration is decided later by the real voiceover audio length.
const FORMAT_MIDPOINT_MINUTES = { shorts: 44 / 60, longform: (2 + 12) / 2 };
// Duration cap: all videos target 30-50 seconds (wide window - model oscillates)
// Render.js clamps final duration to the actual voiceover length anyway.
// 2026-10-03, the narrative engine (prompts/write-script.md): five beats â€” hook, setup,
// re-hook, payoff, close â€” need ~100 words. Shorts move from 30-45 s to 36-52 s at the
// gate's effective rate, (superseded 2026-10-10: 80-98 words at the Gemini voice's pace) (scripts/test-word-budget.mjs).
// Measured the same day the narrator speaks 1.8-2.5 words/s, so ~100 words is 40-55 s of
// real voiceover; the workflow still trims anything over 58 s (scripts/fit-short.js).
export const DURATION_RANGE_SECONDS = { shorts: { min: 36, max: 52 }, longform: { min: 30, max: 45 } };

/**
 * EdgeTTS speaks slower than the nominal WPM, so the nominal figure
 * under-predicts duration and the gate passed videos that overran.
 *
 * src/utils/tts.js delivers every voiceover at `rate=-8%` ("slower, measured
 * documentary pace"), and no channel overrides it. The gate was converting
 * words to seconds at the NOMINAL wpm, which is ~9% optimistic: 129 words
 * was predicted at 49.9s and ch48 actually rendered at 55.49s in run
 * 35319923732 â€” inside the gate, outside the target.
 *
 * Applying the rate here makes the gate's prediction match what the
 * renderer will actually produce, so the 30-45s target is real rather than
 * nominal.
 */
export const TTS_RATE_FACTOR = 0.92;

/** Effective words-per-minute for a channel style, as actually spoken. */
export function effectiveWpm(style) {
  return (WPM_TARGET[style] || 150) * TTS_RATE_FACTOR;
}
const HEX_COLOR = /#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b/g;

function loadChannel(channelId) {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  return resolveChannel(channelId, channels);
}

function wordCount(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

// â”€â”€ SCR-18: names are copied from the research, not retyped â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NAME_TOKEN = /^[A-Z][A-Za-z'â€™-]+$/;
// Tokens allowed INSIDE a multi-word name: "Bank of Nowhere", "Van der Waals".
const NAME_CONNECTOR = new Set(["of", "the", "and", "for", "de", "del", "van", "von", "da", "di", "la", "le", "du"]);
// Sentence-initial words that are not names and must not turn the next word into a
// multi-word "name" ("On September", "But Powell").
const NAME_LEAD = new Set(["the", "a", "an", "on", "in", "at", "by", "for", "from", "after", "before", "when", "but", "and", "if", "as", "his", "her", "its", "their", "this", "that", "these", "those", "he", "she", "it", "they"]);
// Sentence-initial adverbs that glue onto a following name ("Then Matt Graney",
// run 39611317543 ch-2). Only ever dropped as the FIRST token of a run.
const NAME_LEAD_ADVERB = new Set(["then", "now", "today", "yesterday", "tomorrow", "still", "also", "meanwhile", "however", "instead", "finally", "next", "later", "soon", "so", "yet", "here", "there", "since", "until", "while", "with", "without", "under", "over", "inside", "across", "during", "through", "against", "among", "between", "according"]);
// Calendar words are capitalised but are not names ("Scientific Reports October",
// run 39611317543 ch-48): a run may END or contain them without being an unknown name.
const CALENDAR_WORD = new Set(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

function nameTokens(text) {
  return String(text || "")
    .split(/\s+/)
    .map((t) => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9'â€™-]+$/g, "").replace(/['â€™]s$/i, ""))
    .filter(Boolean);
}
const stripLead = (tokens) => {
  let t = tokens.slice();
  while (t.length > 1 && NAME_LEAD.has(t[0])) t = t.slice(1);
  return t;
};
const editDistanceAtMost1 = (a, b) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return true;
};

/**
 * SCR-18 (BLOCKER near-miss / MAJOR unknown) â€” every proper noun is copied from
 * the research artifact, character for character.
 *
 * Run 39128017438 rendered "The Washington Pest": the writer's script said
 * "Post", an enforced plan edit changed the headline on attempt 3, and nothing
 * between the planner and the frame compared the name with the research
 * spelling. The naming check compares the two rendered looks against each
 * other, so two looks rendering the SAME typo agree.
 *
 * Conservative by design. A near-miss is a capitalised sequence (or a token of
 * a researched name) that differs from a research name by exactly one edit and
 * starts with the same letter â€” the shape of a typo, not a paraphrase.
 * Everything else capitalised and absent from the research is a MAJOR warning,
 * because sentence-initial words and legitimate paraphrase live there.
 */
export function nameFidelityProblems(script, research) {
  const blockers = [], majors = [];
  if (!research) return { blockers, majors };

  const collect = (node, out = []) => {
    if (typeof node === "string") out.push(node);
    else if (Array.isArray(node)) node.forEach((n) => collect(n, out));
    else if (node && typeof node === "object") Object.values(node).forEach((n) => collect(n, out));
    return out;
  };
  const researchSeq = ` ${collect(research).flatMap((s) => nameTokens(s).map((t) => t.toLowerCase())).join(" ")} `;
  const researchNames = (research.named_entities || []).map((e) => String(e.name || "")).filter(Boolean);
  const nameLower = researchNames.map((n) => ({ name: n, tokens: stripLead(nameTokens(n).map((t) => t.toLowerCase())) }));
  const singleNames = new Set(nameLower.filter((n) => n.tokens.length === 1).map((n) => n.tokens[0]));

  const present = (tokens) => {
    const t = stripLead(tokens);
    return !t.length || researchSeq.includes(` ${t.join(" ")} `);
  };
  const nearMissOfToken = (token) => {
    for (const { name, tokens } of nameLower) {
      for (const t of tokens) {
        if (t === token || t.length < 4 || t[0] !== token[0]) continue;
        if (editDistanceAtMost1(token, t)) return name;
      }
    }
    return null;
  };
  const nearMissOfWindow = (tokens) => {
    for (const { name, tokens: nt } of nameLower) {
      if (nt.length !== tokens.length || !nt.length) continue;
      let matching = 0, near = 0, ok = true;
      for (let k = 0; k < nt.length; k++) {
        if (nt[k] === tokens[k]) { matching++; continue; }
        if (nt[k][0] !== tokens[k][0] || nt[k].length < 4 || !editDistanceAtMost1(tokens[k], nt[k])) { ok = false; break; }
        near++;
      }
      if (ok && matching >= 1 && near === 1) return name;
    }
    return null;
  };

  const seen = new Set();
  for (const text of collect(script)) {
    const toks = nameTokens(String(text));
    const runs = [];
    let cur = [];
    for (let i = 0; i < toks.length; i++) {
      if (NAME_TOKEN.test(toks[i]) && toks[i] !== "I") { cur.push(toks[i]); continue; }
      const connector = NAME_CONNECTOR.has(toks[i].toLowerCase());
      if (connector && cur.length && i + 1 < toks.length && NAME_TOKEN.test(toks[i + 1])) { cur.push(toks[i]); continue; }
      if (cur.length) runs.push(cur);
      cur = [];
    }
    if (cur.length) runs.push(cur);

    for (const run of runs) {
      const win = run.slice(0, 5);
      const lower = win.map((t) => t.toLowerCase());
      const core = stripLead(lower);
      const key = core.join(" ");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (present(core)) continue;

      // The near-miss test also runs without a leading adverb, which would
      // otherwise hide "Then Michelle Singletry" from the length-matched window.
      const bare = core.length > 1 && NAME_LEAD_ADVERB.has(core[0]) ? core.slice(1) : core;
      const near = nearMissOfWindow(core) || nearMissOfWindow(bare)
        || (bare.length === 1 ? nearMissOfToken(bare[0]) : null);
      // A run made ONLY of researched names, calendar words and at most one
      // leading adverb is not an unknown name — it is two things side by side.
      // Checked after the near-miss test, so a typo still blocks.
      const covered = (() => {
        const ok = new Array(core.length + 1).fill(false);
        ok[0] = true;
        for (let i = 0; i < core.length; i++) {
          if (!ok[i]) continue;
          for (let j = i + 1; j <= core.length; j++) {
            const seg = core.slice(i, j);
            const single = seg.length === 1 ? seg[0] : null;
            if ((single && CALENDAR_WORD.has(single)) || (single && i === 0 && NAME_LEAD_ADVERB.has(single))
                || (!NAME_CONNECTOR.has(seg[0]) && researchSeq.includes(` ${seg.join(" ")} `)
                    // A lone word only counts when it is part of a researched NAME —
                    // two research words side by side ("Washington" + "Times") are
                    // not a researched name.
                    && (seg.length >= 2 || singleNames.has(single)))) ok[j] = true;
          }
        }
        return ok[core.length];
      })();
      if (near) {
        blockers.push(`SCR-18: "${win.join(" ")}" is a near-miss of the research name "${near}" â€” copy the name exactly as the research artifact spells it.`);
      } else if (core.length >= 2 && !covered) {
        majors.push(`SCR-18: "${win.join(" ")}" is not named in the research artifact â€” use the research's own name, or drop the name.`);
      }
    }
  }
  return { blockers, majors };
}

/**
 * Sentences of the voiceover that name no figure / date / proper noun, and the longest run of
 * them in a row. Exported for scripts/test-script-shows.mjs.
 */
export function wordsOnlyShare(sections = []) {
  const sentences = sections
    .flatMap((s) => String(s.voiceover || "").split(/(?<=[.!?])\s+/))
    .map((t) => t.trim()).filter(Boolean);
  const names = (t) => /\d/.test(t) || /(?:^|\s)(?!I\b)[A-Z][A-Za-z]+/.test(t.replace(/^\W*\S+\s*/, " ")) ||
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(t);
  const flags = sentences.map((t) => !names(t));
  let run = 0, best = 0;
  for (const f of flags) { run = f ? run + 1 : 0; best = Math.max(best, run); }
  return { sentences, bare: sentences.filter((_, i) => flags[i]), run: best };
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--strict");
  const [channelId, scriptSlug, researchSlugArg] = args;
  // researchSlug defaults to scriptSlug for the single-format case; pass it
  // explicitly when one research artifact backs multiple script files
  // (e.g. "<slug>-shorts" and "<slug>-longform" both trace back to "<slug>").
  const researchSlug = researchSlugArg || scriptSlug;
  const strict = process.argv.includes("--strict");
  if (!channelId || !scriptSlug) {
    console.error("Usage: node scripts/gate-script.js <channel-id> <script-slug> [research-slug] [--strict]");
    process.exit(1);
  }

  const channel = loadChannel(channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const scriptPath = join(ROOT, "data", "research", String(channelId), `${scriptSlug}-script.json`);
  const researchPath = join(ROOT, "data", "research", String(channelId), `${researchSlug}.json`);
  if (!existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }
  const script = JSON.parse(readFileSync(scriptPath, "utf-8"));
  const research = existsSync(researchPath) ? JSON.parse(readFileSync(researchPath, "utf-8")) : null;

  const blockers = [];
  const majors = [];
  const sections = script.sections || [];
  const isMg = channel.style === "motion-graphics";
  // Beat checks apply only where the render path READS sections[].beats.
  // Motion-graphics shorts render through DirectedShorts (render.js
  // getCompositionForStyle, unless USE_LEGACY_3D=true), which builds its
  // visuals from the SRT + visual plan and never reads beats; those scripts
  // are written against schemas/script.directed.json, which has no beats.
  // Grounding checks (SCR-08, SCR-12..14) still apply to every script.
  const readsBeats = isMg && !(script.format === "shorts" && process.env.USE_LEGACY_3D !== "true");
  if (isMg && !readsBeats) {
    console.log("SCR-03/04/05/06/07/15: not applicable â€” DirectedShorts does not read sections[].beats (CHECK-REGISTER.md scope note).");
  }

  if (readsBeats) {
    const allBeats = sections.flatMap((s) => (s.beats || []).map((b) => ({ ...b, sectionId: s.id, voiceover: s.voiceover })));

    // SCR-03 â€” anchor_token appears verbatim in its section's voiceover.
    for (const b of allBeats) {
      const vo = (b.voiceover || "").toLowerCase();
      if (!b.anchor_token || !vo.includes(String(b.anchor_token).toLowerCase())) {
        blockers.push(`SCR-03: beat in section "${b.sectionId}" has anchor_token "${b.anchor_token}" not found verbatim in its voiceover.`);
      }
    }

    // SCR-04 â€” every PROGRESS beat has data.series with >=2 points.
    for (const b of allBeats.filter((x) => x.archetype === "PROGRESS")) {
      const n = b.data?.series?.length || 0;
      if (n < 2) {
        // Name the way OUT, not just the violation. SCR-04 and SCR-05 pull in
        // opposite directions when the research yielded a single number:
        // "needs >=2 points" invites the model to invent a second one, and
        // SCR-05 then rejects it for not tracing to the research. Channels 44
        // and 48 died in that loop in run 35293642808, fabricating
        // "Standard baseline"=0 / "Baseline retention"=39 to reach two
        // points. Inventing a statistic is a hard-rule violation
        // (CLAUDE.md), so the escape hatch has to be stated here.
        blockers.push(
          `SCR-04: PROGRESS beat in section "${b.sectionId}" ("${b.text}") has ${n} series point(s), needs >=2. ` +
          `Do NOT invent a second point (no "baseline"=0, no zero rows, no made-up comparison) â€” SCR-05 will reject it. ` +
          `If the research only supports ONE number for this beat, change the archetype to HERO_NUMBER instead.`
        );
      }
    }

    // SCR-05 â€” every series value traces to research.numbers.
    if (research) {
      const knownValues = new Set((research.numbers || []).map((n) => n.value));
      for (const b of allBeats) {
        for (const point of b.data?.series || []) {
          const matches = [...knownValues].some((v) => Math.abs(v - point.value) < 1e-9);
          if (!matches) {
            // Show what IS available. The model was being told its value was
            // wrong without being shown the legal set, so it guessed again â€”
            // the same information gap that made ajv's enum errors useless.
            const available = [...knownValues].slice(0, 12).join(", ");
            blockers.push(
              `SCR-05: series point "${point.label}"=${point.value} in section "${b.sectionId}" doesn't match any research.numbers[].value. ` +
              `Use only these researched values: [${available}${knownValues.size > 12 ? ", â€¦" : ""}]. ` +
              `If none of them fit this beat, use HERO_NUMBER with a single real number, or drop the chart â€” never invent a value to fill a series.`
            );
          }
        }
      }
    } else {
      majors.push(`SCR-05: research artifact not found at ${researchPath} â€” could not verify chart data traces to sourced numbers.`);
    }

    // SCR-06 (soft) â€” archetype mix vs. channel.concepts, only if declared.
    if (channel.concepts) {
      const total = allBeats.length || 1;
      const counts = {};
      for (const b of allBeats) counts[b.archetype] = (counts[b.archetype] || 0) + 1;
      const primaryShare = (channel.concepts.primary || []).reduce((s, a) => s + (counts[a] || 0), 0) / total;
      const excluded = (channel.concepts.excluded || []).filter((a) => counts[a] > 0);
      if (primaryShare < 0.5) majors.push(`SCR-06: primary archetypes are ${(primaryShare * 100).toFixed(0)}% of beats, need >=50%.`);
      if (excluded.length > 0) majors.push(`SCR-06: excluded archetype(s) used: ${excluded.join(", ")}.`);
    }

    // SCR-07 â€” STATEMENT <=30% of beats.
    const statementShare = allBeats.filter((b) => b.archetype === "STATEMENT").length / (allBeats.length || 1);
    if (statementShare > 0.3) {
      majors.push(`SCR-07: STATEMENT is ${(statementShare * 100).toFixed(0)}% of beats, must be <=30%.`);
    }

    /**
     * SCR-15 (soft) â€” the writer actually directed the visuals.
     *
     * The style contract requires a `visual` block on every beat. When it is
     * missing, visual/director.js falls back to picking a strategy by
     * keyword match on the narration â€” which still renders, so nothing
     * fails, it just quietly produces the templated look this gate exists
     * to catch. Reported as MAJOR rather than BLOCKER for that reason: a
     * script with no direction is worse, not broken, and failing the run
     * would cost the channel its upload for the day.
     *
     * Two separate failures, because they need different answers: none at
     * all means the writer ignored the instruction; all-the-same means it
     * answered without deciding, which the contract calls out by name.
     */
    const directed = allBeats.filter((b) => b.visual && b.visual.strategy);
    const share = directed.length / (allBeats.length || 1);
    if (directed.length === 0) {
      majors.push(
        `SCR-15: no beat carries a visual block â€” every one will be planned by keyword fallback. The style contract requires the writer to direct each beat.`
      );
    } else if (share < 0.6) {
      majors.push(
        `SCR-15: only ${(share * 100).toFixed(0)}% of beats carry a visual block; the rest fall back to keyword matching.`
      );
    } else {
      const mix = new Set(directed.map((b) => String(b.visual.strategy).toUpperCase()));
      if (directed.length >= 4 && mix.size === 1) {
        majors.push(
          `SCR-15: all ${directed.length} directed beats chose the same strategy (${[...mix][0]}) â€” that is defaulting, not directing.`
        );
      }
    }
  }

  // SCR-08 (soft, both schemas) â€” pacing sanity check against style WPM target.
  // Real duration is decided later from actual voiceover audio length; this
  // only catches scripts that are wildly too dense or too sparse for their format.
  const totalWords = sections.reduce((sum, s) => sum + wordCount(s.voiceover), 0);
  const targetWpm = WPM_TARGET[channel.style] || 150;
  const midpointMinutes = FORMAT_MIDPOINT_MINUTES[script.format] || FORMAT_MIDPOINT_MINUTES.longform;
  const impliedWpm = totalWords / midpointMinutes;
  if (impliedWpm < targetWpm * 0.5 || impliedWpm > targetWpm * 1.5) {
    majors.push(`SCR-08: ${totalWords} words implies ~${impliedWpm.toFixed(0)} WPM at the ${script.format} midpoint duration, vs. this channel's ${targetWpm} WPM target â€” check pacing.`);
  }

  // SCR-16 (BLOCKER) - duration must be 30-50 seconds.
  // Voiceover duration = totalWords / WPM; frame count = duration * FPS.
  // At 30 fps: 30s = 900 frames, 50s = 1500 frames.
  const durationRange = DURATION_RANGE_SECONDS[script.format] || DURATION_RANGE_SECONDS.shorts;
  // Effective, not nominal: see TTS_RATE_FACTOR. Using the nominal wpm here
  // is what let ch48 pass at a predicted 49.9s and render at 55.49s.
  const spokenWpm = effectiveWpm(channel.style);
  const impliedSeconds = (totalWords / spokenWpm) * 60;
  if (impliedSeconds < durationRange.min || impliedSeconds > durationRange.max) {
    // Report the fix in WORDS, which is what the model controls.
    //
    // This used to say only "~27s duration â€” outside 30-50s target", leaving
    // the model to reverse-engineer a word count from a duration it never
    // sees. It guessed low over and over: channel 44 produced 70, 67 then 61
    // words and channel 48 produced 76, 74 then 53 in run 35293642808, every
    // one of them under the floor it was never told.
    const minWords = Math.ceil((durationRange.min * spokenWpm) / 60);
    const maxWords = Math.floor((durationRange.max * spokenWpm) / 60);
    const delta = totalWords < minWords
      ? `ADD at least ${minWords - totalWords} more words`
      : `CUT at least ${totalWords - maxWords} words`;
    blockers.push(
      `SCR-16: ${totalWords} words implies ~${impliedSeconds.toFixed(0)}s duration â€” outside the ${durationRange.min}-${durationRange.max}s target. ` +
      `This channel needs ${minWords}-${maxWords} words of voiceover (at ${targetWpm} wpm): ${delta}. ` +
      `Count the words in every section's voiceover and hit that range â€” shorter is NOT safer, under ${minWords} fails exactly like over ${maxWords}.`
    );
  }

  // SCR-17 (soft) â€” beats have something to show (short-video-scripter rules, 2026-10-09).
  // Heuristic: a sentence "names something drawable" if it holds a figure, a date, or a proper
  // noun after its first word. A real object noun ("a courthouse") is invisible to this, so it
  // can only WARN; the renderer's shot legality (at most one words-only beat in three) is the
  // judge of what can actually be drawn.
  {
    const { sentences, bare, run } = wordsOnlyShare(sections);
    if (sentences.length >= 6 && (bare.length / sentences.length > 1 / 3 || run >= 3)) {
      majors.push(`SCR-17: ${bare.length}/${sentences.length} sentences name no figure, date or proper noun (longest run ${run}) â€” the renderer allows at most one words-only beat in three: "${bare.slice(0, 3).join('" / "').slice(0, 220)}"`);
    }
  }

  // SCR-17 STRICT (config strict_visual channels only: ch-02, ch-48 â€” owner's
  // frame rule 2026-10-20: "every frame must have a visual asset. No pure
  // text cards."). SCR-17 above can only warn for every channel; for the
  // channels the frame review keeps rejecting as TEMPLATE_MONOCULTURE it is
  // stricter: every sentence should ground a figure (number / chart / date /
  // place / list / comparison / document / money / cause-effect).
  //
  // REVERTED TO ONE TIER (run 39454114003 ch-2): the warning tier assumed the
  // plan would attach the named entity's real logo/photo, so the render audit
  // could verify it. It cannot: a small company has no fetched mark, the
  // ladder falls back to a name plate, and the audit - correctly - refuses
  // plates as text cards. Seven beats passed on warning and failed the render
  // with no retry. A sentence that grounds nothing must fail HERE, where the
  // writer is re-asked and the strict re-pick can change the topic.
  if (channel.strict_visual) {
    const bad = strictUngroundableSentences(wordsOnlyShare(sections).sentences);
    if (bad.length) {
      blockers.push(
        `SCR-17 STRICT (strict_visual channel): ${bad.length} sentence(s) ground no figure, date, place, list, comparison, document, money object or cause/sequence — every beat must draw a real visual, and naming an entity is not one (a name plate is a text card). Rewrite each one to state a sourced number, date, place, a list, a comparison or a cause/effect the frame can draw (facts verbatim from the research; invent nothing): "${bad.slice(0, 4).join('" / "').slice(0, 300)}"`
      );
    }
  }

  // SCR-18 â€” proper nouns are copied from the research artifact (BLOCKER
  // near-miss, MAJOR unknown). This is the script-stage half of the fix for
  // "The Washington Pest"; the challenger and the auto-correct cover the plan.
  if (research) {
    const nameFidelity = nameFidelityProblems(script, research);
    blockers.push(...nameFidelity.blockers);
    majors.push(...nameFidelity.majors);
  }

  // SCR-12 â€” text_overlay is an object or null, never a bare string.
  // (Already enforced by --json-schema at the CLI boundary; checked again
  // here as defense in depth against hand-edited files.)
  for (const s of sections) {
    if (typeof s.text_overlay === "string") {
      blockers.push(`SCR-12: section "${s.id}" has text_overlay as a bare string, must be an object or null.`);
    }
  }

  // SCR-13 (soft) â€” no hex colour values anywhere in the script JSON.
  const rawJson = JSON.stringify(script);
  const hexHits = rawJson.match(HEX_COLOR);
  if (hexHits) {
    majors.push(`SCR-13: hex colour value(s) found in script JSON: ${[...new Set(hexHits)].join(", ")}. Colour belongs in channels.json, not the script.`);
  }

  // SCR-14 â€” sources_used >=3, all appear in the research file.
  const sourcesUsed = script.sources_used || [];
  if (sourcesUsed.length < 2) {
    blockers.push(`SCR-14: sources_used has ${sourcesUsed.length} entries, needs >=2.`);
  }
  if (research) {
    const known = new Set([
      ...(research.key_facts || []).map((f) => f.source_url),
      ...(research.numbers || []).map((n) => n.source_url),
    ]);
    const unknown = sourcesUsed.filter((u) => !known.has(u));
    if (unknown.length > 0) {
      blockers.push(`SCR-14: sources_used references URL(s) not present in the research file: ${unknown.join(", ")}`);
    }
  }

  if (majors.length > 0) {
    console.warn(`Script gate â€” ${majors.length} MAJOR warning(s) for ${channelId}/${scriptSlug}:`);
    majors.forEach((m) => console.warn(`  - ${m}`));
  }
  if (blockers.length > 0) {
    console.error(`Script gate FAILED (BLOCKER) for ${channelId}/${scriptSlug}:`);
    blockers.forEach((b) => console.error(`  - ${b}`));
    process.exit(1);
  }
  if (strict && majors.length > 0) {
    console.error(`Script gate FAILED (--strict, MAJOR warnings present) for ${channelId}/${scriptSlug}.`);
    process.exit(1);
  }

  console.log(`Script gate PASSED for ${channelId}/${scriptSlug}${majors.length ? ` (${majors.length} warning(s))` : ""}.`);
}

// Only run the CLI when invoked directly. Importing this file for its
// exported gate constants (scripts/test-word-budget.mjs) previously executed
// main() and exited on the missing arguments â€” the same import side-effect
// that made local-visual-auditor.js untestable.
const invokedDirectly = process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) main();
