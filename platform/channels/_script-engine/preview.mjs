/**
 * Live run of the real script engine for all eight channels, on facts fetched during this run.
 * No stub is used here. For each channel: fetch the sources -> claims -> blueprint -> script -> continuity ->
 * independent critic -> (if approved) narration and measured duration. Every channel is published as it completes.
 * A channel that does not pass is reported with the reason; a script is never published as approved without review.
 */
import { createHash } from "node:crypto";
import { channelConfig } from "../../script-engine/channels.mjs";
import { durationProblems, measureWpm, wpmFrom } from "../../script-engine/duration.mjs";
import { runEngine } from "../../script-engine/engine.mjs";
import { liveLLM } from "../../script-engine/llm.mjs";
import { fetchSource } from "../../script-engine/sources.mjs";
import { TOPICS } from "./topics.mjs";

const BUDGET_MS = 44 * 60e3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sentenceMd = (pkg) => pkg.sentences.map((s) => `${s.sentence_id}. [${s.beat_id}${s.claim_ids.length ? " | " + s.claim_ids.join(",") : ""}] ${s.text}\n   - follows because: ${s.link_from_previous}\n   - on screen: ${s.on_screen_text || "(none)"}`).join("\n");
const draftMd = (title, pkg, extra = "") => `# ${title}\n\n${extra}Central question: ${pkg.blueprint.central_question}\n\nSelected hook: ${pkg.selected_hook}\n\nHook options (code decides honesty and score; the highest-scoring HONEST one is chosen):\n${pkg.hook_options.map((h) => `- ${h.honest ? "honest" : "REJECTED"} | ${h.family} | score ${h.score} | ${h.text}`).join("\n")}\n\nEstimated duration: ${pkg.duration_estimate_s}s\n\n## Narration, sentence by sentence\n\n${sentenceMd(pkg)}\n\n## Narration as spoken\n\n${pkg.sentences.map((s) => s.text).join(" ")}\n`;
const outlineMd = (bp, removed) => `# Story outline\n\nCentral question: ${bp.central_question}\n\nThesis: ${bp.thesis}\n\nWhy it matters: ${bp.why_it_matters}\n\nViewer starts knowing: ${bp.viewer_start}\n\nViewer ends understanding: ${bp.viewer_end}\n\n${bp.beats.map((b) => `- ${b.beat_id} (${b.role}, link: ${b.link_from_previous}, claims: ${b.claim_ids.join(",") || "none"}): ${b.purpose}`).join("\n")}\n\nQuestions raised: ${bp.questions_raised.map((q) => `"${q.question}" raised in ${q.raised_in}, answered in ${q.answered_in}`).join("; ") || "none"}\n\nConclusion: ${bp.conclusion}\n${removed.length ? `\nBeats removed because they did not serve the question: ${removed.map((r) => `${r.beat_id} (${r.by}: ${r.reason})`).join("; ")}\n` : ""}`;

export default async function preview({ runId, tools, _llm = null }) {
  // src/lib/gemini-client.js stops a process at 50,000 tokens ("one video"). Eight channels make roughly 100 calls, so the
  // cap is raised for this run only; the provider's own quotas still apply and are reported as blocked_provider.
  process.env.MAX_TOKENS_PER_VIDEO ||= "5000000";
  const llm = _llm || liveLLM();
  const started = Date.now();
  const wpmCache = new Map();
  const summary = [];
  const keys = Object.keys(TOPICS);

  const measure = (voice) => {
    if (!wpmCache.has(voice)) {
      try { wpmCache.set(voice, wpmFrom(measureWpm({ tools, voice }))); }
      catch (e) { console.error(`[preview] wpm measurement failed for ${voice}: ${String(e.message).slice(0, 200)}`); wpmCache.set(voice, { ...wpmFrom({ voice }), measurement_error: String(e.message).slice(0, 200) }); }
    }
    return wpmCache.get(voice);
  };

  for (const channelKey of keys) {
    const T = TOPICS[channelKey];
    const put = (name, content) => tools.write(`${channelKey}/${name}`, content);
    const entry = { channel: channelKey, topic: T.topic, format: T.format, status: "not_run" };
    summary.push(entry);
    const writeSummary = () => { tools.write("quality-summary.json", summary.map(({ finalText, ...rest }) => rest)); tools.write("scripts-summary.md", summaryMd(summary)); };
    if (Date.now() - started > BUDGET_MS) { entry.status = "not_run"; entry.reason = "the run's time budget was spent before this channel started"; writeSummary(); tools.stage("blocked", "not_run", { channel: channelKey, issues: entry.reason }); continue; }
    try {
      const channel = channelConfig(channelKey, T.format);
      // 1. fetch the sources (real pages; nothing substituted when one fails)
      const sources = [], fetchLog = [];
      for (const [i, url] of T.sources.entries()) {
        try { const s = await fetchSource({ source_id: `s${i + 1}`, url }); sources.push(s); fetchLog.push({ source_id: s.source_id, url, ok: true, chars: s.text.length, sha256: createHash("sha256").update(s.text).digest("hex").slice(0, 16), title: s.title, published: s.published, fetched_at: s.fetched_at }); }
        catch (e) { fetchLog.push({ url, ok: false, error: String(e.message).slice(0, 200) }); }
      }
      entry.sources = fetchLog;
      if (!sources.length || !sources.some((s) => s.text.length > 1500)) {
        entry.status = "blocked_input"; entry.reason = "no source page could be fetched";
        put("quality-report.json", { status: entry.status, reason: entry.reason, fetch: fetchLog }); writeSummary(); tools.stage("blocked", "failed", { channel: channelKey, issues: entry.reason }); continue;
      }
      const wpm = measure(channel.ttsVoice);
      entry.wpm = wpm;

      const drafts = [];
      const result = await runEngine({
        channelKey, format: T.format, topic: T.topic, angle: T.angle, sources, llm, wpm, production_run: runId, profileOverrides: T.overrides || {}, maxRevisions: 3,
        onProgress: (ev) => {
          if (ev.event === "claims") { put("claims.json", { fetched: fetchLog, claims: ev.claims, dropped_by_code: ev.dropped, sources: ev.sources }); tools.stage("research_complete", "ok", { channel: channelKey, claims: ev.claims.length }); }
          if (ev.event === "blueprint") { put("blueprint.json", { blueprint: ev.blueprint, ...ev.report }); put("story-outline.md", outlineMd(ev.blueprint, ev.report.removed_beats)); tools.stage("blueprint_complete", "ok", { channel: channelKey }); }
          if (ev.event === "draft") {
            drafts.push(ev.pkg);
            if (ev.round === 1 || drafts.length === 1) { put("script-draft.md", draftMd(`${channel.name}: first draft (NOT reviewed yet)`, ev.pkg)); tools.stage("script_complete", "ok", { channel: channelKey, round: ev.round }); }
            else put("script-revised.md", draftMd(`${channel.name}: revision ${ev.round - 1} (draft ${ev.round})`, ev.pkg, "Status: revision after review findings; not yet approved.\n\n"));
          }
        },
      });
      entry.status = result.status;
      entry.rounds = result.report.rounds.length;
      entry.narrowings = result.report.narrowings;
      entry.providers = result.report.providers;
      entry.calls = result.report.calls.length;
      entry.caveats = result.report.caveats;
      const report = { ...result.report, fetch: fetchLog };
      if (result.error) report.error = result.error;
      if (result.report.last_critique) put("critique.json", result.report.last_critique);

      if (result.status === "approved") {
        const pkg = result.package;
        entry.finalText = pkg.sentences.map((s) => s.text).join(" ");
        // The approved script is voiced with the channel's real voice and the length measured.
        let narration_s = null;
        try { const mp3 = tools.voice({ text: entry.finalText, voice: channel.ttsVoice, output: `${channelKey}/voice-preview.mp3` }); narration_s = Math.round(tools.durationOf(mp3) * 10) / 10; }
        catch (e) { report.caveats = [...(report.caveats || []), `narration could not be voiced: ${String(e.message).slice(0, 160)}`]; }
        const dur = durationProblems({ estimate_s: pkg.duration_estimate_s, narration_s, max_s: channel.profile.maxSeconds, min_s: channel.profile.minSeconds });
        report.duration_check = { estimate_s: pkg.duration_estimate_s, narration_s, mp4_s: null, note: "No MP4 exists at this stage; the MP4 comparison runs when a channel renders it.", problems: dur };
        entry.duration = report.duration_check;
        if (dur.some((d) => d.severity === "critical")) { entry.status = "blocked_duration"; report.status = entry.status; }
        put("script-package.json", pkg);
        put("scene-seeds.json", result.scene_seeds);
        put("script-final.md", draftMd(`${channel.name}: FINAL (approved by ${pkg.quality_report.approved_by})`, pkg, `Written by ${pkg.quality_report.written_by}. Independent provider: ${pkg.quality_report.independent_provider}.\nMeasured narration: ${narration_s ?? "not measured"}s against an estimate of ${pkg.duration_estimate_s}s.\n\n`));
        put("quality-report.json", report);
        writeSummary();
        tools.stage(entry.status === "approved" ? "script_approved" : "blocked", entry.status === "approved" ? "ok" : "failed", { channel: channelKey, issues: entry.status === "approved" ? undefined : "narration is longer than the length allows" });
      } else {
        const last = result.rejected_draft || drafts.at(-1);
        if (last) { entry.finalText = last.sentences.map((s) => s.text).join(" "); entry.notApproved = true; put("script-rejected-draft.md", draftMd(`${channel.name}: NOT APPROVED (${result.status})`, last, `This draft did NOT pass review. Open findings: ${JSON.stringify((result.findings || []).slice(0, 12).map((f) => `${f.rule}: ${f.problem}`))}\n\n`)); }
        entry.reason = result.error || (result.findings || []).slice(0, 4).map((f) => `${f.rule}: ${f.problem}`).join(" | ") || result.report.blocked?.detail;
        put("quality-report.json", { ...report, open_findings: result.findings || [] });
        writeSummary();
        tools.stage("blocked", "failed", { channel: channelKey, issues: `${result.status}: ${String(entry.reason).slice(0, 300)}` });
      }
    } catch (e) {
      entry.status = "engine_error"; entry.reason = String(e.stack || e).slice(0, 600);
      put("quality-report.json", { status: entry.status, error: entry.reason }); writeSummary();
      tools.stage("blocked", "failed", { channel: channelKey, issues: `engine_error: ${String(e.message).slice(0, 200)}` });
    }
    await sleep(3000);
  }
  writeFinal(tools, summary);
}

function summaryMd(summary) {
  const lines = ["# Script engine: live preview, all channels\n", "Each script below was produced by the engine from pages fetched during this run. Only entries marked APPROVED passed every gate and an independent critic. Anything else is shown for transparency and must not be narrated.\n"];
  for (const e of summary) {
    lines.push(`## ${e.channel} - ${e.status.toUpperCase()}${e.status === "approved" ? " (APPROVED)" : ""}`, `Topic: ${e.topic} (${e.format})`);
    if (e.providers) lines.push(`Writer providers: ${e.providers.writer.join(", ") || "none"}; critic providers: ${e.providers.critic.join(", ") || "none"}; model calls: ${e.calls}; rounds: ${e.rounds}; narrowings: ${e.narrowings}`);
    if (e.wpm) lines.push(`Words per minute: ${e.wpm.wpm} (${e.wpm.source}, voice ${e.wpm.voice || "n/a"})`);
    if (e.duration) lines.push(`Duration: estimate ${e.duration.estimate_s}s, measured narration ${e.duration.narration_s ?? "n/a"}s`);
    if (e.caveats?.length) lines.push(`Caveats: ${e.caveats.join(" ")}`);
    if (e.reason) lines.push(`Why not approved: ${e.reason}`);
    if (e.finalText) lines.push(e.notApproved ? "\nLast draft (NOT APPROVED):" : "\nFinal script:", `> ${e.finalText}`);
    lines.push("");
  }
  return lines.join("\n");
}

function writeFinal(tools, summary) {
  const approved = summary.filter((e) => e.status === "approved").length;
  tools.write("quality-summary.json", summary.map(({ finalText, ...rest }) => rest));
  tools.write("scripts-summary.md", summaryMd(summary));
  tools.stage("preview_ready", "ok", { issues: `${approved} of ${summary.length} channels approved` });
}
