---
name: asset-sourcing
description: Build the free, licensed, treated image library motion-graphics videos composite into their scenes. Use when a channel needs real photography for IMAGE_BEAT scenes, when the b-roll set for a topic is thin, or when re-treating an asset that failed a prior cutout attempt.
---

# Asset Sourcing Skill

## Purpose

Source real, license-clean photography from free APIs, cut it out or treat
it (`treat.js` — see PART 6 of MOTION-GRAPHICS-MANUAL.md's rebuild notes),
and register it in `data/asset-library/index.json` so a render can pick it
up with a plain file read. Never fetches at render time — this is an
offline library-building step (`fetch-library.js`), run manually or on its
own schedule, separate from `daily-pipeline.yml`'s daily render.

## Sources (all free, commercial-safe, PD/CC0/CC-BY/Pexels/Unsplash only)

| Source | Key required | Module |
|---|---|---|
| Wikimedia Commons | no | `sources/wikimedia.js` |
| Met Museum Open Access | no | `sources/met.js` |
| NASA Image Library | no | `sources/nasa.js` |
| Library of Congress | no | `sources/loc.js` |
| National Archives (NARA) | maybe (`NARA_API_KEY`) | `sources/nara.js` |
| Smithsonian Open Access | yes (`SMITHSONIAN_API_KEY` or `DATA_GOV_API_KEY`) | `sources/smithsonian.js` |
| Pexels | yes (`PEXELS_API_KEY`) | `sources/pexels.js` |
| Unsplash | yes (`UNSPLASH_ACCESS_KEY`) | `sources/unsplash.js` |

A source with no key set logs a warning and returns no candidates — it
never fails the whole build.

## Setup (one-time)

`treat.js` shells out to rembg via a dedicated Python venv, kept separate
from the pipeline's main Python environment because rembg's dependency
tree (onnxruntime, scikit-image, numba) is heavy and CPU-inference-only:

```
python3 -m venv .venv-rembg
.venv-rembg/bin/pip install "rembg[cpu]"
```

The u2net model weights (~176MB) download from GitHub on first use and
cache to `~/.u2net/` — `actions/cache` should key on `.venv-rembg` and
`~/.u2net` in CI so this only happens once.

## Process

1. `node src/skills/asset-sourcing/fetch-library.js <channel-id> <query terms...> [--count N] [--mode bw|color]`
2. Searches all 8 sources, filters to allowed licenses (`licenses.js`).
3. Downloads at >=2x the shorts stage width (2160px) — anything smaller is
   skipped, not silently accepted undersized.
4. Runs `treat.js`: rembg cutout (or full-bleed for texture/landscape
   photos the classifier routes away from a forced cutout), tone
   normalization, contact shadow, tight crop.
5. Copies the treated file into
   `src/skills/remotion-render/public/asset-library/<channel-id>/` and
   appends a manifest row to `data/asset-library/index.json` (source,
   licence, attribution, treatment, mode — never just the bare file).
6. `select.js` (pure, no network) is what `render.js` calls at render time
   to pick the best keyword match for a channel from the manifest already
   built — see its header for why this half never touches the network.

## Known limitations (say so, don't paper over it)

- The cutout-vs-full-bleed classifier (`treat.js`'s `classify()`) is a
  measured heuristic — alpha coverage + edge-touch — not a quality
  judgement. It correctly routes clean single-subject photos (a spider, a
  fish) to cutout and can still let through a low-coverage but visually
  ambiguous "cutout" on a busy texture photo (confirmed on the
  `calcium-formations.jpg` fixture during this rebuild: u2net found a
  low-coverage, non-edge-touching blob around one rock feature that
  technically passed the classifier but isn't a clean subject isolation).
  Spot-check treated output before trusting a channel's whole batch.
- This skill was built and unit-verified in a sandboxed session whose
  egress policy denied `commons.wikimedia.org` and `huggingface.co`
  outright (confirmed via the proxy's status endpoint) while allowing
  `pypi.org`/`files.pythonhosted.org` (rembg's own install) and
  `github.com` (rembg's model-weight download). The source modules
  (`sources/*.js`) are therefore verified by construction against each
  API's documented contract and by their pure `parseX()` functions, not by
  a live end-to-end fetch against every host — run `fetch-library.js` once
  in an environment with open egress (e.g. GitHub Actions) before trusting
  a source module you haven't seen return real results.
