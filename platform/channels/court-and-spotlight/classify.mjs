/**
 * Story classification, run before script and scene production. It looks at the central question, the story category and the
 * evidence available, picks ONE dominant format, and records why. A story is never forced into a format that does not suit it.
 * Deterministic on purpose: the same inputs give the same routing, and the reasons are saved with the production metadata.
 */
const RULES = [
  { format: "investigation", subject: "Alleged crime or legal case, arrest, prison, documented dispute, or fact-check of a viral claim", re: /\b(arrest|arrested|mugshot|mug shot|prison|jail|sentenc|convict|acquit|indict|charged|lawsuit|sued|court|trial|verdict|alleg|fraud|tax case|feud|dispute|fact[- ]?check|viral claim|investigat)/i },
  { format: "entertainment_magazine", subject: "Awards, achievements, career milestones, fashion, collections, iconic moments", re: /\b(award|grammy|oscar|emmy|record[- ]breaking|milestone|achievement|collection|fashion|red carpet|iconic|career highlight|wins?|trophy)/i },
  { format: "vox_explainer", subject: "Cultural influence, why a celebrity became famous, comparisons, cultural analysis", re: /\b(why did|how did|influence|influential|cultural|compare|comparison|versus|vs\.?|rivalry|changed the|transformed|became (so )?famous|phenomenon|economics|impact)/i },
];

export function classifyStory({ topic, central_question = "", category = "", evidence = [] }) {
  const text = [topic, central_question, category].join(" ");
  const hits = RULES.map((r) => ({ format: r.format, subject: r.subject, matches: [...new Set((text.match(new RegExp(r.re.source, "gi")) || []).map((m) => m.toLowerCase()))] })).filter((h) => h.matches.length);
  // Ties go to the format that best serves the main question: legal material outranks the rest, because that framing carries legal risk.
  const order = ["investigation", "vox_explainer", "entertainment_magazine"];
  hits.sort((a, b) => b.matches.length - a.matches.length || order.indexOf(a.format) - order.indexOf(b.format));
  const chosen = hits[0]?.format || "vox_explainer";
  return {
    format: chosen,
    reasoning: hits.length ? `Matched ${hits[0].subject}: ${hits[0].matches.join(", ")}.` : "No rule matched; defaulted to the explainer format.",
    alternatives: hits.slice(1).map((h) => ({ format: h.format, matches: h.matches })),
    evidence_available: evidence,
    hybrid: hits.length > 1 ? "Overlapping signals; one primary style stays dominant and the others are not mixed in." : null,
  };
}
