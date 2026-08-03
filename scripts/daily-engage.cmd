@echo off
REM Daily niche engagement wrapper — 25 Shorts watched, 10 liked, 3 commented per channel.
REM Called by the "YT_DailyEngage" scheduled task (see register-daily-engage.ps1).

set ROOT=%~dp0..
if not exist "%ROOT%\data\run-logs" mkdir "%ROOT%\data\run-logs"

echo [%date% %time%] Daily engagement started >> "%ROOT%\data\run-logs\engage.log"
"C:\Program Files\nodejs\node.exe" "%ROOT%\src\utils\youtube-engage.js" all --watch-count 25 --like-count 10 --comment-count 3 >> "%ROOT%\data\run-logs\engage.log" 2>&1
echo [%date% %time%] Daily engagement finished (exit %errorlevel%) >> "%ROOT%\data\run-logs\engage.log"
