# Visual Identity — what `channels.json` could supply, and what it could not

`config/visual-identity.json` is a **draft**. It fails `scripts/gate-visual-identity.js`
on purpose: section 2 requires human curation and a human signature, and neither
has happened. The gate is the worklist.

Every value in the draft is **transcribed** from a value a human already wrote in
`config/channels.json`. Nothing is generated, inferred or averaged.

## Provenance of every value in the draft

| Field | ch-01 | ch-02 | ch-09 | Source |
|---|---|---|---|---|
| `primary_palette` | 4 hex | 4 hex | 4 hex | `channels.json` → `colors`, in the order `primary, secondary, accent, bg` |
| `typography_primary` | Inter | DM Sans | Roboto Condensed | `channels.json` → `font` |
| `environment_type` | `desk-flatlay` | `courtroom` | `map-territory` | first entry of `visual_spec.camera_angles`: "top-down desk flat-lay", "courtroom establishing wide", "satellite top-down" |
| `transition_language` | 3 values | — | — | `visual_spec.transitions`, taken only where it already holds **exactly** 3 |

## Two things the transcription refused to do

**Order `primary_palette` by prominence.** Section 2 says "ordered from most to
least prominent". `channels.json` orders them `primary, secondary, accent, bg`,
which is a naming order, not a measured prominence order. The draft preserves
the source order untouched. **A human must confirm or reorder it** — measuring
real prominence needs frames, which is the research phase's job.

**Cut `transition_language` down to 3.** ch-02 declares four transitions
(`document-reveal`, `map-zoom`, `dramatic-cut`, `scale-impact`) and ch-09
declares four (`map-morph`, `territory-fill`, `border-draw`, `zoom-region`).
Section 2 permits exactly three. Choosing which to drop is an editorial decision
about the channel, so the field is left absent rather than truncated.

## What `channels.json` does not contain at all

Nine of the twelve required fields have no source in the repo. They are not
missing by oversight; the concepts do not exist in the current config:

- `secondary_palette` — there is one accent colour per channel, not three.
- `typography_secondary` — one font per channel.
- `core_objects` — `visual_spec.b_roll_sources` lists **sources** ("stock
  office/desk footage"), not the object types section 2 asks for ("bills,
  calculator, phone, ledger, receipt").
- `camera_language` — `visual_spec.camera_angles` are shot descriptions, not
  moves from section 2's closed twelve. Only ch-01's "top-down desk flat-lay"
  and ch-09's "satellite top-down" map to a listed move (`top-down`); the rest
  ("infographic animated build", "constitutional text zoom") are not camera
  moves at all.
- `framing_default`, `text_placement`, `use_of_negative_space`, `motion_curve` —
  no equivalent field exists.
- `style_reference_document` — the section-1 research has not been completed.

## One inconsistency found while transcribing, not resolved

ch-01 and ch-09 both set `bg_mode: "white"` while their `colors.bg` is a very
dark navy (`#0A1020`, `#050F1A`). ch-02 sets `bg_mode: "black"` with
`colors.bg: "#0F0F1A"`. Whichever is authoritative, the two disagree, and the
new specification has to state one background truth. Flagged rather than
silently picked.

## Why the research phase cannot close the gaps from this machine

Measured, not assumed:

- A script here has no egress. `curl` to `behance.net`, `vimeo.com`,
  `awwwards.com` and `elements.envato.com` all return `000`.
- Searching does work through the session's own tools, and finds references at
  the right tier: Behance fintech motion case studies, agency showreels, and
  recognised creators in the niche (Humphrey Yang, WhiteBoard Finance, Two
  Cents, Ben Felix).
- But text sources describe colour in words. A representative fintech case study
  gives "white, charcoal, and signature blue/green gradient". Section 1.4 asks
  for "the exact hex codes used most frequently". Those two are not the same
  thing, and turning one into the other is exactly the fabrication this repo
  forbids.

So of section 1.4's nine attributes, text research can reach the qualitative
ones — typography family, transition styles, framing conventions, iconography,
text placement — and cannot reach `dominant_colour_palette` (as hex) or
`motion_curves_and_easing`. `research-style.mjs` writes those UNRESOLVED rather
than filling them.

**The repo already owns the mechanism that would close it.**
`scripts/vision_critic.py` makes one vision call per contact sheet against an
OpenAI-compatible endpoint. Pointed at frames sampled from reference videos it
would measure palette and easing directly. It needs `VISION_API_KEY` and a
vision-capable `VISION_MODEL`, neither set here, and the reference frames would
have to be supplied or fetched somewhere with egress.
