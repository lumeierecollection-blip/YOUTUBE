# Style Reference — Money Mind (ch-01), motion-graphics

## What this document is, and what it is not

**It is not a completed section-1.5 consolidation.** A real one requires ten
professional references each analysed for nine attributes, two of which
(exact hex palettes, motion curves) are measurements of moving pixels. This
machine cannot fetch reference media at all — `curl` to behance.net, vimeo.com,
awwwards.com and elements.envato.com all return `000` — and text sources
describe colour in words, not hex. The section-1 worksheet
(`ch-01-motion-graphics.worksheet.json`) stays open for that work.

**It is the authored design rationale** behind ch-01's Visual Identity
Specification, written on explicit instruction to fill the nine fields
`config/channels.json` could not supply. Every value below states what it was
derived from. Where the derivation is a judgement rather than a transcription,
it says so.

Query run (section 1.2):
`2026 Personal Finance motion-graphics video design trends professional editors`

## References found

The fixed 1.2 query returns trend journalism rather than the tiers 1.3 asks
for, which is itself worth recording. Two further searches were needed to reach
professional sources in the niche.

| # | Reference | Tier |
|---|---|---|
| 1 | [FinTech SaaS Explainer Video, Behance](https://www.behance.net/gallery/240116369/FinTech-Saas-Explainer-Video-Motion-graphics-Video) | agency-showreel |
| 2 | [10 Best Fintech Explainer Videos That Build Trust, Bluetrain](https://www.bluetrain.co.uk/blog/10-best-fintech-explainer-videos-that-build-trust/) | agency-showreel |
| 3 | [18 Best SaaS Explainer Video Examples, Whatastory](https://www.whatastory.agency/blog/saas-explainer-video-examples) | agency-showreel |
| 4 | [10 Motion Graphic Design Trends for 2026, SonduckFilm](https://www.sonduckfilm.com/tutorials/motion-trends/) | recognised-creator |
| 5 | [11 Motion Design Trends for 2026, Envato Elements](https://elements.envato.com/learn/motion-design-trends) | trend journalism (does not fit a 1.3 tier) |
| 6 | [Best Personal Finance YouTube Channels, Vidpros](https://vidpros.com/best-personal-finance-youtube-channels/) | index of recognised creators |
| 7 | [Top Finance YouTube Creators 2026, OutlierKit](https://outlierkit.com/resources/youtube-finance-niche-creators/) | index of recognised creators |

Named creators surfaced by 6 and 7 (Humphrey Yang, WhiteBoard Finance, Two
Cents, Ben Felix) are genuine tier-3 references but could not be analysed:
watching them is not possible from here.

## What the sources actually said

- A representative fintech explainer opens with "bold typography, clean
  transitions, and dynamic energy", on "white, charcoal, and signature
  blue/green gradient" (ref 2). **Named colours, not hex** — this is precisely
  the gap section 1.4 cannot close from text.
- Two formats dominate the niche: talking-head explainers with strong on-screen
  graphics, and faceless voiceover essays over slow B-roll (refs 6, 7).
- Mixed-media collage and analog texture are the 2026 direction; vertical 9:16
  is now over 60% of digital video (refs 4, 5).

## Derivation of each authored field

| Field | Value | Derived from |
|---|---|---|
| `secondary_palette` | `#16A34A`, `#94A3B8`, `#F8FAFC` | The declared accent `#22C55E` darkened for a second green, plus the slate and paper-white the white-ground compositions already use. **Judgement**: `channels.json` declares one accent, not three. |
| `typography_secondary` | JetBrains Mono | Available as a real woff2. **Judgement**, but a grounded one: this channel's world is receipts and ledgers, and tabular numerals belong on them. |
| `core_objects` | bank statement, receipt, calculator, phone showing a budgeting app, cash notes, ledger notebook | The addendum's own finance example ("bills, calculator, phone, ledger, receipt") plus `content_pillars` → "budget tool reviews" for the phone. |
| `camera_language` | top-down, push-in, pull-out, static | `visual_spec.camera_angles` "top-down desk flat-lay" → `top-down`, "phone screen close-up" → `push-in`. `pull-out` and `static` complete the set: a flat-lay reveals by widening off an object, it does not pan across. **Corrected after review** — the first draft gave all three channels the same four moves in a different order, which is the monoculture in miniature. |
| `framing_default` | medium | The desk has to read as a desk before any one object on it does. Close-up is reserved for the phone and the receipt. **Judgement.** |
| `text_placement` | lower-third | Numbers annotate objects here rather than replacing them, so the type stays off the desk surface. **Judgement.** |
| `use_of_negative_space` | high | `bg_mode: white` and `visual_spec.color_grade` "clean bright with green accent highlights". |
| `motion_curve` | ease-in-out | `visual_spec.pacing` "steady with info-dense segments" and `sfx_profile.music_style` "upbeat lo-fi electronic, light and motivating". |

## Unmeasured

`dominant_colour_palette` as hex and `motion_curves_and_easing` are not
established by any reference above. The palette in the specification is the
channel's own declared colour, not a measured consensus from references.
