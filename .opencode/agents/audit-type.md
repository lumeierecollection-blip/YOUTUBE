---
description: Audits and rebuilds type, fonts, measurement, captions, and crispness against verified sources.
mode: subagent
permission:
  edit:
    "**": deny
    "src/skills/remotion-render/captions/**": allow
    "src/skills/remotion-render/layout/measure.js": allow
    "data/audit/**": allow
  bash: allow
  websearch: allow
  webfetch: allow
  task:
    "*": deny
    "verify-independent": allow
---
You audit type, fonts, measurement, captions, crispness.
