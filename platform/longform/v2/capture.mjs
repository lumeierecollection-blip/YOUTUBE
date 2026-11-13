#!/usr/bin/env node
/**
 * Long form v2: REAL browser capture. Playwright drives Chrome to a public page, performs scripted steps (scroll, click, type, wait), records
 * the whole interaction as video, saves a screenshot after every step, and reports the on-page rectangles of given phrases so a highlight
 * can be drawn on the real pixels (never on a mock-up). Used by AI Tested (software demonstrations) and Court & Spotlight (source captures).
 * Reference technique: AI Search 1Aqhg0FVm-w / tDWtcyeNNew (real pages pushed in with a highlight box); SunnyV2 mxCZUz2F24E (captured
 * articles with the claim line highlighted).
 * Job: { id, url, viewport:{width,height}, scale, phrases:[..], steps:[{ do:"scroll"|"click"|"type"|"wait"|"goto", ... }], record:bool, fullPage:bool }
 * Usage: node platform/longform/v2/capture.mjs <job.json> <outDir>   -> <outDir>/<id>-<n>.png, <id>.json, <id>.webm (if record)
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";

const { chromium } = createRequire(join(ROOT, "package.json"))("playwright");

/** Rectangles (page coordinates) of each occurrence of a phrase in the page text, found with DOM Ranges. */
const findRects = (phrases) => {
  const out = {};
  for (const phrase of phrases) {
    const want = phrase.replace(/\s+/g, " ").trim().toLowerCase(), walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), nodes = []; let text = "";
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { const v = n.nodeValue.replace(/\s+/g, " "); if (!v.trim() || !n.parentElement || n.parentElement.closest("script,style,noscript")) continue; nodes.push({ n, start: text.length, v }); text += v; }
    const at = text.toLowerCase().indexOf(want); if (at < 0) { out[phrase] = null; continue; }
    const locate = (pos) => { const k = nodes.findLast((x) => x.start <= pos); const raw = k.n.nodeValue; let seen = 0, i = 0, prevSpace = false; for (; i < raw.length && seen < pos - k.start; i++) { const sp = /\s/.test(raw[i]); if (!(sp && prevSpace)) seen++; prevSpace = sp; } return [k.n, Math.min(i, raw.length)]; };
    const r = document.createRange(), [sn, so] = locate(at), [en, eo] = locate(at + want.length); r.setStart(sn, so); r.setEnd(en, eo);
    out[phrase] = [...r.getClientRects()].filter((q) => q.width > 2 && q.height > 2).map((q) => ({ x: Math.round(q.x + scrollX), y: Math.round(q.y + scrollY), w: Math.round(q.width), h: Math.round(q.height) }));
  }
  return out;
};

export async function capture(job, outDir) {
  mkdirSync(outDir, { recursive: true });
  const vp = job.viewport || { width: 1600, height: 900 }, scale = job.scale || 1.5;
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: scale, locale: "en-GB", ...(job.record ? { recordVideo: { dir: outDir, size: vp } } : {}) });
  const page = await ctx.newPage(), shots = [], log = [];
  const shot = async (label) => { const file = `${job.id}-${shots.length}.png`; await page.screenshot({ path: join(outDir, file), fullPage: !!job.fullPage && shots.length === 0 }); shots.push({ file, label, scrollY: await page.evaluate(() => scrollY), at_ms: Date.now() - t0 }); };
  const t0 = Date.now();
  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 90000 }); await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}); await page.evaluate(() => document.fonts && document.fonts.ready);
  for (const sel of job.hide || []) await page.addStyleTag({ content: `${sel}{display:none !important}` });
  await shot("loaded");
  for (const s of job.steps || []) {
    if (s.do === "scroll") await page.evaluate(([y, smooth]) => window.scrollTo({ top: y, behavior: smooth ? "smooth" : "instant" }), [s.y, !!job.record]);
    else if (s.do === "scrollTo") await page.getByText(s.text, { exact: false }).first().scrollIntoViewIfNeeded();
    else if (s.do === "click") { const el = s.selector ? page.locator(s.selector).first() : page.getByText(s.text, { exact: false }).first(); const b = await el.boundingBox(); if (b) { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 }); log.push({ cursor: [b.x + b.width / 2, b.y + b.height / 2], at_ms: Date.now() - t0 }); } await el.click(); }
    else if (s.do === "type") await page.keyboard.type(s.text, { delay: s.delay ?? 45 });
    else if (s.do === "press") await page.keyboard.press(s.key);
    else if (s.do === "goto") await page.goto(s.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(s.wait ?? 700);
    if (s.shot !== false) await shot(s.label || s.do);
  }
  const rects = job.phrases?.length ? await page.evaluate(findRects, job.phrases) : {};
  const meta = { id: job.id, url: job.url, final_url: page.url(), title: await page.title(), captured: new Date().toISOString(), viewport: vp, scale, page_height: await page.evaluate(() => document.documentElement.scrollHeight), shots, rects, cursor_log: log };
  const video = job.record ? page.video() : null;
  await ctx.close(); await browser.close();
  if (video) { const p = await video.path(); renameSync(p, join(outDir, `${job.id}.webm`)); meta.video = `${job.id}.webm`; }
  writeFileSync(join(outDir, `${job.id}.json`), JSON.stringify(meta, null, 1));
  return meta;
}

if (process.argv[1] && process.argv[1].endsWith("capture.mjs")) {
  const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
  for (const job of Array.isArray(jobs) ? jobs : [jobs]) {
    try { const m = await capture(job, process.argv[3]); console.log("captured", m.id, m.shots.length, "shots", Object.entries(m.rects).map(([k, v]) => `${k.slice(0, 24)}:${v ? v.length : "MISSING"}`).join(" | "), m.video || ""); }
    catch (e) { console.log("FAILED", job.id, e.message.split("\n")[0]); }
  }
}
