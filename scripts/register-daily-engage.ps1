# Registers (or updates) the daily niche-engagement scheduled task.
# Each channel: watch 25 in-niche Shorts, like 10, comment on 3.
# The engage script adds random pacing + session jitter so daily timing varies.
#
# Usage:  powershell -ExecutionPolicy Bypass -File .\scripts\register-daily-engage.ps1 [-Time 09:00]

param(
  [string]$Time = "09:00"
)

$taskName = "YT_DailyEngage"
$wrapper  = "C:\Users\Chile\YOUTUBE\scripts\daily-engage.cmd"

if (-not (Test-Path $wrapper)) {
  Write-Host "ERROR: wrapper not found at $wrapper" -ForegroundColor Red
  exit 1
}

# Remove existing task (if any) so the update is clean
schtasks /Delete /TN $taskName /F 2>$null | Out-Null

# Create the daily task (interactive so it runs in the user's session)
schtasks /Create /TN $taskName /TR $wrapper /SC DAILY /ST $Time /IT /RL LIMITED | Out-Null

if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: failed to create scheduled task" -ForegroundColor Red
  exit 1
}

Write-Host "Scheduled task '$taskName' created." -ForegroundColor Green
Write-Host "  Runs daily at $Time"
Write-Host "  Command: $wrapper"
Write-Host ""
Write-Host "To run it right now for testing:"
Write-Host "  schtasks /Run /TN $taskName"
Write-Host "To remove it:"
Write-Host "  schtasks /Delete /TN $taskName /F"
