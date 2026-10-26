#!/usr/bin/env bash
# Ensure ffmpeg and ffprobe are on PATH.
#
# The ubuntu-latest image normally ships both, and until 2026-10-26 the
# `apt-get update` fallback in the workflows was never needed. On run
# 40364703475 both loop jobs then sat in that fallback for 12+ minutes with no
# output, so the fallback is now bounded: no apt at all, a static build from a
# GitHub release instead. A missing binary fails in about a minute instead of
# wedging the job, and dpkg is never left half-configured for later steps.
set -euo pipefail

if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  ffmpeg -version | head -1
  exit 0
fi

echo "ffmpeg/ffprobe missing from the runner image; using the static BtbN build"
dest="${RUNNER_TEMP:-/tmp}/ffmpeg-static"
mkdir -p "$dest"
tarball="$dest/ffmpeg.tar.xz"
curl -fsSL --retry 3 --retry-delay 2 --max-time 300 -o "$tarball" \
  https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz
tar -xJf "$tarball" -C "$dest"
install -m 0755 \
  "$dest"/ffmpeg-master-latest-linux64-gpl/bin/ffmpeg \
  "$dest"/ffmpeg-master-latest-linux64-gpl/bin/ffprobe \
  "$dest"/
if [ -n "${GITHUB_PATH:-}" ]; then
  echo "$dest" >> "$GITHUB_PATH"
fi
export PATH="$dest:$PATH"
hash -r
ffmpeg -version | head -1
ffprobe -version | head -1
