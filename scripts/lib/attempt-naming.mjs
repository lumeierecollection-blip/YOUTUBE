// Pure naming for render-and-qa.js attempts. Extracted so the names can be unit-tested without a render.
import { basename, extname, join } from "node:path";

const ATTEMPT_SUFFIX = /(?:-enforced-attempt\d+|-revised-a\d+-\d+)+(?=\.json$)/;

// "X-enforced-attempt1.json" -> "X.json". Without this, attempt 2 enforced on top of attempt 1's plan
// produced "X-enforced-attempt1-enforced-attempt2.json" (names grew by one suffix per attempt).
export function basePlanPath(planPath) {
  return planPath.replace(ATTEMPT_SUFFIX, "");
}

export function enforcedPlanPathFor(planPath, attempt) {
  return basePlanPath(planPath).replace(/\.json$/, `-enforced-attempt${attempt}.json`);
}

export function revisedPlanPathFor(planPath, attempt, revision) {
  return basePlanPath(planPath).replace(/\.json$/, `-revised-a${attempt}-${revision}.json`);
}

export function correctionsPathFor(root, runId, scriptPath, attempt, kind = "") {
  const stem = basename(scriptPath, extname(scriptPath));
  return join(root, "data", "audit", "corrections", String(runId), `${stem}-attempt${attempt}${kind ? `-${kind}` : ""}.json`);
}

// The MP4 path is the same on every attempt of a run (the superseded attempt's file is removed, not queued),
// so it depends on the UTC date at call time. `date` is injectable for tests.
export function outputPathFor(root, channelId, scriptPath, format, date = new Date()) {
  const slug = basename(scriptPath, extname(scriptPath)).replace(/-script$/, "");
  return join(root, "data", "renders", channelId, `${slug}-${format}-${date.toISOString().slice(0, 10)}.mp4`);
}
