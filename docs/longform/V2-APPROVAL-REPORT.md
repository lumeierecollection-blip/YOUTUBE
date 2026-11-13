# Long form v2: visual approval package (stills only), 13 Nov 2026

Nothing here is a full render, a timeline render or an upload. Shorts are untouched. Nothing is merged to `main`. Waiting for approval.

**Where things are**
- Branch `feat/longform` (work) and `stills/longform-v2` (approval render on GitHub Actions, artifact `longform-stills-*`).
- Stills, contact sheets, storyboards: `output/longform-approval/<channel>/` (`contact-sheet.jpg`, `storyboard.jpg`, `sheet-opening.jpg`, `sheet-scenes.jpg`, `sheet-transitions.jpg`, `sheet-thumbs.jpg`, every still labelled with its component, technique and sources).
- Scripts and storyboards: `docs/longform/episodes/<channel>-<slug>/SCRIPT.md` (generated from `platform/longform/v2/episodes/*.mjs`, the same files the stills render from).
- Research: `docs/longform/analysis/` (20 records), `DESIGN-LAWS.md`, `AUDIO-TRANSITIONS.md`, `SKILL-REGISTER.md`.

## Architecture (new, nothing from v1)
- `src/skills/remotion-render/channels/lf2/`: `kit.jsx` (type, timing, live two-scene transitions, audio layer, grain), `geomap.jsx`, `hidden.jsx`, `aitest.jsx`, `court.jsx`, `rival.jsx`, `compositions.jsx` (two generic compositions: `LF2Scene` renders any scene of any channel from props, `LF2Tx` renders a transition between two live scenes).
- Data/asset tools: `platform/longform/v2/capture.mjs` (Playwright capture + recording + word rectangles), `pdfpage.py` (court PDF pages + word rectangles), `assets.mjs` (Commons photos with licence manifest), `platform/longform/rival/prepare.mjs` (StatsBomb to scene data), `platform/longform/experiments/multiply.mjs` + `.github/workflows/longform-experiment.yml` (real AI test on the runner).
- Config: `config/longform-v2.json` (all colour), `config/longform-audio.json` (sound profile per channel, from measurement).
- Stills: `platform/longform/stills/specs.mjs` builds every still from the episode storyboards; `run.mjs` renders, labels and assembles contact and storyboard sheets.

## The four samples
| Channel | Episode | Evidence | Beats / stills |
|---|---|---|---|
| Hidden Past | The ships trapped in the Suez Canal for eight years (Yellow Fleet, 1967–75) | Wikipedia (3 articles), OSM geometry, geoBoundaries, 9 Commons photos (1967, 1973, 1974, 1975, NASA 2002), live Sentinel-2 imagery + terrain | 19 / 33 |
| AI Tested | At what size does AI multiplication break? | Our own test, 2 GitHub Actions runs, 115 seeded problems, raw replies kept; real page capture of the models page | 14 / 27 |
| Court & Spotlight | Boris Becker: four guilty verdicts, twenty acquittals | Judge's sentencing remarks (PDF), two Insolvency Service releases (archived), 6 Commons photos; Wikipedia only for career facts, marked REPORTED | 15 / 29 |
| Rival Lines | How Spain won the Euro 2024 final, in data | StatsBomb open data: 3,304 events, lineups, 2,882 360 freeze-frames | 15 / 29 |

## Decisions and the reference behind each
| Decision | Reference (observed) |
|---|---|
| Hidden Past opens on one uncut map with labels arriving in narration order, then a dated photo with its credit and a source-worded caption | 3IVbe0xrRt8 (0 cuts in 300 s, labels in order); WiRLNEl-4bk (uncut dated CCTV, credit and caption boxes) |
| One satellite base, camera re-frames it; colour only for held land and routes; small key bottom-left | U_UoAZrOTNU, FA-oEtccS_k, R60ZGwd3n9E |
| Chart over a picture; scale translation; figures stacked early | U_UoAZrOTNU (oil chart); WiRLNEl-4bk (10 NYC blocks; numbers in first 2 min) |
| AI Tested evidence = the real screen, camera to the line, highlight box; result beside its settings; pill label | 1Aqhg0FVm-w, tDWtcyeNNew, cUeZMUGCxrw, h5zkzon0gM4 |
| Court: every claim on a captured source with the line highlighted, Credit tag on every photo, white quote card, dated typed transcript | mxCZUz2F24E, 1aAGV7G5zbo, jZpq6BCud7s |
| Court: provenance bug that stays up; date cards between sections | OJ8fsE_GOlg, -p_TBe0Re_s |
| Court: status chip on every card and a ledger that never mixes convictions with acquittals | our rule (channel brief), not in the references |
| Rival: black vignetted pitch, team dots, big-number opener, scoreline card reused as minute marker, one capital callout, COMING UP tag, timeline spine | N8PZt_9_adI, KC2Vgjw282s, Nx8h403Sj_s, oZaPKaIVIA0, Dki5tjN0rDE |
| Rival proof layer = animated event + 360 data instead of broadcast clips | references cut to broadcast footage we have no rights to |
| Transitions: dissolve on footage, camera move on maps (Hidden Past); blur whip (Rival); dip/dissolve (Court); hard cut / push (AI) | measured and frame-checked, AUDIO-TRANSITIONS.md |

## Technical tests
- 118 stills rendered locally on Windows (Remotion `renderStill`, Chrome swangle) and inspected; defects fixed and re-rendered (list in SKILL-REGISTER.md).
- Same package rendered on GitHub Actions (`stills/longform-v2`).
- Real AI test: run 43343589332 and run 43346149304 (two models complete; others dropped on quota, 402, 404, 500, recorded as such).
- Playwright capture: 6 pages, 1 recorded browser session.

## Limitations (plainly)
1. **Scripts are condensed** (287 to 639 words, about 2 to 4 minutes each). They cover each full story arc in final order; the target is 9 to 10 minutes. Lengthening needs more research per section.
2. **No motion has been verified.** Stills prove composition, data and layout, not easing, pacing or transitions in motion. The mograph-critic motion checks need a short video render, which waits for your approval.
3. **Audio is designed, not heard.** Sound profiles come from measurement of the references. The repo has no documentary music beds (only a kalimba loop), so a music library is still needed.
4. **3D terrain + filled areas fail under software rendering.** Scenes that fill an area use a flat, tilted map. A GPU runner would allow both.
5. **CesiumJS and Blender were not tested** (no keys, not installed).
6. **AI Tested covers two small models.** Larger models hit free-tier quota. The episode says so on screen.
7. **Rival 360 data** records only players inside the broadcast camera's view and has no player identities between events; movement between events is interpolated and labelled as such.
8. **Court** uses archived copies of two gov.uk pages (the live pages return HTTP 410). The judge's remarks contain an internal date inconsistency (2017 vs 2018), documented in the episode file.
9. **Rights to the references:** our versions do not use their footage, maps or music; reference clips stayed local for measurement only.
