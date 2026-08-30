---
description: Audits and rebuilds renderMedia options, config, encoder, and CI against verified sources.
mode: subagent
permission:
  edit:
    "**": deny
    "src/skills/remotion-render/render.js": allow
    "src/skills/remotion-render/remotion.config.js": allow
    ".github/**": allow
    "data/audit/**": allow
  bash: allow
  websearch: allow
  webfetch: allow
  task:
    "*": deny
    "verify-independent": allow
---
You audit render options, config, encoder, CI.
