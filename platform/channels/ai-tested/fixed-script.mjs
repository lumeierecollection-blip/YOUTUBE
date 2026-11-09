/**
 * Written directly on the owner's instruction, from the measured test in experiment.json, to get this video
 * out without waiting on the model providers' quotas. It did NOT pass through the script engine or its
 * independent critic. Set USE_FIXED to false to return this channel to the engine.
 */
export const USE_FIXED = true;
export const SENTENCES = [
  { text: "Can AI count letters?", kind: "hook", claim_ids: [] },
  { text: "We gave two models twenty questions.", kind: "setup", claim_ids: ["design"] },
  { text: "Both got strawberry right.", kind: "terminal", claim_ids: ["example"] },
  { text: "OpenAI's GPT-OSS got all twenty.", kind: "score", claim_ids: ["score0"] },
  { text: "Google's Flash-Lite got eleven.", kind: "score", claim_ids: ["score1"] },
  { text: "On random letters, just three of ten.", kind: "split", claim_ids: ["split_random1"] },
  { text: "It found five Os in onomatopoeia.", kind: "miss", claim_ids: ["miss"] },
  { text: "There are four.", kind: "miss", claim_ids: ["miss"] },
  { text: "So AI can count, just not every model.", kind: "close", claim_ids: [], on_screen_text: "AI can count. Just not every model." },
];
export const METADATA = {
  title: "Can AI Count Letters? We Tested Two Models",
  description: "We gave OpenAI's GPT-OSS and Google's Gemini Flash-Lite the same 20 letter-counting questions, and code marked every reply. One test, run on 9 November 2026. Results can change between runs and as models update.\n\n#Shorts #AI #AITested #Gemini #TechNews",
  tags: ["AI test", "letter counting", "GPT-OSS", "Gemini Flash-Lite", "AI models", "strawberry test"],
};
