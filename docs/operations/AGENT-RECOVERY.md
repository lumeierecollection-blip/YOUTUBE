# Recovery of the first nine agents (audited 2026-11-09)

All nine stopped at the same moment with `HTTP 429 ... 5-hour limit`. None had pushed a branch,
started a render, or produced a preview. No agent's work duplicated another's. None is running.

| Assignment | Worktree `.claude/worktrees/` | State found | Recovered to | Reassignment |
|---|---|---|---|---|
| AI Tested | `agent-af22557b3c0c00674` | Research only, no files | Nothing to keep | Whole assignment |
| Hidden Past | `agent-a15a35d1d8465f5eb` | No files | Nothing to keep | Whole assignment |
| Red Space Facts | `agent-a98ee874be312f332` | `channel.json`, `deps.json`, `figures.json`, `sample.json`, Saturn texture | `wip/red-space-facts` `a7133e0e` | Compositions, preview, render |
| Dopamine Loop | `agent-a73d1c06907922d98` | No files | Nothing to keep | Whole assignment |
| Gray Matter | `agent-ab1a919f2ba18d303` | `figures.mjs` and test, `preview.mjs`, `sample.mjs`, `scenes.mjs`, `compositions.jsx`, Gray's plates | `wip/gray-matter` `13e7d5b3` | SKILLS.md, render, review |
| Rival Lines | `agent-a40f8116e8fd2a98f` | No files | Nothing to keep | Whole assignment |
| Court & Spotlight | `agent-ae675ab019e4474db` | Vendored Opus Motion modules with LICENSE and PIN | `wip/court-and-spotlight` `ed4e0332` | Formats, claim layer, render |
| World View | `agent-a6344e9388832abe2` | No files | Nothing to keep | Whole assignment |
| Script engine | `agent-a5f27d873da3e9134` | Research only, no files | Nothing to keep | Whole assignment |

Worktrees are kept until their work is confirmed merged into its branch.

Recovered work is marked `wip`: it has not been rendered or reviewed.

## Foundation gaps found

- `config/channel-registry.json` holds all eight channels, but only `channel-preview.yml` reads it.
  `autopilot.yml` reads `config/autopilot.json`, which covers two channels. Connecting production to
  the registry is integration work.
- Stage names were free text. They are now a fixed list, and the index shows branch, commit, artifact
  link, frames, voice and QA.
