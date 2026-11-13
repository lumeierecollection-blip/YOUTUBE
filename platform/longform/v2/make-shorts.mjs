#!/usr/bin/env node
/**
 * Vertical Shorts + publishing metadata from a rendered long-form episode (run after render-episode.mjs, same output folder).
 * Usage: node platform/longform/v2/make-shorts.mjs <channel>
 * Output: output/longform-prod/<channel>/shorts/<slug>/{short.mp4, cover.jpg, captions.ass, meta.json} and <channel>/episode-meta.json
 *
 * Built from the analytics of the channels' earlier Shorts (output/analytics, docs/longform/SHORTS-ANALYSIS-AND-FIXES.md):
 *  - the first seconds state the result, with a big on-screen hook line from the first frame (hook lost 13-32% of viewers);
 *  - the bridge (3-11 s) was the weakest part in 6 of 8 AI Tested Shorts: so each Short starts on the payoff/tension beat, not a set-up, and the picture
 *    changes at beat boundaries (a new scene about every 10-20 s plus a caption change every ~1.5 s);
 *  - 22-41 s long (the best Shorts retained 86-107% at 23-39 s); titles under 60 characters, no truncation; hashtags always, #Shorts first.
 * Visual limit, stated plainly: the scenes are 16:9 compositions, shown here at full width over a blurred copy of themselves (no re-layout for portrait).
 * Nothing here uploads.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { assertHashtags } from "../../production/hashtags.mjs";

const ch = process.argv[2];
const FPS = 30, XF = 0.4, PAD = 0.55, MIN = 22, MAX = 41, TARGET = 37;
const BASE = join(ROOT, "output/longform-prod", ch), BEATS = join(BASE, "beats"), VOICE = join(BASE, "voice"), SH = join(BASE, "shorts");
const THEME = JSON.parse(readFileSync(join(ROOT, "config/longform-v2.json"), "utf8"))[ch];
const MUSIC = { "hidden-past": ["MUSIC_HISTORY_DOC", "Documentary Background", "Soundrider/Dope", "https://www.jamendo.com/track/1670561"], "ai-tested": ["MUSIC_ATMOS_DARK", "KREATEN -09- Dark atmospheric and bored piano", "Kreaten", "https://www.jamendo.com/track/466945"] }[ch];
const DEFS = {
  "hidden-past": [
    { slug: "trapped-8-years", start: "H02", ends: ["H03", "H04"], hook: "15 SHIPS. 8 YEARS.\nTRAPPED IN THE\nSUEZ CANAL", title: "15 Ships Trapped in the Suez Canal for 8 Years", tags: ["#HiddenPast", "#History", "#SuezCanal", "#Shorts"] },
    { slug: "life-on-the-lake", start: "H11", ends: ["H12"], hook: "THEY HAD A LAKE.\nAND AN OLYMPIC\nGAMES.", title: "Trapped Sailors Held Their Own Olympics", tags: ["#HiddenPast", "#History", "#SuezCanal", "#Shorts"] },
    { slug: "last-ships-home", start: "H17", ends: ["H18", "H19"], hook: "8 YEARS LATER,\nTHE CANAL REOPENED", title: "The Day the Trapped Ships Finally Went Home", tags: ["#HiddenPast", "#History", "#SuezCanal", "#Shorts"] },
    { slug: "oil-through-one-canal", start: "H05", ends: ["H06", "H07"], hook: "60% OF ITALY'S OIL\nCAME THROUGH\nONE CANAL", title: "Why Closing One Canal Hit Europe's Oil", tags: ["#HiddenPast", "#History", "#SuezCanal", "#Shorts"] },
  ],
  "ai-tested": [
    { slug: "first-four-digits", start: "A01", ends: ["A03"], hook: "AI GOT THE FIRST\n4 DIGITS RIGHT.\nTHEN IT BROKE.", title: "AI Gets Long Multiplication Wrong. We Tested It", tags: ["#AITested", "#AI", "#Gemini", "#Shorts"] },
    { slug: "why-it-fails", start: "A09b", ends: ["A09c"], hook: "WHY CAN AI WRITE\nESSAYS BUT NOT\nMULTIPLY?", title: "Why AI Writes Essays But Fails at Maths", tags: ["#AITested", "#AI", "#ChatGPT", "#Shorts"] },
    { slug: "show-its-working", start: "A10", ends: ["A11", "A12"], hook: "ONE TRICK FIXED IT:\nMAKE AI SHOW\nITS WORKING", title: "The Trick That Makes AI Do Maths Right", tags: ["#AITested", "#AI", "#Gemini", "#Shorts"] },
    { slug: "only-the-number", start: "A13", ends: ["A13"], hook: "TOLD TO REPLY WITH\nONLY A NUMBER,\nIT DIDN'T. 90 OF 90.", title: "We Told AI to Answer With Only a Number", tags: ["#AITested", "#AI", "#Gemma", "#Shorts"] },
  ],
}[ch];
if (!DEFS) { console.error("channel must be hidden-past or ai-tested"); process.exit(1); }

const run = (c, a, o = {}) => spawnSync(c, a, { encoding: "utf8", maxBuffer: 1 << 28, ...o });
const dur = (f) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout.trim());
const { EPISODE: ep, SOURCES } = await import(`./episodes/${ch}.mjs`);
const idx = Object.fromEntries(ep.beats.map((b, i) => [b.id, i]));
for (const b of ep.beats) { const m = join(VOICE, `${b.id}.mp3`); b._len = existsSync(m) ? dur(m) + PAD : 0; }
const ass = (hex) => { const h = hex.replace("#", ""); return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase(); };
const ts = (t) => { const c = Math.max(0, t), h = Math.floor(c / 3600), m = Math.floor((c % 3600) / 60), s = (c % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(m).padStart(2, "0")}:${s}`; };
const attrib = (() => { try { return JSON.parse(readFileSync(join(ROOT, `src/skills/remotion-render/public/lf2/${ch}/ATTRIBUTIONS.json`), "utf8")); } catch { return {}; } })();
const creditsFor = (beats) => [...new Set(beats.flatMap((b) => { const img = b.scene.image || b.scene.photo; const k = img && basename(String(img)).replace(/\.\w+$/, ""); return k && attrib[k] ? [`${attrib[k].credit_line} (${attrib[k].source_url})`] : []; }))];
const musicLine = `Music: "${MUSIC[1]}" by ${MUSIC[2]}, licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). ${MUSIC[3]}`;
const results = []; mkdirSync(SH, { recursive: true });

for (const d of DEFS) {
  const s = idx[d.start];
  // pick the end beat whose total length is inside the window and closest to the target
  let best = null;
  for (const e of d.ends) { const win = ep.beats.slice(s, idx[e] + 1); if (win.some((b) => !b._len || !existsSync(join(BEATS, `${b.id}.mp4`)))) continue; const total = win.reduce((t, b, i) => t + b._len - (i ? XF : 0), 0); if (total >= MIN && total <= MAX && (!best || Math.abs(total - TARGET) < Math.abs(best.total - TARGET))) best = { win, total, end: e }; }
  const dir = join(SH, d.slug); mkdirSync(dir, { recursive: true });
  if (!best) { results.push({ slug: d.slug, status: "blocked", reason: "no beat window of 22-41 s from the rendered beats (beats missing or too long/short)" }); console.log("skip", d.slug); continue; }
  const { win, total } = best, n = win.length;
  const finalMp4 = join(dir, "short.mp4");
  // ---- captions + hook (ASS). Words come from each beat's own timing file; a beat's voice starts where its video starts.
  let start = 0; const caps = [];
  for (const b of win) {
    const wf = join(VOICE, `${b.id}.words.json`); const words = existsSync(wf) ? (JSON.parse(readFileSync(wf, "utf8")).words || []) : [];
    for (let i = 0; i < words.length; i += 3) { const g = words.slice(i, i + 3); caps.push({ t0: start + g[0].start, t1: start + g.at(-1).end + 0.12, text: g.map((w) => w.text).join(" ").toUpperCase() }); }
    start += b._len - XF;
  }
  for (let i = 0; i < caps.length - 1; i++) caps[i].t1 = Math.min(caps[i].t1, caps[i + 1].t0);
  const hookEnd = 3.2, acc = ass(THEME.accent || "#FFE14D");
  writeFileSync(join(dir, "captions.ass"), `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Cap,DejaVu Sans,76,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,7,2,2,60,60,330,1\nStyle: Hook,DejaVu Sans,62,${acc},&H000000FF,&H00000000,&HC8000000,-1,0,0,0,100,100,0,0,3,14,0,8,60,60,190,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${`Dialogue: 1,${ts(0)},${ts(hookEnd)},Hook,,0,0,0,,${d.hook.replace(/\n/g, "\\N")}\n`}${caps.map((c) => `Dialogue: 0,${ts(Math.max(c.t0, hookEnd * 0 + 0))},${ts(c.t1)},Cap,,0,0,0,,${c.text.replace(/[{}]/g, "")}`).join("\n")}\n`);
  // ---- voice track for this window
  const voiceWav = join(dir, "voice.wav"); let st = 0; const del = [];
  win.forEach((b, i) => { del.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(st * 1000)}|${Math.round(st * 1000)}[a${i}]`); st += b._len - XF; });
  let r = run("ffmpeg", ["-y", "-v", "error", ...win.flatMap((b) => ["-i", join(VOICE, `${b.id}.mp3`)]), "-filter_complex", `${del.join(";")};${win.map((_, i) => `[a${i}]`).join("")}amix=inputs=${n}:normalize=0:duration=longest[o]`, "-map", "[o]", "-t", total.toFixed(2), voiceWav]);
  if (r.status) { results.push({ slug: d.slug, status: "failed", reason: `voice: ${r.stderr.slice(0, 200)}` }); continue; }
  // ---- music bed (same bed as the episode, ducked), two-pass loudnorm to -14 LUFS
  const musicFile = join(ROOT, "platform/longform/v2/audio/beds", `${MUSIC[0]}.mp3`), pre = join(dir, "pre.wav"), master = join(dir, "master.wav");
  r = run("ffmpeg", ["-y", "-v", "error", "-i", voiceWav, "-stream_loop", "-1", "-i", musicFile, "-filter_complex", `[1:a]atrim=0:${total.toFixed(2)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=-19dB,afade=t=in:d=1.5,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5[mus];[0:a]asplit=2[vo][key];[mus][key]sidechaincompress=threshold=0.04:ratio=3:attack=30:release=600[duck];[vo][duck]amix=inputs=2:normalize=0:duration=first[mx]`, "-map", "[mx]", "-ar", "48000", pre]);
  if (r.status) { results.push({ slug: d.slug, status: "failed", reason: `mix: ${r.stderr.slice(0, 200)}` }); continue; }
  const m = run("ffmpeg", ["-hide_banner", "-nostats", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"]).stderr, J = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
  run("ffmpeg", ["-y", "-v", "error", "-i", pre, "-af", `loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=${J.input_i}:measured_TP=${J.input_tp}:measured_LRA=${J.input_lra}:measured_thresh=${J.input_thresh}:offset=${J.target_offset}:linear=true,alimiter=limit=0.89:level=false`, "-ar", "48000", master]);
  // ---- picture: crossfade chain, then 1080x1920: blurred fill + full-width scene + burned captions
  const vin = win.flatMap((b) => ["-i", join(BEATS, `${b.id}.mp4`)]);
  const chain = [win.map((_, i) => `[${i}:v]fps=${FPS}[n${i}]`).join(";")]; let lab = "[n0]", a2 = win[0]._len;
  for (let i = 1; i < n; i++) { chain.push(`${lab}[n${i}]xfade=transition=fade:duration=${XF}:offset=${(a2 - XF).toFixed(3)}[x${i}]`); lab = `[x${i}]`; a2 += win[i]._len - XF; }
  const tmp = join(dir, "short.tmp.mp4");
  const fg = `${chain.join(";")};${lab}split=2[p][q];[p]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=32:6,eq=brightness=-0.18[bg];[q]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2-110[v];[v]ass=captions.ass[out]`;
  r = run("ffmpeg", ["-y", "-v", "error", ...vin, "-i", "master.wav", "-filter_complex", fg, "-map", "[out]", "-map", `${n}:a`, "-c:v", "libx264", "-crf", "21", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "192k", "-t", total.toFixed(2), "-movflags", "+faststart", "short.tmp.mp4"], { cwd: dir });
  if (r.status) { results.push({ slug: d.slug, status: "failed", reason: `video: ${r.stderr.slice(0, 300)}` }); continue; }
  renameSync(tmp, finalMp4);
  run("ffmpeg", ["-y", "-v", "error", "-ss", "1.2", "-i", finalMp4, "-frames:v", "1", "-q:v", "2", "cover.jpg"], { cwd: dir });
  // ---- metadata
  const srcIds = [...new Set(win.flatMap((b) => b.src || []))], srcLines = srcIds.map((k) => SOURCES[k] && `- ${SOURCES[k].title}: ${SOURCES[k].url}`).filter(Boolean);
  const desc = [`${win.map((b) => b.vo).join(" ")}`.slice(0, 300) + (win.map((b) => b.vo).join(" ").length > 300 ? "…" : ""), "", d.tags.join(" "), "", "Sources:", ...srcLines, "", "Image credits:", ...(creditsFor(win).length ? creditsFor(win) : ["(graphics and captures made for this video)"]), "", musicLine].join("\n");
  assertHashtags(desc);
  if (d.title.length > 60 || /…$/.test(d.title)) throw new Error(`title too long or truncated: ${d.title}`);
  const meta = { channel: ch, slug: d.slug, format: "short", title: d.title, description: desc, tags: d.tags.map((t) => t.slice(1)), hook_text: d.hook, beats: win.map((b) => b.id), seconds: +total.toFixed(2), music: MUSIC[0], privacy: "private", upload_status: "NOT UPLOADED" };
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  results.push({ slug: d.slug, status: "rendered", seconds: +total.toFixed(1), beats: meta.beats });
  console.log("short", d.slug, total.toFixed(1), "s");
}

// ---- long-form metadata: chapters from the real beat lengths
const all = ep.beats; let t = 0; const chapters = []; let lastPart = null;
for (const b of all) { if (b.part !== lastPart) { chapters.push([t, b.part]); lastPart = b.part; } t += (b._len || 0) - XF; }
const fmt = (s) => { const x = Math.round(s), m = Math.floor(x / 60), sec = String(x % 60).padStart(2, "0"); return `${m}:${sec}`; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const epMeta = {
  channel: ch, title: ep.title, format: "long-form", privacy: "private", upload_status: "NOT UPLOADED",
  description: [ep.title, "", `Chapters:`, ...chapters.map(([s, p]) => `${fmt(s)} ${cap(p)}`), "", "Sources:", ...Object.values(SOURCES).map((s) => `- ${s.title}: ${s.url}`), "", "Image credits:", ...creditsFor(all), "", musicLine, "", ch === "ai-tested" ? "#AITested #AI #Gemini" : "#HiddenPast #History #SuezCanal"].join("\n"),
  tags: ch === "ai-tested" ? ["AI test", "AI multiplication", "Gemini", "Faith and Fate", "chain of thought"] : ["Suez Canal", "Yellow Fleet", "Great Bitter Lake", "Six Day War", "history"],
  seconds: +t.toFixed(1), music: MUSIC[0],
};
writeFileSync(join(BASE, "episode-meta.json"), JSON.stringify(epMeta, null, 2));
writeFileSync(join(SH, "shorts-log.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
