# AI Tested: skills inspected and used

Pinned: `.agents/skills/*` last changed at commit `461233c6625665f088ff0b34fbc31c3a3f696837`; branch base `56770d23ca0a9f9a51c7bd3eb29e11b89dd202c9` (feat/platform).
All three are in-repo skills (SKILL.md only, no scripts or dependencies, no separate licence file; they are repository content). Repository facts beyond this: `docs/operations/SPECIALIST-SKILL-AUDIT.md`.

| Skill | Takes in / puts out | How this channel uses it | Where the sample departs from it |
|---|---|---|---|
| `terminal-inserts` | Spec: dark chrome, traffic lights, JetBrains Mono, typed characters, blinking block cursor | `Terminal` scene in `src/skills/remotion-render/channels/ai-tested/compositions.jsx`: dark inset, three dots, mono type, typed command, blinking cursor, command output lines. Output is the real stdout of the displayed command, run on the runner. | Typing speed: the skill says 3-5 chars/s, but a 90-character real command would not fit in a Short; typed at about 12 chars/s. Window title is a plain "bash - ubuntu runner". |
| `article-highlights` | Spec: marker stroke drawn left to right, accent colour, one accent highlight per beat, source citation on the card, real sources only | `CaptureWindow` + `Marker`: marker stroke draws over the flag cell of a real headless-Chrome capture of the fetched docs page, with the source host shown. | The skill describes a headline card; this uses the real page pixels in a browser mock-up instead of a typeset card, so the highlighted text cannot differ from the source. |
| `motion-graphics` | Spec: white-friendly flat colour, one accent, rise/fade only (no skew/rotate), node/connector shapes, beat every 1.5-3 s | Hook comparison cards, `Pipe` process diagram (connectors draw, a dot travels), close card. Palette in `channel.json` (teal accent, no purple). | Spec is dark-bg oriented; white background used per the platform visual standard. Kinetic type sized 120+ px. |

## Added in this channel (in my paths)
- `capture.mjs`: annotated capture of a real page. Headless Chrome via `puppeteer-core@23.11.1` (installed per run from `deps.json`, Apache-2.0) finds the table row, crops the real pixels, returns the flag cell's coordinates so the annotation sits on the real element.
- Terminal demonstration: `preview.mjs` runs the shown command with `bash -c` and feeds the captured stdout to the scene. The run fails if the three flags are not in the output.
- Feature callouts: `Callout` (line from highlight to a label naming the feature).
- Device mock-up with a real capture: `CaptureWindow` (browser window frame around the capture).
- `qa.mjs`: channel QA producing `qa-report.json`.

## Not used
`scripts/autopilot/ai-tested.mjs`, `visual-vocabulary.mjs`, `logos.mjs` were read, not imported: they build editor-timeline layers and depend on LLM planning and vision calls in the autopilot pipeline. The sample reuses their palette idea (white, surface grey, one accent) and their scene vocabulary (kinetic, terminal, article, diagram, compare, conclusion). Logos were not used: no company mark was needed and none would be shown without a verified source file.

## Claim handling
Claims are recorded in `claims.json`. `demonstrated_feature` is used only when this render itself ran something (the `--help` command). Behaviour that comes from the docs and was not executed (it needs an authenticated account) is `documented_not_run`, not `demonstrated_feature`. No marketing claims are used. No charts: no numeric data was needed.
