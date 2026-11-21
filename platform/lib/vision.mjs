/** One vision call with a provider chain, so a used-up Gemini quota never blocks production (21 Nov 2026: every sourcing + gate call returned no answer for a day).
 *  visionJSON(prompt, buf, mime) -> parsed JSON or null. Order: Gemini models x keys, then VISION_API (OpenAI-compatible), Groq, Mistral, OpenRouter.
 *  Every failure is logged once per provider so the cause is visible in the Actions log. */
const GEM = ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GOOGLE_GENERATIVE_AI_API_KEY"].map((k) => process.env[k]).filter(Boolean);
const GEM_MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const seen = new Set(), note = (k, m) => { if (!seen.has(k)) { seen.add(k); console.log(`  [vision] ${k}: ${m}`); } };
const parse = (t) => { try { return JSON.parse(String(t || "").replace(/^```(?:json)?\s*|```\s*$/g, "").trim()); } catch { const m = String(t || "").match(/\{[\s\S]*\}/); try { return m && JSON.parse(m[0]); } catch { return null; } } };
async function gemini(prompt, b64, mime) {
  for (const model of GEM_MODELS) for (const key of GEM) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(60000),
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: b64 } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) });
      if (!r.ok) { note("gemini " + model + " " + r.status, (await r.text()).slice(0, 90).replace(/\s+/g, " ")); continue; }
      const j = parse((await r.json()).candidates?.[0]?.content?.parts?.map((x) => x.text || "").join("")); if (j) return j;
    } catch (e) { note("gemini err", String(e).slice(0, 60)); }
  }
  return null;
}
async function openai(name, base, key, model, prompt, b64, mime) {
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(90000),
      body: JSON.stringify({ model, temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: prompt + "\nReply with the JSON only." }, { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }] }] }) });
    if (!r.ok) { note(name + " " + r.status, (await r.text()).slice(0, 90).replace(/\s+/g, " ")); return null; }
    return parse((await r.json()).choices?.[0]?.message?.content);
  } catch (e) { note(name + " err", String(e).slice(0, 60)); return null; }
}
export async function visionJSON(prompt, buf, mime = "image/jpeg") {
  const b64 = buf.toString("base64"); let j = await gemini(prompt, b64, mime); if (j) return j;
  const E = process.env, tries = [];
  if (E.VISION_API_KEY && E.VISION_API_BASE && E.VISION_MODEL) tries.push(["vision-api", E.VISION_API_BASE, E.VISION_API_KEY, E.VISION_MODEL]);
  if (E.GROQ_API_KEY) tries.push(["groq", "https://api.groq.com/openai/v1", E.GROQ_API_KEY, "meta-llama/llama-4-scout-17b-16e-instruct"]);
  if (E.MISTRAL_API_KEY) tries.push(["mistral", "https://api.mistral.ai/v1", E.MISTRAL_API_KEY, "pixtral-12b-2409"]);
  if (E.OPENROUTER_API_KEY) tries.push(["openrouter", "https://openrouter.ai/api/v1", E.OPENROUTER_API_KEY, "google/gemini-2.5-flash"]);
  for (const t of tries) { j = await openai(...t, prompt, b64, mime); if (j) { note("used " + t[0], "answered"); return j; } }
  return null;
}
