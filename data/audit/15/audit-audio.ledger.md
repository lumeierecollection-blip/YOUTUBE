# AUDIT-AUDIO LEDGER — Stage 15 (Delete-list sweep)

Lane: `audit-audio` · Stage: 15 (DEL sweep / whole-domain) · Built: 2026-08-30
Domain: SFX map, gains, LUFS, audio sync · Scope: the audio/render-sound path within this lane's ownership.

## Scope & ownership (from `.opencode/agents/audit-audio.md`)

Edit allowed only on:
- `src/audio/**` (asset tree: `sfx-manifest.json`, `sfx-library.measured.json`, `*.ogg/.mp3/.wav/.zip`, and the `Kenney.url`/`Patreon.url`/`License.txt` provenance records)
- `src/skills/remotion-render/audio.js`
- `src/skills/remotion-render/visual/sound-design.js`
- `src/skills/remotion-render/visual/sfx-library.js`
- `data/audit/**`

Everything else read/grep allowed, edit denied. **No edits were made this stage** — this is a pure absence-sweep, so CROSSCHECK-PROTOCOL Part 2's Phase 2 (delete-then-replace) and Phase 3 (counter-check) do not apply (there is no diff to counter-check). The sweep is Phase 1 GROUND-only verification, recorded below.

## Gate list read

The DEL table is the gate list for Stage 15 (FINISH-SPEC.md is absent; R01–R30 re-encoded as `DEL-*`). Read from `CHECK-REGISTER.md` §4 (lines 1475–1509), 33 rows DEL-01..33. DEL-17 is RETIRED/INVERTED per §4.2 (2026-08-16) — pure white/black backgrounds are now correct; its pattern ignored.

**Rule applied throughout:** no row marked pass from the register's State column; every pattern re-grepped by hand below. Verdicts are from measured hits (or measured zero hits) in this lane's owned files.

## Re-confirmation of Stage-13 precedent (AUD-05 / AUD-06)

- **AUD-05** — `grep https` over `audio.js` / `sound-design.js` / `sfx-library.js`: **0 hits**. All `<Audio>`/`<SoundEvent>` sources in `compositions/motion-graphics.jsx` are `staticFile(<local path>)` or the local static VO import `currentAudio`; **0 `https://` anywhere in that composition** (verified this stage, lines 432–433, 1224–1225). The only `https://`/`http://` in the audio tree are provenance/attribution TEXT records (see DEL-29 row). Re-confirmed.
- **AUD-06** — every library file carries a licence record in `visual/sfx-library.js` + `src/audio/sfx-library.measured.json` (26/26: 22 Kenney Interface CC0 + 2 Kenney Impact CC0 + 2 Mixkit Free), all commercial/YouTube permitted (stage-13 PART C fetched kenney.nl/support + mixkit.co FAQ). On-disk `License.txt` present for both Kenney packs. Re-confirmed.

---

## Part A — Full-pattern sweep table (audio domain)

Patterns run over owned files: `audio.js`, `visual/sound-design.js`, `visual/sfx-library.js`, `src/audio/sfx-library.measured.json`, `src/audio/sfx-manifest.json`, and the `src/audio/*/` `.url`/`License.txt` text records. Binary assets (`.ogg/.mp3/.wav/.zip`) carry no code patterns (matched nothing; asset filenames/data only).

| ID | Pattern (register) | Hits in audio domain (file:line) | Classification | Verdict (audio domain) |
|---|---|---|---|---|
| DEL-01 | `Math.min(width, height) / 1080` | 0 | — | CLEAN (no-op scale factor) |
| DEL-02 | `GridBackground` | 0 | — | CLEAN |
| DEL-03 | `ColorWipe` | 0 | — | CLEAN |
| DEL-04 | `extractStats\|extractHeroNumber\|extractFlowLines` | 0 | — | CLEAN |
| DEL-05 | `[A-Za-z]+)\s+([A-Za-z]+` | 0 | — | CLEAN |
| DEL-06 | `iconFor` | 0 | — | CLEAN |
| DEL-32 | `resolveIcon` outside `iconRole==="secondary"` | 0 (`resolveIcon` absent in audio files) | — | CLEAN (encoding domain: no icon resolution in audio) |
| DEL-33 | `StatementScene` reachable for visualPlan beat | 0 (`StatementScene` absent in audio files) | — | CLEAN (encoding domain) |
| DEL-07 | `pickScene` | 0 | — | CLEAN |
| DEL-08 | `display: flex` in Stage/Headline/Caption | 0 (`flex` absent in audio code) | — | CLEAN |
| DEL-09 | `chunkVoiceover` | 0 | — | CLEAN |
| DEL-10 | `space-around` | 0 | — | CLEAN |
| DEL-11 | `Config.set` referenced by render.js | 0 (`Config.set` absent in audio files) | — | CLEAN |
| DEL-12 | `boxShadow\|radial-gradient` | 0 | — | CLEAN |
| DEL-13 | `MinimalSections` | 0 | — | CLEAN |
| DEL-14 | generated entry path / `inputProps` workaround | 0 (`inputProps`/`entry-file` absent in audio files) | — | CLEAN |
| DEL-15 | `Easing.linear\|easing: *undefined` | 0 | — | CLEAN |
| DEL-16 | `Math.sin(` (outside arc helper) | 0 | — | CLEAN (no sine/arc in audio) |
| DEL-17 | ~~white/black~~ **RETIRED/INVERTED** (§4.2) | n/a — ignored as instructed | — | IGNORED (not a violation) |
| DEL-18 | `gradient` | 0 | — | CLEAN |
| DEL-19 | `border:` | 0 | — | CLEAN |
| DEL-20 | `imageFormat.*jpeg` | 0 | — | CLEAN |
| DEL-21 | `skew\|rotate(` on text | 0 (`skew`/`rotate(` absent in audio code) | — | CLEAN |
| DEL-22 | `moodFrom` | 0 | — | CLEAN |
| DEL-23 | `Math.random` | **1**, comment only: `sound-design.js:337` `* staying reproducible for a given script - no Math.random anywhere.` | **Documentation comment** stating the deliberate absence. **0 live code occurrences.** The design is deterministic by construction: `pickAsset` (L342–357) selects via a pure string hash `(h*31+ch.charCodeAt(0))>>>0` over seed `role:seed`, seed = `beat.startFrame:state.key:variant` (L420). No RNG call site exists anywhere in the audio path. Register DEL-23 itself is the standing negative gate; any reintroduced `Math.random` fails this grep immediately. | **CLEAN — 0 live.** Comment-only. Positive-checked deterministic design (no AMEND needed). |
| DEL-24 | `particle` | 0 | — | CLEAN |
| DEL-25 | `parallax` | 0 | — | CLEAN (no depth/parallax in audio) |
| DEL-26 | `three\|THREE\.` | **3**, comments only: `sound-design.js:296` `Three roles genuinely vary:`, `:302` `Only those three are discriminated.`, `:386` `Three is enough to read as...` | **False positives on the English word "Three"** in prose comments. Not Three.js / WebGL geometry; no such import or construct exists. | **CLEAN — 0 live.** NI (not applicable) — natural-language comment text. |
| DEL-27 | `textTransform.*uppercase` in caption | 0 | — | CLEAN |
| DEL-28 | `grain` in mg style | 0 | — | CLEAN (no film grain in audio path) |
| DEL-29 | `https://` in compositions (remote fetch at render) | code: **0** in `audio.js`/`sound-design.js`/`sfx-library.js`. Text records in `src/audio/`: `sfx-manifest.json:11,18,25` (kenney.nl×2, mixkit.co — provenance catalog); `kenney_interface/Kenney.url:2` + `License.txt:11,19,20,21,23` + `Patreon.url:2`; `kenney_impact/Kenney.url:2` + `License.txt:11,19,20,21,24` + `Patreon.url:2` — all attribution/provenance documentation. | **Text/metadata records only.** Never fetched, never loaded at render (JSON `.url`/`.txt` are not part of the composition bundle path; `<Audio>` sources are all `staticFile()` local). Matches stage-13 AUD-05 exactly. | **CLEAN — 0 live remote fetch.** No composition uses an http(s) asset source (verified motion-graphics.jsx:432–433,1224–1225 = 0 `https://`). |
| DEL-30 | `#[0-9A-Fa-f]{6}` in channels.json | 0 (audio code carries no hex colour literals) | — | CLEAN (colour domain lives in channels.json — not this lane's file) |
| DEL-31 | `channelName` / `sections[idx].id` in Kicker | 0 (`channelName` absent in audio files) | — | CLEAN |

**Row count:** 33 DEL rows considered. DEL-17 retired/ignored. Of the remaining 32, **all are CLEAN with zero live code violations** in the audio domain. The only pattern matches anywhere in owned files are (a) the DEL-23 absence-documentation comment and (b) DEL-26 English-word "Three" in comments and (c) DEL-29 provenance text records — each classified honest, none a live banned construct.

## Part B — Co-reports (cross-cutting, for owning lanes)

Nothing in this lane's three code files (`audio.js`, `sound-design.js`, `sfx-library.js`) carries any DEL-* pattern as a live code path — all hits there are comment/absence-doc only. No co-report of a live violation originates from this lane.

Observations handed outward (no action needed by other lanes, logged for completeness):
- **DEL-29 across the whole render-sound path is clean** — verified `compositions/motion-graphics.jsx` has **0 `https://`**; every `<Audio>`/`<SoundEvent>` uses `staticFile(<local>)` or local `currentAudio` (L432–433 sound events; L1224 underscore; L1225 VO). The owning (encoding/orchestrator) lane can rely on this.
- `src/audio/*/{Kenney,Patreon}.url` + `License.txt` contain `http://` provenance links by design (URL type records) — stage-13 noted these; they are text documentation, never loaded at render time. No change requested (SFR-3 from stage 13, a durability mirror, remains optional/unchanged).

## Part C — AMEND candidates

**None.** The single plausible concern — live `Math.random` (DEL-23) — is confirmed absent: the only match is the comment at `sound-design.js:337` that documents the deliberate absence, and the selection code (`pickAsset` L342–357) is a deterministic string-hash with no RNG. This is a designed feature backed by the register's own DEL-23 grep as the standing positive-negative gate; no amendment requested.

## Part D — Shared-file requests (SFR)

**None.** No change required that touches a file outside this lane's ownership. (Stage-13's SFR-3 optional license-mirror and SFR-4 `sfx-manifest.json` catalog note remain open with their original owners; this sweep required no edits and re-raises neither as a blocker.)

## Part E — Protocol compliance

- Phase 1 (GROUND): all patterns re-grepped by hand over the full owned tree; no register State column trusted. ✓
- Phase 2 (CHANGE): **no change made** — nothing to delete or replace (all banned constructs absent). ✓
- Phase 3 (COUNTER-CHECK): not applicable — no diff was produced; this is an absence sweep. No `verify-independent` dispatch performed because there is no byte-change to judge (documented honestly rather than inventing a rubber-stamp counter-check).

## VERDICT

audio domain DEL sweep: 33/33 patterns clean in scope, 0 live violations
