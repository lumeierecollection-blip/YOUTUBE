# Kalimba bed tracks — credits

Downloaded 2026-09-27 from OpenGameArt. Each file was converted to 128 kbps
44.1 kHz stereo MP3 and loudness-normalised to −16 LUFS (ffmpeg `loudnorm`)
so the fixed −24 dB bed gain lands at the same level on every track.
Nothing else was edited.

Chosen per video by `audio-mix.js` (`pickKalimbaTrack`): FNV-1a hash of
channel ID + script filename, mod track count.

| File | Title | Artist | Source | License | Attribution |
|---|---|---|---|---|---|
| kalimba-01.mp3 | Short kalimba loop | extenz | https://opengameart.org/content/short-kalimba-loop | CC0 1.0 | not required |
| kalimba-02.mp3 | What are we doing here? | Konrad "FeniX" Gadzina | https://opengameart.org/content/what-are-we-doing-here-0 | CC-BY 3.0 | Konrad "FeniX" Gadzina — http://enklawa-tworcza.blogspot.com/ |
| kalimba-03.mp3 | Hope | ShootDawn | https://opengameart.org/content/hope-1 | CC-BY 4.0 | "Hope" by ShootDawn, CC-BY 4.0 |
| kalimba-04.mp3 | I think I'd stay (jungle chill) | Emmntt | https://opengameart.org/content/i-think-id-stay-jungle-chill | page lists CC0; the author's own attribution text says CC-BY 3.0 — treated as **CC-BY 3.0** | "I think I'd stay" Emmntt (emmntt.tilda.ws), CC-BY 3.0 |

CC-BY tracks require attribution wherever the video is published (e.g. the
YouTube description). That is not automated yet.

Target was six tracks; four were found under an allowed license (CC0,
CC-BY, Pixabay License):
- **Pixabay:** kalimba tracks exist under the Pixabay Content License
  (e.g. "Kalimba Soft Background Loop" by DailyJoy), but the pages sit
  behind a Cloudflare challenge (curl: HTTP 403) and expose no direct file
  URL, so nothing could be downloaded.
- **Free Music Archive / ccMixter / Internet Archive:** every kalimba track
  found was CC BY-NC or stricter (Circus Marcus, Blue Dot Sessions, Silent
  Strangers, Dan Lizard, DoKashiteru, Mr. Scruff) — not allowed.
- **Wikimedia Commons:** kalimba recordings found were CC BY-SA — not
  allowed.

`public/audio/kalimba.mp3` (the old single bed) is NOT in this pool: no
source or license for it is recorded anywhere in the repo.
