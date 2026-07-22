/**
 * Channel Branding System — Per-channel visual identity specs.
 *
 * Usage: node src/utils/branding.js <channel-id>
 * Output: data/research/<channel-id>/branding-spec.json
 *
 * Consistent branding increases CTR by up to 30% and subscriber
 * conversion by 2-3x. Every channel needs a locked visual identity.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

/**
 * Generate full branding spec from channel config.
 */
function generateBrandingSpec(channel) {
  const colors = channel.colors || {};
  const font = channel.font || "Montserrat";

  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    niche: channel.niche,

    // ─── Profile Picture ───
    profile_picture: {
      size: "800x800 px (minimum 256x256)",
      display_sizes: {
        channel_page: "96x96 px",
        search_results: "44x44 px",
        comments: "40x40 px",
        notifications: "28x28 px",
      },
      design_rules: [
        "Keep it simple — readable at 28x28 pixels",
        "Bold, recognizable silhouette or lettermark",
        "High contrast against both light and dark backgrounds",
        "No fine details that disappear at small sizes",
        "Use channel accent color as background",
      ],
      format: "PNG with transparency, sRGB color profile",
    },

    // ─── Banner Art ───
    banner: {
      size: "2560x1440 px (safe area: 1546x423 center)",
      display_areas: {
        desktop: "2560x423 px (center strip)",
        tablet: "1855x423 px",
        mobile: "1546x423 px",
        tv: "2560x1440 px (full image)",
      },
      design_rules: [
        "Logo center-left, value proposition on right",
        "All critical text within center 1546x423 safe area",
        "Test on desktop, tablet, and mobile before publishing",
        "Use channel color palette",
        "Update annually to stay fresh while maintaining core recognition",
      ],
      layout: {
        left_section: "Logo or channel icon",
        center_section: "Channel name in title font",
        right_section: "Tagline or value proposition",
        background: "Channel primary color or gradient",
      },
    },

    // ─── Color System ───
    color_system: {
      primary: colors.primary || "#0A0A0A",
      secondary: colors.secondary || "#1A1A2E",
      accent: colors.accent || "#E94560",
      background: colors.bg || "#050510",
      text_primary: "#FFFFFF",
      text_secondary: "#B0B0B0",
      ratio: {
        dominant: "60% — primary/dark neutral",
        secondary: "30% — secondary brand color",
        accent: "10% — high-contrast highlight for CTAs and emphasis",
      },
      gradient_suggestions: [
        `linear-gradient(135deg, ${colors.primary || "#0A0A0A"}, ${colors.secondary || "#1A1A2E"})`,
        `radial-gradient(circle, ${colors.accent || "#E94560"}22, transparent)`,
      ],
    },

    // ─── Typography ───
    typography: {
      title_font: {
        name: font,
        weight: "Bold or Black",
        use: "Thumbnail headlines, banner titles, chapter cards",
        fallback: "Arial Black, Impact",
      },
      body_font: {
        name: "Inter or Roboto",
        weight: "Regular or Medium",
        use: "Video descriptions, community posts, end screen text",
        fallback: "Arial, Helvetica",
      },
      rules: [
        "Maximum 2 font families across entire channel",
        "Title font for all thumbnail text",
        "Body font for descriptions and readable text",
        "Never use decorative/script fonts in thumbnails",
        "Minimum 60pt at 1280x720 canvas for thumbnail text",
      ],
    },

    // ─── Thumbnail Templates ───
    thumbnail_templates: {
      count: 3,
      templates: [
        {
          name: "primary",
          layout: "Left text / Right focal element",
          text_position: "Left 60% of frame",
          focal_position: "Right 40% of frame",
          safe_zones: "Keep bottom-right clear (duration badge), left 2/3 safest",
          use: "Default template for most videos",
        },
        {
          name: "data-focus",
          layout: "Center number / surrounding context",
          text_position: "Center, 60%+ of frame",
          focal_position: "Large bold number or statistic",
          use: "Data-driven videos, rankings, comparisons",
        },
        {
          name: "scene",
          layout: "Full dramatic image / minimal text",
          text_position: "Top-left or center-top",
          focal_position: "Full-frame dramatic visual",
          use: "Story-driven, cinematic, emotional topics",
        },
      ],
      consistency_rules: [
        "Use same 2-3 color palette on EVERY thumbnail",
        "Same font on EVERY thumbnail",
        "Same general layout position across videos",
        "Viewers should recognize your content before reading the title",
        "3-element system: color palette + font + layout structure",
      ],
    },

    // ─── Intro/Outro ───
    intro_outro: {
      intro: {
        duration: "3-5 seconds max",
        elements: ["Channel logo animation", "Channel name reveal", "Brief sound design"],
        rules: [
          "Keep under 5 seconds — viewers skip long intros",
          "Consistent across all videos",
          "Reinforces brand identity",
          "Don't repeat in every video if upload frequency is high",
        ],
      },
      outro: {
        duration: "15-20 seconds",
        elements: ["End screen elements", "Verbal CTA", "Channel branding"],
        notes: "Outro IS the end screen. Plan it into the video structure.",
      },
    },

    // ─── Channel Description ───
    channel_description: {
      length: "under 200 characters for mobile preview",
      structure: [
        "Line 1: What the channel is about (keyword-rich)",
        "Line 2: Upload schedule or content type",
        "Line 3: CTA (subscribe, bell)",
      ],
      example: `${channel.description || channel.niche} | New videos every week | Subscribe for deep dives into ${channel.niche?.toLowerCase() || "this topic"}`,
    },

    // ─── Watermark ───
    watermark: {
      size: "150x150 px",
      format: "PNG with transparency",
      content: "Channel logo or subscribe button",
      display_time: "Full video duration",
      notes: "Branded watermark appears on all videos. Use subscribe button for growth.",
    },

    // ─── Cross-Platform Consistency ───
    cross_platform: {
      rule: "Same color palette, font, and logo across ALL platforms",
      platforms: ["YouTube", "Twitter/X", "Instagram", "TikTok", "Discord"],
      notes: "Viewers who discover you elsewhere should recognize the brand instantly on YouTube.",
    },

    // ─── Brand Guidelines Document ───
    brand_guidelines: {
      filename: `data/research/${channel.channel_id}/brand-guidelines.md`,
      contents: [
        "Color palette with hex codes",
        "Typography specifications",
        "Logo usage rules",
        "Thumbnail templates",
        "Do's and Don'ts",
        "Example assets",
      ],
    },
  };
}

/**
 * Generate a brand guidelines markdown document.
 */
function generateBrandGuidelines(spec) {
  return `# Brand Guidelines — ${spec.channel_name}

## Color Palette
| Role | Hex | Usage |
|------|-----|-------|
| Primary | ${spec.color_system.primary} | Backgrounds, dominant areas (60%) |
| Secondary | ${spec.color_system.secondary} | Supporting elements (30%) |
| Accent | ${spec.color_system.accent} | CTAs, emphasis, highlights (10%) |
| Background | ${spec.color_system.background} | Video backgrounds |
| Text Primary | ${spec.color_system.text_primary} | Headlines, primary text |
| Text Secondary | ${spec.color_system.text_secondary} | Body text, descriptions |

## Typography
### Title Font: ${spec.typography.title_font.name}
- Weight: ${spec.typography.title_font.weight}
- Use: ${spec.typography.title_font.use}

### Body Font: ${spec.typography.body_font.name}
- Weight: ${spec.typography.body_font.weight}
- Use: ${spec.typography.body_font.use}

## Thumbnail Rules
- Maximum 2 fonts per thumbnail
- Maximum 3-5 words of text
- Same color palette on EVERY thumbnail
- Same layout position across videos
- Keep bottom-right corner clear
- Mobile-first: must read at 120px wide

## Do's
- Use consistent colors across all assets
- Keep branding recognizable at small sizes
- Test banner on desktop, tablet, mobile
- Update branding annually (keep core elements)

## Don'ts
- Don't use more than 2 fonts
- Don't change branding frequently
- Don't use thin/decorative fonts in thumbnails
- Don't clutter profile picture with fine details
`;
}

/**
 * CLI entry point.
 */
function main() {
  const channelId = process.argv[2];

  if (!channelId) {
    console.error("Usage: node branding.js <channel-id>");
    process.exit(1);
  }

  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const channel = channels.find((c) => c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const spec = generateBrandingSpec(channel);

  // Save JSON spec
  const outDir = join(ROOT, "data", "research", channelId);
  mkdirSync(outDir, { recursive: true });

  const jsonPath = join(outDir, "branding-spec.json");
  writeFileSync(jsonPath, JSON.stringify(spec, null, 2));

  // Save markdown guidelines
  const mdPath = join(outDir, "brand-guidelines.md");
  writeFileSync(mdPath, generateBrandGuidelines(spec));

  console.log(`Branding spec saved: ${jsonPath}`);
  console.log(`Brand guidelines saved: ${mdPath}`);
  console.log(`\nKey colors: ${spec.color_system.primary} / ${spec.color_system.secondary} / ${spec.color_system.accent}`);
  console.log(`Fonts: ${spec.typography.title_font.name} + ${spec.typography.body_font.name}`);
}

export { generateBrandingSpec, generateBrandGuidelines };

if (process.argv[1] && process.argv[1].endsWith("branding.js")) main();
