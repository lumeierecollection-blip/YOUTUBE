#!/bin/bash
# usage: catalog.sh <niche> <channel_id> [<channel_id> ...]  -> cat/<channel_id>.psv  (newest first: idx|id|views|duration|title)
# Flat listing of the channel's long-form Videos tab (Shorts tab is separate, so it is excluded), newest 250.
cd "$(dirname "$0")"; mkdir -p cat
niche=$1; shift
for cid in "$@"; do
  [ -s cat/$cid.psv ] && { echo "$cid cached $(wc -l < cat/$cid.psv)"; continue; }
  python -m yt_dlp --no-warnings -q --flat-playlist --playlist-end 250 --print "%(playlist_index)s|%(id)s|%(view_count)s|%(duration)s|%(channel)s|%(title)s" \
    "https://www.youtube.com/channel/$cid/videos" 2>/dev/null > cat/$cid.psv
  echo "$niche $cid $(head -1 cat/$cid.psv | cut -d'|' -f5) $(wc -l < cat/$cid.psv)"
  echo "$niche|$cid" >> cat/_index.psv
  sleep 3
done
