const words = (x) => String(x || "").trim().split(/\s+/).filter(Boolean);
const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function validateRivalLinesScript(script) {
  const errors = [];
  const sections = Array.isArray(script?.sections) ? script.sections : [];
  const hook = String(script?.hook || sections[0]?.voiceover || "").trim();
  if (hook.length < 35 || hook.length > 260) errors.push("opening hook must be 35–260 characters and establish the story immediately");
  if (/^(in today's video|today we (are|will)|welcome back|hello everyone|in this video)\b/i.test(hook)) errors.push("generic channel introduction is forbidden; lead with the football story");
  const players = [...new Set((script?.named_entities || []).filter((x) => x?.type === "person").map((x) => String(x.name || "").trim()).filter(Boolean))];
  const storyText = [hook, ...sections.map((s) => s.voiceover)].join(" ");
  for (const player of players) if (!norm(storyText).includes(norm(player))) errors.push(`named player ${player} is not introduced in the narration`);
  const full = sections.map((s) => String(s.voiceover || "")).join(" ");
  if (sections.length < 3) errors.push("football documentary needs at least three narrative sections");
  if (words(full).length < 220) errors.push("script is too short to establish context, evidence, analysis, and conclusion");
  const sources = new Set((script?.sources_used || []).map((s) => typeof s === "string" ? s : s?.url).filter(Boolean));
  const matches = Array.isArray(script?.match_evidence) ? script.match_evidence : [];
  for (const m of matches) {
    if (!m.player || !m.club || !m.match || !m.event) errors.push("each match_evidence item must name player, club, match, and event");
    if (!m.source_url || !sources.has(m.source_url)) errors.push(`match evidence ${m.match || "(unnamed)"} must cite a URL in sources_used`);
    if (!m.narration_ref) errors.push(`match evidence ${m.match || "(unnamed)"} must reference a narration section`);
  }
  const major = Array.isArray(script?.major_claims) ? script.major_claims : [];
  for (const c of major) if (!String(c.claim || "").trim() || !c.source_url || !sources.has(c.source_url)) errors.push("each major analytical claim must link to a source listed in sources_used");
  if (players.length && !matches.some((m) => players.includes(m.player))) errors.push("a named player has no sourced match example");
  if (!script?.ending || String(script.ending).trim().length < 30) errors.push("a distinct narrative conclusion is required");
  return { ok: errors.length === 0, hook, hook_words: words(hook).length, sections: sections.length, errors };
}

if (process.argv[1]?.endsWith("rival-lines-script-gate.mjs")) {
  const fs = await import("node:fs");
  const p = process.argv[2];
  if (!p) { console.error("Usage: node scripts/rival-lines-script-gate.mjs <script.json>"); process.exit(2); }
  const result = validateRivalLinesScript(JSON.parse(fs.readFileSync(p, "utf8")));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
