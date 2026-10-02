# V2 — cutouts clean: live Pixabay only, every PNG verified (2026-10-02)

Branch `claude/visual-rebuild-from-5f91e75`.

**Result:**
- The old library is deleted and nothing falls back to it.
- Every cutout is fetched live, isolated, and verified with the owner's
  LITERAL prompt each time it is used.
- In 5 test runs, only one cutout reached a frame: a gavel. It was the right
  object, but it was grounded figuratively on a sentence about a law. That
  gap is now closed (`613890f`).
- On the final six-channel run, no sentence named a physical object, so no
  cutout was fetched and none rendered.

## What changed

| Commit | Fix |
|---|---|
| `4374b1e` | **1.** `src/skills/remotion-render/public/cutouts/` deleted: 26 files (22 PNGs, `index.json`, `verified.json`, credits). Nothing kept. |
| `f00ed31` | **2.** Library fallback removed. It was in `scripts/render-and-qa.js` (`conceptLibrary()` / `lib.find`), not in `fetch-cutout-once.cjs`. Also removed: the workflow's `cutouts` job and `build_cutouts` input, `build-cutout-library.mjs`, `reverify-cutout-library.mjs`, `cutout-library-lib.mjs`, `cutout-contact-sheet.mjs`, `docs/cutout-contact-sheet.png`. |
| `7b2d930` | **3.** `verify-cutout-image.cjs` uses the owner's prompt verbatim. Accepted only for `verdict === "LITERAL"` and `recognizable === true`. The verdict cache is removed. **4.** 6 candidates per concept; every rejection moves to the next; all rejected means no cutout. Logs use the owner's format. |
| `14bf5ff` | **5.** `public/cutouts-live/` and `public/cutouts/` are git-ignored. The local `cutouts-live/` was empty, and nothing under it was ever tracked. A concept reused within one run is **verified again** before reuse. |
| `f00ed31` | **6.** Every beat that renders a cutout logs `"<name>" from pixabay, verdict=LITERAL, seen="…"` and `source=<pixabay page>`. |
| `138be28` | The planner is told to name the literal object ("gloves"), not a symbol for the idea ("shield"). |
| `613890f` | **Concept grounding is literal:** a photographed concept needs every word of its own name in the sentence. |

Two smaller points:
- **Bank files are verified too.** A `public/png-bank/` file (none exists
  today) goes through the same verifier before use.
- **The flow is now:** bank (verified) → Pixabay (6 candidates, tags must
  name every word of the concept) → rembg → geometric checks → verifier →
  accepted, or the beat renders without a cutout.

## Test runs

### ch-2 only

| Run | Topic | Concepts fetched | Result |
|---|---|---|---|
| [37005965046](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/37005965046) | US immigration / HUD housing | none | Every planner concept (shield, padlock, government-building…) was dropped as not named by its sentence. approved-review (frame review). |
| [37010325344](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/37010325344) | California electric shock gloves | none | The sentence names "gloves"; the planner offered shield / warning-triangle → prompt fix `138be28`. Rejected on zones (a TYPE-SPLIT layout regression, fixed in `138be28`). |
| [37012196580](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/37012196580) | California credit discrimination law | shield, credit card, gavel | See the candidate log below. |
| [37016991996](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/37016991996) | NYC rent freeze | none | No sentence names an object. approved-review (frame review). |

**Candidate log, run 37012196580:**

```
"shield"       1 REJECTED (FIGURATIVE, saw "red umbrella protecting laptop")
               2 REJECTED (isolation: more than one object / a scene)
               3 REJECTED (isolation: the object covers 0.0% of the photo)
               4 REJECTED (isolation: more than one object / a scene)
               5 REJECTED (DIFFERENT, saw "face mask and money")
               6 REJECTED (isolation: more than one object / a scene)
               all 6 rejected, beat renders without a cutout
"credit card"  1 REJECTED (isolation: cut by the frame)
               2 REJECTED (isolation: the object covers 5.4% of the photo)
               3 REJECTED (FIGURATIVE, saw "leather wallet with cards")
               4 REJECTED (isolation: cut by the frame)
               5 REJECTED (isolation: cut by the frame)
               6 REJECTED (DIFFERENT, saw "leather wallet with cards")
               all 6 rejected, beat renders without a cutout
"gavel"        1 ACCEPTED (LITERAL, saw "wooden gavel on block")
               pixabay.com/photos/gavel-auction-law-hammer-symbol-2492011/
               attempt 2: reuse re-verified, ACCEPTED (LITERAL, "wooden gavel on block")
```

**The one rendered cutout, checked on the frame (beat 8, t = 49.6 s):** a
wooden gavel on its sound block, cleanly isolated. Its ink box is 930×476
centred at (540, 1060). The image matches its concept.

**The sentence it was attached to does not:** "This law empowers
Californians by ensuring they receive fair credit." The beat check flagged
it ("not literally named in the sentence"). The concept passed grounding
because the old gavel spec's trigger words included "law", "court" and
"judge". That is a figurative match at the concept level, which no image
verifier can catch. Fixed in `613890f`: "gavel" now needs the word "gavel".
Tested in `scripts/test-concept-visuals.mjs`.

### All six channels, [37020625494](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/37020625494) (`dae9f3a`)

| Channel | Outcome | Cutouts |
|---|---|---|
| ch-1 | Discovery failed | — |
| ch-2 | Research failed | — |
| ch-9 | approved-review (challenger), 71% visual | None named. 23 planner concepts dropped (factory, padlock, handshake…); the sentences are about embargoes and industries. |
| ch-26 | approved-review (frame review), 50% visual | None named (arrests, investors). |
| ch-44 | **approved**; upload failed (`invalid_grant`, expired token) | None named. |
| ch-48 | approved-review (challenger), 60% visual | None named (APQR software, data aggregation). |

I checked every dropped concept against its sentence; none was a false
negative. **No wrong PNG rendered in any run after the library was deleted.**

## Where this stops

- **Metaphors still ground.** A word the sentence uses figuratively ("a
  shield against discrimination") is literally named, so it grounds. The
  verifier judges the image against the word, not the sentence's sense of
  it. In 37012196580 every shield candidate was rejected anyway, but a real
  shield photo would have passed.
- **The cost is fewer cutouts.** Many scripts in these niches name no
  physical object, so most videos now have no cutout. That is what
  right-or-absent means here; the visual-first ratio pays for it (ch-26 50%).
- **The verifier is one vision model's reading** (Groq qwen3.8-27b, then
  Gemini flash-lite, then Ollama qwen2.5vl:3b), not ground truth. The beat
  check reviews the rendered frame again, and that is what caught the gavel.
- **Uploads:** ch-9 and ch-26 return `invalid_client`; ch-44 returns
  `invalid_grant`.
