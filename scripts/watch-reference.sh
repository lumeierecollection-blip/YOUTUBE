#!/usr/bin/env bash
# Research-only: download reference videos for frame/caption inspection. Output is NOT used in any production asset.
set -u
OUT=research/ref-ch04; mkdir -p $OUT; W=/tmp/w; mkdir -p $W
pip install -q yt-dlp >/dev/null 2>&1; sudo apt-get install -y -q ffmpeg >/dev/null 2>&1 || true
declare -A V=( [short_tactics_unfolded]=_Qt54x2FM4c [long_zekiel_mourinho]=l-8FSH6X4fw [long_purist_como]=x1bh-MEbdC0 )
for n in "${!V[@]}"; do
  id=${V[$n]}; echo "== $n $id"
  yt-dlp -q --no-warnings -f "bv*[height<=480]+ba/b[height<=480]/b" --merge-output-format mp4 -o "$W/$n.%(ext)s" \
     --write-auto-subs --write-subs --sub-langs "en.*" --sub-format vtt "https://youtu.be/$id" 2>&1 | tail -3
  f=$W/$n.mp4; [ -f "$f" ] || { echo "DOWNLOAD FAILED $n"; continue; }
  ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,duration -of csv=p=0 "$f" | tee $OUT/$n.probe.txt
  cp $W/$n*.vtt $OUT/ 2>/dev/null
  if [[ $n == short* ]]; then
    ffmpeg -v error -y -i "$f" -t 6 -vf "fps=4,scale=270:-1,tile=6x4" -frames:v 1 $OUT/$n.first6s_4fps.jpg
    ffmpeg -v error -y -i "$f" -vf "fps=1,scale=216:-1,tile=8x9" -frames:v 1 $OUT/$n.full_1fps.jpg
  else
    ffmpeg -v error -y -t 60 -i "$f" -vf "fps=1/3,scale=256:-1,tile=5x4" -frames:v 1 $OUT/$n.first60s.jpg
    ffmpeg -v error -y -i "$f" -vf "fps=1/15,scale=256:-1,tile=6x6" -frames:v 2 $OUT/$n.body_%d.jpg
    # scene-cut count as an editing-rhythm measure
    ffmpeg -i "$f" -vf "select='gt(scene,0.3)',metadata=print:file=-" -an -f null - 2>/dev/null | grep -c pts_time | tee $OUT/$n.cuts.txt
  fi
  [[ $n == short* ]] && { ffmpeg -i "$f" -vf "select='gt(scene,0.3)',metadata=print:file=-" -an -f null - 2>/dev/null | grep -c pts_time | tee $OUT/$n.cuts.txt; }
  ffmpeg -nostats -i "$f" -af ebur128 -f null - 2>&1 | grep -E "^\s+(I|LRA):" | tee $OUT/$n.loudness.txt
done
git config user.name ci; git config user.email ci@users.noreply.github.com
git add $OUT && git commit -qm "research: ch-04 reference frames/captions (analysis only)" && git push 2>&1 | tail -1
