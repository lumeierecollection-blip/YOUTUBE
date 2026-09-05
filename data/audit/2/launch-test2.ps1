$report = "C:\Users\Chile\YOUTUBE\data\audit\2\launch-test2.txt"
$out = @()
$out += "START $(Get-Date -Format o)"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profile = Join-Path $env:TEMP ("chrome-flagtest-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $profile | Out-Null
$errFile = Join-Path $env:TEMP "chrome-flagtest-err.txt"
$args = @(
  "about:blank", "--allow-pre-commit-input", "--disable-background-networking",
  "--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,CanvasOopRasterization",
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
  "--remote-debugging-port=0", ("--user-data-dir=" + $profile)
)
$p = Start-Process -FilePath $chrome -ArgumentList $args -PassThru -RedirectStandardError $errFile -RedirectStandardOutput (Join-Path $env:TEMP "chrome-flagtest-out.txt") -WindowStyle Hidden
Start-Sleep -Seconds 12
$err = if (Test-Path $errFile) { Get-Content $errFile -Raw } else { "(no stderr file)" }
$out += "ALIVE_AFTER_12S: $(-not $p.HasExited)"
$ws = [regex]::Match($err, "DevTools listening on (ws://[^\s]+)").Groups[1].Value
$out += "DEVTOLS_WS: $ws"
if ($ws) {
  $port = ([uri]$ws).Port
  try {
    $wc = New-Object System.Net.WebClient
    $json = $wc.DownloadString("http://127.0.0.1:$port/json/version")
    $out += "ENDPOINT_OK: $($json.Substring(0, [Math]::Min(160, $json.Length)))"
  } catch {
    $out += "ENDPOINT_FAIL: $($_.Exception.Message)"
  }
}
$out += "STDERR_TAIL:"
$out += ($err -split "`r?`n" | Select-Object -Last 8) -join " | "
taskkill /PID $p.Id /T /F 2>&1 | Out-Null
Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
$out += "END $(Get-Date -Format o)"
$out -join "`r`n" | Set-Content -Path $report -Encoding UTF8
