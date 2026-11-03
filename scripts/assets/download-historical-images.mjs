#!/usr/bin/env node
/**
 * Source the curated, people-centred historical image pack for
 * "Margaret Clitherow / Guy Fawkes" from Wikimedia Commons.
 *
 *   node scripts/assets/download-historical-images.mjs --channel 1
 *
 * This is deliberately NOT a keyword search. Every image is an exact Commons
 * file title with a known licence, so a render can never silently receive an
 * unrelated picture. The pack is all-or-nothing: if any title is missing, its
 * licence is not explicit PD/CC, or the downloaded bytes are not a valid
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

/**
 * Nine beats, nine unique images. Eight are people/people-groups, one is the
 * place (York Minster). sentence_index is the spoken sentence the image covers,
 * so the visual is tied to the narration rather than to a generic keyword.
 */
const PACK = [
  {
    sentence_index: 0,
    kind: "person",
    subject: "Margaret Clitherow",
    label: "Margaret Clitherow",
    title: "File:Saint Margaret of York Catholic Church (Loveland, Ohio) - stained glass, the Pearl of York.jpg",
    alt: "Stained-glass window depicting Margaret Clitherow, the Pearl of York",
    note: "A modern stained-glass depiction of Clitherow; the window is in Loveland, Ohio, not York.",
    reason: "The hook names a pregnant mother in York; the stained glass identifies her as Margaret Clitherow, the Pearl of York.",
  },
  {
    sentence_index: 1,
    kind: "person",
    subject: "Margaret Clitherow",
    label: "Margaret Clitherow",
    title: "File:St. Margaret Clitherow JS.jpg",
    alt: "Engraving of Margaret Clitherow holding a cross",
    note: "Eighteenth-century engraving after an older portrait.",
    reason: "The sentence names Margaret Clitherow and the accusation against her; the engraving is a portrait of her.",
  },
  {
    sentence_index: 2,
    kind: "person",
    subject: "Margaret Clitherow",
    label: "Margaret Clitherow",
    title: "File:St Margaret Clitherow, Ladyewell House, Broughton (Preston) - geograph.org.uk - 539003.jpg",
    alt: "Statue of St Margaret Clitherow at Ladyewell House",
    note: "A statue of Clitherow at the Ladyewell shrine; not a contemporary likeness.",
    reason: "The sentence describes her refusal to plead while pregnant; the statue depicts her holding a cross.",
  },
  {
    sentence_index: 3,
    kind: "place",
    subject: "York Minster",
    label: "York",
    title: "File:York Minster Nave.jpg",
    alt: "The nave of York Minster",
    note: "York Minster as it stands today; the medieval minster dominated the city in Fawkes's youth.",
    reason: "The sentence asks what Guy Fawkes saw in York; the image shows York Minster, the city's defining landmark.",
  },
  {
    sentence_index: 4,
    kind: "people",
    subject: "Pressing to death",
    label: "Punishment of pressing",
    title: "File:Engraving for the Malefactor's Register the punishment formerly inflicted on those who refused pleading to an indictment.jpg",
    alt: "Engraving of a prisoner being pressed to death under weights",
    note: "Generic 1780 engraving of peine forte et dure; it illustrates the method, not Clitherow herself.",
    reason: "The sentence describes her being slowly crushed to death; the engraving depicts the press punishment itself, and is labelled as a generic depiction.",
  },
  {
    sentence_index: 5,
    kind: "person",
    subject: "Guy Fawkes",
    label: "Guy Fawkes",
    title: "File:Guy Fawkes portrait.jpg",
    alt: "Portrait of Guy Fawkes",
    note: "Traditional portrait of Guy Fawkes (1570-1606).",
    reason: "The sentence names Guy Fawkes and the theory that he witnessed the execution; the portrait depicts him.",
  },
  {
    sentence_index: 6,
    kind: "people",
    subject: "Christopher and John Wright",
    label: "Christopher & John Wright",
    title: "File:John and christopher wright.jpg",
    alt: "Contemporary sketch of Christopher and John Wright",
    note: "Contemporary engraving of the Wright brothers, later Gunpowder Plot conspirators.",
    reason: "The sentence names Christopher and John Wright; the engraving depicts both brothers together.",
    rights_note: "Wikimedia Commons tags the file Public domain; the source institution's reproduction notice is retained here for transparency.",
  },
  {
    sentence_index: 7,
    kind: "people",
    subject: "Gunpowder Plot conspirators",
    label: "The 1605 conspirators",
    title: "File:Gunpow1.jpg",
    alt: "Engraving of the Gunpowder Plot conspirators",
    note: "Crispijn van de Passe the Elder's group engraving of the conspirators.",
    reason: "The sentence describes the brutal act shaping the conspirators before 1605; the group engraving depicts the plotters.",
  },
  {
    sentence_index: 8,
    kind: "people",
    subject: "Execution of the Gunpowder Plotters",
    label: "The plot's aftermath",
    title: "File:Anonymous - The Gunpowder Plotters and their Execution in February 1606 - B1977.14.17890 - Yale Center for British Art.jpg",
    alt: "Engraving of the Gunpowder Plotters and their execution in February 1606",
    note: "A period engraving of the plotters and their February 1606 execution; it shows the plot's aftermath, not Clitherow's 1586 death.",
    reason: "The closing sentence links Clitherow's death to the 1605 plot; the engraving shows the plotters and their 1606 execution, the plot's outcome.",
  },
];

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
  const outDir = resolve(ROOT, arg("out") || join("data", "editor", "assets", channel));
  mkdirSync(outDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const images = [];
  const errors = [];
  const seenTitles = new Set();
  const seenHashes = new Set();

  console.log(`[image-pack] ${PACK.length} curated Commons files -> ${relative(ROOT, outDir)}`);

  for (let i = 0; i < PACK.length; i++) {
    const spec = PACK[i];
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
      images.push(record);
      seenTitles.add(spec.title);
      console.log(`[image-pack]   ok ${finalSize.width}x${finalSize.height} ${info.license} ${(finalBuf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      const msg = `${id} ${spec.title}: ${e.message}`;
      errors.push(msg);
      console.error(`[image-pack]   FAILED ${msg}`);
    }
  }

  const people = images.filter((x) => x.kind === "person" || x.kind === "people").length;
  const peopleRatio = images.length ? people / images.length : 0;
  const uniqueFiles = new Set(images.map((x) => x.sha256)).size;
  const ok = images.length === PACK.length && uniqueFiles === PACK.length && peopleRatio >= MIN_PEOPLE_RATIO;

  const manifest = {
    schema: "historical-visual-pack/v1",
    generated_at: generatedAt,
    pack: "margaret-clitherow-people-centered",
    channel_id: String(channel),
    source: "Wikimedia Commons",
    source_api: API,
    status: ok ? "ok" : "failed",
    total_requested: PACK.length,
    total_downloaded: images.length,
    unique_files: uniqueFiles,
    people_focused: people,
    people_ratio: Number(peopleRatio.toFixed(4)),
    people_ratio_min: MIN_PEOPLE_RATIO,
    total_bytes: images.reduce((a, x) => a + x.bytes, 0),
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
    selection: "Exact Commons file titles from a curated nine-beat pack; no keyword search, no stand-ins.",
    licence_policy: "Only explicit Public domain, CC0, CC BY or CC BY-SA files. Files with non-free/fair-use/unknown licences or trademark/personality restrictions are rejected.",
    people_focused: people,
    people_ratio: manifest.people_ratio,
    images: images.map((x) => ({
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
    `People-focused: ${people}/${images.length} (${(peopleRatio * 100).toFixed(1)}%)`,
    "",
    "All files below carry an explicit Public domain, CC0, CC BY or CC BY-SA licence on Wikimedia Commons. The exact file page is linked for verification.",
    "",
    ...images.map((x, n) => [
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

  console.log(`[image-pack] ${images.length}/${PACK.length} downloaded, ${people}/${images.length} people-focused (${(peopleRatio * 100).toFixed(1)}%), ${uniqueFiles} unique`);
  if (errors.length) {
    for (const e of errors) console.error(`::error::image-pack: ${e}`);
  }
  if (!ok) {
    console.error(`::error::image-pack: production gate failed (need ${PACK.length} unique images, >=${MIN_PEOPLE_RATIO * 100}% people-focused)`);
    process.exit(1);
  }
  console.log("[image-pack] production gate passed");
}

main().catch((e) => {
  console.error(`::error::image-pack: ${e.stack || e.message}`);
  process.exit(1);
});
