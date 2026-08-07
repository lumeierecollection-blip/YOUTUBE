$report = "C:\Users\Chile\YOUTUBE\data\audit\2\kill-report.txt"
$out = @()
$out += "START $(Get-Date -Format o)"
try {
  $procs = wmic process where "name='chrome.exe'" get ProcessId,CommandLine /FORMAT:LIST 2>$null
  $lines = $procs -split "`r`n"
  $cur = @{}
  foreach ($l in $lines) {
    $l = $l.Trim()
    if ($l -like "CommandLine=*") { $cur.cmd = $l.Substring(12) }
    elseif ($l -like "ProcessId=*") {
      $cur.pid = [int]$l.Substring(10)
      if ($cur.cmd -match "--headless|puppeteer_dev_chrome_profile|chrome-headless-test|remote-debugging-port") {
        $out += "KILL $($cur.pid): $($cur.cmd.Substring(0, [Math]::Min(120, $cur.cmd.Length)))"
        taskkill /PID $cur.pid /T /F 2>&1 | Out-Null
      }
      $cur = @{}
    }
  }
  $out += "done."
} catch {
  $out += "ERROR: $($_.Exception.Message)"
}
$out += "END $(Get-Date -Format o)"
$out -join "`r`n" | Set-Content -Path $report -Encoding UTF8
