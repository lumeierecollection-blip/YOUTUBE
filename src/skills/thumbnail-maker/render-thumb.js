#!/usr/bin/env node

/**
 * Thumbnail Renderer — Renders thumbnail specs to PNG using sharp.
 *
 * Usage: node render-thumb.js <channel-id> [topic-slug]
 * Input: data/thumbnails/<channel-id>/<id>-thumb-spec.json
 * Output: data/thumbnails/<channel-id>/<id>-thumb.png
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");

const WIDTH = 1280;
const HEIGHT = 720;

function parseColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function hexToSvgColor(hex) {
  return hex;
}

function buildSvgElements(spec) {
  const bg = spec.background || {};
  const elements = spec.elements || [];

  let svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">`;

  // Background gradient
  if (bg.type === "gradient" && bg.colors?.length >= 2) {
    const c1 = parseColor(bg.colors[0]);
    const c2 = parseColor(bg.colors[1]);
    const angle = bg.direction === "diagonal" ? 135 : 180;
    const rad = (angle * Math.PI) / 180;
    const x2 = Math.round(50 + 50 * Math.cos(rad));
    const y2 = Math.round(50 + 50 * Math.sin(rad));
    svg += `<defs><linearGradient id="bg" x1="0%" y1="0%" x2="${x2}%" y2="${y2}%">`;
    svg += `<stop offset="0%" stop-color="rgb(${c1.r},${c1.g},${c1.b})"/>`;
    svg += `<stop offset="100%" stop-color="rgb(${c2.r},${c2.g},${c2.b})"/>`;
    svg += `</linearGradient></defs>`;
    svg += `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>`;
  } else {
    const c = parseColor(bg.colors?.[0] || "#0D1117");
    svg += `<rect width="${WIDTH}" height="${HEIGHT}" fill="rgb(${c.r},${c.g},${c.b})"/>`;
  }

  // Text elements
  for (const el of elements) {
    if (el.type !== "text") continue;

    const font = el.font || {};
    const pos = el.position || {};
    const weight = font.weight || 400;
    const size = font.size || 48;
    const color = hexToSvgColor(font.color || "#FFFFFF");
    const family = font.family || "Inter, Arial, sans-serif";

    let x, y;
    if (pos.x === "center") x = WIDTH / 2;
    else if (typeof pos.x === "number") x = pos.x;
    else x = WIDTH / 2;

    if (pos.y === "center") y = HEIGHT / 2 + (pos.margin || 0);
    else if (pos.y === "bottom") y = HEIGHT - (pos.margin || 60);
    else if (pos.y === "top") y = (pos.margin || 60);
    else if (typeof pos.y === "number") y = pos.y;
    else y = HEIGHT / 2;

    const anchor = pos.x === "center" ? "middle" : "start";
    const opacity = el.opacity || 1;

    // Shadow
    if (font.shadow) {
      const sb = font.shadow.blur || 0;
      const so = font.shadow.offset_y || 0;
      svg += `<text x="${x}" y="${y + so}" text-anchor="${anchor}" `;
      svg += `font-family="${family}" font-weight="${weight}" font-size="${size}" `;
      svg += `fill="rgba(0,0,0,0.5)" filter="url(#shadow)" opacity="${opacity}">${escapeXml(el.content)}</text>`;
    }

    // Main text
    svg += `<text x="${x}" y="${y}" text-anchor="${anchor}" `;
    svg += `font-family="${family}" font-weight="${weight}" font-size="${size}" `;
    svg += `fill="${color}" opacity="${opacity}">${escapeXml(el.content)}</text>`;
  }

  // Shadow filter
  svg += `<defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">`;
  svg += `<feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#000000" flood-opacity="0.5"/>`;
  svg += `</filter></defs>`;

  svg += `</svg>`;
  return svg;
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function renderThumbnail(specPath, outputPath) {
  const spec = JSON.parse(readFileSync(specPath, "utf-8"));
  const svg = buildSvgElements(spec);

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Rendered: ${outputPath}`);
}

async function main() {
  const [channelId, topicSlug] = process.argv.slice(2);

  if (!channelId) {
    console.error("Usage: node render-thumb.js <channel-id> [topic-slug]");
    process.exit(1);
  }

  const thumbDir = join(ROOT, "data", "thumbnails", channelId);
  if (!existsSync(thumbDir)) {
    console.error(`No thumbnails for channel ${channelId}`);
    process.exit(1);
  }

  // Find spec files
  const specs = readdirSync(thumbDir).filter(f => f.endsWith("-thumb-spec.json"));

  if (specs.length === 0) {
    console.error("No thumbnail specs found");
    process.exit(1);
  }

  // Filter by topic slug if provided
  const toRender = topicSlug
    ? specs.filter(s => s.includes(topicSlug))
    : specs;

  if (toRender.length === 0) {
    console.error(`No specs matching "${topicSlug}"`);
    process.exit(1);
  }

  for (const spec of toRender) {
    const specPath = join(thumbDir, spec);
    const pngPath = specPath.replace("-thumb-spec.json", "-thumb.png");
    await renderThumbnail(specPath, pngPath);
  }
  console.log(`\nDone. Rendered ${toRender.length} thumbnail(s).`);
}

main().catch(err => { console.error(err); process.exit(1); });
