#!/bin/bash
# usage: discover.sh <niche> "<query>" ...  -> disc/<niche>.psv rows: query|id|channel|channel_id|views|duration|title
# Flat search (fast): all-time by views (sp=CAMSAhAB = sort by views, type video) and this year by views (CAMSBAgFEAE%3D).
cd "$(dirname "$0")"; mkdir -p disc
niche=$1; shift
for q in "$@"; do
  qq=$(echo "$q" | sed 's/ /+/g')
  for sp in "CAMSAhAB" "CAMSBAgFEAE%3D" "EgIQAQ%3D%3D"; do
    python -m yt_dlp --no-warnings -q --flat-playlist --playlist-end 40 --print "$q|%(id)s|%(channel)s|%(channel_id)s|%(view_count)s|%(duration)s|%(title)s" \
      "https://www.youtube.com/results?search_query=$qq&sp=$sp" 2>/dev/null >> disc/$niche.psv
  done
done
sort -u -t'|' -k2,2 disc/$niche.psv -o disc/$niche.psv
wc -l disc/$niche.psv
