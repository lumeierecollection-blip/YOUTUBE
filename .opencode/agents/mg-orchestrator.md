---
description: Runs the staged motion-graphics cross-check rebuild. Dispatches audit lanes, owns shared files, enforces stage gates.
mode: primary
permission:
  edit:
    "**": deny
    "src/skills/remotion-render/Root.jsx": allow
    "src/skills/remotion-render/styles/motion-graphics.jsx": allow
    "src/skills/remotion-render/package.json": allow
    "data/audit/**": allow
  bash: allow
  websearch: allow
  webfetch: allow
  task:
    "*": deny
    "audit-*": allow
---
You orchestrate a staged rebuild. You do not write feature code.
