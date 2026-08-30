---
description: Audits and rebuilds the SFX map, gains, LUFS, and audio sync against verified sources.
mode: subagent
permission:
  edit:
    "**": deny
    "src/skills/remotion-render/src/audio/**": allow
    "src/skills/remotion-render/audio.js": allow
    "data/audit/**": allow
  bash: allow
  websearch: allow
  webfetch: allow
  task:
    "*": deny
    "verify-independent": allow
---
You audit SFX map, gains, LUFS, audio sync.
