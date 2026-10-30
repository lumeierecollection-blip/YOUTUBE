/**
 * Enforces a channel's niche_rules on discovery candidates BEFORE one is reserved (run 41030159423: the celebrity channel picked a church
 * abuse settlement: not a celebrity story, and abuse is exactly what keeps a channel limited-ads). A prompt can ask; this decides.
 *
 *   1. niche_blocklist (config/channels.json): regex sources matched against the title + angle. A hit rejects the candidate. Deterministic.
 *   2. niche fit (optional, NICHE_JUDGE=1): one model call per candidate asks whether the topic belongs to the channel's niche and breaks
 *      none of its rules. A "no" rejects. If the model cannot answer the candidate is KEPT (the blocklist still applied): a quota error must
 *      not silence a channel.
 * If every candidate is rejected the validator exits 1 (the workflow re-asks with the reasons, then skips the channel for the day).
 */
export function blocklistHit(topic, channel) {
  const text = `${topic?.topic || ""} ${topic?.angle || ""}`;
  for (const src of channel?.niche_blocklist || []) {
    let re;
    try { re = new RegExp(src, "i"); } catch { continue; }
    const m = text.match(re);
    if (m) return `contains "${m[0]}", which this channel's niche rules rule out`;
  }
  return null;
}

export function fitPrompt(topic, channel) {
  return `A YouTube channel has this niche: "${channel.niche}".
It covers these content pillars (a topic that fits ANY ONE of them belongs to the niche, even if the niche title names only one of them):
${(channel.content_pillars || []).map((r) => `- ${r}`).join("\n")}
Its rules (hard limits):
${(channel.niche_rules || []).map((r) => `- ${r}`).join("\n")}

Candidate video topic: "${topic.topic}"
Angle: "${topic.angle || ""}"

Does the topic fit at least one pillar AND break none of the rules (e.g. it rests on an unproven allegation, needs clips or artwork we cannot show, is advice, or is not about what the niche covers)?
Answer ONLY JSON: {"fits": true|false, "reason": "<12 words>"}`;
}

export function parseFit(answer) {
  let obj = answer;
  if (answer && typeof answer.content === "string") {
    const m = answer.content.match(/\{[\s\S]*\}/);
    try { obj = m ? JSON.parse(m[0]) : null; } catch { obj = null; }
  }
  if (!obj || typeof obj.fits !== "boolean") return null; // no usable answer: the caller keeps the candidate
  return obj;
}

/** ask(prompt) -> model answer; injected for tests. Returns { kept, rejected:[{topic, reject_reason}] }. */
export async function guardTopics(topics, channel, { ask = null, log = console.log } = {}) {
  const kept = [], rejected = [];
  for (const t of topics) {
    const hit = blocklistHit(t, channel);
    if (hit) { rejected.push({ ...t, reject_reason: hit }); log(`[niche-guard] REJECTED "${t.topic}": ${hit}`); continue; }
    if (ask && (channel?.niche_rules || []).length) {
      let verdict = null;
      try { verdict = parseFit(await ask(fitPrompt(t, channel))); } catch { verdict = null; }
      if (verdict && verdict.fits === false) {
        const why = `not in the niche or breaks its rules (${String(verdict.reason || "no reason").slice(0, 100)})`;
        rejected.push({ ...t, reject_reason: why });
        log(`[niche-guard] REJECTED "${t.topic}": ${why}`);
        continue;
      }
      if (!verdict) log(`[niche-guard] no answer for "${t.topic}"; kept (the blocklist passed)`);
    }
    kept.push(t);
  }
  return { kept, rejected };
}

export function defaultAsk() {
  return async (prompt) => {
    const { callLLM } = await import("../../src/lib/llm.js");
    return callLLM([{ role: "user", content: prompt }], { maxTokens: 200, temperature: 0, keepAlive: 0 }, "niche-guard");
  };
}
