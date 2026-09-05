/**
 * Render Settings — Optimized Remotion render configuration for YouTube.
 *
 * Usage: node src/utils/render-settings.js <channel-id> [--type long-form|shorts]
 * Output: data/research/<channel-id>/render-settings.json
 *
 * Based on Remotion docs and YouTube encoding best practices.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

/**
 * Generate render settings for long-form YouTube videos.
 */
function generateLongFormSettings(channel) {
  return {
    type: "long-form",
    output: {
      format: "MP4",
      video_codec: "h264",
      audio_codec: "aac",
      pixel_format: "yuv420p",
      color_space: "bt709",
    },
    quality: {
      crf: 18,
      notes: "CRF 18 = high quality (~15-20 MB/min). Lower = better quality but larger files.",
      audio_bitrate: "320k",
      jpeg_quality: 90,
      notes_jpeg: "JPEG quality 90 for sharper text. Default is 80.",
    },
    resolution: {
      width: 1920,
      height: 1080,
      fps: 30,
      notes: "1080p30 is optimal for YouTube. 4K only if content demands it (slower render).",
    },
    encoding: {
      x264_preset: "slow",
      notes: "slow preset = better compression (smaller file, same quality). medium = faster render.",
      threads: "auto",
      two_pass: false,
      notes_two_pass: "CRF mode is generally better than 2-pass for YouTube.",
    },
    performance: {
      concurrency: "auto",
      benchmark: "Run `npx remotion benchmark` to find optimal concurrency",
      gpu_effects: "Avoid WebGL/canvas effects in cloud (no GPU). Use precomputed images instead.",
      memoization: "Use useMemo() and useCallback() in React components for expensive computation",
    },
    render_command: `npx remotion render src/index.tsx <CompositionId> output.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --color-space=bt709 --audio-codec=aac --audio-bitrate=320k --jpeg-quality=90 --x264-preset=slow`,
  };
}

/**
 * Generate render settings for YouTube Shorts.
 */
function generateShortsSettings(channel) {
  return {
    type: "shorts",
    output: {
      format: "MP4",
      video_codec: "h264",
      audio_codec: "aac",
      pixel_format: "yuv420p",
      color_space: "bt709",
    },
    quality: {
      crf: 16,
      notes: "Slightly lower CRF (higher quality) for Shorts — they're shorter so file size is less concern.",
      audio_bitrate: "320k",
      jpeg_quality: 95,
      notes_jpeg: "Higher JPEG quality for Shorts — text readability is critical on mobile.",
    },
    resolution: {
      width: 1080,
      height: 1920,
      fps: 30,
      notes: "9:16 vertical. 1080x1920 is optimal for Shorts.",
    },
    encoding: {
      x264_preset: "medium",
      notes: "medium preset for faster render (Shorts are short, file size isn't a concern).",
      threads: "auto",
    },
    captions: {
      method: "burned-in",
      notes: "Shorts MUST use burned-in captions. Platforms strip external caption files.",
      style: {
        font: "Impact, Arial Black, sans-serif",
        size: "48px",
        color: "#FFFFFF",
        stroke: "#000000",
        stroke_width: "3px",
        position: "bottom-center",
        max_width: "90%",
      },
    },
    render_command: `npx remotion render src/index.tsx <CompositionId> output.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709 --audio-codec=aac --audio-bitrate=320k --jpeg-quality=95 --x264-preset=medium`,
  };
}

/**
 * Generate quality presets for different content types.
 */
function generateQualityPresets() {
  return {
    draft: {
      crf: 28,
      jpeg_quality: 70,
      x264_preset: "ultrafast",
      use_case: "Quick preview, testing, iteration",
      notes: "Fast render, lower quality. Good for review cycles.",
    },
    standard: {
      crf: 23,
      jpeg_quality: 80,
      x264_preset: "fast",
      use_case: "Standard YouTube upload",
      notes: "Good balance of quality and file size.",
    },
    high: {
      crf: 18,
      jpeg_quality: 90,
      x264_preset: "slow",
      use_case: "High-quality YouTube upload (recommended)",
      notes: "Best quality for YouTube. Our default setting.",
    },
    maximum: {
      crf: 15,
      jpeg_quality: 100,
      x264_preset: "veryslow",
      use_case: "Maximum quality, archive, or re-upload",
      notes: "Largest files. Only for special cases.",
    },
  };
}

/**
 * Full render settings generation.
 */
function generateRenderSettings(channel, type = "long-form") {
  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    settings: type === "shorts"
      ? generateShortsSettings(channel)
      : generateLongFormSettings(channel),
    quality_presets: generateQualityPresets(),
    youtube_optimization: {
      recommended_codec: "H.264 (most compatible)",
      recommended_pixel_format: "yuv420p (universal playback)",
      recommended_color_space: "bt709 (accurate colors)",
      file_size_target: "Under 128GB (YouTube limit), aim for under 100MB per minute",
      notes: [
        "H.264 is most compatible with YouTube's processing",
        "H.265/HEVC is 50% smaller but not universally supported",
        "VP9 is open source but very slow to encode",
        "YouTube re-encodes everything — don't over-compress",
        "CRF 18-20 is the sweet spot for YouTube quality",
      ],
    },
    performance_tips: [
      "Use <Video> from @remotion/media for best rendering performance",
      "Avoid WebGL/canvas effects in cloud (no GPU)",
      "Use useMemo() and useCallback() for expensive computation",
      "Run `npx remotion benchmark` to find optimal concurrency",
      "PNG format is slower than JPEG — only use for transparent video",
      "Higher resolution = slower render. Scale down with --scale if needed",
    ],
  };
}

/**
 * CLI entry point.
 */
function main() {
  const channelId = process.argv[2];
  const type = process.argv.includes("--shorts") ? "shorts" : "long-form";

  if (!channelId) {
    console.error("Usage: node render-settings.js <channel-id> [--shorts]");
    process.exit(1);
  }

  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const channel = channels.find((c) => c.id === numId || c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const settings = generateRenderSettings(channel, type);

  const outDir = join(ROOT, "data", "research", channelId);
  mkdirSync(outDir, { recursive: true });

  const outPath = join(outDir, `render-settings-${type}.json`);
  writeFileSync(outPath, JSON.stringify(settings, null, 2));

  console.log(`Render settings saved: ${outPath}`);
  console.log(`\nType: ${type}`);
  console.log(`Codec: ${settings.settings.output.video_codec}`);
  console.log(`CRF: ${settings.settings.quality.crf}`);
  console.log(`Resolution: ${settings.settings.resolution.width}x${settings.settings.resolution.height}`);
  console.log(`Preset: ${settings.settings.encoding.x264_preset}`);
}

export { generateRenderSettings, generateLongFormSettings, generateShortsSettings, generateQualityPresets };

if (process.argv[1] && process.argv[1].endsWith("render-settings.js")) main();
