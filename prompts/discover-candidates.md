This run covers a SINGLE channel. Return THREE distinct candidate topics
for it in `topics`, best first. Every candidate must follow all the rules
above, must be grounded in the search results, and must not repeat or
rephrase any topic or slug in the channel's `recent_topics`. The pipeline
reserves the first candidate that is not a recent duplicate, so three
genuinely different candidates keep the channel from being skipped.

SUBJECTS — a video of typed names is a failed video. For every candidate list in `subjects` the specific people and organizations the
story is ABOUT, by the full public names the sources give them (never a generic group such as "police", "prosecutors" or "the council").
Prefer stories whose main subjects are known well enough to have a Wikipedia article with a logo or a portrait: a national agency, a listed
company, a university, an official, a public figure. A story whose only subjects are a local committee, a small firm or a private consultant
has nothing to show on screen. The pipeline looks each subject up and reserves the best-illustrated candidate first, so three candidates with
three different, well-known sets of subjects keep the channel from a video made of text.
