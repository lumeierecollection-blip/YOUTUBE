# Margaret Clitherow Video - Asset Requirements

## Overview

This document specifies the historical image assets required to produce a people-centered
Mary Margaret Clitherow / Guy Fawkes YouTube Short (51 seconds, 9:16 vertical).

**Target:** 75% people-focused imagery with 12-15 distinct visual assets.

---

## Required Image Assets

| ID | Subject | Historical Theme | Minimum # |
|----|---------|------------------|-----------|
| MC-01 | Margaret Clitherow | Historical portrait/recreation | 1 |
| MC-02 | Margaret's family | Elizabethan domestic life | 1 |
| MC-03 | Hidden Catholic priest | Priest hole/recreation | 1 |
| MC-04 | Religious persecution | Authorities arresting Catholics | 1 |
| MC-05 | Execution scene | 1586 York execution method | 1 |
| GF-01 | Guy Fawkes | Verified historical portrait | 1 |
| GF-02 | Christopher Wright | Gunpowder Plot conspirator | 1 |
| GF-03 | John Wright | Gunpowder Plot conspirator | 1 |
| GF-04 | Conspirators group | Gunpowder Plot planning | 1 |
| GF-05 | Plot documents | Manuscript/historical evidence | 1 |
| BACK-01 | Dark moody background | Title screen backdrop | 1 |
| TEXT-01 | Texture overlay | Parchment/aged paper texture | 1 |

**Total required:** 12 specific assets

---

## Asset Specifications

### Technical Requirements
- **Format:** JPEG or PNG
- **Resolution:** Minimum 1080x1920 (will be cropped to 9:16)
- **Color profile:** sRGB
- **Quality:** High (no compression artifacts)

### Historical Accuracy
- **Period:** 1586 for Margaret Clitherow scenes, 1605 for Gunpowder Plot
- **Style:** Historical paintings, engravings, or verified photographs
- **NOT accepted:** AI-generated portraits of named individuals, modern photography

### Visual Storytelling Purpose

**Beat 1 (Hook):** Margaret Clitherow portrait showing defiance
**Beat 2 (Setup):** Family life, priest hiding
**Beat 3 (Rehook):** Arrest and trial
**Beat 4 (Payoff):** Execution scene
**Beat 5 (Conclusion):** Guy Fawkes and Wright portraits, plot documents

---

## Source Collections (Priority Order)

### Tier 1 - Direct Download (Public Domain/Verified)
1. **Wikimedia Commons**
   - Search: "Margaret Clitherow", "Guy Fawkes portrait", "Gunpowder Plot"
   - License: Public Domain, CC BY-SA 4.0, CC0
   - Example: https://commons.wikimedia.org/wiki/Category:Margaret_Clitherow

2. **National Portrait Gallery (UK)**
   - API: https://www.npg.org.uk/programme/apis-and-data/
   - License: Varies - check each image
   - Search: "Guy Fawkes", "Elizabethan period"

3. **British Library Digital Collections**
   - Collection: Historical engravings, manuscripts
   - Access: Open access images
   - URL: https://www.bl.uk/collection-guides/digital-collections

### Tier 2 - Reference Only (Need Manual Download)
4. **Rijksmuseum Collection**
   - API: https://www.rijksmuseum.nl/en/api
   - Content: Dutch interpretations of Elizabethan England
   - License: CC0 for pre-1950 works

5. **Victoria and Albert Museum**
   - Collection: Fashion, social history
   - URL: https://www.vam.ac.uk/collections
   - License: Check individual items

6. **York Museums Trust**
   - Content: Local Margaret Clitherow artifacts
   - URL: https://www.yorm.org.uk/museum-and-galleries
   - License: Contact for reuse rights

---

## Licensing Documentation

Each asset must include:

```json
{
  "asset_id": "mc-portrait-01",
  "filename": "margaret-clitherow-historical-portrait.jpg",
  "subject": "Margaret Clitherow",
  "historical_period": "1586, York",
  "source_url": "https://commons.wikimedia.org/wiki/File:Example.jpg",
  "creator": "Historical artist name or 'Unknown'",
  "license": "Public Domain (pre-1928)" or "CC BY-SA 4.0",
  "attribution_required": true,
  "attribution_text": "Author Name / Wikimedia Commons",
  "verification_status": "verified" or "needs_review",
  "intended_beat": "beat-1-hook"
}
```

---

## How to Source Assets

### Option A: Wikimedia Commons (Automatic)
```bash
# Search via API (requires jq)
curl "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=Margaret%20Clitherow%20portrait&format=json" | jq '.query.search[].title'
```

### Option B: Manual Browser Search
1. Go to Wikimedia Commons
2. Search for specific terms
3. Filter by:
   - Image type: Still image
   - License: Public Domain or CC BY-SA
   - Media type: Photographs, Artwork
4. Download with attribution info

### Option C: British Library
1. Go to https://www.bl.uk/collection-guides/digital-collections
2. Search "Elizabethan execution" or "Catholic martyr"
3. Use "Use this image" links for rights info

---

## Quality Check

Before committing assets:

- [ ] File downloads successfully
- [ ] Image is clear at 1080x1920 crop
- [ ] Historical period matches
- [ ] Subject matches intended beat
- [ ] License is verified (Public Domain, CC0, or CC BY-SA)
- [ ] Attribution text is recorded
- [ ] Filename matches asset ID

---

## Implementation Notes

1. Place downloaded images in: `data/editor/assets/1/`
2. Update the asset manifest: `data/editor/visual-asset-manifest-margaret-clitherow.json`
3. The Remotion renderer will reference these files
4. Credits are displayed automatically from asset metadata

---

## Legal Reminders

⚠️ **Do NOT use:**
- Modern stock photography
- AI-generated historical portraits of named individuals
- Images without clear licensing
- Copyrighted museum images without permission

⚠️ **Do use:**
- Pre-1928 public domain works
- CC0 licensed modern recreations
- Verified historical engravings/paintings
- Museum images with explicit reuse permission