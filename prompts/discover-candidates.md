This run covers a SINGLE channel. Return THREE distinct candidate topics
for it in `topics`, best first. Every candidate must follow all the rules
above, must be grounded in the search results, and must not repeat or
rephrase any topic or slug in the channel's `recent_topics`. The pipeline
reserves the first candidate that is not a recent duplicate, so three
genuinely different candidates keep the channel from being skipped.
