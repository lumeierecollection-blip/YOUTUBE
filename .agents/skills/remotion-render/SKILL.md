---
name: remotion-render
description: Authoritative video-editor skill — complete production lifecycle from narration understanding through final-MP4 QA. Owns visual concept extraction, sentence-level coverage, asset selection, composition, motion design, caption sync, rendering, and visual QA for all three channels.
version: 2.0.0
---

# Remotion Render — Authoritative Video Editor Skill

This skill is the **primary authority** for all video production in the YOUTUBE automation project. It owns the complete editing and production lifecycle:

1. Understanding the narration
2. Visual concept extraction
3. Sentence-level visual planning
4. Asset selection and verification
5. Photograph usage
6. PNG cutout usage
7. Visual composition
8. Scene and beat planning
9. Motion design
10. Camera movement
11. Transitions
12. Caption placement and synchronization
13. Music and sound integration
14. Channel-specific visual treatment
15. Mobile-first layout
16. Remotion implementation
17. Rendering
18. Visual inspection
19. Technical QA
20. Final video acceptance

Supporting skills (remotion-best-practices, remotion-markup, remotion-maps, remotion-multimedia, remotion-captions, asset-sourcing, music-sourcing, sfx-sourcing) provide specialist guidance but **do not** independently invent competing rendering rules. The primary skill owns the complete production outcome.

---

## Core Principle: Visuals Must Explain Narration

A video consisting of small text, black space, floating dots, generic boxes, and repetitive transitions is a **failed video**, even if every technical test passes.

A video that renders successfully but does not communicate the narration is a **failed video**.

A video that works on one channel but fails on the other two is an **incomplete implementation**.

Every visual must represent the actual person, object, place, event, document, process, or relationship named in the narration. No decorative dots/particles, unrelated stock photos, repeated zoom/pan as fake animation, or one generic image for a multi-concept sentence.

---

## 1. Understanding the Narration

Before building a timeline, create a visual interpretation of the narration. The editor must not treat the script as a sequence of sentences to decorate — it must understand the information being communicated.

For each narration segment, identify:
- People, organisations, locations, physical objects, documents
- Events, actions, processes, comparisons, relationships
- Dates, quantities, changes over time, before-and-after states

Identify which concepts are **essential** to understanding the sentence. Not every word requires a separate image, but every important visual concept must be represented.

---

## 2. Sentence-Level Visual Coverage (Non-Negotiable)

A sentence can contain two, three, or more important concepts. **One image per sentence is not sufficient** when it fails to communicate everything being discussed.

Use these initial targets, adapting to narration duration and complexity:

| Sentence complexity | Initial visual target |
|---|---|
| One simple concept | 1–2 meaningful beats |
| Two distinct concepts | 2–3 meaningful beats |
| Three or more important concepts | 3–5 meaningful beats |
| Complex process | Sequential explanatory beats |
| Comparison | Both subjects and their differences |
| Before and after | Both states, clearly distinguished |

A beat must add information. Do not create rapid cuts simply to meet a number.

**Example:** "The engineers inspected the damaged bridge while emergency workers evacuated residents from nearby homes."
Requires beats for: engineers, damaged bridge, inspection, emergency workers, residents, nearby homes, evacuation.

The visual plan must explicitly record: narration segment, concept, asset/composition, visual purpose, entry time, duration, movement, exit, relationship to next beat.

---

## 3. Asset Selection and Verification

### Photographs (Part 4.1)
Use photographs when the viewer needs to see a real person, location, historical event, physical object, building, environment, or documentary evidence.
- Photographs should retain photographic integrity.
- Appropriate treatments: full-frame establishing shots, controlled camera pushes, slow pans, relevant close-ups, detail crops, side-by-side comparisons, layered compositions.
- A photograph must actually match the subject. Never use an image of a different person/place/event simply because it looks similar.

### PNG Cutouts (Parts 4.2–4.3)
Use transparent PNG cutouts when a subject needs to be isolated from its background (person, aircraft, ship, artefact, historical object, machine, building element).
- A PNG cutout must be used as a meaningful layer within a deliberate composition, not floating on an empty background.
- Validate before use: correct subject, adequate resolution, genuine transparency, clean edges, no unwanted rectangular background, no image-generation defects, correct proportions/orientation/scale, no distortion.
- Never stretch a PNG disproportionately. Never use tiny, unreadable foreground elements.

### Authenticity and Provenance (Part 4.4)
Clearly distinguish: archival photographs, contemporary photographs, illustrations, diagrams, AI-generated reconstructions.
- Never represent an AI-generated reconstruction as authentic historical evidence.
- Maintain asset source information, usage rights, and credits.
- When an exact photograph cannot be verified, use an appropriate graphic representation rather than pretending an unrelated photograph is authentic.
- Fail closed: no asset is ever presented as something it isn't.

---

## 4. Visual Composition (Part 7)

Compose intentionally for the target format (mobile-first, 9:16 Shorts):
- Main subjects must be large enough to recognise.
- Important text must be readable on a phone.
- Captions must not obscure essential imagery.
- Important objects must not be hidden behind platform interface areas.
- Multiple subjects must remain distinguishable.
- Split screens must be balanced.
- Images must use the available composition effectively.
- Backgrounds must support the subject.
- Text hierarchy must be clear.
- Every scene must have a visual focal point.

Avoid enormous black areas, tiny labels, and weak visual hierarchy. Do not fill empty space with meaningless decoration.

Do not force all channels into one visual template. The visual style must reflect the subject, editorial purpose, and configured channel identity.

---

## 5. Motion Design (Part 5)

Movement must communicate something. For every animated element, define:
1. Subject, 2. Purpose, 3. Starting position, 4. Ending position, 5. Direction,
6. Duration, 7. Acceleration/easing, 8. Relationship to other elements,
9. Relationship to narration, 10. Physical believability.

### Appropriate movement (Part 5.1)
- Aircraft: approach, descent, directional movement.
- Ships: believable movement through water, directionally consistent travel.
- Maps: controlled camera movement, route drawing, location highlighting.
- Documents: page reveal, close-up, highlighting a relevant passage.
- Historical artefacts: restrained rotation, detail reveal, close-up, layered composition.
- Data: accurate counters, meaningful bar growth, correct chart progression.
- Buildings: architectural reveal, contextual camera movement, before/after comparison.

### Prohibited meaningless movement (Part 5.2)
Reject: random floating dots, random particle movement, unexplained bouncing, continuous spinning, excessive zooming, unmotivated parallax, objects floating without context, camera shake as decoration, movement that distracts from captions.

### Voxel/particle effects (Part 5.3)
Allowed only when they explain or represent something (building reconstructing, object assembling, geographical area modelling, structure transitioning from schematic to real-world). A screen full of moving dots is not meaningful. If the effect does not serve the subject, remove it.

---

## 6. Caption Placement and Synchronization

Captions must be synced to the actual TTS audio timing, not estimated timing. Captions must not obscure essential imagery. Word-level highlighting should follow the spoken word. Caption timing errors fail QA.

---

## 7. Channel-Specific Visual Treatment

Three priority channels: **1 (History Untold)**, **2 (AI Tool Reviews)**, **48 (Ergonomics & Human Factors)**. Each has a unique niche, format, and configured style. Preserve channel-specific requirements unless there is a demonstrated defect.

- Channel 1: cinematic-documentary, historical subject matter, archival imagery, restrained motion.
- Channel 2: minimal, AI/tool subject matter, clean graphics, screenshots with provenance labels.
- Channel 48: motion-graphics, engineering subject matter, diagrams, annotated photographs, patent documents.

---

## 8. Remotion Implementation

### Timeline Schema (`schemas/editor-timeline.json`)
The timeline is the single source of truth: what is in it is drawn, what is not in it is not. Every asset, in/out frame, rect, crop, keyframe, caption, and effect comes from the timeline.

### Renderer (`src/skills/remotion-render/editor/EditorTimeline.jsx`)
Draws persisted editor timelines. Has no layout opinions of its own — every layer comes from the timeline passed as the `timeline` prop.

### Render Orchestrator (`src/skills/remotion-render/render-editor.js`)
Stages assets into `public/editor/`, bundles the Remotion entry, renders through `renderMedia` with h264/aac, enforces audio track, writes render manifest.

### Layer Math (`src/skills/remotion-render/editor/layer-math.js`)
Shared pure-JS math used by both the renderer and QA. Defines `valueAt`, `stateAt`, `imageBox`, `layersActiveAt`, `isVisiblyRendered`, `effectMagnitude`, `formatCount`. QA and renderer must agree on what each frame shows.

---

## 9. Technical QA Gate (Part 9.1)

Verify:
- Correct dimensions (1080×1920 for Shorts).
- Correct aspect ratio.
- Correct frame rate (30 FPS).
- Valid H.264 video codec, valid AAC audio codec.
- Audio present, correct duration.
- No corrupted or accidental black frames.
- No missing assets, no broken compositions.
- No caption timing errors.
- No unexpected silent sections.

---

## 10. Visual QA Gate (Parts 9.2–9.4)

Inspect representative frames and contact sheets. Evaluate:
- Screen utilisation (no large unexplained black areas).
- Image quality and subject relevance.
- Text readability on mobile.
- Composition, layering, motion.
- Transitions, visual variety, narration alignment.
- Mobile readability.

### Coverage QA
Produce a narration-to-visual report. For every narration segment, record: important concepts, assigned visual beats, asset references, coverage status, missing concepts, required corrections. A sentence mentioning two distinct important subjects must not pass when only one is represented. Decorative shapes, labels, or background textures do not count as meaningful visual coverage.

---

## 11. Final Video Acceptance (Part 12)

The project is complete only when:
- `remotion-render` is the primary video-editor skill and Claude Code loads it.
- Visuals correspond to the narration across all three channels.
- Multiple important concepts receive appropriate coverage.
- Photographs are relevant and correctly matched.
- PNGs are clean and deliberately composed.
- Historical authenticity is preserved.
- Diagrams explain actual information.
- No meaningless particle effects remain.
- Movement has a clear purpose and physical plausibility.
- Beat timing follows narration.
- The screen is used effectively, no large black areas.
- Important text is readable on mobile.
- Actual MP4s are rendered through GitHub Actions.
- All three channels have representative successful renders.
- Technical QA passes, visual QA passes, coverage reports pass.
- Artifacts are accessible from GitHub and traceable to a commit SHA.
- No public videos are uploaded. No credentials or secrets exposed.

---

## 12. Execution Model (Part 10)

All testing, rendering, and QA must happen on GitHub-hosted infrastructure via GitHub Actions. The local PC may be used for repository editing, authentication, inspection, and Git operations only — never as a substitute production renderer.

1. Inspect the live repository and current branch state.
2. Create a dedicated feature branch.
3. Make tracked code and skill changes.
4. Commit and push the branch.
5. Run tests and renders through GitHub Actions.
6. Upload MP4/QA/frames/contact sheets as workflow artifacts.
7. Inspect artifacts and logs. Correct failures. Repeat until acceptance criteria are met.

Every render must record its exact commit SHA. Do not push to `main`, do not force-push, do not reset/overwrite uncommitted work.

---

## 13. Related Skill Files

- `.opencode/skills/remotion-render/SKILL.md` — OpenCode-specific rendering procedure (references this document as authoritative).
- `.agents/skills/remotion-best-practices/SKILL.md` — Router to specialist Remotion skills.
- `.agents/skills/remotion-best-practices/remotion-render/REFERENCE.md` — Advanced rendering reference.
- `.agents/skills/remotion-best-practices/remotion-markup/REFERENCE.md` — React markup best practices.
- `.agents/skills/remotion-best-practices/remotion-maps/REFERENCE.md` — Geographic explainers.
- `.agents/skills/remotion-best-practices/remotion-multimedia/REFERENCE.md` — Browser multimedia tasks.
- `.agents/skills/remotion-best-practices/remotion-captions/REFERENCE.md` — Caption handling.
- `src/skills/remotion-render/` — Implementation code (EditorTimeline.jsx, render-editor.js, layer-math.js, etc.).
- `scripts/editor/` — Coverage pipeline (coverage-plan.mjs, coverage-layers.mjs, coverage-graphics.mjs, coverage-assets.mjs, coverage-timeline.mjs, coverage-audit.mjs, auto-timeline.mjs, video-qa.js).
- `scripts/__tests__/editor-coverage.test.js` — Coverage pipeline tests.
- `.github/workflows/visual-storytelling-proof.yml` — GitHub Actions proof workflow (channels 1, 2, 48).
