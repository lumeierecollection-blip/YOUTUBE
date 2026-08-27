import { existsSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Finds a usable Chrome/Chromium binary. Explicit env override first, then
 * platform-typical install locations, then the sandboxed Playwright cache
 * this environment pre-installs Chromium into. Returns undefined (rather
 * than a bad path) when nothing is found, so Remotion falls back to
 * downloading/managing its own Chrome Headless Shell.
 *
 * Shared by render.js and verify-compositions.js — split out so a QA script
 * importing this doesn't also import (and side-effect-run) render.js's own
 * top-level main().
 */
export function findChrome() {
  if (process.env.REMOTION_CHROME_PATH && existsSync(process.env.REMOTION_CHROME_PATH)) {
    return process.env.REMOTION_CHROME_PATH;
  }
  if (process.platform === "win32") {
    const p = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    return existsSync(p) ? p : undefined;
  }
  if (process.platform === "darwin") {
    const p = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    return existsSync(p) ? p : undefined;
  }
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const pwBase = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwBase && existsSync(pwBase)) {
    for (const entry of readdirSync(pwBase)) {
      // Prefer chromium_headless_shell: modern Chrome removed "old headless"
      // mode, which is what Remotion's renderer launches with.
      if (entry.startsWith("chromium_headless_shell-")) {
        const p = join(pwBase, entry, "chrome-linux", "headless_shell");
        if (existsSync(p)) candidates.unshift(p);
      }
      if (entry.startsWith("chromium-")) {
        const p = join(pwBase, entry, "chrome-linux", "chrome");
        if (existsSync(p)) candidates.push(p);
      }
    }
  }
  return candidates.find((p) => existsSync(p));
}
