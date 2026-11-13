# QA: How Spain Won the Euro 2024 Final, in Data (rival-lines)

Generated 2026-11-13. Assumptions: beat duration = narration words / 2.5 words per second; authentic share is an upper bound: a beat counts as real when it shows at least one authentic asset, even if graphics also appear; reference bands are provisional (see config/longform-qa-standards.json).

Reference standard status: provisional (all references from a single channel; includes videos with <60% coverage).

Metrics: estimated_minutes=5.5, target_minutes=10, beats=23, ai_generated_share=0, authentic_beat_share_upper_bound=0.156, longest_constructed_stretch_s=171, overlay_beat_share=0.212, assets_used=3, distinct_real_assets=3, longest_beat_s=33, scene_changes_per_min=4.2

| Check | Result | Measured | Standard | Why | Evidence |
|---|---|---|---|---|---|
| V1 AI-generated imagery | **PASS** | 0% of estimated time | 0% (hard rule; none of the 28 non-AI-Tested reference videos shows any) | Generated pictures read as artificial when used as decoration. | VISUAL-EDITING-RESEARCH.md section 3-4 |
| V2 Authentic media share | **PASS** | 16% of estimated time shows at least one authentic asset (upper bound) | reference band 14-40% real captured (sampled; -12 points tolerance) (provisional) | The references that look least artificial are built on real captured material; constructed graphics should explain what real media cannot. | VISUAL-EDITING-RESEARCH.md section 3 (5 videos, Football Made Simple) |
| V3 All-constructed stretch | **PASS** | 171 s (ending at beat R10) | longest in the references 180 s (sampled runs of 15 s); FAIL above 1.5x (provisional) | Long runs of graphics without any real picture are the 'AI slideshow' pattern the references avoid. | VISUAL-EDITING-RESEARCH.md section 4 |
| V4 Caption / text overlay share | **PASS** | 21% of time on beats that carry a caption, label, kicker, badge or stamp | reference band 20-36% (+12 points) (provisional) | Text on every scene is not what the references do; labels belong to key terms, footage and credits. | CAPTION-RESEARCH.md |
| V5 Repeated media | **PASS** | 3 distinct authentic assets across 23 beats | no asset on more than 2 beats (author's rule; no reference measurement) (provisional) | Repeating one picture reads as generic filler. | none (judgement) |
| V6 Credit on every third-party picture | **PASS** | every authentic picture has a credit field in its scene | 100% (hard rule; the references show credit or source lines on borrowed material) | CLAUDE.md: no media without a recorded source; references credit borrowed clips on screen. | CAPTION-RESEARCH.md; CLAUDE.md |
| V7 Licence and source recorded | **PASS** | 7 assets with licence and source | every asset has licence, source URL and commercial use allowed (hard rule) | CLAUDE.md hard rule. | MEDIA-MANIFEST.json |
| V8 Long unchanging visual | **PASS** | longest single beat 33 s (beat length, not measured change) | longest static stretch in the references 18 s (frame-difference score); flag above max(60 s, that) (provisional) | A beat that long needs internal change (camera move, reveal, new panel) or a cut to real media. | VISUAL-EDITING-RESEARCH.md section 6 |
| V9 Scene-change rate | **INFO** | 4.2 beats/min (a beat can contain several internal changes) | reference 4.7-9.8 shots/min (dissolve-aware detector, +-15%) (provisional) | Compare only as an indication: beats are not shots. | VISUAL-EDITING-RESEARCH.md section 5 |
| V10 Visual matches narration (lexical screen only) | **CHECK** | 1 real pictures share no content word with their narration: R16:spain-moncloa-2024-3.jpg | a person confirms each flagged picture shows what is said (a word match is not proof of relevance) (provisional) | A picture unrelated to the narration is the strongest 'filler' signal. | none (a person must judge) |
| A0 Audio checks | **SKIPPED** | no cue sheet for this channel | docs/longform/cue-sheets/<channel>.json (provisional) |  |  |
