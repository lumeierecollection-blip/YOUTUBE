# Specialist skill and repository audit

Read-only audit. Nothing was cloned, installed or executed. Data came from `gh api` (repository metadata, HEAD commit, top-level contents, recursive tree listings) and from raw file reads through `gh api` and `curl`. Files were read in part where noted. "Not determined" means the audit did not establish the fact. No adoption recommendation is made here.

Audit date: 2026-11-09.

---

## social-media-skills/skills

- **Commit SHA:** f28cef2b7067ec64e79c9d85421c022c06659e03
- **Licence:** MIT (GitHub API SPDX `MIT`; top-level `LICENSE` file present, text not read)
- **Metadata:** default branch `main`, pushed 2026-10-15, size 1680 KB, language Shell, not archived, not a fork.
- **What it does:** A collection of 106 Agent Skills (`skills/*/SKILL.md`) for social media strategy, writing, video, design and analytics. The target skill, `skills/short-form-video-script/SKILL.md`, is a scripting craft guide for vertical short-form video that produces spoken lines, on-screen text, beat direction, hook variants and a CTA.
- **Inputs / outputs:** Inputs are a natural-language request and, per the skill text, `brand-profile` and `voice-builder` skills. Output is script text in the agent's reply. The skill text names the WoopSocial product as the publishing destination; this audit did not verify that product.
- **Runtime and dependencies:** No runtime for the skills themselves (Markdown instructions). `scripts/build-packs.sh`, `scripts/build-skill-zips.sh`, `scripts/validate-skills.sh` exist at top level; not read or run. `tools/` and `.github/` exist; not read.
- **Linux GitHub Actions runnable (no interactive session):** Not applicable to the skill text. The shell scripts were not examined, so their runnability is not determined.
- **Obligations:** MIT notice and copyright retention. No other obligation found in the parts read.

---

## vyralcontent/content-skills

- **Commit SHA:** 349e495d97029a3e6303a7510e3f39c73f36d8fe
- **Licence:** MIT (GitHub API SPDX `MIT`; top-level `LICENSE`; SKILL.md frontmatter `license: MIT`)
- **Metadata:** default branch `main`, pushed 2026-06-22, size 306 KB, language null (no code files), not archived, not a fork.
- **What it does:** Markdown Agent Skills for short-form hooks, scripts and carousels for TikTok, Reels and YouTube Shorts, sponsored by Vyral Content. The target skill `skills/viral-youtube-shorts/SKILL.md` writes and diagnoses Shorts scripts and hooks, and covers the Shorts feed, retention and monetisation choices.
- **Inputs / outputs:** Inputs are a user's topic or existing short. Outputs are script text, hook options, checklists and diagnostic advice (templates under `assets/`, reference notes under `references/`). The README states the skills are built from "more than 200,000 viral TikToks, Reels, and YouTube Shorts"; that scraping method was not verified.
- **Runtime and dependencies:** None. Markdown only.
- **Linux GitHub Actions runnable:** Not applicable (no executable code in the repository).
- **Obligations:** MIT notice. The README attributes the project to Vyral Content and links to vyralcontent.com.

---

## Jakeschincariol/youtube-agent-skill

- **Commit SHA:** a2feb2104981a375ffd4f87ee04f4f5344ac43c6
- **Licence:** MIT (GitHub API SPDX `MIT`; top-level `LICENSE`)
- **Metadata:** default branch `main`, pushed 2026-09-16, size 32 KB, language Python, not archived, not a fork.
- **What it does:** Eleven Claude skills for running a YouTube channel. The target skill `skills/yt-script/` writes a video script from five candidate hooks drawn from 21 formulas in `hooks.json`, then ranks those hooks with `hookscore.py`, a heuristic scorer.
- **Inputs / outputs:** `hookscore.py` takes a text file of one hook per line, or `--hook "<line>"`, and prints ranked scores (or JSON with `--json`). Scores come from five heuristic properties (filler words, vague words, concreteness regex and similar), combined 60% mean and 40% weakest property. The SKILL.md says the skill reads a user file `~/.claude/youtube/voice.md` if present. The `hookscore.py` docstring says it was measured against 74 hooks, separating deliberately bad hooks well and creators' own hits from misses barely at all; that measurement was not verified.
- **Runtime and dependencies:** Python 3. The imports seen in the file header are `json`, `os`, `re`, `sys`, which are standard library. `hookscore.py` loads `hooks.json` from its own directory. The full file was not read.
- **Linux GitHub Actions runnable:** Likely yes for the scorer, since it is stdlib Python with no interactive input. Not run; not determined in full.
- **Obligations:** MIT notice. No other obligation found in the parts read.

---

## Garinmckayl/anima

- **Commit SHA:** f0249c4fdc94cc854abcff8bf34a087e37145714
- **Licence:** MIT (GitHub API SPDX `MIT`; top-level `LICENSE`; README badge)
- **Metadata:** default branch `main`, pushed 2026-10-16, size 19277 KB, language JavaScript, not archived, not a fork.
- **What it does:** A Claude Code skill (`SKILL.md`) that produces biology and pharmacology explainer figures: anatomy, receptors, cells and molecular mechanisms, as interactive isometric SVG figures with on-page cited numbers. The README says numbers that cannot be verified are left out; the sourcing process was not audited.
- **Inputs / outputs:** Input is a biology topic in natural language, or a `/anima` command in the README examples. Output is standalone HTML pages written by `node examples/<name>/build.mjs`, with a `--light` option. Six example directories were listed (`dopamine-receptors`, `estrogen-aggression`, `neuron`, `reward-addiction`, `semaglutide-glp1`, `stimulants-dat`, `sunflower-bend`), and `kit/turn-build.mjs` exists.
- **Runtime and dependencies:** Node.js (`.mjs` scripts). No top-level `package.json` appeared in the root listing or tree, and `examples/*/package.json` was not checked. Dependency list: not determined.
- **Linux GitHub Actions runnable:** Not determined. The build scripts appear to write files without an interactive session, but they were not run.
- **Obligations:** MIT notice. The repository is labelled with an educational-use note in its example text; no separate obligation found.

---

## andrewRowlinson/mplsoccer

- **Commit SHA:** 150be3f5d891526506a4c35b03256f173a70a14a
- **Licence:** MIT (GitHub API SPDX `MIT`; `pyproject.toml` `license = "MIT"`)
- **Metadata:** default branch `main`, pushed 2026-10-27, size 96910 KB, language Python, not archived, not a fork.
- **What it does:** A Python library that plots football (soccer) pitches and charts on matplotlib and loads StatsBomb open data. It is a plotting library, not a skill repository.
- **Inputs / outputs:** Inputs are event, tracking or pitch data as dataframes, or StatsBomb open data fetched over the network. Outputs are matplotlib figures and images.
- **Runtime and dependencies:** Python `>=3.10` (per `pyproject.toml`). Dependencies: `matplotlib >= 3.8`, `numpy`, `pandas`, `Pillow`, `requests`, `scipy`, `seaborn`. Build backend: hatchling.
- **Linux GitHub Actions runnable:** Probably yes. It is pure Python with no GUI requirement for file output. The StatsBomb loader needs network access to StatsBomb's open-data host. Not run; not determined in full.
- **Obligations:** MIT notice. StatsBomb open data carries its own terms, which were not checked.

---

## haidrrrry/claude-remotion-skill

- **Commit SHA:** 1dcbe5e3fc6cf970bd10d3cc05f0a8a5d19d0383
- **Licence:** MIT (GitHub API SPDX `MIT`; README badge links `LICENSE`, which is present at top level)
- **Metadata:** default branch `main`, pushed 2026-08-12, size 14826 KB, language TypeScript, not archived, not a fork.
- **What it does:** An Agent Skill (`remotion-motion-graphics/SKILL.md`) that instructs Claude to write Remotion (React) code for motion-graphics videos: spring easing, staggered entrances, captions, colour grades and sound design. The `examples/` directory contains four finished compositions and npm scripts that render them.
- **Inputs / outputs:** Input is a natural-language video request. Outputs are Remotion TSX source and rendered MP4 files (examples write to `out/`). `examples/scripts/gen-sfx.mjs` and `gen-track.mjs` generate audio. Also present: `remotion-motion-graphics.skill` (packaged skill), `scripts/build-skill.sh`, `demo.mp4`, `demo.gif`.
- **Runtime and dependencies:** Node.js and npm. `examples/package.json` lists `react` `^19.0.0` and `remotion` `^4.0.0` among its dependencies, plus the Remotion CLI through npm scripts (`remotion render`, `remotion studio`). Full dependency list: not determined.
- **Linux GitHub Actions runnable:** Not determined. Remotion renders with a headless browser, so the render scripts could run without a display. Not run.
- **Obligations:** MIT notice. Remotion is a separate dependency with its own licence terms, which were not checked in this audit.

---

## muhammadkaif654/pitchvision-ai-football-analytics

- **Commit SHA:** 8fe04cce41ae638e01010fafbd4deceafaf26998
- **Licence:** AGPL-3.0 (GitHub API SPDX `AGPL-3.0`; top-level `LICENSE` begins "GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007")
- **Metadata:** default branch `main`, pushed 2026-10-15, size 883 KB, language Python, not archived, not a fork.
- **What it does:** A Python application that takes a broadcast football clip and produces tracked players and ball (YOLO11 detection, ByteTrack tracking), pitch calibration, a bird's-eye tactical map, player and team statistics, heatmaps and exported reports, all through a Streamlit dashboard. It is an application, not a skill repository.
- **Inputs / outputs:** Input is a video clip uploaded through the dashboard or the CLI. Outputs are annotated and side-by-side videos, CSV and Excel reports, tracking data, heatmaps and ZIP exports. The README says sample footage is copyrighted and is not shipped.
- **Runtime and dependencies:** Python 3.12 (README). `requirements.txt` pins `torch==2.14.1`, `torchvision==0.29.1` (CPU index), `ultralytics==8.4.175`, `supervision==0.30.9`, `trackers==2.6.1`, `opencv-python==5.0.0.93`, `numpy==2.5.2`, `pandas==3.0.6`, `scikit-learn==1.8.0`, `scipy==1.18.1`, `mplsoccer==1.8.1`, `matplotlib==3.11.2`, `plotly==7.1.0`, `streamlit==1.65.0`. The README's documented install is Windows PowerShell with `uv`, via `scripts/setup.ps1`. Optional Intel GPU acceleration is mentioned.
- **Model weights:** Not in the repository. The tree contains `models/README.md` only; no `.pt` files were found. The README says the three models are produced by a Colab/Kaggle notebook (`notebooks/train_models.ipynb`) trained on Roboflow Universe datasets and distributed as `pitchvision_models.zip`. The licences of those datasets and the zip were not checked.
- **Linux GitHub Actions runnable:** Not determined. The documented setup is Windows-specific, the model weights must be obtained separately, and the app is a Streamlit server. Not run.
- **Obligations:** AGPL-3.0. Per the licence text, redistribution requires source availability and the licence's network-interaction clause (section 13) applies to modified versions offered to remote users. Dependency licences (for example `ultralytics`, which the AGPL text does not cover automatically) were not checked. Dataset and model-weight licences were not checked.

---

## vibegameengine/video-motion-craft

- **Commit SHA:** c17ab30ee376379c84d84315b886ae4282d7a96c
- **Licence:** MIT for original parts (GitHub API SPDX `MIT`; top-level `LICENSE`). Borrowed material is under other licences, listed below. Apache 2.0 full text in `LICENSE-APACHE-2.0.txt`.
- **Metadata:** default branch `main`, pushed 2026-09-07, size 120 KB, language Shell, not archived, not a fork.
- **What it does:** A Claude Code skill (`SKILL.md`) for making video with cinematic motion: Remotion for motion graphics and titles, and FFmpeg with Whisper for editing real footage (trim, jump-cut, captions, overlays, speed). The README says its motion rules come from case law in four borrowed projects.
- **Inputs / outputs:** Inputs are video files or natural-language requests. Outputs are rendered video and edited media. Scripts under `scripts/`: `caption.sh`, `edit.sh`, `gen-sfx.mjs`, `jumpcut.sh`, `overlay-text.sh`, `transcribe.sh`, `trim.sh`.
- **Borrowed material (from THIRD-PARTY-NOTICES.md):**
  - `video-shotcraft` (Vincent Wei), Apache License 2.0. Source of the `references/motion-laws.md` rules.
  - `claude-remotion-skill` (haidrrrry), MIT, copyright 2025 haidrrrry.
  - `video-editing-skill` (Ian Perez), MIT, copyright 2025.
  - `claude-code-video-toolkit` (Digital Samba), MIT, copyright 2024.
- **Runtime and dependencies:** Bash shell scripts, FFmpeg, Whisper (transcription), Node.js (`gen-sfx.mjs`), and Remotion. Versions and Whisper model download behaviour were not checked.
- **Linux GitHub Actions runnable:** Plausible for the shell and FFmpeg scripts, which need no interactive session. Not run; not determined.
- **Obligations:** MIT notice for original parts. Apache 2.0 for the `video-shotcraft`-derived parts: the notice and licence text must be retained, and modified files must carry change notices (Apache 2.0 section 4). MIT copyright notices for the three MIT sources must be retained. The THIRD-PARTY-NOTICES file records what was changed for each borrowed source.

---

## remotion-dev/skills

- **Commit SHA:** 1af7e69a2a613437d46095924057970a6a7df40d
- **Licence:** none found. GitHub API licence is null. No `LICENSE`, `LICENCE`, `COPYING` or `NOTICE` file exists anywhere in the recursive tree. `package.json` has no `license` field (it is `"private": true`). The README contains no licence section. Its only "licen" hit is a link to a `/remotion-license` skill, which describes Remotion's own licence and not this repository's.
- **Metadata:** default branch `main`, pushed 2026-11-09, size 634 KB, language TypeScript, not archived, not a fork.
- **What it does:** Remotion's collection of Agent Skills, which define best practices for building Remotion projects. The README says they are generated by `packages/skills/scripts/sync-readme.ts` in the upstream Remotion monorepo. The entry skill `skills/remotion-best-practices/SKILL.md` routes to the other skills (`remotion-create`, `remotion-captions`, `remotion-maps`, `remotion-render`, `remotion-studio`, and others, 12 files in total).
- **Inputs / outputs:** Inputs are a natural-language request. Output is agent instructions, and guidance on writing Remotion code. The skill text includes a rule to preserve user edits to code made outside the conversation.
- **Runtime and dependencies:** Markdown skill files. `package.json` has a `dev` script (`remotion studio`) and devDependencies on `remotion`, `@remotion/cli`, `@remotion/bundler`, `@remotion/three`, `@remotion/shapes`, `react` `^19.0.0`, `eslint`, and others.
- **Linux GitHub Actions runnable:** Not applicable to the skill text. The package scripts were not run.
- **Obligations:** None stated by a licence, because none was found. Under default copyright, no reuse grant is established by the repository itself; use terms are not determined.

---

## AleBrito124356/remotion-video-templates

- **Commit SHA:** 90149464d51a43fcb90e15491bf0d681c1b0fa49
- **Licence:** MIT (GitHub API SPDX `MIT`; `package.json` `"license": "MIT"`; README badge)
- **Metadata:** default branch `main`, pushed 2026-07-18, size 54 KB, language TypeScript, not archived, not a fork.
- **What it does:** Six Remotion video templates (logo intro, lower thirds, kinetic typography, data-driven charts, TikTok-style captions, product promo), each customisable through typed props. It is a template project, not a skill repository.
- **Inputs / outputs:** Inputs are typed props for each composition. Outputs are rendered MP4 files through `remotion render` (also `still` and `compositions` scripts). The README says it renders locally with no API keys.
- **Runtime and dependencies:** Node.js, TypeScript (`tsc --noEmit` typecheck). `package.json` dependencies include `@remotion/cli` `4.0.200`, `@remotion/google-fonts` `4.0.200`, `@remotion/transitions` `4.0.200`; the full list was not read. Google Fonts are used, so the render likely requires network access to fetch fonts. Not verified.
- **Linux GitHub Actions runnable:** Plausible; Remotion renders headless and the README says no API keys are needed. Not run; not determined in full.
- **Obligations:** MIT notice. Remotion's own licence is separate and was not checked. Google Fonts used by the templates carry their own licences (per font; not checked).

---

## mylxsw/cinematic-video-skill

- **Commit SHA:** 0fbcccc997f594352dfca1c82cafd389667a264a
- **Licence:** MIT (GitHub API SPDX `MIT`; top-level `LICENSE`)
- **Metadata:** default branch `main`, pushed 2026-09-28, size 70 KB, language TypeScript, not archived, not a fork.
- **What it does:** A Claude Code skill (`SKILL.md`, name `cinematic-video`) that directs a cinematic motion-graphics video from a brief: story design, fact verification, scene and beat timeline, visual system, synthesised score, Remotion render to MP4, and automated layout QA. Reference files under `references/` hold the phase-by-phase guidance.
- **Inputs / outputs:** Inputs are a one-line brief and research the agent performs (the skill says it fact-checks claims). Outputs are an MP4 and synthesised audio. The `template/` directory holds a starter kit: `template/tools/` (`audio_check.py`, `build.sh`, `contact_sheet.py`, `music.py`, `setup.sh`, `subset_fonts.sh`) and `template/video/` (`package.json`, `qa.mjs`).
- **Runtime and dependencies:** Node.js with Remotion (`template/video/package.json`, contents not read), Python (`music.py` and `audio_check.py`; the skill text names numpy), and Bash (`build.sh`, `setup.sh`). Full dependency lists: not determined. The skill text names font subsetting (`subset_fonts.sh`); font licences were not checked.
- **Linux GitHub Actions runnable:** Not determined. The shell and Python tooling appear to be non-interactive, but `setup.sh` and `build.sh` were not read or run.
- **Obligations:** MIT notice. Font and music-related licences in any bundled assets were not checked.

---

## bouclem/OpenAnimateMyMaps

- **Commit SHA:** a7e1c670d77733f183f72804f373674ee018952f
- **Licence:** MIT (GitHub API SPDX `MIT`; `package.json` `"license": "MIT"`; top-level `LICENSE` present)
- **Metadata:** default branch `main`, pushed 2026-09-23, size 4475 KB, language JavaScript, not archived, not a fork. Repository description is null.
- **Documentation note:** There is no top-level `README.md` (the contents request returned 404). `docs/README.md` exists and was not read.
- **What it does:** Per `package.json`, an open-source, no-account browser studio for cinematic map animation videos (Next.js application). It is not a skill repository.
- **Inputs / outputs:** Inputs are map data and settings entered in the browser. Outputs are videos encoded in the browser using `mediabunny`; the output container and codec were not checked.
- **Runtime and dependencies:** Node.js. `package.json` scripts: `next dev`, `next build`, `tsc --noEmit`, `npx serve out`. Key dependencies: `next` `16.3.6`, `react` and `react-dom` `19.3.0`, `maplibre-gl` `6.11.1`, `three` `0.186.0`, `@turf/turf` `7.4.0`, `mediabunny` `1.59.0`, `zustand` `5.0.15`, `lucide-react` `1.47.0`.
- **Linux GitHub Actions runnable:** Not determined. `next build` is a non-interactive step; video export is browser-driven and was not tested.
- **Obligations:** MIT notice. Map tile and basemap data providers' terms were not checked.

---

## Fansist/warmap

- **Commit SHA:** 5fb99f73703f1270cf8ef1a9d5ef30505efc7d8f
- **Licence:** none found. GitHub API licence is null. No `LICENSE`, `LICENCE`, `COPYING` or `NOTICE` file exists in the recursive tree. `package.json` has no `license` field. The README has no licence section. The only licence-related text is line 555: "Flag sources and licences are recorded in `public/flags/CREDITS.md`", which was not read.
- **Metadata:** default branch `main`, pushed 2026-08-11, size 157 KB, language TypeScript, not archived, not a fork.
- **What it does:** A renderer for data-driven animated war-map videos. It takes a JSON timeline document of dated events and renders MP4 files using Remotion: a satellite basemap, morphing front lines, naval fleets, animated counters, forts and supply networks. Two worked examples are included (`data/punic-war-1.json`, `data/western-desert.json`). It is not a skill repository.
- **Inputs / outputs:** Input is a JSON timeline file under `data/`. Outputs are MP4 files written to `out/` (for example `out/punic-war-1.mp4`). The `basemap`, `flags` and `validate` commands are listed in `package.json`; their data sources were not verified.
- **Runtime and dependencies:** Node.js with `tsx` and Remotion. Scripts: `studio`, `render`, `basemap`, `flags`, `validate`. Full dependency list: not determined.
- **Linux GitHub Actions runnable:** Not determined. The `basemap` and `flags` steps may fetch external imagery or flag data; this was not checked.
- **Obligations:** No licence-based obligation can be stated, because no repository licence was found. Satellite imagery and flag sources carry their own terms, recorded in `public/flags/CREDITS.md` (not read).

---

## Cele-san/vox-style-animation

- **Commit SHA:** 598760469edb55686208310652767a61d09f9793
- **Licence:** MIT (GitHub API SPDX `MIT`; top-level `LICENSE`)
- **Metadata:** default branch `main`, pushed 2026-07-14, size 12484 KB, language HTML, not archived, not a fork.
- **What it does:** A reusable style pack that reproduces what the README calls the "Vox look" (cream paper, halftone dots, heavy ink type, a highlighter marker, hand-drawn annotations) for motion-graphics video, built on HyperFrames (HTML-to-video). It also describes a method for capturing another style into a pack. The skill is `skills/vox-style-animation/SKILL.md`.
- **Inputs / outputs:** Inputs are HTML and CSS compositions, including `assets/brand-tokens.css` and `assets/starter/compositions/s1-demo.html`. Outputs are rendered video via HyperFrames. An example video is included under `examples/how-it-works/render/`.
- **Runtime and dependencies:** HTML and CSS. HyperFrames is the renderer; its requirements were not checked. No `package.json` appeared at the top level.
- **Linux GitHub Actions runnable:** Not determined. The HyperFrames renderer was not examined.
- **Obligations:** MIT notice. The README refers to a specific third-party video and the "Vox" look; no separate licence or trademark terms were found in the parts read.

---

## iart-ai/map-animation-skills

- **Commit SHA:** 390ca98bbcf2ea88a430a69c0dcbf423e43d075d
- **Licence:** MIT (GitHub API SPDX `MIT`; top-level `LICENSE`)
- **Metadata:** default branch `main`, pushed 2026-06-22, size 8455 KB, language HTML, not archived, not a fork.
- **What it does:** Agent Skills for animated maps for explainer video: camera zoom, orbit and pan, drawn-on routes, dropped pins and region highlights, with a 12fps stutter cadence. The target skill `skills/map-animation/SKILL.md` describes two production paths: Google Earth Studio camera imports composited in After Effects, and code-renderable GeoJSON or SVG vector maps driven by coordinates through Remotion.
- **Inputs / outputs:** Inputs are coordinates, GeoJSON or SVG vector maps, and natural-language requests. Outputs are video and images. Scripts: `scripts/contact-sheet.sh`, `scripts/probe-mp4.sh`, `scripts/seek-shot.sh`. The README links to the commercial agent at iart.ai.
- **Runtime and dependencies:** Bash scripts (probe and contact-sheet tools; their external tools were not checked, and `ffprobe` is plausible from the name only). Remotion and After Effects are referenced in the skill text. `skills/map-animation/README.md` exists and was not read.
- **Linux GitHub Actions runnable:** Not determined. The shell scripts were not run.
- **Obligations:** MIT notice. Google Earth Studio use is referenced in the skill text; Google's terms for that tool were not checked.

---

## GovinduSasanka/opus-motion-library

- **Commit SHA:** 8f1b78a25d0cf310c9bf904d434285046c4ed25a
- **Licence:** MIT (GitHub API SPDX `MIT`; top-level `LICENSE`; README badge "MIT licence" linking to it). `THIRD_PARTY_NOTICES.md` is present and was not read.
- **Metadata:** default branch `main`, pushed 2026-10-28, size 96190 KB, language TypeScript, not archived, not a fork.
- **What it does:** A library of parameterised motion graphics for Remotion and React, with SVG and three.js motions and one-line styles. It ships an ESM build, a web build, a custom element, a JSON catalog, a props schema and a styles file, plus an MCP server (`mcp/`) and a CLI (`cli/`). It is an npm library, not a skill repository.
- **Inputs / outputs:** Inputs are component props, the `catalog.json` and `styles.json` files, and CLI or MCP calls. Outputs are React components, Remotion compositions and rendered video. The README says rendering is deterministic (seeded randomness) with no cloud service.
- **Motion count is inconsistent across the repository:** the GitHub repository description says "615+", the `package.json` description says "605", and the README badge says "616". The count was not reconciled.
- **Runtime and dependencies:** Node.js, ES modules (`"type": "module"`), `main`/`exports` pointing to `dist/`. Remotion, React and three.js are named in the description. Full dependency list: not determined (`package.json` was read in part).
- **Linux GitHub Actions runnable:** Not determined. The library is a Node package; rendering was not tested.
- **Obligations:** MIT notice. `THIRD_PARTY_NOTICES.md` and the bundled media in `gallery/` and `docs/media/` were not checked for separate terms.

---

## rive-app/rive-react

- **Commit SHA:** eaca5be32a191c15b4654361de4836c6f2fa3999
- **Licence:** MIT (GitHub API SPDX `MIT`; `package.json` `"license"` present; top-level `LICENSE` present)
- **Metadata:** default branch `main`, pushed 2026-11-05, size 11712 KB, language TypeScript, not archived, not a fork.
- **What it does:** The React runtime for Rive, a 2D and 3D animation engine. It is a wrapper around Rive's JS and WebAssembly runtime that renders Rive animations in React components. It is a library, not a skill repository.
- **Inputs / outputs:** Inputs are `.riv` animation files and React props. Output is a rendered canvas in a browser UI.
- **Runtime and dependencies:** Version 4.38.1. Build with `bunchee`, tests with `jest`, lint with ESLint, typecheck with `tsc`. Peer dependencies include `react` `^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0`. Full dependency list: not determined.
- **Linux GitHub Actions runnable:** Probably yes for build and test (npm scripts). The repository has a `.github` directory with a `tests.yml` workflow badge. Not run; not determined.
- **Obligations:** MIT notice. The Rive WebAssembly runtime it loads is a separate component whose terms were not checked.

---

## ThomasAFink/SOLSYS

*Identity as the owner's selected SOLSYS is unconfirmed.*

- **Commit SHA:** 310932f432d6f290e402482962f23d8724674598
- **Licence:** MIT (GitHub API SPDX `MIT`; top-level `LICENSE`)
- **Metadata:** default branch `main`, pushed 2026-11-07, size field 9,560,639 KB (about 9.1 GiB, per the API), language Python, not archived, not a fork. Homepage empty.
- **Repository description (verbatim from the API):** "This project visualizes the solar system from the inner planets out to the nearest stars, with a special focus on asteroids."
- **What it does (from README):** Visualises the solar system with corrected Keplerian physics, from the inner planets past the Kuiper Belt and Oort Cloud to nearby stars. Main product is light and dark GIF animations and a staged 3D zoom. Side product is static multi-zoom JPGs and a light-year star map.
- **Inputs / outputs:** Inputs are orbital and catalogue data, including `data/interstellar_objects.csv` (for 1I/ʻOumuamua, 2I/Borisov, 3I/ATLAS). Outputs are GIF and JPG files (under `output/`) and a star map.
- **Runtime and dependencies (from README):** Python. Install with `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt` (plus a dev requirements file). Dependencies named: `numpy`, `pandas`, `matplotlib`. `pyproject.toml` and `render.py` exist at top level; not read.
- **Linux GitHub Actions runnable:** Not determined. The README describes a command-line render workflow; the 9 GiB reported size and the render run time were not assessed; not run.
- **Obligations:** MIT notice.

---

## pitchaura.readthedocs.io (documentation site, not a repository on the list)

- **What it is (from the site, fetched with `curl -L`):** The documentation site for "PitchAura", a "spatial analytics computation engine for football/soccer tracking data". It turns tracking coordinates into pitch-control matrices, Voronoi territories, tactical metrics and cognitive vision models, built on NumPy and SciPy. Modules named: Space and pitch control (kinematic model, Spearman 2018, plus Voronoi), Tactics, Cognitive, Sync, Viz, and an I/O adapter for kloppy. The site footer names the source as `rondo-labs/PitchAura`.
- **Install (from the site):** `pip install pitch-aura`, with optional extras `kloppy`, `viz`, or both. Requirements: Python 3.12 or later, NumPy 1.24 or later, SciPy 1.10 or later, pandas 2.0 or later.
- **Licence (from the site's License section):** "GNU General Public License v3.0 — see LICENSE." The LICENSE file in the source repository was not fetched, so the site's statement is the only source for this licence.
- **Commit SHA:** not applicable; the site was not linked to a repository commit in this audit.
- **Linux GitHub Actions runnable:** Not determined; the package was not installed.
- **Obligations (per GPL-3.0, as stated by the site):** Source availability and licence-text retention on redistribution.
