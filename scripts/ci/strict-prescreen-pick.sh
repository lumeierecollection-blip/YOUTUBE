#!/usr/bin/env bash
# Strict-visual channels only (ch-2, ch-48): before the writer is called, check that the chosen topic's RESEARCH has something to draw
# (scripts/strict-prescreen.mjs: >= STRICT_MIN_STRONG facts that state a figure, date-event, place, list or comparison). If it does not,
# research up to three of the other discovery candidates, switch to the first that does, or to the best-scoring one. A starved topic cost
# eight script attempts per channel per day before this ran (runs 41020644767, 41033193873, 41034624426: ch-48 "MIT magnetic sensors").
# It loosens nothing: the full script gate still decides. Exits 0 always except on a hard fault; the topic file /tmp/channel-topic.json is
# rewritten when a better topic is found.
set -euo pipefail
CH="${CHANNEL_ID:?CHANNEL_ID is required}"
MAX_ALTERNATES="${PRESCREEN_MAX_ALTERNATES:-3}"
TOPIC_FILE="${TOPIC_FILE:-/tmp/channel-topic.json}"
TOPICS_FILE="${TOPICS_FILE:-/tmp/topics.json}"

IS_STRICT=$(node scripts/strict-prescreen.mjs --is-strict "$CH" 2>/dev/null | tail -n 1 || echo false)
if [ "$IS_STRICT" != "true" ]; then
  echo "[prescreen] ch-$CH is not strict_visual: nothing to check"
  exit 0
fi

SLUG=$(jq -r '.slug' "$TOPIC_FILE")
set +e
node scripts/strict-prescreen.mjs "$CH" "$SLUG"
RC=$?
set -e
if [ "$RC" -eq 0 ]; then
  echo "[prescreen] ch-$CH: \"$SLUG\" has enough to draw"
  exit 0
fi
if [ "$RC" -ne 3 ]; then
  echo "::warning::[prescreen] ch-$CH: the pre-screen could not judge \"$SLUG\" (exit $RC); keeping it"
  exit 0
fi

echo "::warning::[prescreen] ch-$CH: \"$SLUG\" is starved (too little to draw); trying the other discovery candidates"
score() { node scripts/strict-prescreen.mjs --score "$CH" "$1" 2>/dev/null | tail -n 1 | awk '{ print ($1 * 100) + $2 }'; }

BEST="$SLUG"
BEST_TOPIC=$(jq -r '.topic // .slug' "$TOPIC_FILE")
BEST_ANGLE=$(jq -r '.angle // ""' "$TOPIC_FILE")
BEST_SCORE=$(score "$SLUG" || echo 0)
BEST_SCORE="${BEST_SCORE:-0}"
TRIED=" $SLUG "
TRIES=0

switch_to() {
  jq -n --arg s "$1" --arg t "$2" --arg a "$3" '{slug:$s,topic:$t,angle:$a}' > "$TOPIC_FILE"
  echo "[prescreen] ch-$CH: switched to \"$1\""
}

N=$(jq '.topics | length' "$TOPICS_FILE" 2>/dev/null || echo 0)
for IDX in $(seq 0 $((N - 1))); do
  [ "$TRIES" -lt "$MAX_ALTERNATES" ] || break
  T=$(jq -r ".topics[$IDX].topic" "$TOPICS_FILE")
  S=$(jq -r ".topics[$IDX].slug" "$TOPICS_FILE")
  A=$(jq -r ".topics[$IDX].angle // \"\"" "$TOPICS_FILE")
  case "$TRIED" in *" $S "*) continue ;; esac
  TRIED="$TRIED$S "
  set +e
  node scripts/reserve-topic-single.js "$CH" "$T" "$S" > /dev/null 2>&1
  R=$?
  set -e
  [ "$R" -eq 0 ] || { echo "[prescreen] ch-$CH: \"$S\" is a duplicate or cannot be reserved; skipped"; continue; }
  TRIES=$((TRIES + 1))
  set +e
  jq -n --arg t "$T" --arg a "$A" --arg s "$S" --arg c "$CH" '{topic:$t, angle:$a, slug:$s, channel_id:$c, trending_entities:null}' \
    | node scripts/ollama-agent.js \
        --prompt-file prompts/research.md \
        --schema-file schemas/research.json \
        --agent pipeline-research \
        --model "${OPENCODE_MODELS_RESEARCH:-ollama-cloud/gpt-oss:120b,ollama/qwen2.5:3b}" \
        --task-label research --max-retries 4 --min-source-domains 2 --channel-id "$CH" --video-id "$S" \
        --search-out "data/research/$CH/$S-search.json" \
        > /tmp/research-prescreen.json 2> /tmp/research-prescreen-err.log
  RP=$?
  set -e
  if [ "$RP" -ne 0 ] || ! jq -e '.structured_output.key_facts | length >= 3' /tmp/research-prescreen.json > /dev/null 2>&1; then
    echo "[prescreen] ch-$CH: research for \"$S\" failed; skipped"
    continue
  fi
  jq '.structured_output' /tmp/research-prescreen.json > "data/research/$CH/$S.json"
  if ! node scripts/gate-research.js "$CH" "$S" > /dev/null 2>&1; then
    echo "[prescreen] ch-$CH: research for \"$S\" failed the research gate; skipped"
    continue
  fi
  set +e
  node scripts/strict-prescreen.mjs "$CH" "$S"
  RC2=$?
  set -e
  if [ "$RC2" -eq 0 ]; then
    switch_to "$S" "$T" "$A"
    exit 0
  fi
  SC=$(score "$S" || echo 0)
  SC="${SC:-0}"
  if [ "$SC" -gt "$BEST_SCORE" ]; then BEST="$S"; BEST_TOPIC="$T"; BEST_ANGLE="$A"; BEST_SCORE="$SC"; fi
done

if [ "$BEST" != "$SLUG" ]; then
  switch_to "$BEST" "$BEST_TOPIC" "$BEST_ANGLE"
else
  echo "::warning::[prescreen] ch-$CH: no candidate had more to draw than \"$SLUG\"; keeping it"
fi
