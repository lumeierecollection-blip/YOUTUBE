// Faithful reproduction of @remotion/renderer's Chrome launch: node child_process.spawn
// with an args array + piped stdio. Launches installed Chrome 151 with the exact flag
// set from dist/esm/index.mjs internalOpenBrowser (minus gl/device-scale flags), waits
// for "DevTools listening", probes the endpoint, then kills the tree. Writes a report
// file so shell-pipe wedges from zombie chrome cannot hide the result.
import { spawn } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const REPORT = "C:\\Users\\Chile\\YOUTUBE\\data\\audit\\2\\launch-repro.txt";
const out = [];
out.push("START " + new Date().toISOString());

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "chrome-repro-"));
const args = [
  "about:blank", "--allow-pre-commit-input", "--disable-background-networking",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-breakpad", "--disable-client-side-phishing-detection",
  "--disable-component-extensions-with-background-pages", "--disable-default-apps",
  "--disable-dev-shm-usage", "--no-proxy-server", "--proxy-server='direct://'",
  "--proxy-bypass-list=*", "--force-gpu-mem-available-mb=4096", "--disable-hang-monitor",
  "--disable-extensions", "--allow-chrome-scheme-url", "--disable-ipc-flooding-protection",
  "--disable-popup-blocking", "--disable-prompt-on-repost", "--disable-renderer-backgrounding",
  "--disable-sync", "--force-color-profile=srgb", "--metrics-recording-only", "--mute-audio",
  "--no-first-run", "--video-threads=2", "--enable-automation", "--password-store=basic",
  "--use-mock-keychain", "--enable-blink-features=IdleDetection", "--export-tagged-pdf",
  "--intensive-wake-up-throttling-policy=0", "--headless=new", "--no-sandbox",
  "--disable-setuid-sandbox", "--disable-background-media-suspend",
  "--allow-running-insecure-content", "--disable-component-update", "--disable-domain-reliability",
  "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process,Translate,BackForwardCache,AvoidUnnecessaryBeforeUnloadCheckSync,IntensiveWakeUpThrottling,LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults",
  "--disable-print-preview", "--disable-site-isolation-trials", "--disk-cache-size=268435456",
  "--hide-scrollbars", "--no-default-browser-check", "--no-pings", "--font-render-hinting=none",
  "--no-zygote", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu",
  "--remote-debugging-port=0",
  "--user-data-dir=" + profile,
];

let stderr = "";
let finished = false;
const child = spawn(CHROME, args, { stdio: ["ignore", "pipe", "pipe"] });
child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
child.on("exit", (code, signal) => { out.push("CHILD_EXIT code=" + code + " signal=" + signal); finished = true; });
child.on("error", (e) => out.push("SPAWN_ERROR: " + e.message));

await new Promise((r) => setTimeout(r, 15000));

out.push("ALIVE_AFTER_15S: " + !finished);
const ws = (stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/) || [])[1] || "";
out.push("DEVTOLS_WS: " + (ws || "(none)"));
if (ws) {
  const port = new URL(ws).port;
  try {
    const res = await fetch("http://127.0.0.1:" + port + "/json/version");
    const body = await res.text();
    out.push("ENDPOINT_OK: " + body.slice(0, 160));
  } catch (e) {
    out.push("ENDPOINT_FAIL: " + e.message);
  }
}
out.push("STDERR_TAIL: " + stderr.split(/\r?\n/).slice(-10).join(" | "));

try { process.kill(child.pid); } catch (e) {}
try { rmSync(profile, { recursive: true, force: true }); } catch (e) {}
out.push("END " + new Date().toISOString());
writeFileSync(REPORT, out.join("\n"), "utf8");
process.exit(0);
