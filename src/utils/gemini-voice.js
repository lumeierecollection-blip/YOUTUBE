/**
 * The Gemini prebuilt voice for a channel's Edge voice (same gender and register), and the delivery note Gemini TTS reads as a
 * style instruction. channels.json `gemini_voice` overrides. The note asks for the human reading the owner described: varied
 * intonation, breaths at the punctuation, emphasis on the word that matters.
 */
const GEMINI_VOICE = { "en-US-GuyNeural": "Charon", "en-US-AndrewNeural": "Sadaltager", "en-GB-RyanNeural": "Rasalgethi", "en-US-AriaNeural": "Sulafat", "en-US-JennyNeural": "Aoede" };
export function geminiVoiceFor(edgeVoice, override = null) {
  const voice = override || GEMINI_VOICE[edgeVoice] || (/Guy|Andrew|Ryan|Davis|Tony|Christopher|Eric|Brian/i.test(edgeVoice || "") ? "Charon" : "Sulafat");
  const british = /^en-GB/i.test(edgeVoice || "");
  const style = `Read this as a documentary narrator speaking to one person${british ? ", in a natural British English accent" : ""}: warm, engaged and conversational, with real variation in pitch across each sentence, a short breath at every comma and dash, a clear stop at every full stop, and a little weight on the one word in each sentence that matters. Never sing-song, never flat, never rushed.`;
  return { voice, style };
}
