$report = "C:\Users\Chile\YOUTUBE\data\audit\2\chrome-procs.txt"
$out = @()
$out += "START $(Get-Date -Format o)"
try {
  $procs = wmic process where "name='chrome.exe'" get ProcessId,CommandLine /FORMAT:LIST 2>$null
  $lines = $procs -split "`r`n"
  $cur = @{}
  $count = 0
  foreach ($l in $lines) {
    $l = $l.Trim()
    if ($l -like "CommandLine=*") { $cur.cmd = $l.Substring(12) }
    elseif ($l -like "ProcessId=*") {
      $cur.pid = $l.Substring(10)
      $count++
      $isHeadless = $cur.cmd -match "puppeteer_dev_chrome_profile|chrome-delta-|chrome-stdin-|chrome-repro-|chrome-flagtest-|chrome-launch-test-|--headless"
      if ($isHeadless) {
        $out += "ZOMBIE $($cur.pid): $($cur.cmd.Substring(0, [Math]::Min(150, $cur.cmd.Length)))"
      }
      $cur = @{}
    }
  }
  $out += "TOTAL_CHROME_PROCS: $count"
} catch {
  $out += "ERROR: $($_.Exception.Message)"
}
$out += "END $(Get-Date -Format o)"
$out -join "`r`n" | Set-Content -Path $report -Encoding UTF8
