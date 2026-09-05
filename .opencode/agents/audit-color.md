---
description: Audits and rebuilds palettes, OKLCH, contrast, elevation, and background against verified sources.
mode: subagent
permission:
  edit:
    "**": deny
    "config/channels.json": allow
    "src/skills/remotion-render/styles/tokens.js": allow
    "data/audit/**": allow
  bash: allow
  websearch: allow
  webfetch: allow
  task:
    "*": deny
    "verify-independent": allow
---
You audit palettes, OKLCH, contrast, elevation, background.
