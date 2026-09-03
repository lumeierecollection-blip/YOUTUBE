# remocn components — install commands, verified per page

Nine components from [remocn](https://remocn.dev) live in
`src/skills/remotion-render/components/remocn/`. This file records, for each
one, the exact install command its own doc page shows, and where that command
could not be run.

## How the command was verified

`remocn.dev` is refused by this environment's egress proxy (`EGRESS_BLOCKED`),
so the rendered pages were not read. Every page below was instead read from the
site's own source repository, `Remocn/remocn` at commit
`412c601d55e25d60be8b506c2195648569bc38b9`, which is what remocn.dev is built
from.

Each doc page renders its install line through one shared component,
`components/docs/install-block.tsx`:

```
const npmCommand = `npx shadcn@latest add @remocn/${name}`;
```

and each page passes its own `name`. The slug in the URL and the package name
are therefore not assumed to match — they were checked one page at a time, and
checked again against the registry entry that `shadcn add` would resolve
(`registry/remocn/registry.json`, 151 items).

| Component | Doc page | `<InstallBlock name=…>` on that page | registry entry | Exact command |
|---|---|---|---|---|
| Line-by-Line Slide | `content/docs/typography/line-by-line-slide.mdx` | `line-by-line-slide` | `line-by-line-slide` → `line-by-line-slide/index.tsx` | `npx shadcn@latest add @remocn/line-by-line-slide` |
| Soft Blur In | `content/docs/typography/soft-blur-in.mdx` | `soft-blur-in` | `soft-blur-in` → `soft-blur-in/index.tsx` | `npx shadcn@latest add @remocn/soft-blur-in` |
| Micro Scale Fade | `content/docs/typography/micro-scale-fade.mdx` | `micro-scale-fade` | `micro-scale-fade` → `micro-scale-fade/index.tsx` | `npx shadcn@latest add @remocn/micro-scale-fade` |
| Inline Highlight | `content/docs/typography/inline-highlight.mdx` | `inline-highlight` | `inline-highlight` → `inline-highlight/index.tsx` | `npx shadcn@latest add @remocn/inline-highlight` |
| Marker Highlight | `content/docs/typography/marker-highlight.mdx` | `marker-highlight` | `marker-highlight` → `marker-highlight/index.tsx` | `npx shadcn@latest add @remocn/marker-highlight` |
| Slot Machine Roll | `content/docs/typography/slot-machine-roll.mdx` | `slot-machine-roll` | `slot-machine-roll` → `slot-machine-roll/index.tsx` | `npx shadcn@latest add @remocn/slot-machine-roll` |
| Matrix Decode | `content/docs/typography/matrix-decode.mdx` | `matrix-decode` | `matrix-decode` → `matrix-decode/index.tsx` | `npx shadcn@latest add @remocn/matrix-decode` |
| Number Wheel | `content/docs/typography/number-wheel.mdx` | `number-wheel` | `number-wheel` → `number-wheel/index.tsx` | `npx shadcn@latest add @remocn/number-wheel` |
| Rolling Number | `content/docs/typography/rolling-number.mdx` | `rolling-number` | `rolling-number` → `rolling-number/index.tsx` | `npx shadcn@latest add @remocn/rolling-number` |

All nine slugs match across URL, page, and registry. None needed a guessed
package name.

## The command could not be run here — named failure

`npx shadcn@latest add @remocn/<name>` fails in this environment:

```
Request to https://ui.shadcn.com/r/registries.json failed
```

`ui.shadcn.com` and `remocn.dev` are both refused by the egress policy. Since
`shadcn add` copies files rather than adding a dependency, the components were
installed by copying the exact files the registry serves
(`registry/remocn/<name>/index.tsx`). This is a substitution for the documented
command, recorded rather than passed off as the documented install.

Seven of the nine are byte-identical to the registry source. Two differ, both
marked in their own source:

- `number-wheel.tsx` and `rolling-number.tsx` replaced a module-scope
  `@remotion/google-fonts/JetBrainsMono` import with the JetBrains Mono already
  vendored at `public/fonts/JetBrainsMono-400.woff2`. `fonts.gstatic.com` is
  blocked, and because the import ran at module scope it broke every
  composition in the bundle, not only those two.

Nothing else diverges: a diff of all nine against the registry source shows
those two hunks and no others.

## Rendered evidence

One real clip per component, at `data/renders/remocn/<Component>.mp4`
(1280x720, h264), rendered by `src/skills/remotion-render/remocn-demo/`. The
three text-entrance components were rendered on the identical script line so
they are directly comparable; the two highlight components were rendered
against a real pull-quote line; the four number components against real
figures from scripts in `data/research/`. Those files are regenerable and
therefore gitignored — re-render with
`node src/skills/remotion-render/remocn-demo/render-clips.mjs`.
