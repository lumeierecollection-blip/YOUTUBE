// Rival Lines preview. The branch picks the format: preview/rival-lines-final (match analysis) or preview/rival-lines-messi (player documentary).
// Pipeline per run: StatsBomb data + mplsoccer graphics (Python) -> real Commons photographs -> voice, timeline, render and QA (shared path).
// Every research artefact is written next to the video so a failed render can be resumed and every claim traced.
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFixedShort } from "../../production/fixed-short.mjs";
import { commonsAsset, dataUri } from "../../production/commons.mjs";
import { discover } from "./topics.mjs";
import { compactScenes, fitScript } from "../../production/fitscript.mjs";
import { narrate } from "../../production/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../..");
const channel = JSON.parse(readFileSync(join(here, "channel.json"), "utf8"));
const py = process.platform === "win32" ? "python" : "python3";
const UA = { "User-Agent": "RivalLines/1.0 (football analysis)" };
const CALIBRATION = "Barcelona won the league on the final day. The striker scored twice in the second half, and the goalkeeper saved a late penalty. It was the club's tenth title in twelve years, and the crowd stayed long after the final whistle.";

function analyse(script, outDir, cache) {
  mkdirSync(outDir, { recursive: true });
  const r = spawnSync(py, [join(here, script), outDir, cache], { encoding: "utf8", timeout: 1500000, cwd: here, maxBuffer: 1e8 });
  process.stdout.write(String(r.stdout || ""));
  if (r.status !== 0) throw new Error(`${script} failed: ${String(r.stderr).split("\n").filter(Boolean).slice(-8).join(" | ").slice(0, 900)}`);
}

/** Every Wikipedia-based claim must find its exact text in the fetched article, or the run stops. */
async function verifyWikipedia(claims, title) {
  const j = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exintro=1&redirects=1&titles=${title}`, { headers: UA })).json();
  const text = Object.values(j.query.pages)[0].extract;
  for (const c of claims.filter((x) => x.must)) if (!text.includes(c.must)) throw new Error(`claim ${c.claim_id}: "${c.must}" not found in the fetched Wikipedia article`);
  return text.length;
}

export default async function preview({ key, runId, tools }) {
  const branch = process.env.GITHUB_REF_NAME || "";
  const mode = /messi|player/.test(branch) ? "player" : "match";
  const story = await import(mode === "player" ? "./messi-story.mjs" : "./final-story.mjs");
  const adir = join(tools.outDir, "analysis"), cache = join(ROOT, "output/sb-cache");

  // 1. Topic discovery against the real data repository (writes the ranked, de-duplicated backlog).
  try { tools.write("topic-backlog.json", (await discover()).backlog.map(({ editorial_scores, ...t }) => ({ ...t, editorial_scores }))); } catch (e) { tools.write("topic-backlog.json", { error: String(e.message || e) }); }

  // 2. Data and mplsoccer graphics.
  analyse(mode === "player" ? "analysis_messi.py" : "analysis_final.py", adir, cache);
  const data = JSON.parse(readFileSync(join(adir, mode === "player" ? "messi-data.json" : "match-data.json"), "utf8"));
  tools.write(mode === "player" ? "messi-data.json" : "match-data.json", data);
  tools.write("story-blueprint.json", { ...story.blueprint, format: mode === "player" ? "player_documentary" : "match_analysis" });
  tools.stage("research_complete", "ok");

  // 3. Images: analysis graphics, the StatsBomb logo, and (documentary) real licensed photographs.
  const images = { sbLogo: await dataUri(join(adir, "sb-logo.png")) }, credits = {}, entries = [];
  if (mode === "match") for (const [k, f] of Object.entries({ formArg: "formation_arg.png", formFra: "formation_fra.png", netArg: "network_arg.png", netFra: "network_fra.png", shotmap: "shotmap.png" })) images[k] = await dataUri(join(adir, f));
  else {
    await verifyWikipedia(story.claims, "Lionel_Messi");
    for (const a of story.ASSETS) {
      const { file, entry } = await commonsAsset({ title: a.title, dir: join(tools.outDir, "assets"), id: a.id, claim: a.claim, role: "photograph" });
      let used = file;
      if (a.cutout) {
        const cut = join(tools.outDir, "assets", `${a.id}-cutout.png`);
        const r = spawnSync(py, [join(ROOT, "platform/production/cutout.py"), file, cut, "--seed", "1", ...(a.cutout.model ? ["--model", a.cutout.model] : []), ...(a.cutout.crop ? ["--crop", a.cutout.crop] : [])], { encoding: "utf8", timeout: 900000 });
        if (r.status !== 0) throw new Error(`cut-out failed for ${a.id}: ${String(r.stderr).split("\n").slice(-5).join(" ").slice(0, 400)}`);
        used = cut; entry.treatment = "photographic cut-out (rembg); no pixel of the subject is generated.";
      }
      images[a.key] = await dataUri(used); credits[a.key] = entry.credit_line; entries.push(entry);
    }
  }
  tools.write("attribution.json", { statsbomb: { required: "credit StatsBomb and show the StatsBomb logo", logo_source: "https://github.com/statsbomb/open-data/tree/master/img", shown: "on every scene (attribution bar) and in the description", repo: "https://github.com/statsbomb/open-data" }, photographs: entries, data_classes: { verified_statistics: mode === "player" ? "career facts from Wikipedia (W claims)" : "match record (score, shootout)", event_data_derived: "everything else, computed from StatsBomb events", video_derived_estimates: "none used" } });
  tools.write("asset-manifest.json", { note: "Photographs are real Wikimedia Commons files. All tactical graphics are drawn by mplsoccer from recorded events. Nothing is AI-generated.", assets: entries });

  // 4. Voice, timeline, render, frames, QA. Voice only: no music has been licensed for this channel yet.
  // The 35 to 40 second rule: measure this voice's natural pace first, then choose the wording that fits. The voice is never sped up.
  let sentences = story.sentences, scenes = story.scenes;
  if (story.slots) {
    const cal = await narrate({ text: CALIBRATION, edgeVoice: channel.voice.tts, outDir: tools.outDir, name: "calibration", style: channel.voice.style });
    const fit = fitScript({ slots: story.slots, wpm: cal.wpm * 0.88, targetSeconds: 36.5, minSeconds: 35, maxSeconds: 38.5 });
    ({ scenes, sentences } = compactScenes({ scenes: story.scenes, sentences: fit.sentences }));
    tools.write("script-fit.json", { measured_wpm: cal.wpm, calibration_seconds: cal.seconds, voice: cal.engine, ...fit });
    console.log(`script fit: ${cal.wpm} wpm -> ${fit.words} words, about ${fit.estimated_seconds}s, kept ${fit.kept.join(",")}`);
  }
  const result = await runFixedShort({ key, runId, tools, spec: { topic: story.topic, claims: story.claims.map(({ must, ...c }) => c), sources: story.sources, sentences, scenes, compositionId: mode === "player" ? "RivalPlayerShort" : "RivalMatchShort", edgeVoice: channel.voice.tts, style: channel.voice.style, metadata: story.metadata, minSeconds: 34, maxSeconds: 40, refit: story.slots ? (wpm) => compactScenes({ scenes: story.scenes, sentences: fitScript({ slots: story.slots, wpm: wpm * 0.98, targetSeconds: 36.5, minSeconds: 35, maxSeconds: 38.5 }).sentences }) : undefined, makeProps: () => ({ images, credits, data }) } });
  tools.write("quality-report.json", { format: mode === "player" ? "player_documentary" : "match_analysis", technical: result.qa, data_note: "event data only; locations are where events were recorded" });
}
