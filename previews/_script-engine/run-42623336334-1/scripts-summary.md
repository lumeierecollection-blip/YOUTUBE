# Script engine: live preview, all channels

Each script below was produced by the engine from pages fetched during this run. Only entries marked APPROVED passed every gate and an independent critic. Anything else is shown for transparency and must not be narrated.

## ai-tested - BLOCKED_MODEL
Topic: Model Context Protocol (short)
Writer providers: gemini; critic providers: none; model calls: 4; rounds: 0; narrowings: 0
Words per minute: 189.6 (measured, voice en-US-AndrewNeural)
Why not approved: judge gave unusable output: the answer was not valid JSON

## hidden-past - REJECTED
Topic: The Antikythera mechanism (short)
Writer providers: gemini; critic providers: none; model calls: 8; rounds: 3; narrowings: 0
Words per minute: 171.4 (measured, voice en-GB-RyanNeural)
Why not approved: CON-05: "Olympic Games" appears with no word saying what or who it is. | CON-04: The sentence states a figure or a name but cites no claim. | CON-04: The ending brings in something the listener has not heard (figure 1901).

Last draft (NOT APPROVED):
> What did the gears of the Antikythera mechanism actually do? To support complex counting, the largest gear measures thirteen centimetres and originally had two hundred twenty-three teeth. This twenty-three tooth eclipse cycle link enabled predictions of astronomical positions, plus athletic game cycles like the ancient Olympic Games. Physical evidence from 1901 proves the Antikythera mechanism could predict eclipses and track athletic cycles.

## red-space-facts - BLOCKED_MODEL
Topic: Why Mars looks red (short)
Writer providers: gemini; critic providers: none; model calls: 4; rounds: 0; narrowings: 0
Words per minute: 176.8 (measured, voice en-US-GuyNeural)
Why not approved: judge gave unusable output: the answer was not valid JSON

## dopamine-loop - REJECTED
Topic: Nostalgia (short)
Writer providers: gemini; critic providers: none; model calls: 8; rounds: 3; narrowings: 0
Words per minute: 187 (measured, voice en-US-EmmaNeural)
Why not approved: CON-02: These two sentences share no subject, name or fact: the narration jumps. | CON-02: These two sentences share no subject, name or fact: the narration jumps. | DUR-01: the script is estimated at 17s; the minimum is 18s

Last draft (NOT APPROVED):
> Why does an old song pull you into a bittersweet longing for the past? Music acts as a strong trigger for that bittersweet longing. Sound passes through sensory processing, how the brain interprets sound, straight into the amygdala, the brain's emotional processing center. Why does an old song pull you into the past?

## gray-matter - REJECTED
Topic: Sleep and memory (short)
Writer providers: gemini; critic providers: none; model calls: 8; rounds: 3; narrowings: 0
Words per minute: 170.7 (measured, voice en-US-JennyNeural)
Why not approved: CON-03: "these memory" refers to something never mentioned before this point. | CON-04: The ending brings in something the listener has not heard (active, reorganiz, connection, lock). | DUR-01: the script is estimated at 14.4s; the minimum is 18s

Last draft (NOT APPROVED):
> How does sleep actually process our memories? Nocturnal sleep and daytime naps stabilize and enhance these memory processes. Hippocampus activity, the brain structure for memory, directly causes plastic changes and better performance. Sleep actively reorganizes brain connections to lock in memories.

## rival-lines - BLOCKED_MODEL
Topic: The 2005 UEFA Champions League final (match_analysis)
Writer providers: gemini; critic providers: none; model calls: 4; rounds: 0; narrowings: 0
Words per minute: 166.5 (measured, voice en-US-AriaNeural)
Why not approved: judge gave unusable output: the answer was not valid JSON

## court-and-spotlight - ENGINE_ERROR
Topic: Martha Stewart and the ImClone case (investigation)
Words per minute: 176.8 (measured, voice en-US-GuyNeural)
Why not approved: Error: script-package invalid:
  script-package.cta: expected string|null, got object
    at assertValid (file:///home/runner/work/YOUTUBE/YOUTUBE/platform/script-engine/schema.mjs:59:23)
    at runEngine (file:///home/runner/work/YOUTUBE/YOUTUBE/platform/script-engine/engine.mjs:106:7)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async preview (file:///home/runner/work/YOUTUBE/YOUTUBE/platform/channels/_script-engine/preview.mjs:64:22)
    at async file:///home/runner/work/YOUTUBE/YOUTUBE/platform/preview/run.mjs:20:3

## world-view - REJECTED_BLUEPRINT
Topic: The 1956 Suez Crisis (short)
Writer providers: gemini; critic providers: none; model calls: 7; rounds: 0; narrowings: 0
Words per minute: 177 (measured, voice en-GB-SoniaNeural)
Why not approved: blueprint rejected: a ending beat does not serve the question: The beat fails to provide a summary or synthesis of the intervention origins, serving no purpose.; the beats do not answer the central question from the claims; the beats do not answer the central question from the claims; does not fit the length; narrow to: The plan fails because it lists the UK and France joining as a beat but provides no claims to explain their distinct motivations, leaving the central question unanswered.
