import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, createReadStream, writeFileSync } from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";

const stable = (x) => Array.isArray(x) ? x.map(stable) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().filter((k) => !["preview_file", "preview_path", "render_path", "contact_sheet", "generated_at", "storyboard_hash"].includes(k)).map((k) => [k, stable(x[k])])) : x;
export const storyboardHash = (storyboard) => createHash("sha256").update(JSON.stringify(stable(storyboard))).digest("hex");
const norm = (x) => String(x || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const countWords = (x) => String(x || "").trim().split(/\s+/).filter(Boolean).length;
const now = () => new Date().toISOString();

export function validateRivalLinesStoryboard(doc, { root = process.cwd(), requireFiles = false } = {}) {
  const errors = [];
  if (doc?.channel_id !== "ch-51") errors.push("storyboard channel_id must be ch-51 (Rival Lines)");
  if (!Array.isArray(doc?.scenes) || doc.scenes.length < 1) errors.push("storyboard must contain at least one scene");
  const assets = new Map((Array.isArray(doc?.assets) ? doc.assets : []).map((a) => [a.id, a]));
  const ids = new Set();
  const players = new Set();
  const playerPhotos = new Set();
  const playerFootage = new Set();
  for (const scene of doc?.scenes || []) {
    const tag = `scene ${scene?.id || "(missing id)"}`;
    if (!scene?.id || ids.has(scene.id)) errors.push(`${tag}: id is missing or duplicated`);
    ids.add(scene?.id);
    if (!String(scene?.narration || "").trim()) errors.push(`${tag}: narration is required`);
    if (!scene?.narration_ref || !(Number(scene?.narration_end_sec) > Number(scene?.narration_start_sec ?? -1))) errors.push(`${tag}: a narration section reference and start/end timestamps are required`);
    if (!(Number(scene?.duration_frames) > 0)) errors.push(`${tag}: duration_frames must be positive`);
    if (scene?.player?.name) players.add(norm(scene.player.name));
    const text = [scene?.title, scene?.kicker, scene?.caption, scene?.scoreline].filter(Boolean).join(" ");
    if (countWords(text) > 20) errors.push(`${tag}: on-screen copy exceeds the 20-word scene limit`);
    if (text && norm(text).length > 12 && norm(scene?.narration).includes(norm(text))) errors.push(`${tag}: on-screen copy duplicates narration`);
    const refs = [
      scene?.media?.asset_id ? { id: scene.media.asset_id, slot: "media", kind: scene.media.kind } : null,
      scene?.branding?.crest_asset_id ? { id: scene.branding.crest_asset_id, slot: "club crest", kind: "club-crest" } : null,
      scene?.branding?.competition_asset_id ? { id: scene.branding.competition_asset_id, slot: "competition mark", kind: "competition-mark" } : null,
    ].filter(Boolean);
    if (!refs.length && scene.visual?.type !== "tactical") errors.push(`${tag}: no linked media asset; unresolved scenes cannot be approved`);
    for (const ref of refs) {
      const a = assets.get(ref.id);
      if (!a) { errors.push(`${tag}: ${ref.slot} asset ${ref.id} is absent from the manifest`); continue; }
      if (ref.kind && ref.kind !== a.kind) errors.push(`${tag}: declared ${ref.slot} kind does not match asset ${ref.id}`);
      const path = resolve(root, a.path || "");
      if (requireFiles && (!a.path || !existsSync(path))) errors.push(`${tag}: ${ref.slot} file is missing (${a.path || "no path"})`);
      if (!a.source_url) errors.push(`${tag}: ${ref.slot} ${ref.id} has no source URL`);
      if (!a.rights?.evidence_url || !a.rights?.basis || !a.rights?.permitted_use) errors.push(`${tag}: ${ref.slot} ${ref.id} has incomplete rights evidence`);
      if (a.rights?.status !== "verified") errors.push(`${tag}: ${ref.slot} ${ref.id} rights are not verified`);
      if (a.verification?.status !== "verified" || !a.verification?.verified_by || String(a.verification?.evidence || "").length < 12) errors.push(`${tag}: ${ref.slot} ${ref.id} visual identity/relevance verification is incomplete`);
      if (!a.editorial_purpose || !a.transformative_treatment || String(a.transformative_treatment).length < 20) errors.push(`${tag}: ${ref.slot} ${ref.id} lacks a specific transformative editorial purpose`);
      if (ref.slot === "media" && scene.player?.name) {
        if (norm(a.player) !== norm(scene.player.name)) errors.push(`${tag}: asset ${ref.id} is not identified as the narrated player ${scene.player.name}`);
        if (a.kind === "player-photo") playerPhotos.add(norm(scene.player.name));
        if (a.kind === "match-footage") {
          playerFootage.add(norm(scene.player.name));
          if (!a.club || !a.match || !a.event) errors.push(`${tag}: player footage requires the correct club, match, and match event`);
        }
      }
      if (ref.slot === "club crest" && scene.club?.name && norm(a.club) !== norm(scene.club.name)) errors.push(`${tag}: crest asset ${ref.id} is not verified for ${scene.club.name}`);
      if (ref.slot === "competition mark" && scene.match?.competition && norm(a.competition) !== norm(scene.match.competition)) errors.push(`${tag}: competition mark ${ref.id} is not verified for ${scene.match.competition}`);
    }
    if (scene.visual?.type === "tactical" && !(scene.visual.tactical?.points?.length >= 2)) errors.push(`${tag}: tactical animation needs at least two grounded player positions`);
  }
  for (const p of players) {
    if (!playerPhotos.has(p)) errors.push(`player ${p}: no linked genuine, identity-verified photograph is represented in the storyboard`);
    if (!playerFootage.has(p)) errors.push(`player ${p}: no linked actual-match-footage candidate is represented in the storyboard`);
  }
  return { ok: errors.length === 0, errors, assetCount: assets.size, sceneCount: doc?.scenes?.length || 0 };
}

export function decisionReadiness(doc, decisions = {}) {
  const errors = [];
  for (const scene of doc?.scenes || []) {
    const d = decisions[scene.id];
    if (d?.decision !== "approved") { errors.push(`scene ${scene.id}: explicit scene approval is missing`); continue; }
    const ids = [scene.media?.asset_id, scene.branding?.crest_asset_id, scene.branding?.competition_asset_id].filter(Boolean);
    const assets = ids.map((id) => (doc.assets || []).find((x) => x.id === id)).filter(Boolean);
    const needs = new Set();
    for (const a of assets) {
      needs.add("identity"); needs.add("relevance"); needs.add("rights");
      if (a.kind === "match-footage") needs.add("match");
      if (["club-crest", "competition-mark"].includes(a.kind)) needs.add("branding");
    }
    if (scene.player?.name && !assets.length && scene.visual?.type !== "tactical") needs.add("identity");
    for (const k of needs) if (d.checks?.[k] !== true) errors.push(`scene ${scene.id}: reviewer has not verified ${k}`);
    if (d.notes?.toLowerCase().includes("unresolved")) errors.push(`scene ${scene.id}: reviewer recorded unresolved media`);
  }
  return { ok: errors.length === 0, errors };
}

export function currentApproval(doc, approval) {
  if (!approval || approval.storyboard_hash !== storyboardHash(doc) || approval.whole_video?.decision !== "approved") return { approved: false, reason: "No whole-video approval matches this storyboard version." };
  const sceneCheck = decisionReadiness(doc, approval.scenes || {});
  return sceneCheck.ok ? { approved: true, reason: "Every scene and this storyboard version have explicit approval." } : { approved: false, reason: sceneCheck.errors.join("; ") };
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const safeJoin = (base, part) => { const dest = resolve(base, part); if (dest !== resolve(base) && !dest.startsWith(resolve(base) + sep)) throw new Error("invalid path"); return dest; };

function reviewHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rival Lines — storyboard approval</title><style>
  :root{color-scheme:dark;--bg:#0d141a;--panel:#17232b;--ink:#f1eee7;--muted:#a9b2b8;--gold:#d5a84f;--green:#4d9a70;--red:#ee756b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px Inter,system-ui,sans-serif}header{position:sticky;top:0;background:#101820f2;border-bottom:1px solid #31404a;padding:14px 4vw;z-index:5;display:flex;align-items:center;justify-content:space-between}header b{letter-spacing:.18em}main{max-width:1200px;margin:28px auto;padding:0 20px}.notice{padding:15px 18px;background:#422d17;border:1px solid var(--gold);margin:18px 0}.scene{background:var(--panel);border:1px solid #33434e;margin:24px 0;padding:18px;display:grid;grid-template-columns:minmax(300px,1.25fr) minmax(300px,1fr);gap:20px}.scene img.preview{width:100%;aspect-ratio:16/9;object-fit:cover;background:#030609}.scene video{width:100%;max-height:380px;background:#000}.meta{color:var(--muted);line-height:1.6}.flag{color:var(--red);font-weight:800}.ok{color:#9de1b6}.actions{display:flex;gap:10px;margin-top:14px}.checks{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.checks label{font-size:13px}.checks input{accent-color:var(--green)}button{border:1px solid #62717a;background:#25343c;color:var(--ink);padding:10px 14px;cursor:pointer;font-weight:700}button.approve{background:#21593f;border-color:#4d9a70}button.reject{background:#642d31;border-color:#a34b50}textarea{width:100%;background:#0d141a;color:var(--ink);padding:9px;border:1px solid #485761}#whole{position:sticky;bottom:0;background:#101820;padding:14px;border-top:1px solid #33434e;display:flex;justify-content:space-between;align-items:center}@media(max-width:780px){.scene{grid-template-columns:1fr}}
  </style></head><body><header><b>RIVAL LINES / EDITORIAL REVIEW</b><span id="status">Loading storyboard…</span></header><main><div class="notice"><b>Pre-render gate.</b> Review the actual Remotion scene stills and match clips. Unverified identity, match relevance, licensing, or branding blocks approval. Approval is bound to this storyboard's content hash.</div><div id="scenes"></div><section id="post-render" class="scene" style="display:none;grid-template-columns:1fr"><div><h2>Independent post-render inspection</h2><img id="post-image" class="preview" src="/postrender/contact"><p>These are frames extracted from the actual final MP4, sampled at each planned scene midpoint. Compare them with the approved sequence and script.</p><div class="checks" id="post-checks"></div><textarea id="post-notes" rows="3" placeholder="Timestamped defects, or why this pass is acceptable"></textarea><div class="actions"><button class="approve" id="post-submit">Record post-render inspection</button></div></div></section></main><div id="whole"><span>Whole-video approval remains explicit and separate from scene decisions.</span><button id="approve-all" class="approve">Approve storyboard version</button></div><script>
  let state; const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  async function load(){state=await (await fetch('/api/state')).json();document.querySelector('#status').textContent='Version '+state.storyboard_hash.slice(0,12)+' / '+(state.approved?'APPROVED':'PENDING');document.querySelector('#scenes').innerHTML=state.storyboard.scenes.map((s,i)=>{const d=state.approval.scenes?.[s.id]||{};const a=state.storyboard.assets.find(x=>x.id===s.media?.asset_id)||{};const checks=['identity','relevance',...(a.kind==='match-footage'?['match']:[]),...(a.kind==='club-crest'||a.kind==='competition-mark'?['branding']:[]),'rights'];return '<section class="scene"><div><img class="preview" src="/stills/'+encodeURIComponent(s.preview_file||s.id)+'.png"><h2>'+esc(String(i+1).padStart(2,'0'))+' / '+esc(s.title||s.player?.name||s.id)+'</h2><p>'+esc(s.narration)+'</p><div>'+ (a.kind==='match-footage'&&a.preview_path?'<video controls preload="metadata" src="/media/'+encodeURIComponent(a.preview_path)+'"></video>':'')+'</div></div><div><h3>'+esc(s.player?.name||'Scene')+' '+(s.club?.name?'· '+esc(s.club.name):'')+'</h3><p class="meta">'+esc(s.match?.name||'')+' '+esc(s.match?.date||'')+'<br>Scene duration: '+(Number(s.duration_frames)/Number(state.storyboard.fps||30)).toFixed(1)+'s<br>Media: '+esc(a.title||a.id||'UNRESOLVED')+'<br>Asset verification: '+esc(a.verification?.status||'unverified')+' — '+esc(a.verification?.evidence||'no visual evidence recorded')+'<br>Source: <a target="_blank" rel="noreferrer" href="'+esc(a.source_url||'#')+'">'+esc(a.source_url||'missing')+'</a><br>Rights: '+esc(a.rights?.basis||'missing')+' / '+esc(a.rights?.status||'unverified')+' · <a target="_blank" rel="noreferrer" href="'+esc(a.rights?.evidence_url||'#')+'">rights evidence</a><br>Editorial treatment: '+esc(a.transformative_treatment||'missing')+'</p><p class="meta '+(d.decision==='approved'?'ok':'flag')+'">'+esc(d.decision||'PENDING')+'</p><div class="checks">'+checks.map(k=>'<label><input type="checkbox" data-check="'+k+'" '+(d.checks?.[k]?'checked':'')+'> I verified '+k+'</label>').join('')+'</div><textarea rows="2" placeholder="Scene notes or requested change">'+esc(d.notes||'')+'</textarea><div class="actions"><button class="approve" data-decision="approved" data-scene="'+esc(s.id)+'">Approve scene</button><button class="reject" data-decision="rejected" data-scene="'+esc(s.id)+'">Reject / request revision</button></div></div></section>'}).join('');document.querySelector('#post-render').style.display=state.post_render_available?'grid':'none';document.querySelector('#post-checks').innerHTML=['matches_approved_storyboard','matches_final_script','player_identity_correct','footage_relevant','branding_correct','text_and_pacing_acceptable','technical_playback_ok'].map(k=>'<label><input type="checkbox" data-post-check="'+k+'"> I verified '+k.replaceAll('_',' ')+'</label>').join('')}
  }
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-decision]');if(!b)return;const section=b.closest('.scene');const checks={};section.querySelectorAll('[data-check]').forEach(x=>checks[x.dataset.check]=x.checked);const notes=section.querySelector('textarea').value;const r=await fetch('/api/scene',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hash:state.storyboard_hash,scene_id:b.dataset.scene,decision:b.dataset.decision,checks,notes})});const j=await r.json();if(!r.ok)alert(j.error);await load()});
  document.querySelector('#approve-all').addEventListener('click',async()=>{const r=await fetch('/api/whole',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hash:state.storyboard_hash,decision:'approved'})});const j=await r.json();if(!r.ok)alert(j.error);else alert('Storyboard explicitly approved: '+j.hash);await load()});load();
  document.querySelector('#post-submit').addEventListener('click',async()=>{const checks={};document.querySelectorAll('[data-post-check]').forEach(x=>checks[x.dataset.postCheck]=x.checked);const r=await fetch('/api/post-render',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hash:state.storyboard_hash,checks,notes:document.querySelector('#post-notes').value})});const j=await r.json();if(!r.ok)alert(j.error);else alert('Post-render visual inspection recorded.');await load()});
  </script></body></html>`;
}

export async function startReviewServer({ storyboardPath, outDir, host = "127.0.0.1", port = 4173 }) {
  const approvalPath = join(outDir, "approval.json");
  let doc = readJson(storyboardPath), hash = storyboardHash(doc);
  const refresh = () => { const fresh = readJson(storyboardPath), freshHash = storyboardHash(fresh); if (freshHash !== hash) { doc = fresh; hash = freshHash; } else doc = fresh; return { doc, hash }; };
  const getApproval = () => { const old = existsSync(approvalPath) ? readJson(approvalPath) : null; return old?.storyboard_hash === hash ? old : { storyboard_hash: hash, scenes: {}, whole_video: null, post_render: null }; };
  const server = createServer((req, res) => {
    const send = (status, body, type = "application/json") => { res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" }); res.end(type === "application/json" ? JSON.stringify(body) : body); };
    const parseBody = () => new Promise((resolveBody, reject) => { let b = ""; req.on("data", c => { b += c; if (b.length > 1e6) reject(new Error("request too large")); }); req.on("end", () => { try { resolveBody(JSON.parse(b || "{}")); } catch (e) { reject(e); } }); });
    (async () => {
      const url = new URL(req.url, `http://${host}:${port}`);
      if (req.method === "GET" && url.pathname === "/") return send(200, reviewHtml(), "text/html");
      refresh();
      if (req.method === "GET" && url.pathname === "/api/state") return send(200, { storyboard: doc, storyboard_hash: hash, approval: getApproval(), approved: currentApproval(doc, getApproval()).approved, post_render_available: existsSync(join(outDir, "post-render-contact.png")) });
      if (req.method === "GET" && url.pathname.startsWith("/stills/")) { const name = decodeURIComponent(url.pathname.slice(7)); if (!/^[\w.-]+\.png$/.test(name)) return send(400, { error: "invalid still" }); const p = safeJoin(join(outDir, "stills"), name); if (!existsSync(p)) return send(404, { error: "still unavailable" }); res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" }); return res.end(readFileSync(p)); }
      if (req.method === "GET" && url.pathname === "/postrender/contact") { const p = join(outDir, "post-render-contact.png"); if (!existsSync(p)) return send(404, { error: "post-render frames not available" }); res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" }); return res.end(readFileSync(p)); }
      if (req.method === "GET" && url.pathname.startsWith("/media/")) { const name = decodeURIComponent(url.pathname.slice(7)); const p = safeJoin(join(outDir, "public"), name); if (!existsSync(p)) return send(404, { error: "media unavailable" }); const ext = extname(p).toLowerCase(), type = ({ ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" })[ext] || "application/octet-stream", size = statSync(p).size, range = req.headers.range; if (range && /^bytes=\d*-\d*$/.test(range)) { const [a,b] = range.slice(6).split("-"), start = a ? Number(a) : Math.max(0, size - Number(b)), end = b && a ? Math.min(size - 1, Number(b)) : size - 1; if (start > end || start >= size) { res.writeHead(416, { "content-range": `bytes */${size}` }); return res.end(); } res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1, "cache-control": "no-store" }); return createReadStream(p, { start, end }).pipe(res); } res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes", "cache-control": "no-store" }); return createReadStream(p).pipe(res); }
      if (req.method === "POST" && ["/api/scene", "/api/whole", "/api/post-render"].includes(url.pathname)) {
        const body = await parseBody(); refresh();
        if (body.hash !== hash) return send(409, { error: "Storyboard changed; reload and re-approve the new version." });
        const approval = getApproval(); approval.storyboard_hash = hash; approval.scenes ||= {};
        if (url.pathname === "/api/scene") {
          if (!doc.scenes.some((x) => x.id === body.scene_id)) return send(404, { error: "unknown scene" });
          if (!["approved", "rejected"].includes(body.decision)) return send(400, { error: "decision must be approved or rejected" });
          approval.scenes[body.scene_id] = { decision: body.decision, checks: body.checks || {}, notes: String(body.notes || ""), reviewed_at: now() };
          approval.whole_video = null;
          writeJson(approvalPath, approval);
          return send(200, { ok: true });
        }
        if (url.pathname === "/api/whole") {
          const preflightPath = join(outDir, "preflight.json");
          const preflight = existsSync(preflightPath) ? readJson(preflightPath) : { blockers: ["preflight report missing"] };
          if (preflight.storyboard_hash !== hash) return send(409, { error: "Preflight is stale for this storyboard version; regenerate scene previews." });
          if (preflight.blockers?.length) return send(409, { error: `Pre-render blockers must be resolved before approval:\n${preflight.blockers.join("\n")}` });
          const validation = validateRivalLinesStoryboard(doc, { requireFiles: true });
          if (!validation.ok) return send(409, { error: `Storyboard assets are not verified:\n${validation.errors.join("\n")}` });
          const readiness = decisionReadiness(doc, approval.scenes);
          if (!readiness.ok) return send(409, { error: readiness.errors.join("\n") });
          if (body.decision !== "approved") return send(400, { error: "whole-video approval must be explicit" });
          approval.whole_video = { decision: "approved", reviewed_at: now(), storyboard_hash: hash, reviewer: String(body.reviewer || "local reviewer") };
          writeJson(approvalPath, approval);
          return send(200, { ok: true, hash });
        }
        if (!existsSync(join(outDir, "post-render-contact.png"))) return send(409, { error: "Post-render frames are not available for inspection." });
        if (!currentApproval(doc, getApproval()).approved) return send(409, { error: "Post-render inspection requires a valid explicit pre-render storyboard approval." });
        const checks = body.checks || {};
        const required = ["matches_approved_storyboard", "matches_final_script", "player_identity_correct", "footage_relevant", "branding_correct", "text_and_pacing_acceptable", "technical_playback_ok"];
        const failed = required.filter((x) => checks[x] !== true);
        const notes = String(body.notes || "");
        const pass = failed.length === 0;
        if (!pass && !/\b\d{1,2}:\d{2}(?:\.\d+)?\b/.test(notes)) return send(400, { error: `Timestamp each observed defect in the notes (for example 01:24): ${failed.join(", ")}` });
        approval.post_render = { status: pass ? "human-inspected-pass" : "human-inspected-fail", checks, failed_checks: failed, notes, inspected_at: now(), storyboard_hash: hash };
        writeJson(approvalPath, approval);
        writeJson(join(outDir, "post-render-qa.json"), { channel_id: "ch-51", storyboard_hash: hash, status: approval.post_render.status, failed_checks: failed, notes, inspected_at: approval.post_render.inspected_at, reviewer_checks: checks });
        return send(200, { ok: true, status: approval.post_render.status, failed_checks: failed });
      }
      return send(404, { error: "not found" });
    })().catch((e) => send(500, { error: e.message }));
  });
  await new Promise((resolveListen, reject) => server.once("error", reject).listen(port, host, resolveListen));
  return server;
}

export function writePostRenderReport(outDir, report) { mkdirSync(outDir, { recursive: true }); writeJson(join(outDir, "post-render-qa.json"), report); }
