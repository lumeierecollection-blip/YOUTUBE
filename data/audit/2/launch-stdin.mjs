// Confirm stdin-pipe hypothesis: same flags as working T4 (swangle), but stdio
// ["pipe","pipe","pipe"] (Remotion's default at logLevel info) vs ["ignore","pipe","pipe"].
import { spawn } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const REPORT = "C:\\Users\\Chile\\YOUTUBE\\data\\audit\\2\\launch-stdin.txt";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const out = [];
out.push("START " + new Date().toISOString());

const args = [
  "about:blank", "--allow-pre-commit-input", "--disable-background-networking",
  "--enable-features=NetworkService,NetworkServiceInProcess,CanvasDrawElement",
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
  "--use-gl=angle", "--use-angle=swiftshader", "--remote-debugging-port=0",
];

const runTest = async (label, stdio) => {
  const profile = mkdtempSync(join(tmpdir(), "chrome-stdin-"));
  const child = spawn(CHROME, [...args, "--user-data-dir=" + profile], { stdio });
  let stderr = "";
  let exited = false;
  child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
  child.on("exit", () => { exited = true; });
  await new Promise((r) => setTimeout(r, 10000));
  const ws = (stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/) || [])[1] || "";
  out.push(label + ": alive=" + !exited + " devtools=" + (ws ? "YES" : "NO") + " stderrLen=" + stderr.length);
  try { process.kill(child.pid); } catch {}
  await new Promise((r) => setTimeout(r, 1500));
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
};

await runTest("T5_stdin_pipe_pipe_pipe", ["pipe", "pipe", "pipe"]);
await runTest("T6_stdin_ignore", ["ignore", "pipe", "pipe"]);
out.push("END " + new Date().toISOString());
writeFileSync(REPORT, out.join("\n"), "utf8");
process.exit(0);
