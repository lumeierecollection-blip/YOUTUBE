# Self-Heal Agent

Scoped self-healing agent for the render pipeline. Runs when the workflow fails.

## Permission Scope

This agent may ONLY modify these files:

```yaml
permission:
  edit:
    "**": deny
    "scripts/local-visual-plan.cjs": allow
    "scripts/gemini-visual-plan.js": allow
    "src/skills/remotion-render/visual-engine/beat-interpreter.js": allow
    "src/skills/remotion-render/visual-engine/director/visual-director.js": allow
    "config/visual-identity.json": allow  # only bg_mode and colors.bg fields
  bash: allow
  read: allow
```

## What This Agent Does

1. Reads failure logs from `data/audit/render-review/`, `data/renders/`, or `logs/`
2. Classifies errors into:
   - **CREATION_ERROR** — fixable (typography rules, mechanism distribution, plan issues)
   - **RENDER_ERROR** — not fixable (ffmpeg, Remotion, fonts, JSX)
   - **INFRASTRUCTURE** — retry once (timeout, rate limit, OOM)
   - **UPLOAD_ERROR** — credentials issue (YouTube OAuth)
3. Fixes only CREATION_ERROR in allowed paths
4. Logs RENDER_ERROR to `data/self-heal/` and exits
5. Tracks attempts (max 3) in `data/self-heal/attempt-count.txt`

## What This Agent May Never Modify

- Anything under `src/skills/remotion-render/` except the two files listed above
- Any `.jsx` file
- Any primitive, scene, layout, caption, or style file
- The Remotion composition (`Root.jsx`, `index.ts`)
- `render.js` beyond path/plan-loading logic
- The workflow file itself

If a fix requires touching a forbidden path, the agent must stop and write `data/self-heal/blocked-<date>.txt` explaining why, then exit non-zero.

## Error Types

### CREATION_ERROR (fixable)
- "no physical mechanism detected" in log
- Mechanism distribution over 40%
- TYPOGRAPHY count wrong (not 1–2)
- Zero beats in plan
- Invalid JSON in plan
- "Cannot visualize beat" errors

### RENDER_ERROR (not fixable)
- ffmpeg mux hang
- Remotion frame errors
- Missing font
- Canvas dimensions wrong
- Any `.jsx` error

### INFRASTRUCTURE (retry once)
- Timeout
- Rate limit
- Connection reset
- Out of memory

### UPLOAD_ERROR (not fixable)
- YouTube OAuth token issues
- Upload permission denied
- Video too long

## Loop Behavior

```
attempt = 1
while attempt <= 3:
    run daily-pipeline.yml
    if success and mp4 exists and upload succeeded: exit 0
    if attempt == 3: exit 1 with full log
    read failure logs
    classify:
      CREATION_ERROR → fix in allowed paths, retry
      RENDER_ERROR → log to data/self-heal/, exit 1
      INFRASTRUCTURE → retry once, then exit
      UPLOAD_ERROR → log credentials issue, exit 1
    attempt += 1
```
