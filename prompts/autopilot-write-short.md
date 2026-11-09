# Write one 30-second YouTube Short

The INPUT section holds the frozen research, the channel and its style. Use only facts, names and numbers from that research. If the research cannot support a line, write a different line that it can support.

## Hard limit

**The five voiceovers together: {{MIN}} to {{MAX}} words. Count them before you answer.** A script over {{REJECT}} words is rejected, and drafts usually run long, so write tight. Seven short sentences at most. One fact each.

| id | words | sentences | job |
|---|---|---|---|
| hook | {{HOOK}} | 1 | Stops the swipe in two seconds. Open on the most surprising true detail, mid-story, with the strange part in the first few words. Contains a number, a shock or the word "you". Never starts with a person's name. |
| setup | {{SETUP}} | 2 | The first sentence proves the hook is real with one concrete detail: who, where or when. The last sentence is the question the hook made the viewer ask, worded the way a curious person would say it, never like a quiz. It ends with "?" and the research can answer it. |
| rehook | {{REHOOK}} | 1 | **Starts with the word "But".** A turn that raises the stakes. It does not answer the setup's question; it makes the answer matter more. |
| payoff | {{PAYOFF}} | 2 | The first sentence answers the setup's question directly, using the question's key words. It holds a specific number and the name of a person, place or organisation. No "maybe", "perhaps", "might" or "could". |
| close | {{CLOSE}} | 1 | Starts with an action verb (Ask, Look, Check, Picture, Remember) or holds a number. Comes back to the hook's image in new words, so the first line lands differently on a rewatch. |

## Hold the viewer to the last word

This is one chain, not a list of facts. A viewer leaves the moment the next sentence is not needed.

- Each sentence must exist because of the one before it. Between any two sentences you could honestly say "but", "so" or "because". If only "and then" fits, the two are unrelated: rewrite.
- Delete test: if a sentence can be removed and the story still makes sense, it is filler. Replace it with the fact that moves the story.
- The question opened in the setup stays open until the payoff. Nothing earlier may give away the answer.
- Stakes rise. The rehook makes the answer matter more than it did a moment ago.
- Write to be heard. Read it aloud in your head. Maximum 14 words a sentence, and vary the length.
- Never use: "here's the thing", "here's what", "the result?", "turns out", "what if I told you", "in a world where", "not gonna lie", "let me be honest", "game-changer", "No X. No Y. Just Z.", or any request to like, follow or subscribe.

## Rules

- Each section's voiceover is at least 40 characters.
- Write real figures as digits ($10, 1977). Only use a figure the research states. Never add a filler count like "1 leader" or "1 restricted tier".
- Sound like someone telling a friend. Short everyday words. No greeting, no "today", no "did you know", no "in this video".
- Each figure, name and phrase appears once. Never repeat a number in a later sentence.
- Every sentence adds something new. The hook and the payoff must not share a phrase; the payoff reveals a fact the hook did not give away.
- The first time a person or place appears, say in a few words who or what it is.
- Never write he, she, him or her unless that person is already named. If the research gives no name, repeat the description ("the 88-year-old").
- One topic only. A viewer who knows nothing must be able to follow it.
- Choose figures a beginner can feel: years, prices, distances, people, counts of everyday things. Never use chemical formulas, percentages of ingredients or obscure measurements.
- The ending says why the whole story matters, in plain words.
- Never claim more than the research says. Avoid sweeping words like "forever", "everything" or "changed the world" unless the research says so.
- **Every sentence must state something that can be drawn: a sourced number, date, place, a list of two or more things, a comparison, a document, an amount of money, or a cause ("because", "so").** Naming a company or person alone does not count.

## Output

Return only this JSON object:

{
  "channel_id": "from INPUT",
  "topic_slug": "from INPUT",
  "format": "shorts",
  "hook": "the same text as the hook section's voiceover",
  "sections": [
    { "id": "hook", "voiceover": "...", "visual_cue": "what is on screen, at least 10 characters", "text_overlay": null },
    { "id": "setup", "voiceover": "...", "visual_cue": "...", "text_overlay": null },
    { "id": "rehook", "voiceover": "...", "visual_cue": "...", "text_overlay": null },
    { "id": "payoff", "voiceover": "...", "visual_cue": "...", "text_overlay": null },
    { "id": "close", "voiceover": "...", "visual_cue": "...", "text_overlay": null }
  ],
  "sources_used": ["at least 2 source_url values copied exactly from the research"]
}

No colour values anywhere.
