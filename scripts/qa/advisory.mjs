// ADVISORY defect report for render-and-qa.js: merges objective checks with the existing sidecars. Never gates anything.
import { existsSync, readFileSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runObjectiveChecks } from "./objective-checks.mjs";
import { buildSceneBriefs } from "../direction/scene-brief.mjs";
import { checkBriefsAgainstRender } from "../direction/check-briefs.mjs";
import { locateInputs, loadChannel, readJson as readJsonStrict, writeBriefs } from "../direction/brief-cli.mjs";
import { fromLocalAudit, fromBeatCheck, fromCameraCheck, writeDefectReport } from "./defects.mjs";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "skills", "remotion-render", "public");
const readJson = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; } catch { return null; } };

// Scene-brief criteria (scripts/direction): advisory, synchronous, never throws. Inputs are located by render-and-qa.js naming
// (see locateInputs); when any is missing the reason is logged and nothing is added.
function briefDefects(videoPath, manifest) {
  try {
    const loc = locateInputs(videoPath);
    if (loc.skip) { console.log(`[scene-briefs] skipped: ${loc.skip}`); return []; }
    const { paths } = loc;
    const briefs = buildSceneBriefs({
      script: readJsonStrict(paths.script), research: readJsonStrict(paths.research), plan: readJsonStrict(paths.plan), manifest,
      channel: loadChannel(loc.channelId), grammar: readJsonStrict(join(PUBLIC, "..", "..", "..", "..", "config", "clone-grammar.json")),
    });
    writeBriefs(briefs, dirname(videoPath), basename(videoPath, ".mp4"));
    return checkBriefsAgainstRender(briefs, { manifest, publicDir: PUBLIC }).new_defects;
  } catch (e) { console.log(`[scene-briefs] skipped: ${e.message}`); return []; }
}

export function writeAdvisoryDefects(videoPath, { verdict = null, srtPath = null } = {}) {
  const base = videoPath.replace(/\.mp4$/, "");
  const manifest = readJson(`${base}-manifest.json`);
  const format = manifest?.format || (/longform/.test(basename(videoPath)) ? "longform" : "shorts");
  const beatTimes = (manifest?.beats || []).map((b) => (b.start_sec ?? 0) + (b.duration_sec ?? 0) / 2);
  const defects = [
    ...runObjectiveChecks(videoPath, { format, fps: manifest?.fps || 30, srtPath, manifest, publicDir: PUBLIC }),
    ...fromLocalAudit(readJson(`${base}-local-audit.json`)),
    ...fromLocalAudit(readJson(`${base}-backup-audit.json`)),
    ...fromBeatCheck(readJson(`${base}-beat-check.json`), { beatTimes }),
    ...fromCameraCheck(readJson(`${base}-camera-check.json`), { beatTimes }),
    ...(manifest ? briefDefects(videoPath, manifest) : []),
  ];
  return writeDefectReport(dirname(videoPath), basename(base), defects, { advisory: true, queue_verdict: verdict, format });
}
