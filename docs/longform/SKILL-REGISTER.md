# Long form v2: skills, tools and repositories register (13 Nov 2026)

"Invoked" means it was used to make something that is in the approval package, and the output was checked. "Read" means its instructions were
read and followed by hand; the agent skills in `.agents/skills` are instruction files, not tools, so that is how they are used.

## Skills

| Skill | Source | Status | Task | How it was used | Output | Verified |
|---|---|---|---|---|---|---|
| remotion-maps (MapLibre technique) | `.agents/skills/remotion-maps` (Remotion 4.0.512) | installed, read in full | Hidden Past geographic camera | Followed its rules: `interactive:false`, `fadeDuration:0`, `preserveDrawingBuffer`, `delayRender` per frame, wait for idle, camera from frame | `lf2/geomap.jsx` | Rendered 33 Hidden Past stills. Found two things the skill does not cover: maplibre-gl 6 fails to load its worker in the Remotion bundle (fixed by pinning 5.24.1); with terrain on, GeoJSON fills render only partly under swangle (fill scenes use terrain 0) |
| remotion-maps (CesiumJS technique) | same | read | 3D flyovers | Not used: needs a MapTiler or Google Map Tiles key; none is configured | — | not tested |
| remotion-best-practices | `.agents/skills` | read (router) | entry point | Pointed to remotion-maps | — | — |
| article-highlights | `.agents/skills` | read | Court source captures | Marker sweep over the real words, source on screen, real sources only. Departure: highlight drawn on the captured page pixels, not on a re-typed card | `Source`, `Collage` in `lf2/court.jsx` | stills C01, C05, C07, C10, C12 |
| terminal-inserts | `.agents/skills` | read | AI Tested terminal | Dark chrome, traffic lights, JetBrains Mono, typed command, block cursor; output = real runner log lines | `Terminal` in `lf2/aitest.jsx` | still A06 |
| cinematic-camera | `.agents/skills` | read | camera moves | Push-in/pan grammar used on documents and pages. Departure: its rule "never move on photographs" is broken on purpose for Hidden Past footage, because the references push in slowly on photos | `Source`, `Browser`, `Footage` | stills |
| motion-graphics | `.agents/skills` | read | AI Tested diagram | Connectors that draw on, one accent, beat staggering | `Flow` | still A04 |
| mograph-critic | `anthropic-skills:mograph-critic` (Skill tool) | **invoked** 13 Nov 2026 | QA of the stills | Its core checks (velocity linearity, holds, popcorn) need a 6 s video render; video renders wait for approval, so they were **not run**. Its static checks (hierarchy, alignment, stagger in code, contrast, connective tissue) were applied by eye to all four contact sheets | defect list below | partial: motion not verified |
| yt-hook-scripter, scene-director, video-shotcraft | Skill tool / `.opencode/skills` | listed, not invoked | — | Openings were taken from the measured reference openings instead | — | — |

### Defects found in the QA passes and fixed (each re-rendered and looked at)
Rival: counter showed decimals and stopped one short of the total (591 for 592) · completed passes showed 517 for 518 (easing not settled) · move
scenes too far away (camera scale 12.6 → 19–22, follow 0.35 → 0.85) · substitution labels overlapped on the timeline (greedy rows) · blur whip too
strong to read the middle frame (38 → 16 px) · thumbnails showed grey dots (team names missing) · shot-map labels overlapped.
Court: judiciary capture covered by a cookie banner (re-captured after clicking "Only accept necessary cookies") · viewport captures were
stretched to page height · quote highlight on the wrong words · ledger had 23 cells for 24 counts · thumbnail headline overlapped the chip.
AI Tested: footers printed the repository owner's account name (now "test run N · GitHub Actions run id · date") · chart labels ran off the frame.
Hidden Past: chart bars read "60passes" (composition default props leaked) · scale bar stopped at 8,891 · water labels unreadable · thumbnail circle
missed the lake · Sinai fill drawn only in pieces (terrain limit above).
Still open: ship icon in the roster is one generic drawing; footage push-ins and all motion are unverified until a short video render is allowed.

## Tools and repositories

| Tool / repo | Licence | Status | Used for | Result |
|---|---|---|---|---|
| MapLibre GL JS 5.24.1 | BSD-3 | installed, integrated | Hidden Past maps | works; 6.18 rejected (worker load fails in the Remotion bundle) |
| Turf 7 | MIT | integrated | route slicing, Sinai polygon clean-up | works |
| EOX Sentinel-2 cloudless 2016 tiles | CC BY 4.0 | integrated, credited on screen | satellite imagery | works, no key |
| NASA GIBS Blue Marble | public domain | integrated | world-scale maps | works |
| Mapzen terrain tiles (AWS open data) | open data | integrated | elevation, hillshade | works; fills limit above |
| OpenStreetMap via Overpass | ODbL | integrated | canal line, lakes | works |
| geoBoundaries EGY ADM1 | ODbL | integrated | Sinai area (approx.) | works after cleaning |
| CesiumJS | Apache-2.0 | evaluated, not integrated | 3D flyovers | needs keys we do not have; not tested |
| Blender + BlenderGIS | GPL-3.0 | evaluated, not installed | 3D terrain | Blender is not installed on this PC or the runners; not tested |
| Playwright 1.x (Chrome) | Apache-2.0 | integrated (`platform/longform/v2/capture.mjs`) | real browser capture with video recording, scripted clicks, phrase rectangles | works: 6 pages captured, 1 recorded session (`gemini-models.webm`) |
| playcast, OpenScreen, Recordly | MIT | found by search, not installed | cursor-zoom recordings | our Browser scene does the camera and cursor in Remotion instead |
| pypdfium2 | Apache-2.0/BSD | integrated (`pdfpage.py`) | court PDF pages + word rectangles | works |
| StatsBomb open data | free with attribution | integrated (`platform/longform/rival/prepare.mjs`) | events, lineups, 360 freeze-frames | works |
| mplsoccer, kloppy | MIT / BSD | evaluated, not used | pitch plots | static matplotlib output; the animated pitch is built in Remotion instead |
| Wikimedia Commons API | per file | integrated (`platform/longform/v2/assets.mjs`) | photographs, licence manifests | 15 files, licences recorded, refusals enforced |
| Claude-Code-Video-Toolkit, motion-skills (iart-ai) | various | found by search, not installed | — | overlap with what the repo has; not evaluated further |
| yt-dlp, ffmpeg, faster-whisper | Unlicense / LGPL / MIT | used | reference study only | clips kept locally, never committed |

## Phase 2 additions (13 Nov 2026)

| Tool / skill | Licence | Status | Used for | Result |
|---|---|---|---|---|
| three.js via @remotion/three (already installed) | MIT | integrated in `lf2/space.jsx` | 3D planet with real texture and tilt | works; first-still texture race found and fixed |
| Solar System Scope textures | CC BY 4.0 | downloaded, credited | planet textures, star field | works |
| NASA Scientific Visualization Studio API | public domain media | integrated (download + frames) | real Uranus magnetosphere visualisations | works; files kept outside git |
| NASA images API (images-api.nasa.gov) | public domain | tried | video search | unreachable from this PC (connection failed); SVS used instead |
| metafor dataset dat.raudenbush1985 (Raudenbush 1984 Table 1) | data from a published paper | integrated | effect-size plot | works |
| arXiv API | metadata | used | source for the AI Tested explanation beat | works |
| yt-dlp flat listings + per-video metadata | Unlicense | used for research only | 24-channel catalogues, thumbnails | works; no video reused |
| `anthropic-skills:dataviz`, `yt-hook-scripter`, `scene-director` | skills | listed, **not invoked** in phase 2 | — | charts and openings were built from the measured references instead |
| `mograph-critic` | skill | invoked in phase 1; motion checks still need a video render | — | static checks repeated by eye on all seven contact sheets |

## Phase 3 additions (audio and quality)

| Skill / tool | What was done | Verdict |
|---|---|---|
| `claude-video-audio` (AgriciDaniel/claude-video, MIT) | Instruction file read; its two-pass loudnorm and sidechain recipes followed by hand and run on a real narration (`platform/longform/v2/audio/mix-demo.sh`) | Recipes work; it is an FFmpeg recipe collection, not installed or invoked as a skill |
| `mix-master` (gooseworks-ai/goose-skills, MIT) | Instruction file read only | Overlaps the above; not run |
| `longform-audio-mix` (custom, `.claude/skills/longform-audio-mix/SKILL.md`) | Written from the tested recipe | Recipe tested via scripts; not invoked through the Skill tool (skills are discovered at session start) |
| Openverse API | Used for about 60 anonymous queries; licence and source page of every pick re-checked | Works; 200 requests/day limit |
| FFmpeg filters | `loudnorm` (two-pass), `sidechaincompress`, `adelay`, `amix`, `alimiter`, `afade`, `ebur128`, `showspectrumpic` run in this session | Verified |
| SoX, pyloudnorm, librosa, pedalboard, Audacity, Ardour, Demucs, Reaper | Licence/activity read from the GitHub API or not checked; not installed or run | Not used |
