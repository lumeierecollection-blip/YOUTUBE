#!/usr/bin/env node
// Writes docs/longform/episodes/<slug>/SCRIPT.md (narration with sources per beat) and the storyboard table from the episode modules, so the
// script and the storyboard can never drift from what the stills render. Usage: node platform/longform/v2/write-docs.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";

for (const ch of ["hidden-past", "ai-tested", "court-and-spotlight", "rival-lines"]) {
  const { EPISODE: e, SOURCES: S } = await import(`./episodes/${ch}.mjs`);
  const words = e.beats.map((b) => b.vo).join(" ").split(/\s+/).length;
  const md = [
    `# ${e.title}`, "", `Channel: **${ch}** · sample episode for the long-form v2 visual approval · ${e.beats.length} beats · ${words} words of narration (about ${(words / 165).toFixed(1)} min at 165 wpm; target for the full episode ${e.target_minutes} min).`, "",
    "> Status: condensed script. It covers the whole story arc in its final order, at storyboard density. Lengthening it to the target runs on the same sources and beats; every added sentence must cite a source below.", "",
    "## Sources", ...Object.entries(S).map(([k, s]) => `- **${k}**: ${s.title}. ${s.url || ""}${s.captured_from ? ` (captured from ${s.captured_from})` : ""}${s.status ? `, ${s.status}` : ""}`), "",
    "## Script and storyboard", "| Beat | Part | Narration | Picture (scene type) | Sources | Reference technique |", "|---|---|---|---|---|---|",
    ...e.beats.map((b) => `| ${b.id} | ${b.part} | ${b.vo.replace(/\|/g, "/")} | ${b.scene.type}${b.scene.date ? ` · ${b.scene.date}` : ""} | ${b.src.join(", ")} | ${b.ref.replace(/\|/g, "/")} |`), "",
    "## Transitions shown in the approval package", ...e.transitions.map((t) => `- ${t.name}: ${t.a} → ${t.b}, ${t.kind}, ${t.dur} frames. ${t.note}`), "",
    "## Thumbnail concepts", ...e.thumbs.map((t) => `- ${t.name}: "${(t.big || "").replace(/\n/g, " ")}" / "${t.small || ""}"`), "",
    "Stills: `output/longform-approval/" + ch + "/` (and the `longform-stills` workflow artifact). Storyboard sheet: `storyboard.jpg`.", "",
  ].join("\n");
  const dir = join(ROOT, "docs/longform/episodes", `${ch}-${e.slug}`); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SCRIPT.md"), md);
  console.log(ch, e.beats.length, "beats", words, "words");
}
