#!/bin/bash
# Full production renders through the real CLI, sequentially.
# render.js resolves BOTH the script path and the audio path against ROOT,
# so every path here is repo-relative, not absolute.
cd /home/user/YOUTUBE/src/skills/remotion-render
V=data/audit/visual-tests
LOG=/home/user/YOUTUBE/qa/pass6
mkdir -p "$LOG"
for set in "1 finance-accumulation finance" "2 legal-geofence legal" "3 tech-process tech"; do
  set -- $set
  CH=$1; NAME=$2; TAG=$3
  echo "=== rendering $NAME (ch $CH) at $(date -u +%H:%M:%S) ==="
  node render.js shorts "$CH" "$V/$NAME-script.json" "$V/$NAME-script-vo.mp3" > "$LOG/render-$TAG.log" 2>&1
  echo "$TAG exit=$?" | tee -a "$LOG/render-$TAG.log"
done
echo ALL_DONE
