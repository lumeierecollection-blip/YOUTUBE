# Motion proposal — the smallest change that makes the library build

**Status: proposal only. Nothing here is implemented.** It is waiting for the owner's decision.

## 1. Current state

From `docs/MOTION-AUDIT.md` (measured, 114 drawings): **64 (56%) arrive finished** (at least 80% of their final ink is on screen at the first frame of the beat), 2 build only by opacity, and 48 already build (draw-on 13, sequenced 34, transform 1). ComposedScene wraps every drawing in the same fade/slide entrance. So on screen, the static 66 look like finished illustrations fading in, not motion graphics assembling.

## 2. The proposed layer

One wrapper, `BuildIn`, around any drawing. It needs no knowledge of the drawing's internals and does not edit it. It applies one of four builds over a build window at the start of the beat (proposed: p 0 → 0.35, so the build is finished well before the midpoint frame the per-beat check samples), then holds:

| Build | What it does, mechanically | Why it needs no change to the drawing |
|---|---|---|
| **draw** | Every stroked element gets `pathLength=1`, with `stroke-dasharray=1` and `stroke-dashoffset` running 1→0. Fills follow once the stroke closes (fill-opacity 0→original over the last 30% of the window). | Applied by walking the drawing's returned React elements (`React.Children.map` / `cloneElement`) and adding attributes. Existing attribute values are preserved. |
| **assemble** | The drawing's top-level children appear in declaration order: child *i* of *n* fades and rises 8 px over its own slice of the window. | Uses the drawing's own element order, which is already back-to-front (sheet, then marks). Nothing is re-ordered. |
| **sweep** | A `clipPath` rect grows across the drawing's box, left→right (or top→bottom for tall boxes). | One clip around the drawing's `<g>`; the drawing's markup is untouched. |
| **grow** | A `scale` from 0.6→1 about the box's bottom-centre anchor, eased, with opacity 0→1 over the first third. | One transform on the wrapping `<g>`. |

Drawings that already build keep their own animation, and the wrapper passes them through (`build: "own"`). The wrapper replaces ComposedScene's generic fade for library shapes only; abstract primitives keep `motionState`.

## 3. Which build each drawing gets

Only the drawings that do not already build are assigned. Everything else is `own`.

| Drawing | Build | Why |
|---|---|---|
| calculator | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| case file folder | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| date marker | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| ledger notebook | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| legal document | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| satellite terrain | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| archival photograph | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| benefit rule | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| blueprint sheet | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| bolt joint | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| clock face | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| component part | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| concept node | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| conveyor belt | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| courthouse column | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| cross section | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| cursor pointer | grow | a single solid figure: it grows from its base anchor instead of fading in |
| desk edge | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| evidence tube | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| figure silhouette | grow | a single solid figure: it grows from its base anchor instead of fading in |
| film reel | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| gauge dial | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| gavel | grow | a single solid figure: it grows from its base anchor instead of fading in |
| gear train | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| iv stand | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| machine housing | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| medical scan | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| museum artifact | grow | a single solid figure: it grows from its base anchor instead of fading in |
| office tower | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| orbit path | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| patient chart | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| period painting | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| pinned photograph | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| planet sphere | grow | a single solid figure: it grows from its base anchor instead of fading in |
| police dashcam frame | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| prison window | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| product silhouette | grow | a single solid figure: it grows from its base anchor instead of fading in |
| progress arc | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| question line | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| resource site marker | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| robot arm | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| royal seal | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| scale bar | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| share price line | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| spacecraft silhouette | grow | a single solid figure: it grows from its base anchor instead of fading in |
| star field | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| stock ticker tape | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| stone monument | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| blind spider | grow | a single solid figure: it grows from its base anchor instead of fading in |
| cave cross section | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| cave entrance | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| cave worker | grow | a single solid figure: it grows from its base anchor instead of fading in |
| earth globe | grow | a single solid figure: it grows from its base anchor instead of fading in |
| eyeless leech | grow | a single solid figure: it grows from its base anchor instead of fading in |
| gas cloud | grow | a single solid figure: it grows from its base anchor instead of fading in |
| hydrothermal vent | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| mineral crystal | grow | a single solid figure: it grows from its base anchor instead of fading in |
| no sunlight | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| oxygen gauge | draw | line-led: its identity is strokes (a rule, a dial, an arc), so the stroke growing IS the build |
| pale centipede | grow | a single solid figure: it grows from its base anchor instead of fading in |
| rock strata | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| sea surface | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| sealed entrance | assemble | made of distinct parts: parts arriving in order reads as it being put together |
| springtail | grow | a single solid figure: it grows from its base anchor instead of fading in |
| sunlight | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |
| total darkness | sweep | a flat surface (photo, screen, sheet, ground): a mask wipe reveals it the way a print or scan arrives |

**Keep their own build (`own`):** answer frame, application window, archival map sheet, bacteria colony, balance sheet, bank statement, benchmark bar, calendar grid, cash notes, checklist rule, constitutional text, court document, depth scale, dna helix, ecosystem web, enrollment form, evidence exhibit, family tree, galaxy spiral, handwritten letter, lab bench, latency trace, link path, load curve, map-label, map-markers, map-outline, map-region-highlight, map-route, money trail, national border line, output transcript, phone showing a budgeting app, pill dose, plan comparison rows, press headline, process arrow, prompt field, receipt, red string, stacked layer, state map, stepped platform, supply route, territory fill, timeline rule, vital trace, wire node.

Totals: draw 12, assemble 25, sweep 14, grow 15, own 48.

## 4. What changes in the renderer

- **One file:** `visual-engine/composed-scene.jsx`.
- **One function:** a new `BuildIn({ build, p, box, children })` beside `LibraryShape`, plus a `BUILD_OF` table (the §3 assignment, keyed by drawing name) in the same file.
- **One call site:** inside `LibraryShape`, `<ObjectShape …/>` becomes `<BuildIn build={BUILD_OF[obj.name] ?? "own"} p={p} box={rect}><ObjectShape …/></BuildIn>`, and the `opacity={m.enter}` fade on its wrapping `<g>` is removed for drawings whose build is not `own`.
- Verification when implemented: the same no-pixel markup measurement as the audit. Every drawing not marked `own` must go from under 20% of final ink at p=0 to 100% by p=0.35. That check would live in `visual/run-visual-tests.js`.

## 5. What does NOT change

- Every drawing's SVG geometry: no path, coordinate or element is added to or removed from any registered drawing.
- Every colour (palette roles are untouched) and every stroke width.
- The plan format, the planner prompt, and validation.
- The abstract primitives and their motions (`motionState`).
- The map family and the other drawings that already build (`own`).

## Known limits of this proposal

- **draw** on a drawing made mostly of fills (few strokes) reads as a fade. The assignment avoids this by putting fill-heavy drawings on sweep, grow or assemble, but a few may need a second look once rendered.
- **assemble** relies on top-level child order. A drawing that returns one `<g>` wrapping everything has a single child, so it would assemble all at once. The wrapper would then descend one level, and this should be checked per drawing during implementation.
- None of this has been rendered. Each build needs a CI artifact review before anyone claims it looks right.
