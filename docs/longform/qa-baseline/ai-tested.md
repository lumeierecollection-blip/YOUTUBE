# QA: At What Size Does AI Multiplication Break? We Tested It (ai-tested)

Generated 2026-11-13. Assumptions: beat duration = narration words / 2.5 words per second; authentic share is an upper bound: a beat counts as real when it shows at least one authentic asset, even if graphics also appear; reference bands are provisional (see config/longform-qa-standards.json).

Reference standard status: provisional (all references from a single channel).

Metrics: estimated_minutes=4.9, target_minutes=9, beats=17, ai_generated_share=0, authentic_beat_share_upper_bound=0.063, longest_constructed_stretch_s=193, overlay_beat_share=0.075, assets_used=1, distinct_real_assets=1, longest_beat_s=32, scene_changes_per_min=3.5

| Check | Result | Measured | Standard | Why | Evidence |
|---|---|---|---|---|---|
| V1 AI-generated imagery | **PASS** | 0% of estimated time | <= 21% (+12 points tolerance), only as the subject being tested | Generated pictures read as artificial when used as decoration. | VISUAL-EDITING-RESEARCH.md section 3-4 |
| V2 Authentic media share | **FAIL** | 6% of estimated time shows at least one authentic asset (upper bound) | reference band 56-81% real captured (sampled; -12 points tolerance) (provisional) | The references that look least artificial are built on real captured material; constructed graphics should explain what real media cannot. | VISUAL-EDITING-RESEARCH.md section 3 (5 videos, AI Search) |
| V3 All-constructed stretch | **WARN** | 193 s (ending at beat A14) | longest in the references 135 s (sampled runs of 15 s); FAIL above 1.5x (provisional) | Long runs of graphics without any real picture are the 'AI slideshow' pattern the references avoid. | VISUAL-EDITING-RESEARCH.md section 4 |
| V4 Caption / text overlay share | **PASS** | 8% of time on beats that carry a caption, label, kicker, badge or stamp | reference band 1-6% (+12 points) (provisional) | Text on every scene is not what the references do; labels belong to key terms, footage and credits. | CAPTION-RESEARCH.md |
| V5 Repeated media | **PASS** | 1 distinct authentic assets across 17 beats | no asset on more than 2 beats (author's rule; no reference measurement) (provisional) | Repeating one picture reads as generic filler. | none (judgement) |
| V6 Credit on every third-party picture | **PASS** | every authentic picture has a credit field in its scene | 100% (hard rule; the references show credit or source lines on borrowed material) | CLAUDE.md: no media without a recorded source; references credit borrowed clips on screen. | CAPTION-RESEARCH.md; CLAUDE.md |
| V7 Licence and source recorded | **PASS** | 6 assets with licence and source | every asset has licence, source URL and commercial use allowed (hard rule) | CLAUDE.md hard rule. | MEDIA-MANIFEST.json |
| V8 Long unchanging visual | **PASS** | longest single beat 32 s (beat length, not measured change) | longest static stretch in the references 137 s (frame-difference score); flag above max(60 s, that) (provisional) | A beat that long needs internal change (camera move, reveal, new panel) or a cut to real media. | VISUAL-EDITING-RESEARCH.md section 6 |
| V9 Scene-change rate | **INFO** | 3.5 beats/min (a beat can contain several internal changes) | reference 6.3-11.7 shots/min (dissolve-aware detector, +-15%) (provisional) | Compare only as an indication: beats are not shots. | VISUAL-EDITING-RESEARCH.md section 5 |
| V10 Visual matches narration (lexical screen only) | **PASS** | every real picture shares at least one content word with its narration | a person confirms each flagged picture shows what is said (a word match is not proof of relevance) (provisional) | A picture unrelated to the narration is the strongest 'filler' signal. | none (a person must judge) |
| A0 Audio checks | **SKIPPED** | no cue sheet for this channel | docs/longform/cue-sheets/<channel>.json (provisional) |  |  |
