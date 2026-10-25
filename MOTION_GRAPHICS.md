# What this system publishes: motion graphics

## What motion graphics is

Motion graphics is animated visual design: type, shapes, icons, data and images that move to communicate an idea, usually alongside narration. There is no camera and no actor. Everything on screen is drawn, placed and animated on purpose, so each movement carries meaning or sets the pace.

## How it differs from other video forms

- **Live action** is filmed footage. Its images come from the world and are rarely built to explain one point. Motion graphics builds each frame around one sentence.
- **A static slideshow** shows still images that cut from one to the next. Motion graphics keeps the picture alive inside each beat, so nothing sits still while the narration runs.
- **Pure animation** tells a story through characters and scenes. Motion graphics is closer to a diagram that moves, with no story world to invest in. That suits short news and explainer content, where the viewer needs the fact quickly.

## Vocabulary

- **beat**: one spoken sentence and the visuals that run under it.
- **composition**: the layout of one beat: where the type, shapes and images sit.
- **shot**: a specific composition type, such as a title card, a stat card or a map.
- **transition**: how one beat hands over to the next. The outgoing beat holds until the incoming one has something on screen.
- **entrance**: how an element arrives. Entrances are short, with an ease-out and no bounce beyond the set overshoots.
- **camera move**: a slow pan, push or sway of the whole beat, not a cut.
- **pacing**: how often something on screen changes. The pace check fails any beat that stays still for more than one second.

## The rules this system follows

- Every sentence gets a visual.
- Never a blank beat.
- Never a wrong fact: every claim traces to a fetched source, and the script is gated against its sources before anything renders.
- Something moves about every half second, and no beat stays still for more than one second.
- No repeated images.
- No template look.
- Real logos and real photos for named people and places. If a real photo cannot be sourced and verified, a graphic is used instead.

## What makes it look good versus cheap

- **Flat.** Each background is one flat colour. No gradients, glows or vignettes. Depth comes from layering and spacing, not effects.
- **One accent colour.** A channel has two hues: a base and an accent. The accent marks the one thing to look at.
- **Restraint in motion.** Entrances are short and settle. Movement is slow and continuous, and there is no shake, spin, bounce or flashing.
- **Real things over decoration.** A real logo or photo beats an invented icon. Data is shown as data.
- **Pacing that matches the voice.** Movement lands on the words it supports. A beat that looks busy but says nothing is still a bad beat.

Cheap looks come from the opposite: gradients everywhere, the same card repeated, stock icons used as decoration, and one animated element left to carry a whole long sentence.

## Where the reference is

The look is defined by reference videos in the repo. The planner sees frames of them while it plans (`scripts/reference-frames.js`), and the render is scored against them.

**The shared set**, used by every channel that has no style spec of its own (`SHARED_REFS` at `scripts/reference-frames.js:30`):

- `research/motion-graphics-ref/ref-01.mp4`: aged print. Cream paper, an engraved illustration and a column of serif body text, as on a 19th-century magazine page.
- `research/motion-graphics-ref/ref-02.mp4`: pale ground with a faint grid, one lit lantern and leaf branches at the edges, a single small grey word in sans type. Quiet and airy.
- `research/motion-graphics-ref/ref-03.mp4`: cream ground with a faint pink grid and a soft grey ink-smoke mass in the upper middle. Almost no type.

**Channels with their own reference**, from `reference_video` in each `channels/<id>/style-spec.json`:

- **ch-05** (`newspaper-collage`): `research/4_5917850534521349135.mp4`. Newsprint text with a yellow highlighter bar in one frame. A second frame is a dark UK map, so the frames do not agree with each other.
- **ch-06** (`archival-montage`): `research/4_5917850534521349255.mp4`. Black-and-white archival photographs with grain, "SCENE 02 / SCENE 03" captions, and a grey car on a grey ground.
- **ch-08** (`stepped-timeline`): `research/4_5917850534521349257.mp4`. Dark workspace with a red-and-white title tag ("IMPRESSIVE"), a year marker ("2009"), and glitched black-and-white portraits.
- **ch-10** (`editorial-serif-light`): `research/4_5917850534521349264.mp4`. Light grey ground, cherry-blossom branches, a black panel with small white specks, and a grid of engraved images beside a steamship.

**Channels on the shared set.** Of the 19 unique motion-graphics channels in `config/channels.json`, 15 use the shared set: ch-01, ch-02, ch-09, ch-22, ch-24, ch-26, ch-29, ch-31, ch-33, ch-37, ch-39, ch-42, ch-44, ch-48, ch-49. Channel 9, the one whose render failed the pace check, is among them.

**What the frames show.** Each description above is from one or two stills per reference, not from the whole video. Several frames carry third-party marks: a social handle on ref-01, "Edited By Prince" on ch-10, a "fiverr." logo and placeholder text ("I can make highlighter effect here") on ch-05, and "Corporate Timeline History 02" on ch-08. These look like template or demo clips. Whether the repo may use them is the owner's call, and it is an open item.

The motion rules are in `MOTION-GRAPHICS-MANUAL.md`. The pace rule is the owner's: no beat sits still for more than one second.
