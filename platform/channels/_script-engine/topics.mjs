/**
 * One topic per channel for the live preview. Each is grounded ONLY in pages fetched during the run: the
 * script engine's claims.mjs keeps a claim only if its excerpt is verbatim in what these URLs returned.
 * Wikipedia is read as the current revision's plain text through its API; the other pages are fetched as HTML.
 * The topics are real, well-documented subjects chosen so every claim category of the channel can occur;
 * they are not the channels' real upcoming videos.
 */
export const TOPICS = {
  "ai-tested": {
    format: "short",
    topic: "Model Context Protocol",
    angle: "what the protocol actually lets an AI application do, step by step, and which statements are only the project's own claims",
    sources: ["https://en.wikipedia.org/wiki/Model_Context_Protocol", "https://modelcontextprotocol.io/docs/getting-started/intro"],
  },
  "hidden-past": {
    format: "short",
    topic: "The Antikythera mechanism",
    angle: "what the physical evidence shows the device could do, kept apart from what later researchers made of it",
    sources: ["https://en.wikipedia.org/wiki/Antikythera_mechanism"],
  },
  "red-space-facts": {
    format: "short",
    topic: "Why Mars looks red",
    angle: "what is observed on Mars, which explanations are models, and nothing presented as artwork or a what-if unless a source says so",
    sources: ["https://en.wikipedia.org/wiki/Mars", "https://science.nasa.gov/mars/facts/"],
  },
  "dopamine-loop": {
    format: "short",
    topic: "Nostalgia",
    angle: "the feeling of being pulled into the past by a smell or a song, then what research says about it",
    sources: ["https://en.wikipedia.org/wiki/Nostalgia"],
  },
  "gray-matter": {
    format: "short",
    topic: "Sleep and memory",
    angle: "what the brain does with new memories during sleep, separating what is linked from what is shown to cause",
    sources: ["https://en.wikipedia.org/wiki/Sleep_and_memory"],
  },
  "rival-lines": {
    format: "match_analysis",
    topic: "The 2005 UEFA Champions League final",
    angle: "how Liverpool came back from three goals down against Milan: a thesis about the turn of the match, with recorded data kept apart from interpretation",
    sources: ["https://en.wikipedia.org/wiki/2005_UEFA_Champions_League_final"],
    overrides: { targetSeconds: 120, minSeconds: 80, maxSeconds: 180 },
  },
  "court-and-spotlight": {
    format: "investigation",
    topic: "Martha Stewart and the ImClone case",
    angle: "the allegation, the charges, the evidence, her public statements and the outcome, each kept in its own category",
    sources: ["https://en.wikipedia.org/wiki/Martha_Stewart"],
    overrides: { targetSeconds: 120, minSeconds: 80, maxSeconds: 180 },
  },
  "world-view": {
    format: "short",
    topic: "The 1956 Suez Crisis",
    angle: "who acted, what the documents record, and where historians disagree about motives, with views attributed to those who hold them",
    sources: ["https://en.wikipedia.org/wiki/Suez_Crisis"],
  },
};
