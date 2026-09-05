# Motion-Graphics Fix Kit for the YOUTUBE repo

Three parts. Do them in order.

---

## PART 1 — Install the reference library (this is the "what it actually looks like" part)

Your renderer knows mograph theory. It has never seen mograph. The fix is not a
better explanation — it's a library of **concrete recipes with real numbers**
(exact easing curves, exact frame counts, exact stagger offsets) that it copies
instead of inventing.

The best one that exists: **video-shotcraft**
(https://github.com/Vincentwei1021/video-shotcraft) — Apache-2.0, Remotion-native,
152 shot recipe cards, each with duration / parameters / easing / known pitfalls,
plus `references/aesthetic-rules.md` which is a visual-QA rubric, plus working
`.tsx` implementations for every card.

Install into the repo (vendored, so CI has it):

```bash
git clone --depth 1 https://github.com/Vincentwei1021/video-shotcraft.git \
  vendor/video-shotcraft
rm -rf vendor/video-shotcraft/.git
```

Then symlink or copy its SKILL.md into your skills dir so OpenCode auto-discovers it:

```bash
mkdir -p .opencode/skills/video-shotcraft
cp -r vendor/video-shotcraft/SKILL.md vendor/video-shotcraft/references \
      .opencode/skills/video-shotcraft/
```

**Headless/CI gotchas** the shotcraft README documents — you will hit all three on
GitHub Actions:
1. `remotion render` fails with "Maximum for --concurrency is 2" on small runners →
   pass `--concurrency=1`.
2. Recent Chrome dropped old headless mode → use a `chrome-headless-shell` binary,
   not system chromium.
3. If `remotion.media` is unreachable, auto-download of the headless shell fails →
   pass `--browser-executable=<path to local chrome-headless-shell>`.

## PART 2 — Drop in the two skills from this kit

```
.opencode/skills/scene-director/SKILL.md    # decides what each scene looks like
.opencode/skills/mograph-critic/SKILL.md    # looks at the render, says what's wrong
scripts/qa_frames.py                        # free, deterministic defect detector
scripts/vision_critic.py                    # one cheap vision call per iteration
.github/workflows/visual-qa-loop.yml        # the self-correcting loop
```

`scripts/qa_frames.py` needs `pip install pillow numpy` and `ffmpeg` on PATH.

## PART 3 — Paste this into OpenCode

Everything between the lines. Run it in the repo root.

---

You are fixing the visual quality of the Remotion renderer in this repo. The
output currently looks robotic: elements are unaligned, motion is linear, and
scenes are assembled by a blueprint that guesses. Your job is to make it look
like professional motion graphics, verified by looking at actual rendered pixels,
not by reasoning about the code.

**Hard rules for this whole session:**

1. Never claim a visual change works until you have rendered frames and read the
   QA report. "The code looks correct" is not evidence. A PNG is evidence.
2. Read `.opencode/skills/video-shotcraft/SKILL.md` and
   `references/aesthetic-rules.md` before you write any animation code. When you
   need a motion, find the closest shot recipe card and copy its actual
   parameters. Do not invent easing values.
3. Read `.opencode/skills/mograph-critic/SKILL.md` and
   `.opencode/skills/scene-director/SKILL.md` and follow their loops exactly.
4. Budget: you may spend at most **3 vision-critic calls per composition**. Run
   the free deterministic check (`scripts/qa_frames.py`) first every time; only
   escalate to the vision critic when the free check passes but the result still
   looks wrong. If a composition is still failing after 3 iterations, stop, write
   what you tried and what remains broken to `qa/BLOCKED.md`, and move on. Do not
   loop forever.
5. Work on ONE composition end to end before touching the next. Do not refactor
   across all 50 channels at once.

**Order of work:**

Step 1 — Inventory. `grep` the actual component files. List every existing
mograph primitive with its file path. Do not assume a component exists. Write
`qa/INVENTORY.md`.

Step 2 — Baseline. Render 6 seconds of one composition at 540x960 and run
`python scripts/qa_frames.py --video out/baseline.mp4 --report qa/baseline.json`.
Read the report. This tells you, for free: which frames have elements breaking
the safe margins, which elements share no alignment grid, and — most importantly
— which animations are moving at constant velocity (the single biggest cause of
"robotic").

Step 3 — Fix the motion system first, before anything else. Constant-velocity
motion is the defect. Every entrance, exit, and transition must use a real easing
curve taken from a shot card. Then fix stagger: elements that appear together
should appear 2-4 frames apart, not simultaneously. Then fix the grid: everything
aligns to a shared column and baseline.

Step 4 — Re-render, re-run QA, compare the numbers against baseline. Iterate
within your 3-call budget.

Step 5 — Only when one composition passes, apply the same corrections to the
shared primitives so the other styles inherit them.

Step 6 — Wire `.github/workflows/visual-qa-loop.yml` so this runs on every future
render and fails the build on regression.

Start with Step 1. Report the inventory before doing anything else.

---
