// ADVISORY defect report for render-and-qa.js: merges objective checks with the existing sidecars. Never gates anything.
import { existsSync, readFileSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runObjectiveChecks } from "./objective-checks.mjs";
import { fromLocalAudit, fromBeatCheck, fromCameraCheck, writeDefectReport } from "./defects.mjs";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "skills", "remotion-render", "public");
const readJson = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; } catch { return null; } };

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
  ];
  return writeDefectReport(dirname(videoPath), basename(base), defects, { advisory: true, queue_verdict: verdict, format });
}
