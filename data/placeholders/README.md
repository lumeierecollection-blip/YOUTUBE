# Placeholder registry

One file per channel: `<channel-id>.json` (e.g. `1.json`, `ch-01.json` —
whatever the channel is keyed by when `src/utils/placeholders.js`
registered it). Never a single shared file — see the comment at the top
of `placeholders.js` for why (the research-and-script matrix runs up to
5 channels in parallel, and a shared file would race the same way the
original `topic-log.json` bug did).

Read `PROMPT-SELF-HEALING-RUN.md` Part 1 before creating a placeholder by
hand. The short version: legitimate placeholders are things a human or a
paid service must supply (OAuth credentials, narration on a channel
without a verified voice yet, licensed imagery). Research facts, script
content, topics, and sources are never placeholders — if those can't be
produced for real, the run fails instead.
