# What wins in each niche, which reference we copy, and where its pictures come from

Written 2026-11-13. Data: `research/topicdb.json` (competitor catalogues collected 13 Nov 2026), `research/COMPETITORS.md`, the ten owner-fixed reference videos (`REFERENCES.md`, view counts re-read from YouTube on 13 Nov 2026 with `python -m yt_dlp`), and our own channel analytics (`SHORTS-ANALYSIS-AND-FIXES.md`). Small samples; read the limits at the end.

## 1. Which reference video is the visual identity (highest views among the fixed references)

| Our channel | Reference channel | Highest-viewed fixed reference | Views | Length | Runner-up |
|---|---|---|---|---|---|
| Hidden Past | RealLifeLore | **Why The Nepal Flood Was WAY Scarier Than You Think** (`WiRLNEl-4bk`) | 2,330,858 | 30:10 | Saudi Arabia (1,870,924), Russia (1,435,675) |
| AI Tested | AI Search | **AI is reverse engineering everything** (`h5zkzon0gM4`) | 1,097,129 | 14:29 | Deepseek strikes again (1,005,417) |

These two become the visual identity reference for the next two long-form episodes. Their frame-by-frame records are in `analysis/WiRLNEl-4bk.md` and `analysis/h5zkzon0gM4.md`.

## 2. What topics win

**Hidden Past niche (RealLifeLore, 250 newest long videos, views as a multiple of the channel's own median):**
- geopolitics and war: 3.53x average over 92 videos (top: 17.5x);
- "why X is empty or shaped like this" geography: 3.40x over 53 videos (Australia 11.7x, Spain 10x, New Zealand 9.2x);
- history and mysteries: 3.29x over 13 videos (Antarctica under the ice 9.2x; Yellowstone 10.8x);
- a current, visible disaster explained from its first cause is the format of the Nepal flood video (2.33M).
Competitor pattern across the other niches: one named object or event, an unexpected cause, or an absolute ("largest", "hidden").

**AI Tested niche (AI Search, Matt Wolfe):** AI long form is a steady, low-variance niche (AI models 0.58x, AI news 0.67x of the references' medians, 0-2% outliers). Winners are a clear thesis plus a demo ("GPT-5 is a freak" 4.9x, "27 free things you can do with Gemini" 4.5x). The fixed reference (`h5zkzon0gM4`) is a demo-led video with real GitHub pages, real game footage and chaptered sections.
**On our own channel**, the AI Tested Shorts that did best were about whether to trust AI ("We Told AI It Was Wrong. It Didn't Budge." 1,612 views; "Will AI Say I Don't Know?" 1,253; "AI Knew the Answer. Then We Said It Was Wrong." 1,255), so the next AI Tested long form is built around trust, from tests we already ran.

## 3. What the two reference videos are made of, and where we get the same kind of picture lawfully

| Picture type in the reference | What it is there | Our source (licence recorded per file) |
|---|---|---|
| Opening: one long, uncut, dated shot with the source credit on screen (Nepal CCTV) | licensed news footage (Getty, AP Archive credited) | Public-domain film: National Archives (NARA) and USGS films on Wikimedia Commons; credit and licence on screen |
| Source-worded caption boxes, white box with black serif | the news outlet's own wording | Quotes only from the sources we fetched, shown word for word with the source named |
| Satellite and 3D terrain plates with the provider's mark | MapTiler, Google Earth | Our map engine: Sentinel-2 cloudless (EOX, CC BY 4.0), Mapzen terrain, OpenStreetMap (ODbL) |
| Stacked figures in the first two minutes | news and agency numbers | Figures from USGS, Wikipedia and the cited papers, each shown with its source |
| Scale translated to familiar things | narration | computed by us from sourced numbers |
| Sponsor read after the argument | FarmKind | none (we have no sponsor) |
| AI Search: GitHub READMEs, repos, model pages, game footage | real pages and real game clips | Real pages we capture ourselves with a browser (quotation use: owner decision, already raised); our own live test results; no game footage unless licensed |

Footage that is public domain or CC0 on Commons exists for: the 1980 Mount St. Helens eruption (a National Archives film of 102 MB and several USGS films, all marked Public domain), the Tacoma Narrows collapse (Barney Elliott's film, public domain), the Hindenburg fire (Universal newsreel, public domain), and the US nuclear tests (Department of Energy films, public domain or CC0).

## 4. Episode choices that follow from this

- **Hidden Past: the 1980 Mount St. Helens eruption** (landslide first, then the blast nobody expected): the same shape as the Nepal video (a sudden event whose real cause was unexpected, footage first, then terrain and numbers), and it has lawful footage and USGS data.
- **AI Tested: "Can you trust AI? We tested it six ways"**, in the AI Search structure (cold result, chapters, real pages, our own measured tests), built from the tests we have already run and stored.

## 5. Limits

- Competitor numbers are from channel catalogues of 250 videos, keyword-assigned categories (30-39% of titles uncategorised), and a single day's snapshot.
- Only two reference videos set the identity; each rests on one reference channel.
- The reference videos' audio was never analysed; we cannot say what sound they use.
- Footage provenance of the references is read from their descriptions, not verified.
- The two Celebrity News references are still unfetched (YouTube bot check); Space, Psychology and Celebrity News research is not extended in this step.
