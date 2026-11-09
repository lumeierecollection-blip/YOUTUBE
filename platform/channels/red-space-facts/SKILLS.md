# Red Space Facts: skills and tools

## SOLSYS (owner's selection): unconfirmed, not used

The owner selected "SOLSYS" and gave no URL. The audit (`docs/operations/SPECIALIST-SKILL-AUDIT.md`) found one candidate, `ThomasAFink/SOLSYS`. Nothing from it was cloned, installed or executed.

What the candidate appears to be, from the audit only:

- Commit `310932f432d6f290e402482962f23d8724674598`, licence MIT, language Python, default branch `main`, pushed 2026-11-07, API size about 9.1 GiB.
- Description (verbatim from the API): "This project visualizes the solar system from the inner planets out to the nearest stars, with a special focus on asteroids."
- Per its README: solar-system visualisation with corrected Keplerian physics, from the inner planets past the Kuiper Belt and Oort Cloud to nearby stars. Main output is light and dark GIF animations and a staged 3D zoom; side output is static JPGs and a light-year star map. Inputs include orbital and catalogue data such as `data/interstellar_objects.csv`. Python with `numpy`, `pandas`, `matplotlib`.
- Not determined by the audit: whether it runs on GitHub Actions, its render time, whether its GIF output is usable in a Remotion video.

Owner must confirm this is the intended repository before any of it is run.

## What is used instead (provisional)

Three.js through `@remotion/three`, clearly a provisional implementation, listed in `deps.json`:

- `@remotion/three@4.0.507`, pinned to the Remotion version in `src/skills/remotion-render/package.json` (4.0.507), with `three@0.185.1` (the repo's `^0.185.1`) and `@react-three/fiber@9.8.2` (peer dependency; 9.7.0 was rejected by npm because it needs React below 19.3 and the repo resolves 19.3.1).
- Render: `gl: swangle` is already set in `render-channel-composition.mjs`.
- Code: `src/skills/remotion-render/channels/red-space-facts/{compositions,three-kit}.jsx`. The orbits, field lines and ring strip are computed from `figures.json`; they are not SOLSYS output.

## Sources and assets

- Saturn globe texture: `src/skills/remotion-render/channels/red-space-facts/textures/saturn.jpg` is byte-identical in size (275,735 bytes) to `Images and Textures/Saturn/Saturn.jpg` in https://github.com/nasa/NASA-3D-Resources (checked by file size through the GitHub API on 2026-11-09, not by hash). Folder: https://github.com/nasa/NASA-3D-Resources/tree/master/Images%20and%20Textures/Saturn . Repo commit read: `11ebb4ee043715aefbba6aeec8a61746fad67fa7`. A web search credited the nasa3d "Saturn" image to the JPL Solar System Simulator; the credit page itself redirected and was not read. 720x360, low resolution.
- The ring has no NASA texture: its colour and opacity strip is generated from the ring edges, optical-depth ranges and albedos in `figures.json` (NSSDC ring fact sheet). Fine radial structure inside those ranges is invented (artistic interpretation).
- Other planets are plain coloured spheres (colours in `channel.json`); no texture is claimed for them.
- Facts: pages listed in `sample.json` `sources`. This session re-read the NASA release (300 million / under 100 million years, pool estimate), the JPL 2013 page (Keck, April 2011, 25 to 55 degrees latitude, "charged water particles ... along Saturn's magnetic field lines") and the IPGP page (4.5 billion years, Nature Geoscience, 16 December 2024). The fact-sheet numbers in `figures.json` come from the earlier session and were not re-read in this one.

## Known simplifications, stated on screen where they matter

- The JPL page does not say which hemisphere the bands are in; the render draws them in both (illustrative).
- Field lines are a centred dipole; the source says the real field is not.
- Orbits are circles at mean distance; planet markers are enlarged; planet positions are illustrative; time is sped up.
- Ring thinning in the last scenes is an illustration of a model extrapolation, labelled HYPOTHETICAL.
- Narration is PROVISIONAL (hand-planned, not from the script engine). Voice is neural TTS, never a human recording.

## Licence notes

NASA material is generally usable with credit and no implied endorsement; the on-screen line says so. The texture's exact terms were not read from the nasa3d page. Three.js and `@react-three/fiber` are MIT.
