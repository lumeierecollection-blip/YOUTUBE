# Multi-channel production platform

One production infrastructure, independent channel identities. The runtime is ordinary
software run by GitHub Actions; no interactive session is involved in making a video.

## Ownership (agents edit only what they own)

| Owner | Paths |
|---|---|
| Lead architect | `config/channel-registry.json`, `platform/contracts/`, `platform/preview/`, `.github/workflows/channel-preview.yml`, `src/skills/remotion-render/Root.jsx`, `src/skills/remotion-render/render-channel-composition.mjs`, `scripts/autopilot/` |
| Script engine agent | `platform/script-engine/`, `prompts/script-engine/` |
| Channel agent `<key>` | `platform/channels/<key>/`, `src/skills/remotion-render/channels/<key>/` |

A channel agent that needs a change in someone else's path reports it. It does not make it.

Protected, never touched: `task.txt`, `debug_creds.js`, `server.js`, `rix.json`, `signal_aggregator/lib/**`.

## What a channel provides

```
platform/channels/<key>/
  channel.json       visual config, palette, type, voice direction, scene library index
  scenes.mjs         SCENES: treatment id -> { purposes, background, skill, build }
  preview.mjs        default async ({ key, runId, outDir, tools }) => produces a real sample
  deps.json          optional { "npm": ["rive-js@x.y.z"] }, installed only for this channel's run
  requirements.txt   optional Python packages for this channel's run
  SKILLS.md          inspected skills: licence, commit, inputs, outputs, proof of use
src/skills/remotion-render/channels/<key>/
  compositions.jsx   export const compositions = [...], picked up automatically by Root.jsx
```

Dependencies stay per channel, so no agent edits a shared `package.json`.

## Data contracts

`platform/contracts/*.schema.json` define what passes between stages: story blueprint, script
package, critique, claim record, scene plan, preview metadata. Change them only through the
lead architect.

Traceability runs research -> claim -> script sentence -> scene -> visual asset, through
`claim_ids` on every sentence and scene.

## Previews

Pushing to `preview/<key>` (or `claude/preview-<key>...`) runs that channel's `preview.mjs` on
GitHub with no YouTube credentials. Each stage's output goes to `output/previews/<key>/<run>/`
and is published straight away to the `automation/previews` branch, where `previews/index.md`
is the central index. Runs never overwrite earlier runs.

The index updates when a stage finishes. It is not a live stream.
