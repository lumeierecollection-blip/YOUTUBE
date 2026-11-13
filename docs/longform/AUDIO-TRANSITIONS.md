# Audio and transitions in the 20 references (measured, first 300 s of each)

Method (`output/longform-research/av_study.py`, raw numbers in `analysis/AV-MEASURED.json`): the first 300 s of each reference was downloaded at 360p with
its original-language audio track. Audio: integrated loudness and loudness range (ffmpeg `ebur128`); 50 ms RMS windows; "speech level" = the 80th
percentile; a "gap" = a window more than 18 dB below speech; "gap below speech" = how far the median gap sits below speech (small = something keeps
playing under the voice); "true silence" = share of windows below -55 dB; "sudden rises" = +12 dB jumps against the previous 0.3 s at near-speech
level (impacts, stings, hard music entries, but also loud syllables). Video: per-frame scene score; a hard cut = one isolated frame above 0.3; a
gradual transition = 6+ consecutive frames between 0.02 and 0.3; `blackdetect` for black frames. Frames around up to six transitions per video
were extracted and looked at.

**What this cannot tell:** which sounds are music, which are effects, or which instrument; the source tracks; anything after 300 s. A "gradual"
reading can be a camera move inside one shot (confirmed for the AI Search game footage below). No audio was listened to and described by ear.

## Per channel (median of the 5 references)

| Channel (references) | Loudness | Gap below speech | True silence | Hard cuts / 300 s | Median gap between cuts | Hard cuts that land in a speech pause | Sudden rises |
|---|---|---|---|---|---|---|---|
| Hidden Past (RealLifeLore) | -16.9 LUFS | 24.5 dB | 0.8 % | 3 | 7.5 s | 80 % | 169 |
| AI Tested (AI Search) | -18.2 LUFS | 28.8 dB | 5.1 % | 33 | 4.5 s | 79 % | 197 |
| Court & Spotlight (SunnyV2, documentaries) | -16.7 LUFS | 19.9 dB | 0 % | 27 | 2.9 s | 28 % | 38 |
| Rival Lines (Football Made Simple) | -22.8 LUFS | 23.6 dB | 0.5 % | 21 | 7.2 s | 81 % | 114 |

## Observed (frames looked at, plus the numbers)
- **RealLifeLore:** map-led openings have almost no hard cuts (3IVbe0xrRt8: 0 in 300 s; U_UoAZrOTNU: 1): the camera moves on one map instead.
  Footage sections use cross-dissolves of about 0.5 to 0.8 s (3IVbe0xrRt8 at 4:26: a construction time-lapse dissolving into a mountain valley).
  Cuts land in speech pauses (80 %). Under the voice the gaps sit about 22 to 33 dB down with almost no true silence: a quiet bed is present.
  R60ZGwd3n9E has a loudness range of 13.9 LU: the mix changes level between sections.
- **AI Search:** fast hard cuts (median 4.5 s); 5 % true silence and black frames between items (1Aqhg0FVm-w: 9 black segments): short dead air
  between news items is part of the rhythm. The "gradual" readings in h5zkzon0gM4 were checked frame by frame: they are game-camera motion, not
  editorial transitions. Cuts land in speech pauses (79 %).
- **SunnyV2:** gaps only about 19 to 20 dB below speech and zero true silence in all three: a music bed runs continuously under the voice. Cuts
  do NOT follow speech pauses (28 %): picture changes ride the music and the words inside sentences. Few sudden rises (38): the bed is smooth.
  jZpq6BCud7s has 25 black segments: the dark transcript cards.
- **Diddy documentary (-p_TBe0Re_s):** loudest (-12.3 LUFS), 109 hard cuts and 24 gradual transitions in 300 s: dense clip editing with dissolves.
- **FRONTLINE (OJ8fsE_GOlg):** quietest (-23.2 LUFS), widest range (8.0 LU), 18 black segments, 9 % true silence: broadcast mix with real pauses.
  Frames show a cross-dissolve of about 0.2 s between two interviewees and an animated logo open.
- **Football Made Simple:** frames around the gradual readings in N8PZt_9_adI show **directional motion-blur whips** between clips (0.2 to 0.4 s);
  scoreline cards come in on hard cuts. Cuts land in speech pauses (81 %). KC2Vgjw282s has a 15.5 LU range: loud highlight clips against quiet
  tactical narration.

## What the audio system does with this (config/longform-audio.json, `AudioLayer` in lf2/kit.jsx)
Each channel gets a bed level under the voice set from the measured "gap below speech", a loudness target from the measured loudness, and a cut
rule. These are starting values for the first full render, to be checked by measuring our own render the same way. Music and effects come only
from the repo's licensed libraries (`public/sfx/CREDITS.md`, `public/music`); no track is named here that has not been verified.
