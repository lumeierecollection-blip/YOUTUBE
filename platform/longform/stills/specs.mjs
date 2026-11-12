// Shot definitions for the long-form visual approval package. Every shot names the real component it renders (LfScene / LfTransition / LfThumb) and what it demonstrates.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mapFor } from "../maps.mjs";

const here = dirname(fileURLToPath(import.meta.url)), samples = join(here, "../samples");
const j = (f) => JSON.parse(readFileSync(join(samples, f), "utf8"));
const wrap = (t, n) => { const out = []; let line = ""; for (const w of String(t).replace(/\s+/g, " ").split(" ")) { if ((line + " " + w).trim().length > n) { out.push(line); line = w; } else line = (line + " " + w).trim(); } if (line) out.push(line); return out; };
const mk = (channel) => {
  const shots = [];
  const scene = (group, name, scene, frame, label, assets = {}) => shots.push({ group, name, id: "LfScene", frame, props: { channel, scene, ...assets }, label: { component: `LfScene → ${channel} · ${scene.kind}`, mode: frame > 20 ? `animation keyframe (frame ${frame})` : "static", ...label } });
  const trans = (name, kind, a, b, assets, label) => [6, 30, 54].forEach((frame, i) => shots.push({ group: "transitions", name: `${name}-${["start", "middle", "end"][i]}`, id: "LfTransition", frame, props: { channel, kind, a, b, ...assets }, label: { component: `LfTransition (${kind})`, mode: `animation keyframe ${["start", "middle", "end"][i]} (frame ${frame})`, ...label } }));
  const thumb = (name, variant, t, assets, label) => shots.push({ group: "thumbs", name, id: "LfThumb", frame: 0, props: { channel, variant, t, ...assets }, label: { component: `LfThumb ${variant}`, mode: "static thumbnail concept", ...label } });
  return { shots, scene, trans, thumb };
};

export const SPECS = {
  // ───────────────────────────────────────────── Hidden Past
  async "hidden-past"(ctx, dir) {
    const { shots, scene, trans, thumb } = mk("hidden-past"), assets = { photos: [], maps: [] }, images = {}, credits = {};
    for (const [k, title] of Object.entries({ portrait: "File:Ponzi1920.jpg", desk: "File:Charles Ponzi.jpg", mug: "File:Charles Ponzi mug shot.jpg", face: "File:Chas. Ponzi LCCN2014711137.jpg" })) {
      const { file, entry } = await ctx.commons(title, k, join(dir, "assets")); images[k] = await ctx.jpg(file, 1400); credits[k] = entry.credit_line; assets.photos.push(entry);
    }
    const cut = join(dir, "assets/face-cutout.png"), r = spawnSync("python3", [join(ctx.ROOT, "platform/production/cutout.py"), join(dir, "assets/face.jpg"), cut, "--model", "isnet-general-use"], { encoding: "utf8", timeout: 900000 });
    if (r.status === 0) images.faceCut = `data:image/png;base64,${(await ctx.sharp(cut).resize({ height: 1000, withoutEnlargement: true }).png().toBuffer()).toString("base64")}`; else assets.cutout_failed = String(r.stderr).slice(-300);
    const maps = { arrival: await mapFor([{ title: "Lugo, Emilia-Romagna", name: "Lugo" }, { title: "Boston", name: "Boston" }]), exile: await mapFor([{ title: "Boston", name: "Boston" }, { title: "Rio de Janeiro", name: "Rio de Janeiro" }]), baltic: await mapFor([{ title: "Tallinn", name: "Tallinn" }, { title: "Riga", name: "Riga" }, { title: "Vilnius", name: "Vilnius" }], { zoom: 4, noRoute: true }) };
    assets.maps = Object.fromEntries(Object.entries(maps).map(([k, m]) => [k, m.places])); const A = { images, credits, maps };
    const T = { technique: "" };
    scene("openings", "o1-cold-open-portrait", { kind: "photo", image: "portrait", portrait: true, name: "Charles Ponzi", note: "Securities Exchange Company, Boston", year: "1920" }, 40, { scene: "Opening 1: who, where, when (photograph held still, credited)", technique: "This Is History / RealLifeLore: open on a dated, concrete moment" }, A);
    scene("openings", "o2-map-establishing", { kind: "map", map: "arrival", caption: "Lugo to Boston", portrait: "faceCut", portraitSide: "left", name: "Charles Ponzi", year: "1903" }, 90, { scene: "Opening 2: establishing map with relief, glowing route and cut-out portrait", technique: "This Is History: portrait cut-out laid on a terrain map", note: "relief = Natural Earth (public domain)" }, A);
    scene("openings", "o3-question", { kind: "title", kicker: "The question", text: "How could a promise that big fall so fast?" }, 40, { scene: "Opening 3: the central question", technique: "RealLifeLore: turn to one question within the first minutes" }, A);
    scene("main", "m1-timeline", { kind: "timeline", heading: "The case in dated order", year: "1903 – 1949", events: [{ year: "1903", label: "Arrives in Boston with $2.50" }, { year: "Jan 1920", label: "Starts the Securities Exchange Company" }, { year: "26 Jul 1920", label: "The Boston Post starts asking questions" }, { year: "11 Aug 1920", label: "The bank is seized" }, { year: "1 Nov 1920", label: "Pleads guilty to one count" }] }, 140, { scene: "Animated timeline", technique: "chronology in dated chapters (This Is History)", note: "facts from English Wikipedia, Charles Ponzi" }, A);
    scene("main", "m2-compare", { kind: "compare", heading: "How fast the money grew", year: "1920", note: "Bars share one scale starting at zero. Source: English Wikipedia, Charles Ponzi.", items: [{ label: "Invested by February 1920", value: 5000, display: "$5,000" }, { label: "Invested by March 1920", value: 25000, display: "$25,000" }, { label: "Taken in a single day, late July 1920", value: 250000, display: "$250,000", hot: true }] }, 130, { scene: "Statistics: three figures on one scale", technique: "data graphic drawn from zero, one unit" }, A);
    scene("main", "m3-territory", { kind: "map", map: "baltic", caption: "Estonia, Latvia and Lithuania", year: "2026" }, 90, { scene: "Geopolitical treatment: tinted territory with place pins", technique: "RealLifeLore: territory highlight on terrain", note: "LAYOUT SAMPLE, present-day Natural Earth borders, not a Ponzi scene" }, A);
    scene("main", "m4-exile-route", { kind: "map", map: "exile", caption: "Boston to Rio de Janeiro", year: "1949" }, 100, { scene: "Route map: where the story ended", technique: "glowing dotted route over terrain", note: "straight line = connection, not the actual voyage" }, A);
    scene("main", "m5-photo", { kind: "photo", image: "desk", name: "Charles Ponzi at his desk", year: "1920" }, 60, { scene: "Framed archival photograph, credited, never moved", technique: "archival still held (Hidden Past rule)" }, A);
    scene("main", "m6-quote", { kind: "quote", quote: "I went looking for trouble, and I found it.", speaker: "Charles Ponzi, to reporters, 1934", source: "English Wikipedia, Charles Ponzi", year: "1934" }, 60, { scene: "Quotation card with speaker and source", technique: "quotes need speaker and source" }, A);
    scene("main", "m7-number", { kind: "number", big: "$20,000,000", label: "lost by investors, in 1920 dollars", year: "1920" }, 50, { scene: "Stakes figure", technique: "number as the turn of the story" }, A);
    trans("t1", "iris", { kind: "map", map: "arrival", caption: "Lugo to Boston", portrait: "faceCut", portraitSide: "left", year: "1903" }, { kind: "photo", image: "desk", name: "Charles Ponzi at his desk", year: "1920" }, A, { scene: "Map to photograph", technique: "iris: focus from the place onto a face" });
    trans("t2", "wipe", { kind: "number", big: "$20,000,000", label: "lost by investors, in 1920 dollars", year: "1920" }, { kind: "quote", quote: "I went looking for trouble, and I found it.", speaker: "Charles Ponzi, 1934", source: "English Wikipedia", year: "1934" }, A, { scene: "Figure to quotation", technique: "wipe: reveal of the answer" });
    trans("t3", "push", { kind: "photo", image: "mug", name: "Booking photograph", year: "1920" }, { kind: "map", map: "exile", caption: "Boston to Rio de Janeiro", year: "1949" }, A, { scene: "Photograph to map", technique: "push: moving on to the next place and era" });
    thumb("th-A", "A", { lines: ["50% IN", "45 DAYS"] }, { images: { cut: images.faceCut, portrait: images.portrait }, base: maps.exile.base }, { scene: "Thumbnail A: portrait + terrain + the promise", technique: "This Is History thumbnail: portrait left, map right, gold serif words" });
    thumb("th-B", "B", { big: "$20M", lines: ["LOST IN 1920"] }, { base: maps.arrival.base }, { scene: "Thumbnail B: one huge figure", technique: "one focal point, fewest words" });
    thumb("th-C", "C", { lines: ["PONZI", "1920"] }, { images: { mug: images.mug } }, { scene: "Thumbnail C: booking photograph on paper", technique: "document look, high contrast" });
    return { shots, assets };
  },

  // ───────────────────────────────────────────── AI Tested
  async "ai-tested"(ctx, dir) {
    const { shots, scene, trans, thumb } = mk("ai-tested"), assets = { captures: [] }, images = {};
    const { plan } = await import(pathToFileURL(join(ctx.ROOT, "platform/channels/ai-tested/fabricated.mjs")).href);
    const d = plan(j("ai-unknown-experiment.json")).data, ex = d.example;
    // Two real browser captures (the browser-demonstration scene needs real captures; these pages are public).
    const R = join(ctx.ROOT, "src/skills/remotion-render"), { openBrowser } = await import(pathToFileURL(join(R, "node_modules/@remotion/renderer/dist/esm/index.mjs")).href), { findChrome } = await import(pathToFileURL(join(R, "find-chrome.js")).href);
    const chrome = findChrome(), br = await openBrowser("chrome", { ...(chrome ? { browserExecutable: chrome } : {}), chromiumOptions: { gl: "swangle" } });
    for (const [k, url] of Object.entries({ shot: "https://github.com/remotion-dev/remotion", shot2: "https://github.com/remotion-dev/skills" })) {
      const page = await br.newPage(); await page.setViewport({ width: 1600, height: 1000 }); await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      const f = join(dir, `${k}.png`); await page.screenshot({ path: f }); images[k] = await ctx.jpg(f, 1600); assets.captures.push({ key: k, url, taken: new Date().toISOString() }); await page.close();
    }
    await br.close({ silent: true });
    const reply = wrap(String(ex?.reply || "").replace(/[*_`#]+/g, ""), 74).slice(0, 6), made = d.models.map((m) => m.made_up), totalMade = d.made, all = d.all;
    const A = { images }, src = "Capture taken by this preview run; the page is public";
    const claim = { kind: "claim", kicker: "The claim being tested", title: `AI described ${totalMade} of ${all} invented things as real`, scope: `${d.models.length} models, ${d.fakes} things that do not exist, ${d.reals} real controls. Every reply is kept and counted by code.` };
    const term = { kind: "terminal", kicker: "A stored reply, word for word", title: `${ex?.model || "Model"} on an invented thing`, lines: ["$ jq '.models[0].items[] | {label, reply}' experiment.json", "{", `  "label": "${ex?.label || ""}",`, `  "reply": "${reply[0] || ""}`, ...reply.slice(1).map((l) => `           ${l}`), `}`] };
    const bench = { kind: "bench", kicker: "Result", title: "Invented things described as real", max: d.fakes, items: d.models.map((m) => ({ label: m.name, value: m.made_up, display: `${m.made_up} of ${m.fakes}`, hot: m.made_up > 0 })), footer: "Counted by code on a fixed list of admission phrases; one run, temperature 0; results change between runs." };
    const compare = { kind: "compare", kicker: "Side by side", title: "What each model did", cols: d.models.map((m) => m.name), rows: [{ label: "Described as real", cells: d.models.map((m) => ({ text: `${m.made_up} of ${m.fakes}`, hot: m.made_up > 0 })) }, { label: "Said it did not know", cells: d.models.map((m) => ({ text: `${m.admitted} of ${m.fakes}` })) }, { label: "Real controls answered", cells: d.models.map((m) => ({ text: `${m.reals - (m.real_flagged || 0)} of ${m.reals}` })) }], footer: "Same question, same words, every model." };
    const diagram = { kind: "diagram", kicker: "The method", title: "How the test works", nodes: [{ label: "Invent", sub: `${d.fakes} things` }, { label: "Ask", sub: `${d.models.length} models` }, { label: "Keep", sub: "every reply" }, { label: "Count", sub: "by code" }, { label: "Verdict", sub: "what to do" }] };
    const browser = (image, zoom, title) => ({ kind: "browser", kicker: "Real tool, real page", title, url: image === "shot" ? "github.com/remotion-dev/remotion" : "github.com/remotion-dev/skills", image, zoom, source: src });
    scene("openings", "o1-claim", claim, 40, { scene: "Opening 1: the claim and its scope", technique: "AI Search: claim + scope within 10 seconds" }, A);
    scene("openings", "o2-browser", browser("shot", { x: 0.3, y: 0.28, scale: 1.7 }, "Start on the real thing"), 90, { scene: "Opening 2: a real browser capture with a camera push", technique: "AI Search: screen capture of the actual tool", note: "demonstrates the scene; the page is not an AI test" }, A);
    scene("openings", "o3-method", diagram, 90, { scene: "Opening 3: the method in one line", technique: "labelled pipeline, arrows draw in order" }, A);
    scene("main", "m1-browser", browser("shot2", { x: 0.55, y: 0.35, scale: 1.8 }, "Zoom into the part that matters"), 100, { scene: "Browser capture with cursor and zoom", technique: "cursor highlight + zoom into an interface", note: "demonstrates the scene" }, A);
    scene("main", "m2-terminal", term, 150, { scene: "Terminal with a real stored model reply", technique: "terminal and code display", note: "content = real stored reply; the jq command is replayed against the stored file" }, A);
    scene("main", "m3-bench", bench, 100, { scene: "Benchmark bars from zero", technique: "one scale, one unit, counted results" }, A);
    scene("main", "m4-compare", compare, 100, { scene: "Model comparison table", technique: "AI Search: compare models on one test" }, A);
    scene("main", "m5-diagram", { ...diagram, title: "Where each answer was checked", nodes: [{ label: "Reply", sub: "kept whole" }, { label: "Phrase list", sub: "fixed in advance" }, { label: "Outcome", sub: "admitted or made up" }] }, 90, { scene: "Technical diagram (3 nodes)", technique: "animated explanatory diagram" }, A);
    scene("main", "m6-claim-verdict", { kind: "claim", kicker: "Verdict", title: "Confident is not true", scope: "Ask for the source, then click it." }, 50, { scene: "Verdict card", technique: "end each test with a one-line verdict" }, A);
    trans("t1", "wipe", browser("shot", { x: 0.3, y: 0.28, scale: 1.7 }, "Real page"), bench, A, { scene: "Capture to result", technique: "wipe: from the thing to the answer" });
    trans("t2", "push", bench, compare, A, { scene: "Chart to table", technique: "push: next test, next view" });
    trans("t3", "dissolve", term, { kind: "claim", kicker: "Verdict", title: "Confident is not true", scope: "Ask for the source, then click it." }, A, { scene: "Reply to verdict", technique: "dissolve: same thought continues" });
    thumb("th-A", "A", { word: "made up" }, { images: { shot: images.shot } }, { scene: "Thumbnail A: bar word over the real output", technique: "AI Search: cyan bar, one lowercase word over the actual output" });
    thumb("th-B", "B", { big: `${totalMade}/${all}`, lines: ["INVENTED THINGS", "DESCRIBED AS REAL"] }, {}, { scene: "Thumbnail B: the counted result", technique: "one huge number" });
    thumb("th-C", "C", { lines: ["AI ANSWERED", "A BOOK THAT", "DOES NOT EXIST"], terminal: reply.slice(0, 3).join("\n") }, {}, { scene: "Thumbnail C: terminal reply", technique: "show the real reply" });
    return { shots, assets };
  },

  // ───────────────────────────────────────────── Court & Spotlight
  async "court-and-spotlight"(ctx, dir) {
    const { shots, scene, trans, thumb } = mk("court-and-spotlight"), assets = { photos: [] }, images = {}, credits = {}, claims = Object.fromEntries(j("snipes-claims.json").map((c) => [c.claim_id, c.excerpt]));
    for (const [k, title] of Object.entries({ portrait: "File:Wesley Snipes by Gage Skidmore.jpg", booking: "File:Wesley Snipes mug shot.jpg" })) { const { file, entry } = await ctx.commons(title, k, join(dir, "assets")); images[k] = await ctx.jpg(file, 1300); credits[k] = entry.credit_line; assets.photos.push(entry); }
    const A = { images, credits }, DOJ = "U.S. Department of Justice · republished by Blast Magazine", CBS = "CBS News";
    const doj = { kind: "doc", kicker: "Case file · Wesley Snipes", source: DOJ, date: "25 Apr 2008", text: `${claims.K1} ${claims.K2}`, hl: ["failing to file income tax returns", "found guilty by a jury on February 1"], status: "finding", sample: "Real excerpt; card layout is ours" };
    const alleg = { kind: "doc", kicker: "What prosecutors said", source: CBS, date: "25 Apr 2008", text: claims.K4, hl: ["alleged", "at least $13.8 million"], status: "allegation", sample: "Real excerpt; card layout is ours" };
    const acq = { kind: "doc", kicker: "The jury's other decision", source: CBS, date: "25 Apr 2008", text: claims.K3, hl: ["acquitted", "felony tax fraud and conspiracy"], status: "finding", sample: "Real excerpt; card layout is ours" };
    const tl = { kind: "timeline", kicker: "Case chronology", events: [{ date: "1 Feb 2008", text: "Found guilty on failure-to-file charges", status: "finding" }, { date: "Feb 2008", text: "Acquitted of five additional charges", status: "finding" }, { date: "Before sentencing", text: "Government alleged income of at least $13.8 million", status: "allegation" }, { date: "24 Apr 2008", text: "Sentenced to three years; booking photograph dated the same day", status: "record" }] };
    const rel = { kind: "relations", kicker: "Who decided what", nodes: [{ id: "s", label: "Snipes", x: 960, y: 560 }, { id: "p", label: "Prosecutors", x: 360, y: 300 }, { id: "j", label: "Jury", x: 1560, y: 300 }, { id: "g", label: "Judge", x: 960, y: 930 }], edges: [{ from: "p", to: "s", label: "alleged $13.8M", status: "allegation" }, { from: "j", to: "s", label: "guilty: failure to file", status: "finding" }, { from: "g", to: "s", label: "sentenced: 3 years", status: "record" }] };
    const head = { kind: "headline", kicker: "Press record", masthead: CBS, date: "25 April 2008", headline: "Wesley Snipes Gets 3 Years In Prison", body: claims.K5.slice(0, 150) + "…", status: "record" };
    const photo = { kind: "photo", kicker: "Photograph", image: "portrait", name: "Wesley Snipes", caption: "Actor. Sentenced in April 2008 on federal tax charges.", gray: true, status: "record" };
    scene("openings", "o1-outcome", { kind: "outcome", kicker: "The record in one line", big: "3 YEARS", label: "Wesley Snipes, federal tax case", status: "record", source: `${DOJ}, 25 Apr 2008` }, 50, { scene: "Opening 1: the documented outcome first", technique: "outcome in the first sentence; status chip says what kind of fact" }, A);
    scene("openings", "o2-subject", photo, 50, { scene: "Opening 2: the subject, a real licensed photograph", technique: "real photographs only, credited" }, A);
    scene("openings", "o3-headline", head, 50, { scene: "Opening 3: the press record", technique: "real headline and standfirst as an editorial clipping", note: "layout is ours; headline and text are real" }, A);
    scene("main", "m1-doc-finding", doj, 90, { scene: "Court record: document with animated highlights", technique: "evidence excerpt, quoted words highlighted as read" }, A);
    scene("main", "m2-doc-allegation", alleg, 90, { scene: "Allegation drawn differently (amber, dashed)", technique: "an allegation can never look like a finding" }, A);
    scene("main", "m3-doc-acquittal", acq, 90, { scene: "Verdict card", technique: "court findings filled, green" }, A);
    scene("main", "m4-timeline", tl, 120, { scene: "Case chronology", technique: "dated events with a status on each" }, A);
    scene("main", "m5-relations", rel, 110, { scene: "Relationship and decision diagram", technique: "who alleged, decided and sentenced; edge style = status" }, A);
    scene("main", "m6-booking", { kind: "photo", kicker: "Evidence photograph", image: "booking", name: "Booking photograph", caption: "U.S. Marshals Service, dated 24 April 2008. Public domain.", status: "record" }, 60, { scene: "Genuine booking photograph with source", technique: "primary-source photograph, never altered" }, A);
    trans("t1", "wipe", doj, tl, A, { scene: "Document to chronology", technique: "wipe: from the record to the sequence" });
    trans("t2", "slate", photo, alleg, A, { scene: "Subject to allegation", technique: "slate: hard dip for a change of subject" });
    trans("t3", "dissolve", head, rel, A, { scene: "Press to diagram", technique: "dissolve: same story, wider view" });
    thumb("th-A", "A", { big: "3", lines: ["YEARS IN", "PRISON"] }, { images: { portrait: images.portrait } }, { scene: "Thumbnail A: subject + the outcome", technique: "one face, one number, grey-scale + red" });
    thumb("th-B", "B", { quote: ["Snipes was ", "acquitted", " in February of five additional charges"], status: "finding" }, {}, { scene: "Thumbnail B: the real quotation with its status", technique: "document as the thumbnail; the chip prevents a false impression" });
    thumb("th-C", "C", { big: "$13.8M", lines: ["ALLEGED BY", "PROSECUTORS"] }, {}, { scene: "Thumbnail C: the alleged figure, labelled as alleged", technique: "never present an allegation as fact" });
    return { shots, assets };
  },

  // ───────────────────────────────────────────── Rival Lines
  async "rival-lines"(ctx, dir) {
    const { shots, scene, trans, thumb } = mk("rival-lines"), md = j("argentina-france-statsbomb.json"), [A, B] = Object.keys(md.score), pick = (k) => ({ [A]: md.stats[A][k], [B]: md.stats[B][k] });
    const m = { teams: [A, B], title: [], stage: md.stage, competition: md.competition, score: md.score, pens: md.penalties, formation: md.formation, lineup: md.lineup, passes: pick("first_40_completed_passes"), shots78: pick("shots_before_79"), first: pick("first_shot_minute"), xg: pick("xg_series"), goals: pick("goal_minutes") };
    const logo = `data:image/png;base64,${readFileSync(join(samples, "statsbomb-logo.png")).toString("base64")}`, X = { m, logo }, assets = { data: "StatsBomb Open Data, 2022 World Cup final (match 3869685)" };
    const xgA = md.stats[A].xg, xgB = md.stats[B].xg;
    const stats = { kind: "stats", kicker: "First 40 minutes", title: "Completed passes", items: [{ label: "Completed passes, first 40 minutes", a: m.passes[A], b: m.passes[B] }, { label: "Shots before the 79th minute", a: m.shots78[A], b: m.shots78[B] }] };
    const h2h = { kind: "h2h", kicker: "The match record", title: "Final, 18 December 2022", cols: [{ name: A, color: "#6EC1F2", rows: [{ k: "Goals", v: m.score[A] }, { k: "Penalties", v: m.pens[A] }, { k: "Shots before 79'", v: m.shots78[A] }, { k: "Expected goals", v: Number(xgA).toFixed(2) }] }, { name: B, color: "#FF5A4F", rows: [{ k: "Goals", v: m.score[B] }, { k: "Penalties", v: m.pens[B] }, { k: "Shots before 79'", v: m.shots78[B] }, { k: "Expected goals", v: Number(xgB).toFixed(2) }] }], source: "StatsBomb Open Data. Expected goals is StatsBomb's model, not a measured outcome." };
    const form = { kind: "formation", kicker: "Starting shapes" }, xg = { kind: "xg", kicker: "Expected goals, minute by minute", title: "How the chances built" }, tl = { kind: "timeline", kicker: "Goals", title: "The match on a line" };
    scene("openings", "o1-formation", form, 60, { scene: "Opening 1: both starting shapes on the pitch", technique: "Football Made Simple: dark board, one idea per board", note: "recorded starting positions, not in-play movement" }, X);
    scene("openings", "o2-stats", stats, 90, { scene: "Opening 2: the result on screen within seconds", technique: "show the numbers early", note: "bars drawn from zero" }, X);
    scene("openings", "o3-timeline", tl, 90, { scene: "Opening 3: the match on a line", technique: "goal minutes for both teams" }, X);
    scene("main", "m1-formation", form, 90, { scene: "Formation board", technique: "players from the recorded line-up" }, X);
    scene("main", "m2-stats", stats, 110, { scene: "Statistical comparison", technique: "two bars per metric, one scale" }, X);
    scene("main", "m3-xg", xg, 100, { scene: "Expected-goals chart, goals marked", technique: "cumulative xG step chart from the event data", note: "xG = StatsBomb model" }, X);
    scene("main", "m4-timeline", tl, 110, { scene: "Match timeline", technique: "competition timeline" }, X);
    scene("main", "m5-record", h2h, 100, { scene: "Match record comparison", technique: "head-to-head columns", note: "this match only; a multi-match rivalry needs more data" }, X);
    scene("main", "m6-xg-late", xg, 135, { scene: "xG chart, later keyframe", technique: "chart builds over the match" }, X);
    trans("t1", "push", form, stats, X, { scene: "Board to numbers", technique: "push: next idea, next board" });
    trans("t2", "wipe", stats, xg, X, { scene: "Bars to chart", technique: "wipe: reveal of the pattern" });
    trans("t3", "dissolve", tl, h2h, X, { scene: "Timeline to record", technique: "dissolve: same match, summary" });
    thumb("th-A", "A", { big: "3-3", lines: ["THEN PENALTIES"] }, {}, { scene: "Thumbnail A: the score", technique: "one number, gold on black" });
    thumb("th-B", "B", { a: String(m.shots78[A]), b: String(m.shots78[B]), lines: ["SHOTS BEFORE", "THE 79TH MINUTE"] }, {}, { scene: "Thumbnail B: two numbers, two team colours", technique: "head-to-head figure" });
    thumb("th-C", "C", { big: "3-3", lines: [A.toUpperCase(), "v " + B.toUpperCase()] }, {}, { scene: "Thumbnail C: fixture + score", technique: "fixture words, big score" });
    return { shots, assets };
  },
};
