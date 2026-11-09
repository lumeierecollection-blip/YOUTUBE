/**
 * engine.mjs: claims -> blueprint -> script -> continuity -> independent critic -> traceability.
 * Only a script that survived every gate on the SAME draft leaves as `approved`. Everything else leaves with
 * an honest status and its reasons:
 *   approved            a critic other than the writer approved it and no gate has an open blocking finding
 *   rejected            the gates still found blocking problems after the allowed revisions
 *   rejected_blueprint  no story passed the blueprint checks, so no narration was written
 *   blocked_input       the research did not ground enough claims (the topic is skipped, nothing is invented)
 *   blocked_provider    no model provider could answer (quota, outage, no key); NOT a quality verdict
 *   blocked_model       a provider answered but kept returning unusable output
 * A script is never passed because a gate could not run.
 */
import { BlueprintRejected, buildBlueprint } from "./blueprint.mjs";
import { CHANNEL_RULES, channelConfig } from "./channels.mjs";
import { InsufficientEvidence, claimRecordProblems, extractClaims } from "./claims.mjs";
import { blocking, critical, deterministicContinuity, modelContinuity } from "./continuity.mjs";
import { critique } from "./critic.mjs";
import { capacityWords, durationProblems } from "./duration.mjs";
import { BadModelOutput, ProviderExhausted } from "./llm.mjs";
import { assertValid, validate } from "./schema.mjs";
import { sceneSeeds, scriptTraceability } from "./traceability.mjs";
import { validatePackage, writeScript } from "./writer.mjs";

const key = (x) => `${x.rule}|${x.sentence_ids.join(",")}|${x.problem}`;
const dedupe = (xs) => [...new Map(xs.map((x) => [key(x), x])).values()];
const toIssue = (x) => ({ sentence_ids: x.sentence_ids, problem: x.problem, fix: x.fix, severity: x.severity, rule: x.rule });

/** Everything that can be decided without a model. Also what the tests call on stored scripts. */
export function deterministicGates(pkg, { claims, channel, wpm }) {
  const claimsOf = (s) => s.claim_ids.map((id) => claims.find((c) => c.claim_id === id)).filter(Boolean);
  const out = [
    ...deterministicContinuity(pkg, { claims, profile: channel.profile, channel }),
    ...scriptTraceability(pkg, claims),
    ...channel.rules.script({ sentences: pkg.sentences, claimsOf, claims, blueprint: pkg.blueprint }),
    ...durationProblems({ estimate_s: pkg.duration_estimate_s, max_s: channel.profile.maxSeconds, min_s: channel.profile.minSeconds }).map((d) => ({ rule: "DUR-01", sentence_ids: [], ...d })),
  ];
  const honest = pkg.hook_options.filter((h) => h.honest).length;
  if (honest < 2) out.push({ rule: "HOOK-01", severity: "major", category: "misleading_claim", sentence_ids: ["s1"], problem: `Only ${honest} of ${pkg.hook_options.length} hook options are honest; the strongest honest one cannot be chosen from fewer than two.`, fix: "Write more hooks that use only established figures and names and promise only what the payoff delivers." });
  out.push(...claimRecordProblems(pkg.claims).map((p) => ({ rule: "CLM-01", severity: "critical", category: "unsupported_claim", sentence_ids: [], problem: p, fix: "Repair the claim record." })));
  const schema = validate("script-package", pkg);
  for (const e of schema) out.push({ rule: "PKG-01", severity: "critical", category: "missing_context", sentence_ids: [], problem: `script package invalid: ${e}`, fix: "Fix the package." });
  return dedupe(out);
}

const summarise = (xs) => ({ critical: xs.filter((x) => x.severity === "critical").length, major: xs.filter((x) => x.severity === "major").length, minor: xs.filter((x) => x.severity === "minor").length });

export async function runEngine({ channelKey, format = "short", topic, angle, sources = null, claimResult = null, llm, wpm, maxRevisions = 2, maxNarrowings = 2, production_run = "run", profileOverrides = {}, onProgress = () => {} }) {
  const channel = channelConfig(channelKey, format);
  channel.profile = { ...channel.profile, ...profileOverrides };
  const ctx = { llm, calls: [] };
  const report = { channel: channelKey, format, topic, angle, status: "pending", wpm, limits: { target_s: channel.profile.targetSeconds, max_s: channel.profile.maxSeconds }, rounds: [], narrowings: 0, caveats: [], unreviewed_script_released: false };
  const finish = (status, extra = {}) => {
    report.status = status;
    report.calls = ctx.calls.map(({ role, tag, attempt, provider, ms, error, ok, same_provider, chain }) => ({ role, tag, attempt, provider, ms, error, ok, same_provider, chain }));
    report.providers = { writer: [...new Set(ctx.calls.filter((c) => c.role === "writer").map((c) => c.provider).filter(Boolean))], critic: [...new Set(ctx.calls.filter((c) => c.role === "critic").map((c) => c.provider).filter(Boolean))] };
    return { status, report, ...extra };
  };
  try {
    // 1. claims
    if (!claimResult) {
      claimResult = await extractClaims(ctx, { channel, topic, angle, sources });
      onProgress({ event: "claims", claims: claimResult.claims, dropped: claimResult.dropped, sources: claimResult.sources });
    }
    const { claims } = claimResult;
    report.claims = { count: claims.length, dropped: claimResult.dropped || [], sources: claimResult.sources };

    let blueprintResult = null, narrowTo = null, capacity = capacityWords(channel.profile.targetSeconds, wpm.wpm), targetSeconds = channel.profile.targetSeconds;
    let previous = null, issues = [], writerProvider = null, rounds = 0, trimmed = false;
    const drafts = [];
    for (;;) {
      // 2. blueprint (rebuilt when the story has to be narrowed)
      if (!blueprintResult) {
        blueprintResult = await buildBlueprint(ctx, { channel, topic, angle, claims, capacityWords: capacity, targetSeconds, narrowTo });
        report.blueprint = { attempts: blueprintResult.attempts, removed_beats: blueprintResult.removed, checks: blueprintResult.checks, history: blueprintResult.history };
        onProgress({ event: "blueprint", blueprint: blueprintResult.blueprint, report: report.blueprint });
        previous = null; issues = []; rounds = 0; trimmed = false;
      }
      const blueprint = blueprintResult.blueprint;

      // 3. one draft, then every gate on that draft
      const claimsOf = (s) => (s.claim_ids || []).map((id) => claims.find((c) => c.claim_id === id)).filter(Boolean);
      const hookReject = (h) => CHANNEL_RULES[channelKey]?.script?.({ sentences: [{ sentence_id: "hook", text: h.text, claim_ids: h.claim_ids || [] }], claimsOf, claims, blueprint }).some((x) => x.severity === "critical" && x.sentence_ids.includes("hook"));
      const w = await writeScript(ctx, { channel, topic, blueprint, claims, wpm, previous, issues, targetSeconds, hookReject });
      writerProvider = w.provider;
      rounds++;
      const round = { round: rounds, writer_provider: w.provider, words: w.words ?? null };
      report.rounds.push(round);
      if (!w.pkg) {
        round.hook_rejections = w.noHonestHook;
        issues = [{ sentence_ids: ["s1"], problem: `No honest hook among the options: ${w.noHonestHook.join(" | ")}`, fix: "Write hooks that use only claimed figures and names and promise only what the payoff delivers." }];
        if (rounds > maxRevisions) return finish("rejected", { drafts, blueprint, claims, reason: "no honest hook" });
        previous = { hook_options: w.hooks.options, sentences: w.raw.sentences };
        continue;
      }
      const pkg = w.pkg;
      assertValid("script-package", pkg);
      drafts.push(pkg);
      onProgress({ event: "draft", round: rounds, pkg });

      const det = deterministicGates(pkg, { claims, channel, wpm });
      round.deterministic = { ...summarise(det), findings: det };
      if (process.env.SCRIPT_ENGINE_DEBUG) console.error(`[engine] round ${rounds} deterministic:\n${det.map((d) => `  ${d.severity} ${d.rule} ${d.sentence_ids.join(",")} ${d.problem}`).join("\n")}`);
      // Over length: trim once; if still over (or far over), narrow the story. The voice is never sped up.
      const over = pkg.duration_estimate_s > channel.profile.maxSeconds;
      if (over && (trimmed || pkg.duration_estimate_s > channel.profile.maxSeconds * 1.2) && report.narrowings < maxNarrowings) {
        report.narrowings++;
        narrowTo = `Narrower than "${blueprint.central_question}": the last script ran ${pkg.duration_estimate_s}s against a limit of ${channel.profile.maxSeconds}s. Ask a smaller question that fewer beats can answer.`;
        capacity = Math.floor(capacity * 0.8); targetSeconds = targetSeconds * 0.8;
        round.action = "narrow"; blueprintResult = null; continue;
      }
      if (over) trimmed = true;

      let all = [...det];
      let model = null, crit = null;
      if (!blocking(det).length) {
        model = await modelContinuity(ctx, { pkg, claims, channel, known: det });
        round.continuity_model = { understood_when_heard_once: model.understood_when_heard_once, findings: model.findings, same_provider: model.same_provider };
        all = [...all, ...model.findings];
        if (!blocking(model.findings).length) {
          crit = await critique(ctx, { pkg, claims, channel, known: det, writerProvider, wpm, limit: channel.profile.maxSeconds });
          round.critic = { reviewer: crit.reviewer, verdict: crit.verdict, critic_verdict: crit.critic_verdict, verdict_overridden: crit.verdict_overridden, scores: crit.scores, same_provider: crit.same_provider, blocking_reasons: crit.blocking_reasons };
          report.last_critique = crit;
          if (crit.verdict === "approve") {
            const seeds = sceneSeeds(pkg, wpm, { channel: channelKey, production_run });
            pkg.quality_report = {
              status: "approved", approved_by: crit.reviewer, written_by: `writer/${writerProvider}`, independent_provider: !crit.same_provider, scores: crit.scores,
              deterministic: summarise(det), minor_findings: det.filter((x) => x.severity === "minor").length, rounds, wpm,
            };
            assertValid("script-package", pkg);
            report.final = { sentences: pkg.sentences.length, words: pkg.sentences.map((s) => s.text).join(" ").split(/\s+/).length, duration_estimate_s: pkg.duration_estimate_s };
            if (crit.same_provider) report.caveats.push("The critic ran on the same provider as the writer (no other provider had a key); it was a separate role and prompt, not a separate model family.");
            if (wpm.source !== "measured") report.caveats.push("Duration used the default words-per-minute, not a measured one.");
            return finish("approved", { package: pkg, blueprint, claims, critique: crit, scene_seeds: seeds, drafts });
          }
          all = [...all, ...crit.findings, ...crit.required_corrections.map((c) => ({ rule: "CRITIC", severity: "major", category: "missing_context", sentence_ids: [], problem: c, fix: c })), ...crit.blocking_reasons.filter((r) => !/finding:/.test(r)).map((r) => ({ rule: "CRITIC", severity: "major", category: "missing_context", sentence_ids: [], problem: r, fix: "Correct it." }))];
        }
      }
      const todo = dedupe(all.filter((x) => x.severity !== "minor"));
      round.open_findings = summarise(todo);
      if (rounds > maxRevisions) {
        pkg.quality_report = { status: "rejected", reason: "blocking findings remained after the allowed revisions", open: summarise(todo) };
        return finish("rejected", { drafts, rejected_draft: pkg, claims, blueprint, findings: todo, critique: crit });
      }
      previous = pkg; issues = todo.map(toIssue);
    }
  } catch (e) {
    if (e instanceof ProviderExhausted) { report.blocked = { role: e.role, detail: e.detail, chain: e.chain }; return finish("blocked_provider", { error: e.message }); }
    if (e instanceof BadModelOutput) { report.blocked = { role: e.role, detail: e.detail }; return finish("blocked_model", { error: e.message }); }
    if (e instanceof InsufficientEvidence) { report.blocked = { detail: e.message, dropped: e.dropped }; return finish("blocked_input", { error: e.message }); }
    if (e instanceof BlueprintRejected) { report.blocked = { issues: e.issues }; return finish("rejected_blueprint", { error: e.message, issues: e.issues }); }
    throw e;
  }
}

export { critical, blocking };
