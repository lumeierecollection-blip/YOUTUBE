#!/bin/bash
# Reproducible audio demo: narration + one music bed (ducked) + three effects, final stage = TWO-PASS loudnorm, then the exported file is measured again.
# This is a TECHNICAL test of the chain. It has NOT been auditioned by ear (no one has listened): see docs/longform/SOUND-DESIGN-RESEARCH.md.
# usage: bash platform/longform/v2/audio/mix-demo.sh   (from the repo root; needs ffmpeg)
set -e
A=output/longform-media/audio; N=output/final-pipeline-repair/ai-tested/narration.mp3; O=output/longform-audio-demo; mkdir -p $O
TARGET_I=-14; TARGET_TP=-1.5; TARGET_LRA=9
# 1 narration to 48 kHz stereo wav, two-pass normalised to -16 LUFS (voice stem)
M=$(ffmpeg -hide_banner -nostats -i $N -af loudnorm=I=-16:TP=-2:LRA=7:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$M" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
ffmpeg -y -hide_banner -loglevel error -i $N -af "loudnorm=I=-16:TP=-2:LRA=7:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" -ar 48000 -ac 2 $O/vo.wav
# 2 pre-master: music -17 dB (before ducking) with fades and sidechain ducking keyed from the voice, effects placed by delay; no loudness stage yet. Music is attenuated first because the asset is mastered hot (+/-0 dBTP).
ffmpeg -y -hide_banner -loglevel error -i $O/vo.wav -i $A/MUSIC_TECH.ogg -i $A/SFX_KEYBOARD.mp3 -i $A/SFX_MOUSE_CLICK.mp3 -i $A/SFX_WHOOSH.mp3 -filter_complex "
[1:a]atrim=0:27,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=-17dB,afade=t=in:d=1.5,afade=t=out:st=24:d=3[mus];
[0:a]asplit=2[vo][key];
[mus][key]sidechaincompress=threshold=0.05:ratio=2.5:attack=30:release=500[duck];
[2:a]atrim=0:2.5,aformat=sample_rates=48000:channel_layouts=stereo,volume=-14dB,adelay=3000|3000[k];
[3:a]atrim=0:1,aformat=sample_rates=48000:channel_layouts=stereo,volume=-14dB,adelay=9000|9000[c];
[4:a]atrim=0:1.2,aformat=sample_rates=48000:channel_layouts=stereo,volume=-16dB,adelay=14600|14600[w];
[vo][duck][k][c][w]amix=inputs=5:normalize=0:duration=first[mx]" -map "[mx]" -ar 48000 $O/premaster.wav
# 3 final stage: loudnorm pass 1 (measure), pass 2 (apply the measured values, linear), true-peak limiter as a safety net
P=$(ffmpeg -hide_banner -nostats -i $O/premaster.wav -af loudnorm=I=$TARGET_I:TP=$TARGET_TP:LRA=$TARGET_LRA:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
p(){ echo "$P" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
ffmpeg -y -hide_banner -loglevel error -i $O/premaster.wav -af "loudnorm=I=$TARGET_I:TP=$TARGET_TP:LRA=$TARGET_LRA:measured_I=$(p input_i):measured_TP=$(p input_tp):measured_LRA=$(p input_lra):measured_thresh=$(p input_thresh):offset=$(p target_offset):linear=true,alimiter=limit=0.89:level=false" -ar 48000 $O/mix-test-aitested.wav
ffmpeg -y -hide_banner -loglevel error -i $O/mix-test-aitested.wav -b:a 192k $O/mix-test-aitested.mp3
# 4 measure the EXPORTED file (and the voice stem for reference)
echo "premaster: I=$(p input_i) LUFS TP=$(p input_tp) dBTP LRA=$(p input_lra)"
for f in $O/mix-test-aitested.wav $O/mix-test-aitested.mp3; do echo "== $f"; ffmpeg -hide_banner -nostats -i $f -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|LRA:|Peak:)"; done
