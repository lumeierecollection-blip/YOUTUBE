# Gray Matter: inspected skills and tools

## Anima (Garinmckayl/anima)

- Repository: https://github.com/Garinmckayl/anima
- Pinned commit: `f0249c4fdc94cc854abcff8bf34a087e37145714` (2026-10-16, "sunflower-bend: add the cap-binds preset...")
- Licence: MIT (Natnael Getenew). Zero runtime dependencies; the drawing kit uses Node built-ins only.

### What it actually is

A Claude Code skill (`SKILL.md`, installed with `npx skills add`) that makes interactive, isometric SVG
figures of anatomy, neurobiology, pharmacology and cells, delivered as standalone HTML pages with a live
readout and a sources block. Six shipped examples, including `examples/neuron/` (a neuron with
branching dendrites and a hoverable synapse) and `examples/reward-addiction/` (a schematic mid-sagittal
brain). So it is a biology and neuroscience figure tool, not a general animation tool.

What it is not: it renders HTML pages driven by a clock and a small model. It has no video export for
those pages (`scripts/capture.mjs` needs Chrome), and its example pages cannot be stepped frame by frame
by Remotion. It does not produce accurate anatomical placement of brain regions: its brain figure is a
schematic. The SKILL.md instruction loop needs a Claude session.

### What was reviewed before anything ran

Read: README, SKILL.md, `references/neuro.md`, and the kit modules this channel imports:
`kit/blob.mjs`, `kit/branch.mjs`, `kit/iso-kit.mjs`, `kit/chem.mjs`, `kit/tube.mjs`, `kit/lathe.mjs`,
`kit/bio-audit.mjs`. Searched them for network access, `child_process`, `eval`, `process.env` and file
writes: none. Imports are only each other plus `node:fs/promises` and `node:url`, and `bio-audit.mjs`
reads a file only in its own command-line entry point, which this channel does not call. There is no
`package.json`, so there is no install step and no transitive dependency.

### What this channel uses it for

The kit is pure functions that return SVG strings. `figures.mjs` calls them on the runner
(`blobOf`, `branchPieces`, `branchSvg`, `membraneOf`, `helixOf`, `fitProjection`, `bioAudit`) to build:
a CA1-style pyramidal neuron, a magnified dendrite with eight spines, a synapse (presynaptic terminal,
vesicles, cleft, receptors) and an actin filament. Remotion animates those SVG strings (spines
retracting, transmitter crossing the cleft, cofilin splitting the filament). Anima's own HTML pages,
live model and toggles are not used.

`bioAudit` is run on the synapse and fails the preview if a membrane intersects or a label points at a
part that does not exist. It checks drawing consistency, not biological truth; the claim records do that.

### What it is not used for

Where a brain region sits. That comes from public-domain Gray's Anatomy plates (below), because a
schematic brain from a figure kit does not fix anatomical placement.

### Proof of use

The runner clones the pinned commit (`fetchAnima()` in `preview.mjs`, checked against the commit hash),
and `figure-audit.json` in each run records the commit and the audit result. Locally,
`figures.test.mjs` passes 4/4 against this commit with the audit returning `{ ok: true, errors: [] }`.

### Concerns

- Figures are schematic and not to scale; every scene that uses them says so on screen. Spine loss is
  drawn for 3 of 8 spines and is not the measured amount.
- Anima's project is young (2026). The pin protects the run from later changes.
- Cannot run unattended through its SKILL.md; the reusable part (the kit) is called from a script.

## Gray's Anatomy plates (public domain, Wikimedia Commons)

- `assets/Gray739-emphasizing-hippocampus.png`: https://commons.wikimedia.org/wiki/File:Gray739-emphasizing-hippocampus.png
- `assets/Gray726.png`: https://commons.wikimedia.org/wiki/File:Gray726.png
- Gray's Anatomy (1918), drawings by Henry Vandyke Carter; the plate's cyan hippocampus emphasis comes from
  the Commons file. Public domain. The preview derives the highlight mask from that cyan colouring, so
  the glow cannot drift off the structure. Verified at run time: the mask must be at least 1500 px.
- Limit: Gray726's head and brain placement in scene 1 is a schematic head outline drawn for this
  channel around the plate. Scene 1 says "Head and brain placement is schematic".

## Remotion

Used to render all motion (`src/skills/remotion-render/channels/gray-matter/compositions.jsx`), through
the shared `renderComposition` tool. Voice is `edge-tts` (`en-US-JennyNeural`), generated speech and
labelled so.

## Sources behind the claims

All excerpts are copied from fetched text (checked programmatically against the fetched bodies). See
`sample.mjs`: Newbury et al. 2021 (Psychological Bulletin, via Europe PMC), Anand and Dhikav 2012
(Annals of Indian Academy of Neurology), Yoo et al. 2007 (Nature Neuroscience, abstract), Havekes et al.
2016 (eLife, via Europe PMC full text PMC4996653), Star Protocols 2024 (one definition sentence).
Narration is provisional: "hand-planned sample, not from the script engine".
