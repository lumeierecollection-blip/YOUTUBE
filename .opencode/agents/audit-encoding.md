---
description: Audits and rebuilds archetypes, charts, concept mapping, and data honesty against verified sources.
mode: subagent
permission:
  edit:
    "**": deny
    "src/skills/remotion-render/primitives/Chart.jsx": allow
    "src/skills/remotion-render/spec/fromBeats.js": allow
    "data/audit/**": allow
  bash: allow
  websearch: allow
  webfetch: allow
  task:
    "*": deny
    "verify-independent": allow
---
You audit archetypes, charts, concept mapping, data honesty.
