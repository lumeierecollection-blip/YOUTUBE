---
description: Audits and rebuilds layout, slots, safe zones, and the layout compiler against verified sources.
mode: subagent
permission:
  edit:
    "**": deny
    "src/skills/remotion-render/layout/**": allow
    "src/skills/remotion-render/spec/**": allow
    "src/skills/remotion-render/layers/**": allow
    "data/audit/**": allow
  bash: allow
  websearch: allow
  webfetch: allow
  task:
    "*": deny
    "verify-independent": allow
---
You audit layout, slots, safe zones, compiler, alignment.
