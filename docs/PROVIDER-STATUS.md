# Provider Status

## Cerebras
- Endpoint: api.cerebras.ai
- Status: **402 payment_required**
- Error: "Payment required to access this resource. Visit your billing tab."
- Impact: opencode-agent.js exits 1 after all models exhaust retries. Entire pipeline blocked.
- Fix: https://cloud.cerebras.ai/ → billing
- Owner: account holder
- Date first observed: 2026-09-19 (workflow runs 35462154718, 35468403242, 35468932724)
- Affected models: cerebras/gpt-oss-120b, all Cerebras-hosted models

## Deferred — Vox Renderer
- Channels 49 (Cosmic Voxels) and 50 (Mind Mechanics) have isual_engine: "vox" but no vox-style renderer exists.
- Root.jsx registers 4 compositions: cinematic-documentary, minimal, motion-graphics, directed-scene. None are vox-style.
- Temporary fix: route ch-49/50 through existing motion-graphics renderer until vox is built.
- The vox-style-treatment skill (.opencode/skills/vox-style-treatment/SKILL.md) documents the target style but has no corresponding Remotion composition.