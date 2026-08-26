/**
 * Channel-specific visual vocabulary (PART 15).
 *
 * PURE module. The RENDERER is shared; the vocabulary is not. A finance
 * channel explaining a number should reach for a balance/ledger reading of
 * it; a legal channel should reach for the document the number came from;
 * a geopolitics channel should reach for the map.
 *
 * DERIVED FROM THE REAL config/channels.json, NOT INVENTED (PART 15 is
 * explicit about this). The six motion-graphics channels that exist today:
 *
 *   ch-01  Personal Finance (Budgeting for Beginners)   -> finance
 *   ch-02  Legal Education (Know Your Rights)           -> legal
 *   ch-09  Geopolitical Explainers (Maps & Power)       -> geopolitical
 *   ch-26  Financial Crimes & Heists                    -> finance
 *   ch-44  Professional Skill Development               -> process
 *   ch-48  Industrial Manufacturing Explainers          -> process
 *
 * There is no motion-graphics AI/tech channel at present — ch-03 (AI Tool
 * Reviews) is `minimal` style and ch-35 (Real Engineering) is
 * `cinematic-documentary`, and neither routes through this file. The `tech`
 * grammar below is still defined because the classifier can legitimately
 * read a tech concept inside any channel (an industrial channel describing
 * a control system), but no channel is *assigned* to it — assigning one
 * would be inventing a channel.
 *
 * A grammar only ever REORDERS strategies the director already considers
 * valid. It can never conjure a strategy whose data requirements are unmet,
 * so a finance channel with no numbers still can't render a chart.
 */

/** Domain -> the strategies that domain explains things WITH, best first. */
export const GRAMMARS = {
  finance: {
    label: "money flows, balances, ledgers, comparisons",
    prefer: ["ACCUMULATION", "TRANSFORMATION", "DATA_CHART", "COMPARISON", "SCALE_COMPARISON", "TIMELINE"],
    demote: ["DOCUMENT_EVIDENCE", "VISUAL_METAPHOR"],
  },
  legal: {
    label: "documents, clauses, jurisdictions, case timelines",
    prefer: ["DOCUMENT_EVIDENCE", "TIMELINE", "COMPARISON", "GEOSPATIAL_RADIUS", "CAUSE_EFFECT", "BEFORE_AFTER"],
    demote: ["INTERFACE_SIMULATION", "ACCUMULATION"],
  },
  geopolitical: {
    label: "maps, borders, territory, relationships between powers",
    prefer: ["GEOSPATIAL_RADIUS", "RELATIONSHIP", "TIMELINE", "COMPARISON", "CAUSE_EFFECT"],
    demote: ["INTERFACE_SIMULATION", "ACCUMULATION"],
  },
  history: {
    label: "archives, documents, maps, artifacts, chronology",
    prefer: ["TIMELINE", "DOCUMENT_EVIDENCE", "IMAGE_EVIDENCE", "GEOSPATIAL_RADIUS", "BEFORE_AFTER"],
    demote: ["INTERFACE_SIMULATION"],
  },
  process: {
    label: "stages, systems, workflows, throughput",
    prefer: ["PROCESS", "CAUSE_EFFECT", "TRANSFORMATION", "DATA_CHART", "RELATIONSHIP", "BEFORE_AFTER"],
    demote: ["VISUAL_METAPHOR", "DOCUMENT_EVIDENCE"],
  },
  tech: {
    label: "interfaces, systems, data flows, benchmarks",
    prefer: ["INTERFACE_SIMULATION", "PROCESS", "DATA_CHART", "BEFORE_AFTER", "RELATIONSHIP"],
    demote: ["DOCUMENT_EVIDENCE", "VISUAL_METAPHOR"],
  },
  general: {
    label: "no channel-specific bias",
    prefer: [],
    demote: [],
  },
};

/**
 * Map a real channel record to a grammar. Matches on the channel's own
 * `niche` / `content_pillars` text so a channel added to channels.json
 * later gets a sensible grammar without this file needing a new hardcoded
 * id — and so this never claims to know a channel that doesn't exist.
 */
export function grammarForChannel(channel) {
  if (!channel) return GRAMMARS.general;
  const hay = [
    channel.niche,
    channel.channel_name,
    ...(Array.isArray(channel.content_pillars) ? channel.content_pillars : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(legal|law|rights|court|attorney|justice|conviction|statute)\b/.test(hay)) return GRAMMARS.legal;
  if (/\b(geopolit|border|territor|map|power|nation|sovereign)\b/.test(hay)) return GRAMMARS.geopolitical;
  if (/\b(finance|financial|money|budget|debt|invest|heist|fraud|bank|saving)\b/.test(hay)) return GRAMMARS.finance;
  if (/\b(history|historical|archive|ancient|epoch|war|empire|cold case)\b/.test(hay)) return GRAMMARS.history;
  if (/\b(manufactur|industrial|engineering|factory|production|skill|career|process)\b/.test(hay)) return GRAMMARS.process;
  if (/\b(ai|artificial intelligence|software|tech|tool review|app|startup|computer)\b/.test(hay)) return GRAMMARS.tech;
  return GRAMMARS.general;
}

/**
 * Apply the grammar as a score nudge. Deliberately small: evidence from the
 * text always outranks channel habit, so a legal channel that genuinely
 * describes an accumulating total still gets ACCUMULATION. The grammar only
 * decides near-ties.
 */
export function grammarBias(grammar, strategy) {
  if (!grammar) return 0;
  const preferIdx = (grammar.prefer || []).indexOf(strategy);
  if (preferIdx >= 0) return 0.12 - preferIdx * 0.015;
  if ((grammar.demote || []).includes(strategy)) return -0.1;
  return 0;
}
