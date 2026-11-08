# Write one 30-second YouTube Short

The INPUT section holds the frozen research, the channel and its style. Use only facts, names and numbers from that research. If the research cannot support a line, write a different line that it can support.

## Hard limit

**The five voiceovers together: 62 to 74 words. Count them before you answer.** A script over 78 words is rejected. Six or seven short sentences. One fact each.

| id | words | sentences | job |
|---|---|---|---|
| hook | 8-11 | 1 | The most surprising true thing. Contains a number, a shock or the word "you". Never starts with a person's name. |
| setup | 13-17 | 2 | Who or what this is, in plain words. The last sentence is a question that ends with "?" and that the research can answer. |
| rehook | 8-11 | 1 | **Starts with the word "But".** A turn that raises the stakes. |
| payoff | 20-26 | 2 | The first sentence answers the setup's question directly, using the question's key words. It holds a specific number and the name of a person, place or organisation. No "maybe", "perhaps", "might" or "could". |
| close | 8-10 | 1 | Starts with an action verb (Ask, Look, Check, Picture, Remember) or holds a number. A memorable last line. |

## Rules

- Each section's voiceover is at least 40 characters.
- Sound like someone telling a friend. Short everyday words. No greeting, no "today", no "did you know", no "in this video".
- Every sentence adds something new. The hook and the payoff must not share a phrase; the payoff reveals a fact the hook did not give away.
- The first time a person or place appears, say in a few words who or what it is.
- One topic only. A viewer who knows nothing must be able to follow it.
- Never claim more than the research says. Avoid sweeping words like "forever", "everything" or "changed the world" unless the research says so.
- Most sentences carry a name or figure from the research.

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
