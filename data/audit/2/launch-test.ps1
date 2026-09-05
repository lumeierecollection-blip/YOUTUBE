$report = "C:\Users\Chile\YOUTUBE\data\audit\2\launch-test.txt"
$out = @()
$out += "START $(Get-Date -Format o)"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out += "VERSION: $((Get-Item $chrome).VersionInfo.ProductVersion)"
$profile = Join-Path $env:TEMP ("chrome-launch-test-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $profile | Out-Null
$errFile = Join-Path $env:TEMP "chrome-launch-test-err.txt"
$p = Start-Process -FilePath $chrome -ArgumentList '--headless=new', '--remote-debugging-port=9228', ("--user-data-dir=" + $profile), 'about:blank' -PassThru -RedirectStandardError $errFile -RedirectStandardOutput (Join-Path $env:TEMP "chrome-launch-test-out.txt") -WindowStyle Hidden
Start-Sleep -Seconds 8
try {
  $wc = New-Object System.Net.WebClient
  $wc.Timeout = 5000
  $json = $wc.DownloadString("http://127.0.0.1:9228/json/version")
  $out += "DEVTOOLS_OK: $json"
} catch {
  $out += "DEVTOOLS_FAIL: $($_.Exception.Message)"
}
$out += "ERRFILE:"
if (Test-Path $errFile) { $out += (Get-Content $errFile -Raw) }
$out += "LAUNCHER_EXITED: $($p.HasExited)"
taskkill /PID $p.Id /T /F 2>&1 | Out-Null
Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
$out += "END $(Get-Date -Format o)"
$out -join "`r`n" | Set-Content -Path $report -Encoding UTF8
