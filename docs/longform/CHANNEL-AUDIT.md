# Channel audit for long form (13 Nov 2026)

Sources inspected: `config/channel-registry.json` (the authoritative list, 8 channels), `config/channels.json` (52 legacy entries, mostly
unassigned placeholders), `platform/channels/*`, the Shorts render folders, `config/upload-approval.json`. Nothing was renamed, merged, deleted or
paused by this audit. Shorts are untouched.

| Channel the owner names | Registry key | Legacy id | YouTube upload | Long-form status before this phase | Notes |
|---|---|---|---|---|---|
| Hidden Past | `hidden-past` | 1 (ch-01) | configured (CHANNEL_01) | v2 approved baseline (stills) | |
| AI Tested | `ai-tested` | 2 (ch-02) | configured (CHANNEL_02) | v2 baseline | |
| Court & Spotlight | `court-and-spotlight` | 3 (ch-03) | configured (CHANNEL_03; OAuth reported dead earlier) | v2 baseline (investigation format only) | Registry editorial: "Celebrity and pop culture in three selectable formats: investigation, entertainment magazine, VOX-style explainer". channels.json ch-03 is "Celebrity Feuds & Court Sagas". |
| **Celebrity News** | **none** | none | none | none | **No separate channel exists anywhere in config.** The three treatments the owner describes are, today, written into Court & Spotlight's registry entry. |
| Rival Lines | `rival-lines` | 4 (ch-04) | configured (CHANNEL_04) | v2 baseline | |
| **Space** | `red-space-facts` (Red Space Facts) | none | not configured | Shorts only | channels.json also has unassigned placeholders: ch-11 Cosmic Frontiers (paused), ch-49 Stellar, ch-36 Pixel Cosmos. Not touched. |
| **Psychology** | `dopamine-loop` (emotion) and `gray-matter` (brain) | none | not configured | Shorts only | Two registry channels split the subject. Placeholders ch-22 Mind Lab, ch-50 Synapse, ch-35 Rational, ch-32 Neural are unassigned. |
| (not named by the owner) | `world-view` | none | not configured | none | Geopolitics; untouched. |

## How this phase treats the gap
- **Celebrity News is built as its own long-form editorial and visual system, `celebrity-news`,** separate from Court & Spotlight, as the owner
  asked. It is NOT added to the registry and has no upload target: creating a channel needs the owner's decision and a YouTube channel.
  Court & Spotlight keeps the court/legal investigation identity it already has; Celebrity News carries magazine, VOX explainer and
  news-investigation treatments of international celebrities. Owner decision needed: (a) make Celebrity News a new registry channel, or
  (b) fold it into Court & Spotlight as its non-legal formats.
- **Space** long form is built for `red-space-facts`.
- **Psychology** long form is built as one system serving both `dopamine-loop` and `gray-matter`; the sample episode states which channel it is
  written for.
