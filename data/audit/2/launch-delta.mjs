// Flag-delta test: which of Remotion's extra flags breaks Chrome 151 startup?
// T1: control (no features/gl flags)  T2: + --enable-features  T3: + --use-gl=angle
import { spawn } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const REPORT = "C:\\Users\\Chile\\YOUTUBE\\data\\audit\\2\\launch-delta.txt";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const out = [];
out.push("START " + new Date().toISOString());

const baseArgs = [
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
];

const variants = {
  T1_control: [],
  T2_features: ["--enable-features=NetworkService,NetworkServiceInProcess,CanvasDrawElement"],
  T3_features_plus_gl: ["--enable-features=NetworkService,NetworkServiceInProcess,CanvasDrawElement", "--use-gl=angle"],
  T4_swangle: ["--enable-features=NetworkService,NetworkServiceInProcess,CanvasDrawElement", "--use-gl=angle", "--use-angle=swiftshader"],
};

const runTest = async (label, extra) => {
  const profile = mkdtempSync(join(tmpdir(), "chrome-delta-"));
  const args = [...baseArgs, ...extra, "--user-data-dir=" + profile];
  let stderr = "";
  let exited = false;
  const child = spawn(CHROME, args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
  child.on("exit", () => { exited = true; });
  await new Promise((r) => setTimeout(r, 10000));
  const ws = (stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/) || [])[1] || "";
  let ok = ws ? "YES" : "NO";
  if (ws) {
    const port = new URL(ws).port;
    try {
      const res = await fetch("http://127.0.0.1:" + port + "/json/version");
      if (!res.ok) ok = "NO(ep)";
    } catch { ok = "NO(ep)"; }
  }
  out.push(label + ": alive=" + !exited + " devtools=" + ok);
  try { process.kill(child.pid); } catch {}
  await new Promise((r) => setTimeout(r, 1500));
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
};

for (const [label, extra] of Object.entries(variants)) {
  await runTest(label, extra);
}
out.push("END " + new Date().toISOString());
writeFileSync(REPORT, out.join("\n"), "utf8");
process.exit(0);
