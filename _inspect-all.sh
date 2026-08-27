#!/bin/bash
cd /home/user/YOUTUBE/src/skills/remotion-render
V=/home/user/YOUTUBE/data/audit/visual-tests
OUT=qa/pass6/frames
for set in "1 finance-accumulation" "2 legal-geofence" "3 tech-process" "1 uncovered-strategies"; do
  set -- $set
  CH=$1; NAME=$2
  echo "=== $NAME (ch $CH) ==="
  node qa-scripts/inspect-anchors.mjs "$V/$NAME-script.json" "$V/$NAME-script-vo.srt" "$CH" "$OUT" 2>&1 | grep -v "^\[Tab\|Detected differing\|Memory reported\|deprecated"
done
echo INSPECT_DONE
