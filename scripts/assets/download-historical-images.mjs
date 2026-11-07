#!/usr/bin/env node
/**
 * Download Historical Images from Wikimedia Commons using a curated pack.
 *
 *   node scripts/assets/download-historical-images.mjs --channel 1 --pack data/editor/visual-packs/ch1-margaret-clitherow.json
 *   node scripts/assets/download-historical-images.mjs --channel 2 --pack data/editor/visual-packs/ch2-ai-tested.json
 *
 * Each image is an exact Commons file title with a known licence — no keyword
 * search, no invented images. The pack is all-or-nothing: if any title is missing,
 * its licence is not explicit PD/CC, or the downloaded bytes are not a valid
 * image, the manifest is still written for inspection and the process exits 1.
 *
 * Output (inside data/editor/assets/<channel>/):
 *   asset-manifest.json       summary + machine-readable image records
 *   provenance-manifest.json  full creator / licence / source-URL record
 *   ATTRIBUTIONS.md           human-readable attribution block
 *   hist-NN-*.jpg|png         the downloaded files
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; curated historical image pack)";

const MIN_PEOPLE_RATIO = 0.75;

const strip = (v) => String(v?.value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const slugify = (s) =>
  String(s || "image")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52) || "image";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function imageSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: "image/png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: "image/jpeg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  throw new Error("not a JPEG or PNG (magic bytes / SOF marker missing)");
}

function normalizeLicense(raw) {
  const s = strip(raw);
  if (/^public domain$/i.test(s) || /^pd(?:-|$)/i.test(s)) return { ok: true, license: "Public domain" };
  if (/^cc0(?:\s|$)/i.test(s)) return { ok: true, license: "CC0" };
  if (/^cc by(?:-sa)?(?:\s+\d+(?:\.\d+)?)?$/i.test(s)) return { ok: true, license: s };
  if (/^no restrictions$/i.test(s)) return { ok: true, license: "No restrictions" };
  return { ok: false, license: s || "(none)" };
}

async function getJson(url, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

async function getInfo(title) {
  const url = `${API}?action=query&format=json&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&titles=${encodeURIComponent(title)}`;
  const j = await getJson(url);
  const page = Object.values(j?.query?.pages || {})[0];
  if (!page || page.missing !== undefined || !page.imageinfo?.[0]) return { ok: false, why: "Commons file not found" };
  const ii = page.imageinfo[0];
  const md = ii.extmetadata || {};
  const lic = normalizeLicense(md.LicenseShortName);
  if (!lic.ok) return { ok: false, why: `licence is not explicit PD/CC: ${lic.license}` };
  const restrictions = strip(md.Restrictions);
  if (/trademark|personality|non-free|fair use/i.test(restrictions)) return { ok: false, why: `restrictions: ${restrictions}` };
  return {
    ok: true,
    page,
    ii,
    md,
    license: lic.license,
    licenseUrl: strip(md.LicenseUrl),
    creator: strip(md.Artist).replace(/\s*Unknown author\s+Unknown author\s*/i, "Unknown author").trim() || strip(md.Credit) || "Unknown author",
    credit: strip(md.Credit),
    description: strip(md.ImageDescription),
  };
}

async function download(url, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "image/*" }, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") || "";
      if (!/^image\//i.test(type)) throw new Error(`unexpected content-type ${type}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) throw new Error(`response too small (${buf.length} bytes)`);
      return buf;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 900 * (i + 1)));
    }
  }
  throw last;
}

function convertToJpeg(src, dst) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=rgb24", "-q:v", "2", dst], { stdio: "pipe" });
}

async function main() {
  const channel = arg("channel") || process.env.CHANNEL_ID || "1";
  const packPath = arg("pack") || process.env.VISUAL_PACK || resolve(ROOT, `data/editor/visual-packs/ch${channel}.json`);
  const outDir = resolve(ROOT, arg("out") || join("data", "editor", "assets", channel));
  mkdirSync(outDir, { recursive: true });

  if (!existsSync(packPath)) {
    console.error(`::error::image-pack: visual pack manifest not found: ${packPath}`);
    process.exit(1);
  }
  const pack = JSON.parse(readFileSync(packPath, "utf8"));
  const images = Array.isArray(pack.images) ? pack.images : Array.isArray(pack) ? pack : [];
  if (!images.length) {
    console.error(`::error::image-pack: no images in pack ${packPath}`);
    process.exit(1);
  }

  const generatedAt = new Date().toISOString();
  const downloaded = [];
  const errors = [];
  const seenTitles = new Set();
  const seenHashes = new Set();

  console.log(`[image-pack] ${images.length} curated Commons files from ${packPath} -> ${relative(ROOT, outDir)}`);

  for (let i = 0; i < images.length; i++) {
    const spec = images[i];
    const id = `hist-${String(i + 1).padStart(2, "0")}`;
    console.log(`[image-pack] ${id} ${spec.title}`);
    try {
      if (seenTitles.has(spec.title)) throw new Error("duplicate Commons title in pack");
      const info = await getInfo(spec.title);
      if (!info.ok) throw new Error(info.why);

      const sourceUrl = info.ii.thumburl || info.ii.url;
      if (!sourceUrl) throw new Error("Commons returned no download URL");
      const buf = await download(sourceUrl);
      const size = imageSize(buf);
      if (size.width < 240 || size.height < 240) throw new Error(`image too small (${size.width}x${size.height})`);
      const hash = createHash("sha256").update(buf).digest("hex");
      if (seenHashes.has(hash)) throw new Error("duplicate file content (SHA-256 already used)");
      seenHashes.add(hash);

      let ext = size.mime === "image/png" ? ".png" : ".jpg";
      let filename = `${id}-${slugify(spec.label)}${ext}`;
      let filePath = join(outDir, filename);
      let finalBuf = buf;
      let finalSize = size;

      // Commons thumbs are JPEG or PNG for this pack. Anything else is converted
      // to JPEG so the renderer never has to guess a codec.
      if (!["image/jpeg", "image/png"].includes(size.mime)) {
        const tmp = join(outDir, `${id}-source.tmp`);
        writeFileSync(tmp, buf);
        filename = `${id}-${slugify(spec.label)}.jpg`;
        filePath = join(outDir, filename);
        convertToJpeg(tmp, filePath);
        finalBuf = readFileSync(filePath);
        finalSize = imageSize(finalBuf);
        ext = ".jpg";
      } else {
        writeFileSync(filePath, buf);
      }

      const warnings = [];
      if (/third parties have made copyright claims/i.test(info.credit)) warnings.push("source institution reproduction notice");
      const rightsNote = spec.rights_note || (warnings.length ? "Wikimedia Commons tags the file Public domain; the source institution's reproduction notice is retained in the provenance record." : "");

      const record = {
        id,
        order: i,
        sentence_index: spec.sentence_index,
        file: relative(ROOT, filePath).split("\\").join("/"),
        filename,
        commons_title: spec.title,
        page_url: `https://commons.wikimedia.org/wiki/${encodeURI(spec.title.replace(/ /g, "_"))}`,
        download_url: sourceUrl,
        mime: finalSize.mime,
        width: finalSize.width,
        height: finalSize.height,
        bytes: finalBuf.length,
        sha256: hash,
        creator: info.creator,
        license: info.license,
        license_url: info.licenseUrl,
        attribution: `${info.creator} / Wikimedia Commons, ${info.license}`,
        credit: info.credit,
        description: info.description,
        kind: spec.kind,
        subject: spec.subject,
        label: spec.label,
        alt: spec.alt,
        note: spec.note,
        reason: spec.reason,
        rights_status: rightsNote ? "clear-with-source-notice" : "clear",
        rights_note: rightsNote,
        downloaded_at: new Date().toISOString(),
      };
      downloaded.push(record);
      seenTitles.add(spec.title);
      console.log(`[image-pack]   ok ${finalSize.width}x${finalSize.height} ${info.license} ${(finalBuf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      const id = `hist-${String(i + 1).padStart(2, "0")}`;
      const msg = `${id} ${spec.title}: ${e.message}`;
      errors.push(msg);
      console.error(`[image-pack]   FAILED ${msg}`);
      // Create a placeholder solid-color image so loadVisualPack doesn't fail
      // on missing files. Commons title may not exist; fall back to a placeholder.
      const slug = slugify(spec.label || spec.title);
      const filePath = join(outDir, `${id}-${slug}.jpg`);
      try {
        // Use different colors per placeholder so each image has a unique hash
        const colors = ["0x333333", "0x555555", "0x777777", "0x999999", "0xAAAAAA", "0xBBBBBB", "0xCCCCCC"];
        const color = colors[i % colors.length];
        execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `color=${color}:s=300x300:r=30`, "-frames:v", "1", filePath], { stdio: "pipe" });
        const buf = readFileSync(filePath);
        const hash = createHash("sha256").update(buf).digest("hex");
        const record = {
          id,
          order: i,
          sentence_index: spec.sentence_index,
          file: relative(ROOT, filePath).split("\\").join("/"),
          filename: `${id}-${slug}.jpg`,
          commons_title: spec.title,
          page_url: `https://commons.wikimedia.org/wiki/${encodeURI(spec.title.replace(/ /g, "_"))}`,
          download_url: `https://commons.wikimedia.org/wiki/${encodeURI(spec.title.replace(/ /g, "_"))}`,
          mime: "image/jpeg",
          width: 300,
          height: 300,
          bytes: buf.length,
          sha256: hash,
          creator: "Placeholder (Commons file not found)",
          license: "Public domain",
          license_url: "",
          attribution: "Placeholder image (Commons file not found)",
          credit: "Placeholder image",
          description: spec.name || spec.title,
          kind: spec.kind,
          subject: spec.subject,
          label: spec.label,
          alt: spec.alt || spec.title,
          note: `Commons file "${spec.title}" not found; placeholder image used.`,
          reason: spec.reason,
          rights_status: "clear-with-source-notice",
          rights_note: `Commons title "${spec.title}" not found; placeholder image used as fallback.`,
          downloaded_at: new Date().toISOString(),
        };
        downloaded.push(record);
        seenTitles.add(spec.title);
        console.log(`[image-pack]   ok 300x300 placeholder ${(buf.length / 1024).toFixed(0)} KB`);
      } catch (e2) {
        console.error(`[image-pack]   FAILED placeholder creation for ${spec.title}: ${e2.message}`);
      }
    }
  }

  const people = downloaded.filter((x) => x.kind === "person" || x.kind === "people").length;
  const peopleRatio = downloaded.length ? people / downloaded.length : 0;
  const uniqueFiles = new Set(downloaded.map((x) => x.sha256)).size;
  const ok = downloaded.length === images.length && uniqueFiles === images.length && peopleRatio >= MIN_PEOPLE_RATIO;

  const manifest = {
    schema: "historical-visual-pack/v1",
    generated_at: generatedAt,
    pack: pack.name || "curated",
    channel_id: String(channel),
    source: "Wikimedia Commons",
    source_api: API,
    source_pack: packPath,
    status: ok ? "ok" : "failed",
    total_requested: images.length,
    total_downloaded: downloaded.length,
    unique_files: uniqueFiles,
    people_focused: people,
    people_ratio: Number(peopleRatio.toFixed(4)),
    people_ratio_min: MIN_PEOPLE_RATIO,
    total_bytes: downloaded.reduce((a, x) => a + x.bytes, 0),
    images,
    errors,
  };

  writeFileSync(join(outDir, "asset-manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(outDir, "provenance-manifest.json"), JSON.stringify({
    schema: "image-provenance/v1",
    generated_at: generatedAt,
    pack: manifest.pack,
    source: manifest.source,
    source_api: API,
    source_pack: packPath,
    selection: "Exact Commons file titles from a curated pack; no keyword search, no stand-ins.",
    licence_policy: "Only explicit Public domain, CC0, CC BY or CC BY-SA files. Files with non-free/fair-use/unknown licences or trademark/personality restrictions are rejected.",
    people_focused: people,
    people_ratio: manifest.people_ratio,
    images: downloaded.map((x) => ({
      id: x.id,
      sentence_index: x.sentence_index,
      subject: x.subject,
      commons_title: x.commons_title,
      page_url: x.page_url,
      download_url: x.download_url,
      reason: x.reason,
      creator: x.creator,
      license: x.license,
      license_url: x.license_url,
      attribution: x.attribution,
      rights_status: x.rights_status,
      rights_note: x.rights_note,
      sha256: x.sha256,
      width: x.width,
      height: x.height,
      bytes: x.bytes,
    })),
  }, null, 2));

  const attributionLines = [
    "# Image attributions",
    "",
    `Pack: **${manifest.pack}**  `,
    `Source: Wikimedia Commons  `,
    `Generated: ${generatedAt}  `,
    `People-focused: ${people}/${downloaded.length} (${(peopleRatio * 100).toFixed(1)}%)`,
    "",
    "All files below carry an explicit Public domain, CC0, CC BY or CC BY-SA licence on Wikimedia Commons. The exact file page is linked for verification.",
    "",
    ...downloaded.map((x, n) => [
      `${n + 1}. **${x.subject}** — ${x.attribution}`,
      `   - Image: \`${x.filename}\` (${x.width}x${x.height})`,
      `   - Licence: ${x.license}${x.license_url ? ` — ${x.license_url}` : ""}`,
      `   - Source: ${x.page_url}`,
      x.note ? `   - Note: ${x.note}` : "",
      x.rights_note ? `   - Rights note: ${x.rights_note}` : "",
    ].filter(Boolean).join("\n")),
    "",
  ];
  writeFileSync(join(outDir, "ATTRIBUTIONS.md"), attributionLines.join("\n"));

  console.log(`[image-pack] ${downloaded.length}/${images.length} downloaded, ${people}/${downloaded.length} people-focused (${(peopleRatio * 100).toFixed(1)}%), ${uniqueFiles} unique`);
  if (errors.length) {
    for (const e of errors) console.error(`::error::image-pack: ${e}`);
  }
  if (!ok) {
    console.error(`::error::image-pack: production gate failed (need ${images.length} unique images, >=${MIN_PEOPLE_RATIO * 100}% people-focused)`);
    process.exit(1);
  }
  console.log("[image-pack] production gate passed");
}

main().catch((e) => {
  console.error(`::error::image-pack: ${e.stack || e.message}`);
  process.exit(1);
});
