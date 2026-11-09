# Court & Spotlight: three editorial styles, proof report (10 Nov 2026)

Branch `feat/platform` at the commit that contains this file. Nothing is merged to `main`; nothing is uploaded to YouTube.

## 1. What the Vox generator provided, and 2. what was reused

Nothing was reused as code. See `VOX-GENERATOR-FINDINGS.md`: the repository has **no LICENSE file** (README badge says MIT, GitHub reports none), it needs a paid **MuAPI** key that does not exist here, and its method (AI-generated posters and animated images of the people in the story) conflicts with this repository's "real verified photos only" rule. Its *techniques* (cut-out stickers, torn-paper collage, halftone, ducked music, beat maps) were reimplemented clean-room.

## 3. What was adapted / 4. what had to be built

| Capability | Where | Notes |
|---|---|---|
| Real photographs with licence enforcement | `platform/production/commons.mjs` | Wikimedia Commons API; refuses NC/ND/unknown licences; writes manifest entries |
| Photographic cut-out and torn-paper edge | `platform/production/cutout.py` | rembg (MIT) + U2-Net (Apache-2.0); rejects crowds; monochrome option |
| Original music, ducked under the voice | `music.py`, `mix.mjs` | synthesised from scratch, no third-party material, `sidechaincompress` |
| Story classification | `platform/channels/court-and-spotlight/classify.mjs` | deterministic, records reasoning |
| Three style profiles | `.../styles/{investigation,magazine,vox}.json` | each with visual language, image strategy, typography, palette, motion, evidence rules, music, structure, QA checks |
| Three compositions | `src/skills/remotion-render/channels/court-and-spotlight/{dossier,magazine,vox}.jsx` | different layouts, palettes, type and motion |
| Shared Short path | `platform/production/fixed-short.mjs` | one natural voice take, retake if long, never sped up, timeline from measured words |

## 5. Licence and dependency findings

New Python dependencies (channel-only, `platform/channels/court-and-spotlight/requirements.txt`): `rembg[cpu]==2.0.67` (MIT), `pillow`, `numpy`. rembg downloads the U2-Net model (Apache-2.0) from its GitHub releases on first use. Photographs: Wikimedia Commons, CC BY 2.0 / CC BY 3.0 / CC BY-SA 2.0 / 3.0 / 4.0 and public domain; each is credited on screen and in `asset-manifest.json`. CC BY-SA photographs are shown with attribution; **no share-alike obligation has been assessed for the finished videos** (flag for the owner).

## 6. APIs and credentials

None new. Existing Gemini TTS keys (voice) and the repository's normal Actions runner. No MuAPI key. No paid service added.

## 7 to 9. Three configurations and three rendered proofs

| Proof | Style | Subject | Run | Duration | Mean volume | MP4 SHA-256 |
|---|---|---|---|---|---|---|
| A | Investigative / dossier | Wesley Snipes: what the jury decided, what was only alleged | `42714120896` | 25.09 s | -23.0 dB | `d35d9d691e33c202578105283df70fe9ed5c97781baa9b671b477652030ec273` |
| B | Glossy magazine | Beyoncé's record Grammy night | `42714127739` | 22.44 s | -21.9 dB | `bcbf80d57b526f09cd0eaf8aaa0a89b3541afd61cf7e580e84c0a53eff630838` |
| C | VOX explainer | Eras Tour vs Elton John's record | `42714143347` | 26.86 s | -19.9 dB | `b078ba812a73bbf3ab76cc0cf803316025d0a9322e15e28dced0bf4f22329403` |

Each run's artifact (`preview-court-and-spotlight-<run>-1`) holds the MP4, `contact-sheet.jpg`, `scene-*.jpg`, script, `story-blueprint.json`, `scene-plan.json`, `asset-manifest.json`, `story-classification.json`, `style-profile.json`, `music-manifest.json`, `qa-report.json`, `quality-report.json`. All 1080x1920, 30 fps, h264/aac, natural speed (playback speed 1), no black or frozen segments.

## 10. QA results

Technical QA passed on all three (measured on the MP4). Style QA was done by eye on the contact sheets.

## 11. Unresolved limitations (plain)

- **Scripts were written directly, not by the shared script engine**, and were not reviewed by its independent critic. The engine was blocked earlier by free-model quotas.
- **Proof A has no timeline of more than two dates** and one document source is a republished copy (Blast Magazine) of the DOJ release, not justice.gov.
- **Proof B**: the "career progression" is shown only by photo dates from Commons; no career facts beyond the one fetched report are claimed.
- **Proof C** has large empty areas in its last two scenes, and Taylor Swift's cut-out includes her stage cape. Show counts were not found, so none are shown.
- **Cut-outs** are good but not studio-clean: stray objects at the edge of the Snipes cut-out (microphone, bottle).
- **Music** is synthesised and modest. It has not been listened to by a person, only measured.
- **Evidence boards in the owner's references** (many named people joined by red string) were not reproduced: that layout implies guilt by association. The dossier style uses one subject and one piece of evidence per sentence instead.
- Cost of the Vox generator was **not determined** (MuAPI pricing not fetched).
- Not integrated into the daily autopilot: this is the preview path only.

## 12. Files and branches

Branch `feat/platform`; previews `preview/court-and-spotlight-investigation-4`, `-magazine-4`, `-vox-2`. Earlier superseded previews remain: `-investigation`, `-investigation-2`, `-investigation-3`, `-magazine`, `-magazine-2`, `-magazine-3`, `-vox`.

## 13. Tests

`node --test platform/script-engine/*.test.mjs` was not re-run after these changes; no engine code changed. The three proofs rendered successfully on GitHub Actions.

## 14. Ready for review?

Ready for **your review of the three videos**. Not ready to merge: integration with the daily autopilot, the engine-reviewed script path, and your decisions below are outstanding.

## Owner decisions

1. Approve the clean-room route and confirm AI generation is never used for real people.
2. Whether to ask the Vox author for a licence.
3. Whether CC BY-SA photographs are acceptable in monetised videos (share-alike).
4. Music: keep the synthesised music, or supply licensed tracks.
