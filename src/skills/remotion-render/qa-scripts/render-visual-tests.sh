#!/usr/bin/env bash
#
# Render the visual-storytelling test set through the REAL production CLI.
#
# Usage:  bash src/skills/remotion-render/qa-scripts/render-visual-tests.sh [scale]
#
# WHY THIS EXISTS AS A SCRIPT
#
# PART 22/23 of the visual overhaul: "compilation is not acceptance, a
# rendered video is". These three cases each exercise a different family of
# visual strategies, against the three real motion-graphics channel domains
# that exist in config/channels.json (finance / legal / process):
#
#   ch-01  finance  accumulation, transformation, comparison
#   ch-02  legal    geospatial radius (the 150m hard gate), documents
#   ch-48  process  process stages, interface, cause-effect, timeline
#
# STAGING, AND WHY NOT data/research/
#
# render.js takes real paths under the repo root, so the inputs have to live
# somewhere on disk. They are staged into data/audit/visual-tests/ and NEVER
# into data/research/<ch>/, because two of the three scripts are hand-written
# fixtures with illustrative figures. A fixture sitting in a channel's
# research directory looks exactly like a gate-passed research artifact, and
# this repo's grounding rule (CLAUDE.md) turns on that distinction being
# unambiguous. The ch-02 case is the one real gate-passed script.
#
# TTS: the voiceover here is SILENT placeholder audio and the SRT is a
# generated fixture (make-fixture-srt.mjs), because EdgeTTS needs a
# WebSocket this sandbox's proxy does not carry. Timing is therefore
# structurally realistic but MODELLED, not measured — fine for verifying
# visual state timing, not evidence about real speech sync.
set -euo pipefail

SCALE="${1:-0.5}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
R="$ROOT/src/skills/remotion-render"
STAGE="$ROOT/data/audit/visual-tests"
FF="$R/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"

mkdir -p "$STAGE"

stage_and_render() {
  local ch="$1" name="$2" script_src="$3"
  local script="$STAGE/${name}-script.json"
  local srt="$STAGE/${name}-script-vo.srt"
  local mp3="$STAGE/${name}-script-vo.mp3"

  cp "$script_src" "$script"
  node "$R/qa-scripts/make-fixture-srt.mjs" "$script" "$STAGE/${name}-script-vo.fixture.srt" >/dev/null
  cp "$STAGE/${name}-script-vo.fixture.srt" "$srt"

  local dur
  dur=$(python3 -c "
import re,sys
s=open('$srt').read()
t=re.findall(r'--> (\d+):(\d+):(\d+),(\d+)',s)[-1]
print(round(int(t[0])*3600+int(t[1])*60+int(t[2])+int(t[3])/1000+1,2))")
  "$FF" -f lavfi -i anullsrc=r=24000:cl=mono -t "$dur" -q:a 9 -acodec libmp3lame "$mp3" -y 2>/dev/null

  echo "=============================================================="
  echo "  ch-$ch  $name  (${dur}s @ scale $SCALE)"
  echo "=============================================================="
  node "$R/render.js" shorts "$ch" \
    "${script#$ROOT/}" "${mp3#$ROOT/}" "$SCALE" 2>&1 \
    | grep -vE "Detected differing|Memory reported|inadvertently set|Using the lower|THREE.Clock"
}

stage_and_render 1  finance-accumulation "$R/qa-scripts/fixtures/finance-accumulation.fixture.json"
stage_and_render 48 tech-process         "$R/qa-scripts/fixtures/tech-process.fixture.json"
stage_and_render 2  legal-geofence       "$ROOT/data/research/2/google-location-history-chatrie-ruling-shorts-script.json"

echo
echo "Visual reports written to data/renders/<ch>/*-visual-report.json"
