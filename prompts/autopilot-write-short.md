# Write one 30-second YouTube Short

The INPUT section holds the frozen research, the channel and its style. Use only facts, names and numbers from that research. If the research cannot support a line, write a different line that it can support.

## Hard limit

**The five voiceovers together: 55 to 66 words. Count them before you answer.** A script over 72 words is rejected, and drafts usually run long, so write tight. Seven short sentences at most. One fact each.

| id | words | sentences | job |
|---|---|---|---|
| hook | 7-9 | 1 | The most surprising true thing. Contains a number, a shock or the word "you". Never starts with a person's name. |
| setup | 11-14 | 2 | Who or what this is, in plain words. The last sentence is a question that ends with "?" and that the research can answer. |
| rehook | 7-9 | 1 | **Starts with the word "But".** A turn that raises the stakes. |
| payoff | 18-22 | 2 | The first sentence answers the setup's question directly, using the question's key words. It holds a specific number and the name of a person, place or organisation. No "maybe", "perhaps", "might" or "could". |
| close | 7-9 | 1 | Starts with an action verb (Ask, Look, Check, Picture, Remember) or holds a number. A memorable last line. |

## Rules

- Each section's voiceover is at least 40 characters.
- Write every number as digits ($10, 30, 1977), never as words.
- Sound like someone telling a friend. Short everyday words. No greeting, no "today", no "did you know", no "in this video".
- Each figure, name and phrase appears once. Never repeat a number in a later sentence.
- Every sentence adds something new. The hook and the payoff must not share a phrase; the payoff reveals a fact the hook did not give away.
- The first time a person or place appears, say in a few words who or what it is.
- Never write he, she, him or her unless that person is already named. If the research gives no name, repeat the description ("the 88-year-old").
- One topic only. A viewer who knows nothing must be able to follow it.
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
