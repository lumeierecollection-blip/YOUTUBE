# AI Decision Audit
Date: 2026-09-23
Branch: claude/visual-rebuild-from-5f91e75
HEAD: 9bb5993 (audit reads code at this commit)
Evidence run: green run [35847628790](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/35847628790) (dry run, commit 3e96e96) — its `rendered-<ch>-35847628790` and `prep-<ch>-35847628790` artifacts and the complete logs of all 15 jobs (13,809 lines). Nothing was re-run.

**The one-line answer:** Gemini writes a visual plan for 5 of the 6 channels, but on this branch **none of Gemini's visual decisions reach the screen**. Every beat on those 5 channels renders as one line of text on a dark background. The checking AI exists in the code but is **switched off in CI** (`--skip-qa`), so nothing noticed.

## Correction to docs/V2-CI-GREEN.md

That report's ch-1 row ("local, 8 beats, TYPO 2, max 25%") was measured from the **wrong file**. Each artifact also carries a stale plan committed in the repo (`emergency-fund-bigger-than-you-think-2026-shorts-script-visual-plan.json`), and my extraction took the first file alphabetically. The real ch-1 plan for that run is `money-mindset-shifts-2026-shorts-script-visual-plan.json`: Gemini, 5 beats, TYPO 1. The corrected numbers are below.

## Section 1 — Who makes decisions

**Call path** (`scripts/render-and-qa.js`, invoked by `.github/workflows/daily-pipeline-v2.yml:707` as `node scripts/render-and-qa.js --channel <ch> --skip-qa`):

| Step | Where | What |
|---|---|---|
| 1 | `render-and-qa.js:154` `geminiPlan()` | runs `scripts/gemini-visual-plan.js` (Gemini API via `src/lib/gemini-client.js`, key `GEMINI_API_KEY`) if a Gemini key is set |
| 1a | `render-and-qa.js` (inside `geminiPlan`) | if Gemini's plan lists `compositionIssues`, re-runs Gemini **once** with them as corrections; keeps the plan with fewer issues |
| 2 | `render-and-qa.js:211` | if Gemini exits non-zero → `scripts/local-visual-plan.cjs` (rule-based: keyword regexes → mechanism, no model) |
| 3 | `render-and-qa.js` after planning | no plan → render refused (`::error::No visual plan at …`) |
| 4 | `src/skills/remotion-render/render.js:497-507` | loads `data/visual-plans/<ch>/<script>-visual-plan.json`, passes it to `direct()` in `visual-engine/director/visual-director.js` |
| 5 | `visual-engine/directed-scene.jsx` | draws each beat (see Section 3 for what it can actually draw) |

- **Default model:** Gemini `gemini-3.5-flash-lite` — the default in `src/lib/gemini-client.js:228`, which `gemini-visual-plan.js` calls via `callGemini`.
- **Fallback chain:** Gemini → (one corrective Gemini pass) → local rule-based planner → refuse to render. No other fallback is in the plan path.
- **Ollama:** **not used in the plan path.** Ollama (`qwen2.5:3b`) runs only in the prep job (discover/research/script via `scripts/ollama-agent.js`). The render job doesn't install it.

**What actually ran** (from the green run's render logs, `grep "=== (GEMINI|LOCAL) PLAN"`):

| Ch | Planner | Corrective pass |
|---|---|---|
| 1 | Gemini | failed ("Gemini plan failed: response had no 'beats'"), first plan kept |
| 2 | Gemini | failed, first plan kept |
| 9 | Gemini | failed, first plan kept |
| 26 | Gemini | succeeded: composition issues 10 → 1 |
| 44 | Gemini | failed, first plan kept |
| 48 | **local** (Gemini: "response had no 'beats'") | n/a |

**Plan files on disk.** `data/visual-plans/<ch>/` in the repo holds only older committed plans; the plans from the run are in the run's artifacts (`rendered-<ch>-35847628790/visual-plans/<ch>/`). `-first.json` is the pre-correction copy.

| Ch | File (in `rendered-<ch>-35847628790/visual-plans/<ch>/`) | Bytes | source | Beats | generatedAt |
|---|---|---|---|---|---|
| 1 | `emergency-fund-bigger-than-you-think-2026-shorts-script-visual-plan.json` (stale, committed in repo — not this run) | 17509 | local | 8 | 2026-09-22T07:48:28.635Z |
| 1 | `money-mindset-shifts-2026-shorts-script-visual-plan-first.json` | 18409 | (none → Gemini) | 5 | 2026-09-23T10:30:22.296Z |
| 1 | `money-mindset-shifts-2026-shorts-script-visual-plan.json` | 18409 | (none → Gemini) | 5 | 2026-09-23T10:30:22.296Z |
| 2 | `traffic-stop-scripts-now-now-now-now-now-now-now-now-now-now-shorts-script-visual-plan-first.json` | 20482 | (none → Gemini) | 6 | 2026-09-23T10:30:26.061Z |
| 2 | `traffic-stop-scripts-now-now-now-now-now-now-now-now-now-now-shorts-script-visual-plan.json` | 20482 | (none → Gemini) | 6 | 2026-09-23T10:30:26.061Z |
| 9 | `us-greenland-security-deal-shorts-script-visual-plan-first.json` | 22345 | (none → Gemini) | 6 | 2026-09-23T10:30:25.895Z |
| 9 | `us-greenland-security-deal-shorts-script-visual-plan.json` | 22345 | (none → Gemini) | 6 | 2026-09-23T10:30:25.895Z |
| 26 | `delhi-domestic-worker-3-cr-jewelry-theft-shorts-script-visual-plan-first.json` | 26830 | (none → Gemini) | 7 | 2026-09-23T10:30:27.854Z |
| 26 | `delhi-domestic-worker-3-cr-jewelry-theft-shorts-script-visual-plan.json` | 22118 | (none → Gemini) | 7 | 2026-09-23T10:30:37.909Z |
| 44 | `ai-negotiation-tactics-2026-shorts-script-visual-plan-first.json` | 26746 | (none → Gemini) | 7 | 2026-09-23T10:30:20.172Z |
| 44 | `ai-negotiation-tactics-2026-shorts-script-visual-plan.json` | 26746 | (none → Gemini) | 7 | 2026-09-23T10:30:20.172Z |
| 48 | `toyota-humanoid-training-directive-shorts-script-visual-plan.json` | 11051 | local | 6 | 2026-09-23T10:30:31.239Z |

The Gemini planner writes no `source` field; render-and-qa treats a missing field as Gemini, and the logs above confirm it.

## Section 2 — Detailed beat-by-beat (ch-1)

Script topic: "money mindset shifts" (channel 1, Money Mind). Sentences are the SRT cues from `prep-1-35847628790/tts/1/money-mindset-shifts-2026-shorts-script-vo.srt` — the planner and the director both work cue-by-cue.

Full plan file, `rendered-1-35847628790/visual-plans/1/money-mindset-shifts-2026-shorts-script-visual-plan.json`, verbatim:

```json
{
  "generatedAt": "2026-09-23T10:30:22.296Z",
  "channel": "1",
  "iteration": "initial",
  "totalBeats": 5,
  "beats": [
    {
      "index": 0,
      "visual_headline": "What controls your wallet?",
      "reason": "Establishes the core premise that internal beliefs dictate financial reality by visualizing a framework of two diverging paths.",
      "emphasis_words": [
        "money",
        "mindset",
        "beliefs"
      ],
      "visual_events": [
        {
          "type": "comparison",
          "label": "Belief Systems",
          "magnitude": "2"
        }
      ],
      "capabilities": [
        "comparison",
        "typographic_emphasis"
      ],
      "objects": {
        "label_a": "Scarcity",
        "label_b": "Abundance"
      },
      "composition": null,
      "carries_forward": "The two diverging pillars of belief",
      "emotional_weight": "building",
      "typography_direction": {
        "phrase": "What controls your wallet?",
        "why": "Hooks the viewer by reframing money from an external resource to an internal psychological construct.",
        "moment": "hook",
        "single_line": true,
        "not_a_headline": true,
        "not_a_transcript": true,
        "relation_to_visual": "Poses the central question that the diverging belief blocks on screen immediately answer."
      },
      "direction": {
        "narrative_purpose": "Hook the viewer and introduce the concept of money mindset as a dual framework.",
        "subject": "Two distinct structural blocks representing mental frameworks resting on a ground plane",
        "environment": "clean data void",
        "action_start": "A single centered block",
        "action_end": "The block splits cleanly into two distinct paths",
        "camera": "push_in",
        "motion": "smooth lateral separation with a heavy landing",
        "typography": "What controls your wallet?",
        "sound": "silence",
        "consequence": "The viewer understands that financial life splits into two opposing mental rules.",
        "muted_read": "Two contrasting financial mindsets exist.",
        "why_visual": "Visualizing a mind split into two choices directly mirrors the binary nature of beliefs.",
        "graph_justified": false
      },
      "compiledScene": {
        "narrative_role": "statement",
        "mechanism": "CAPABILITY",
        "reason": "Establishes the core premise that internal beliefs dictate financial reality by visualizing a framework of two diverging paths.",
        "subject": "",
        "material": "abstract",
        "objects": [
          {
            "kind": "field",
            "anchor": "center",
            "motion": "appear"
          },
          {
            "kind": "bar",
            "anchor": "left",
            "motion": "appear",
            "count": 1,
            "scale": 1,
            "label": ""
          },
          {
            "kind": "bar",
            "anchor": "right",
            "motion": "appear",
            "count": 1,
            "scale": 0.6,
            "label": ""
          }
        ],
        "shots": [
          {
            "phase": 0,
            "phaseDuration": 1,
            "camera": "hold",
            "focus": "center"
          }
        ],
        "typography": {
          "role": "primary",
          "style": "kinetic",
          "emphasis_words": []
        }
      },
      "compositionCoverage": 0.389,
      "compositionValid": null,
      "mechanism": "TYPOGRAPHY",
      "cap_reassigned": {
        "from": "CAPABILITY:comparison",
        "why": "hook is always TYPOGRAPHY"
      }
    },
    {
      "index": 1,
      "visual_headline": "BELIEFS SHAPE OUTCOMES",
      "reason": "Reinforces the definition of money mindset through a continuous accumulation of mental rules.",
      "emphasis_words": [
        "set",
        "beliefs"
      ],
      "visual_events": [
        {
          "type": "accumulation",
          "label": "Internal Rules",
          "magnitude": "5"
        }
      ],
      "capabilities": [
        "accumulation"
      ],
      "objects": {},
      "composition": null,
      "carries_forward": "The accumulated stack of internal rules",
      "emotional_weight": "calm",
      "typography_direction": null,
      "direction": {
        "narrative_purpose": "Clarify that mindset is built from a cumulative set of individual beliefs.",
        "subject": "A vertical stack of five distinct blocks building upward",
        "environment": "clean data void",
        "action_start": "Empty ground plane",
        "action_end": "Five blocks locked tightly into a vertical column",
        "camera": "hold",
        "motion": "blocks drop sequentially with weighted thuds",
        "typography": "none",
        "sound": "silence",
        "consequence": "The viewer perceives mindset as a physical architecture built block by block.",
        "muted_read": "Beliefs accumulate to form a permanent structure.",
        "why_visual": "Accumulation represents how individual thoughts compound into a fixed belief system.",
        "graph_justified": false
      },
      "compiledScene": {
        "narrative_role": "statement",
        "mechanism": "CAPABILITY",
        "reason": "Reinforces the definition of money mindset through a continuous accumulation of mental rules.",
        "subject": "",
        "material": "abstract",
        "objects": [
          {
            "kind": "stack",
            "anchor": "center",
            "motion": "fill",
            "count": 10,
            "scale": 1,
            "label": "Internal Rules"
          }
        ],
        "shots": [
          {
            "phase": 0,
            "phaseDuration": 1,
            "camera": "hold",
            "focus": "center"
          }
        ],
        "typography": {
          "role": "primary",
          "style": "kinetic",
          "emphasis_words": []
        }
      },
      "compositionCoverage": 0.574,
      "compositionValid": false,
      "composition_dropped": {
        "reasons": [
          "objects[1]: unknown motion \"stacking vertically\""
        ],
        "coverage": 0.574
      }
    },
    {
      "index": 2,
      "visual_headline": "TWO OPPOSING FORCES",
      "reason": "Contrasts scarcity and abundance as two fundamentally different spatial states.",
      "emphasis_words": [
        "scarcity",
        "abundance"
      ],
      "visual_events": [
        {
          "type": "contrast",
          "label": "Scarcity vs Abundance",
          "magnitude": "2"
        }
      ],
      "capabilities": [
        "contrast"
      ],
      "objects": {
        "label_a": "Scarcity",
        "label_b": "Abundance"
      },
      "composition": null,
      "carries_forward": "The expanding abundance bar",
      "emotional_weight": "sharp",
      "typography_direction": null,
      "direction": {
        "narrative_purpose": "Demonstrate the precise binary choice between a restricted or open financial outlook.",
        "subject": "Two side-by-side vertical bars where one contracts and the other grows",
        "environment": "clean data void",
        "action_start": "Two equal bars",
        "action_end": "Left bar shrinks to a sliver while right bar towers",
        "camera": "hold",
        "motion": "inverse vertical scaling with smooth acceleration",
        "typography": "none",
        "sound": "silence",
        "consequence": "The viewer instantly grasps the opposing trajectories of scarcity and abundance.",
        "muted_read": "One mindset diminishes while the other expands.",
        "why_visual": "Direct contrast is the only visual method to show mutually exclusive emotional states.",
        "graph_justified": false
      },
      "compiledScene": {
        "narrative_role": "statement",
        "mechanism": "CAPABILITY",
        "reason": "Contrasts scarcity and abundance as two fundamentally different spatial states.",
        "subject": "",
        "material": "abstract",
        "objects": [
          {
            "kind": "field",
            "anchor": "center",
            "motion": "appear"
          },
          {
            "kind": "block",
            "anchor": "upper_third",
            "motion": "strike",
            "scale": 0.8,
            "label": ""
          },
          {
            "kind": "block",
            "anchor": "lower_third",
            "motion": "rise",
            "scale": 1,
            "label": ""
          }
        ],
        "shots": [
          {
            "phase": 0,
            "phaseDuration": 1,
            "camera": "hold",
            "focus": "center"
          }
        ],
        "typography": {
          "role": "primary",
          "style": "kinetic",
          "emphasis_words": []
        }
      },
      "compositionCoverage": 0.467,
      "compositionValid": false,
      "composition_dropped": {
        "reasons": [
          "objects[1]: unknown motion \"shrinking\"",
          "objects[2]: unknown motion \"expanding\""
        ],
        "coverage": 0.467
      }
    },
    {
      "index": 3,
      "visual_headline": "It is not just about the numbers.",
      "reason": "Exposes the hidden reality that financial stress stems from mindset rather than just a depleted account.",
      "emphasis_words": [
        "financial",
        "stress",
        "mindset"
      ],
      "visual_events": [
        {
          "type": "revelation",
          "label": "Root Cause",
          "magnitude": "1"
        }
      ],
      "capabilities": [
        "revelation"
      ],
      "objects": {},
      "composition": null,
      "carries_forward": "The guiding blocks rising from the broken container",
      "emotional_weight": "heavy",
      "typography_direction": {
        "phrase": "It is not just about the numbers.",
        "why": "Contradicts the common assumption that income level is the sole driver of financial stress.",
        "moment": "contradiction",
        "single_line": true,
        "not_a_headline": true,
        "not_a_transcript": true,
        "relation_to_visual": "Mirrors the moment an outer shell breaks to reveal internal mechanics."
      },
      "direction": {
        "narrative_purpose": "Shift blame away from pure income deficit toward internal decision-making structures.",
        "subject": "A brittle outer shell cracking open to reveal solid internal blocks",
        "environment": "clean data void",
        "action_start": "A solid outer container",
        "action_end": "Container shatters outward, revealing structured decision blocks inside",
        "camera": "push_in",
        "motion": "sharp fracture followed by steady internal rise",
        "typography": "It is not just about the numbers.",
        "sound": "silence",
        "consequence": "The viewer realizes financial struggle is structural and internal, not just numerical.",
        "muted_read": "The surface problem hides a deeper internal mechanism.",
        "why_visual": "Revelation visualizes looking beneath surface-level financial complaints.",
        "graph_justified": false
      },
      "compiledScene": {
        "narrative_role": "statement",
        "mechanism": "CAPABILITY",
        "reason": "Exposes the hidden reality that financial stress stems from mindset rather than just a depleted account.",
        "subject": "",
        "material": "abstract",
        "objects": [
          {
            "kind": "field",
            "anchor": "center",
            "motion": "appear"
          },
          {
            "kind": "document",
            "anchor": "center",
            "motion": "reveal",
            "scale": 1,
            "label": "Root Cause"
          }
        ],
        "shots": [
          {
            "phase": 0,
            "phaseDuration": 1,
            "camera": "hold",
            "focus": "center"
          }
        ],
        "typography": {
          "role": "primary",
          "style": "kinetic",
          "emphasis_words": []
        }
      },
      "compositionCoverage": 0.395,
      "compositionValid": false,
      "composition_dropped": {
        "reasons": [
          "objects[1]: unknown primitive \"container\"",
          "objects[2]: unknown motion \"rising from within\""
        ],
        "coverage": 0.395
      }
    },
    {
      "index": 4,
      "visual_headline": "Build your financial freedom.",
      "reason": "Concludes the argument by showing continuous growth and upward accumulation toward ultimate financial freedom.",
      "emphasis_words": [
        "abundance",
        "freedom"
      ],
      "visual_events": [
        {
          "type": "growth",
          "label": "Financial Freedom",
          "magnitude": "10"
        }
      ],
      "capabilities": [
        "growth",
        "typographic_emphasis"
      ],
      "objects": {},
      "composition": null,
      "carries_forward": null,
      "emotional_weight": "urgent",
      "typography_direction": {
        "phrase": "Build your financial freedom.",
        "why": "Provides a definitive, empowering call to action rooted in the video's core thesis.",
        "moment": "statement",
        "single_line": true,
        "not_a_headline": true,
        "not_a_transcript": true,
        "relation_to_visual": "Accompanies the final upward surge of growth on screen."
      },
      "direction": {
        "narrative_purpose": "Deliver a lasting visual payoff of long-term growth and empowered mindset.",
        "subject": "Four vertical pillars rising smoothly upward in unison",
        "environment": "clean data void",
        "action_start": "Mid-height pillars",
        "action_end": "Pillars stretch upward past the top frame edge",
        "camera": "pull_back",
        "motion": "fluid, organic vertical ascent",
        "typography": "Build your financial freedom.",
        "sound": "silence",
        "consequence": "The viewer feels inspired and sees a clear trajectory toward abundance.",
        "muted_read": "Consistent positive mindset leads to boundless upward growth.",
        "why_visual": "Growth physically enacts the concept of abundance and freedom.",
        "graph_justified": false
      },
      "compiledScene": {
        "narrative_role": "statement",
        "mechanism": "CAPABILITY",
        "reason": "Concludes the argument by showing continuous growth and upward accumulation toward ultimate financial freedom.",
        "subject": "",
        "material": "abstract",
        "objects": [
          {
            "kind": "stack",
            "anchor": "center",
            "motion": "grow",
            "count": 6,
            "scale": 1,
            "label": "Financial Freedom"
          },
          {
            "kind": "figure",
            "anchor": "upper_third",
            "motion": "appear",
            "label": "10"
          }
        ],
        "shots": [
          {
            "phase": 0,
            "phaseDuration": 1,
            "camera": "hold",
            "focus": "center"
          }
        ],
        "typography": {
          "role": "primary",
          "style": "kinetic",
          "emphasis_words": []
        }
      },
      "compositionCoverage": 0.362,
      "compositionValid": false,
      "composition_dropped": {
        "reasons": [
          "objects[1]: unknown primitive \"pillar\""
        ],
        "coverage": 0.362
      }
    }
  ],
  "composedBeats": 0,
  "compositionIssues": [
    {
      "beat": 1,
      "problem": "objects[1]: unknown motion \"stacking vertically\" — use one of: appear, rise, grow, drain, fill, fall, strike, split, count, reveal, hold",
      "fix": "re-compose this beat from the declared primitives"
    },
    {
      "beat": 2,
      "problem": "objects[1]: unknown motion \"shrinking\" — use one of: appear, rise, grow, drain, fill, fall, strike, split, count, reveal, hold",
      "fix": "re-compose this beat from the declared primitives"
    },
    {
      "beat": 2,
      "problem": "objects[2]: unknown motion \"expanding\" — use one of: appear, rise, grow, drain, fill, fall, strike, split, count, reveal, hold",
      "fix": "re-compose this beat from the declared primitives"
    },
    {
      "beat": 3,
      "problem": "objects[1]: unknown primitive \"container\" — use one of: block, stack, bar, vessel, document, grid, gauge, figure, counter, silhouette, arrow, rule, field",
      "fix": "re-compose this beat from the declared primitives"
    },
    {
      "beat": 3,
      "problem": "objects[2]: unknown motion \"rising from within\" — use one of: appear, rise, grow, drain, fill, fall, strike, split, count, reveal, hold",
      "fix": "re-compose this beat from the declared primitives"
    },
    {
      "beat": 4,
      "problem": "objects[1]: unknown primitive \"pillar\" — use one of: block, stack, bar, vessel, document, grid, gauge, figure, counter, silhouette, arrow, rule, field",
      "fix": "re-compose this beat from the declared primitives"
    }
  ],
  "compilationReport": [
    {
      "beat": 0,
      "errors": [
        "scene covers only 13% of the frame (minimum 35%) — this is the empty-frame defect: add objects, raise a count, or use a larger primitive (grid, field, document, vessel)"
      ],
      "warnings": [
        "Scene coverage 13% is below minimum 35% — adding ground plane"
      ]
    },
    {
      "beat": 2,
      "errors": [
        "scene covers only 5% of the frame (minimum 35%) — this is the empty-frame defect: add objects, raise a count, or use a larger primitive (grid, field, document, vessel)"
      ],
      "warnings": [
        "Scene coverage 5% is below minimum 35% — adding ground plane"
      ]
    },
    {
      "beat": 3,
      "errors": [
        "scene covers only 23% of the frame (minimum 35%) — this is the empty-frame defect: add objects, raise a count, or use a larger primitive (grid, field, document, vessel)"
      ],
      "warnings": [
        "Scene coverage 23% is below minimum 35% — adding ground plane"
      ]
    }
  ],
  "capabilityDistribution": {
    "comparison": 1,
    "typographic_emphasis": 2,
    "accumulation": 1,
    "contrast": 1,
    "revelation": 1,
    "growth": 1
  },
  "mechanismDistribution": "TYPOGRAPHY:1 CAPABILITY:accumulation:1 CAPABILITY:contrast:1 CAPABILITY:revelation:1 CAPABILITY:growth:1",
  "compositionsDropped": [
    1,
    2,
    3,
    4
  ]
}
```

**Evaluation.** "Plan match" judges Gemini's decision (mechanism + subject + action) against the sentence. "Rendered as" is what `directed-scene.jsx` actually drew, from the render manifest and the scene routing in Section 3.

| Beat | Sentence (SRT) | Plan's mechanism | Plan's subject | Plan's action | Plan match | Rendered as |
|---|---|---|---|---|---|---|
| 0 | "Your 'money mindset' is simply your set of beliefs about money, which can be either scarcity or abundance." | TYPOGRAPHY (reassigned from CAPABILITY:comparison by the hook rule) | "Two distinct structural blocks representing mental frameworks…" | "A single centered block" → "splits cleanly into two distinct paths" | **Partially** — Gemini's split-into-two visual fit "scarcity or abundance", but the hook rule replaced it with the question "What controls your wallet?" | Text line "What controls your wallet?" |
| 1 | "Did you know that your 'money mindset' is just your set of beliefs about money?" | CAPABILITY:accumulation | "A vertical stack of five distinct blocks building upward" | "Empty ground plane" → "Five blocks locked tightly into a vertical column" | **Partially** — abstract stacking; nothing about "beliefs" specifically | Text line "BELIEFS SHAPE OUTCOMES" (composition dropped: motion "stacking vertically") |
| 2 | "It can be either scarcity or abundance." | CAPABILITY:contrast | "Two side-by-side vertical bars where one contracts and the other grows" | "Two equal bars" → "Left bar shrinks to a sliver while right bar towers" | **Yes** — scarcity vs abundance as shrinking vs growing bars | Text line "TWO OPPOSING FORCES" (composition dropped: motions "shrinking", "expanding") |
| 3 | "Most people assume their financial stress is caused by not having enough money, but a healthy money mindset can help guide financial decisions." | CAPABILITY:revelation | "A brittle outer shell cracking open to reveal solid internal blocks" | "A solid outer container" → "shatters outward, revealing structured decision blocks inside" | **Yes** — "what people assume" vs the real cause | Text line "It is not just about the numbers." (composition dropped: primitive "container") |
| 4 | "A positive money mindset can help create a healthy relationship with money and lead to financial abundance and freedom." | CAPABILITY:growth | "Four vertical pillars rising smoothly upward in unison" | "Mid-height pillars" → "stretch upward past the top frame edge" | **Yes** — growth toward abundance | Text line "Build your financial freedom." (composition dropped: primitive "pillar") |

**ch-1: plan match 3 yes / 2 partially / 0 no (60% yes). On screen: 5 of 5 beats are a single text line; none of Gemini's visual decisions was drawn.**

## Section 3 — Dropped decisions

**Totals across the six channels** (from each plan's `compositionsDropped`, `composition_dropped` and `cap_reassigned` fields, and the render manifests):

| | Count |
|---|---|
| Beats | **37** (ch-1 5, ch-2 6, ch-9 6, ch-26 7, ch-44 7, ch-48 6) |
| Beats planned by Gemini | 31 (all channels except ch-48) |
| Gemini compositions dropped at plan time | **20 of 31** (ch-1 4, ch-2 5, ch-9 4, ch-26 1, ch-44 6) |
| Gemini hook visuals replaced by TYPOGRAPHY (cap rule) | 5 of 5 |
| Gemini compositions kept in the plan | 6 (ch-9 beat 3; ch-26 beats 1, 2, 3, 4, 6) |
| Gemini beats whose **visual** decision was drawn on screen | **0 of 31** |
| Beats removed from the video entirely | 0 |

**What "dropped" means, and why even kept decisions don't render — three separate mechanisms, all confirmed in code:**

1. **Plan-time drop.** `scripts/gemini-visual-plan.js:632-641` — a composition that fails `validateScene()` after synonym mapping is set to `null` and its reasons recorded in `composition_dropped`. Reasons in this run were almost all invented vocabulary: motions "stacking vertically", "shrinking", "expanding", "expand", "stack_up", "align", "drop", "multiply", "fracture", "shatter", "scale_y", "flow"; primitives "container", "pillar", "connector", "node"; anchors "grid", "split", "background". The corrective re-plan that is meant to fix these failed on 4 of 5 channels ("response had no 'beats'").
2. **Kept compositions are never drawn.** `src/skills/remotion-render/visual-engine/directed-scene.jsx` on this branch has **no code that renders `scene.composition`** (`grep -c composition` → 2 hits: a comment and the `compositions` export). `origin/main` has a `ComposedScene`; this branch doesn't. So the 6 compositions that survived validation were also not drawn.
3. **Capability beats route to the text scene.** Every Gemini beat compiles to mechanism `CAPABILITY`. `MechanismScene` (`directed-scene.jsx:1205`) switches on the 8 legacy mechanisms only; `CAPABILITY` hits `default:` (`directed-scene.jsx:1238`) → `<TypographyScene>`, which draws only `beat.text` (`directed-scene.jsx:427`: `if (!headline) return null`). The capability's objects (stacks, bars, figures) are never drawn.

**Effect: the beat is not removed — it is rendered as a single line of text** (the plan's `visual_headline` / typography phrase), on the channel's darkest palette colour. On the 5 Gemini channels that is 100% of the running time (manifest durations: ch-1 31.5s, ch-2 56.1s, ch-9 36.8s, ch-26 48.5s, ch-44 55.1s — all TypographyScene).

**Why no gate caught it:** the render manifest records these beats as `draws_text: false` / `on_screen_text: []` (`render.js` `sceneTextInventory()` doesn't know the `CAPABILITY` mechanism), so any audit reading the manifest believes they draw nothing; the only frame check samples beat 0, which is TYPOGRAPHY by rule; and the plan caps count `CAPABILITY:<cap>` labels as distinct mechanisms, so "TYPOGRAPHY 1–2, no mechanism over 40%" passes while every beat is rendered by the same text scene.

## Section 4 — Checking AI

- **Does one exist?** Yes, two:
  - `scripts/gemini-visual-challenger.js` — "Gemini as semantic reviewer/judge", returns MATCH / NEEDS_CHANGE per beat. Its only caller is `scripts/render-and-qa-enhanced.js`, which only `.github/workflows/daily-pipeline.yml` (**V1**) calls. It reviews an OpenCode "visual intent document", not the V2 plan format. **Not in the V2 path.**
  - `scripts/gemini-frame-review.js` — reviews rendered frames against the script, SRT and plan ("plan-compliance"), and drives the correction loop. Called from `qaOne()` in `render-and-qa.js:453`.
- **Is it wired into the render path?** `qaOne()` is reached only if `skipQA` is false (`render-and-qa.js:701`). The V2 workflow passes `--skip-qa` (`daily-pipeline-v2.yml:707`). **It never runs in CI.**
- **What it would check:** plan compliance of rendered frames, text contrast, "template monoculture", headline dominance (from its prompt and the correction-loop comments in `render-and-qa.js`).
- **Does it reject anything in practice?** In the green run: **0** lines from any QA step (`grep -cE '\[qa/|gemini-review|Gemini verdict|local auditor cleared'` → 0); all six render jobs printed `--skip-qa: skipping QA`. Nothing checked the output against the script.

**Answer: a checking AI exists in the code, and it is switched off in CI. No AI compared the rendered video to the script in any run of this loop.**

## Section 5 — Typography usage

Plan-level counts (plan `mechanism` field, CAPABILITY beats labelled by their primary capability, which is what the caps used) vs. what was rendered (render manifest + `MechanismScene` routing):

| Channel | Total beats | TYPOGRAPHY in plan | % of video that is text (rendered) | Top mechanism (plan) | Second mechanism (plan) |
|---|---|---|---|---|---|
| 1 | 5 | 1 | **100%** | 5 distinct, 1 each (TYPOGRAPHY, accumulation, contrast, revelation, growth) | — |
| 2 | 6 | 1 | **100%** | 6 distinct, 1 each | — |
| 9 | 6 | 1 | **100%** | 6 distinct, 1 each | — |
| 26 | 7 | 1 | **100%** | CAPABILITY:population 2 | 1 each |
| 44 | 7 | 1 | **100%** | 7 distinct, 1 each | — |
| 48 | 6 | 2 | **36%** | TYPOGRAPHY 2, EVIDENCE_FIGURE 2 | ACTION_CONSEQUENCE 1, PROPORTIONAL_OBJECTS 1 |

- **Is TYPOGRAPHY between 1 and 2?** In the plans, yes, on all six. **On screen, no**: on ch-1, 2, 9, 26 and 44 every beat is rendered by `TypographyScene` — 5, 6, 6, 7 and 7 text beats — exceeding the 2-beat cap by 3, 4, 4, 5 and 5. ch-48 renders 2 (within the cap).
- **Do the TYPOGRAPHY frames look designed?** No. I viewed all six beat-0 frames (`rendered-<ch>-35847628790/renders/<ch>/*-beat0.png`, 810×1440). Each is one left-aligned line of text in the upper third on a flat dark background, with some colour emphasis on 1–2 words (ch-2 "DECIDE" red, ch-26 "DELHI" green, ch-48 "plan to" orange). Nothing else is in the frame. It reads as a caption line, not designed kinetic type.

Beat-0 frame statistics (810×1440 PNG; RGB means; "ink" = pixels whose luminance differs from the frame's median by >60):

| Ch | PNG size | configured bg_mode | Mean (whole) | Corner pixel | Text band y300–440 | Lower half | Ink % whole | Ink % lower half |
|---|---|---|---|---|---|---|---|---|
| 1 | 41 KB | white | (15, 24, 43) | (14, 23, 42) | (25, 33, 51) | (14, 23, 42) | 0.49% | 0.0% |
| 2 | 51 KB | black | (16, 15, 25) | (14, 14, 24) | (34, 28, 39) | (14, 14, 24) | 0.93% | 0.0% |
| 9 | 41 KB | white | (6, 16, 27) | (4, 14, 25) | (23, 32, 43) | (4, 14, 25) | 0.86% | 0.0% |
| 26 | 44 KB | black | (1, 1, 1) | (0, 0, 0) | (12, 15, 13) | (0, 0, 0) | 0.68% | 0.0% |
| 44 | 44 KB | white | (15, 24, 43) | (14, 23, 42) | (28, 36, 54) | (14, 23, 42) | 0.63% | 0.0% |
| 48 | 29 KB | black | (1, 1, 1) | (0, 0, 0) | (7, 7, 6) | (0, 0, 0) | 0.33% | 0.0% |

Under 1% of each frame carries anything but background, and the entire lower half is empty on every channel.

Also visible in these frames: **ch-1, ch-9 and ch-44 are configured `bg_mode: white` but render on dark navy.** `render.js:515-523` builds the DirectedShorts plan with `beats`, `palette`, `fonts` and **no `bgMode`**; `directed-scene.jsx:71-72` then takes the darkest palette colour. White background is never applied on this path.

## Section 6 — Summary table

"Plan match" is the Section 2 rule applied to every beat (yes = the plan's mechanism + subject + action could show the sentence to a viewer with no audio). "On screen" is whether that decision was actually drawn.

| Ch | Script (topic slug) | Plan source | Total beats | TYPO (plan / rendered) | Max mech (plan) | Drops | Checking AI ran? | Plan match (yes) | Decisions drawn on screen |
|---|---|---|---|---|---|---|---|---|---|
| 1 | money-mindset-shifts-2026 | Gemini | 5 | 1 / 5 | 20% | 4 (+1 hook) | No (`--skip-qa`) | 3/5 = 60% | 0/5 |
| 2 | traffic-stop-scripts-now-now-… | Gemini | 6 | 1 / 6 | 17% | 5 (+1 hook) | No | 2/6 = 33% | 0/6 |
| 9 | us-greenland-security-deal | Gemini | 6 | 1 / 6 | 17% | 4 (+1 hook) | No | 5/6 = 83% | 0/6 |
| 26 | delhi-domestic-worker-3-cr-jewelry-theft | Gemini | 7 | 1 / 7 | 29% | 1 (+1 hook) | No | 4/7 = 57% | 0/7 |
| 44 | ai-negotiation-tactics-2026 | Gemini | 7 | 1 / 7 | 14% | 6 (+1 hook) | No | 4/7 = 57% | 0/7 |
| 48 | toyota-humanoid-training-directive | local (rule-based) | 6 | 2 / 2 | 33% | 0 | No | 0/6 = 0% | 6/6 (placeholder scenes) |
| **All** | | | **37** | | | **20 (+5)** | **0 of 6** | **18/37 = 49%** | **Gemini: 0/31** |

Per-beat judgements for the five channels not detailed in Section 2:

- **ch-2 (2 yes / 4 partially):** [0] "1 SECOND TO DECIDE" yes; [1] two bars 1s vs 2s yes; [2] two documents stacking for "AAMVA… Eddie Craig guidelines" partially (generic); [3] beam linking to a ticking block partially; [4] grid expanding for "knowing the right steps" partially; [5] two blocks aligning, "STAY SAFE", partially.
- **ch-9 (5 yes / 1 partially):** [0] "PERMANENT CONTROL" yes; [1] five security nodes dropping into territory partially; [2] modern column scaling past the 1951 one yes; [3] surface sliding away to reveal a control seal yes; [4] twelve military tokens multiplying yes; [5] old-order pillar fracturing yes.
- **ch-26 (4 yes / 2 partially / 1 no):** [0] "3 CRORE STOLEN IN DELHI" yes; [1] three silhouettes for "in today's video…" partially (headline typo "DELH"); [2] vessel draining for stolen valuables yes; [3] document splitting for "investigative look" partially; [4] arrow to a new destination, "ESCAPE TO NEPAL", yes; [5] three figures, "ARRESTED IN DELHI", yes; [6] **no** — headline "Rs 3 CRORE RECOVERED" for a sentence about jewelry being *stolen*.
- **ch-44 (4 yes / 3 partially):** [0] "WARMTH SECURES 70% MORE DEALS" yes; [1] standard vs warm AI pillars yes; [2] grid fracturing for "game-changer" partially; [3] data points clustering for "researchers found…" partially; [4] nodes multiplying for "scaling rapidly" yes; [5] block splitting to a hollow core for "neglects human history" yes; [6] beam from strategy to results for "Walmart and Maersk have benefited" partially.
- **ch-48, local planner (0 yes / 2 partially / 4 no):** [0] and [5] TYPOGRAPHY showing the sentence's first 8 words — partially (transcript, not a visual idea); [1] EVIDENCE_FIGURE labelled "Toyota" — no (placeholder); [2] EVIDENCE_FIGURE labelled "Research" — no; [3] ACTION_CONSEQUENCE labelled "CAUSE" / "EFFECT" — no (placeholder labels); [4] PROPORTIONAL_OBJECTS labelled "A" / "B" — no.

## Section 7 — The honest answer

**1. Who is actually deciding what appears on screen?** Gemini (`gemini-visual-plan.js`, called from the GitHub Actions render job) writes the plan for 5 of the 6 channels; the rule-based `local-visual-plan.cjs` planned ch-48 after Gemini returned no beats. But the thing that decides what is **on screen** is the renderer's fallback: on this branch `directed-scene.jsx` cannot draw Gemini's compositions at all, and every Gemini beat's `CAPABILITY` mechanism falls through `MechanismScene`'s `default:` to `TypographyScene`. So on the 5 Gemini channels, every second of video is a line of text on a dark background — Gemini's words, never Gemini's visuals. On ch-48 the local planner's regexes pick legacy scenes with placeholder labels ("CAUSE", "EFFECT", "A", "B").

**2. Do the decisions make sense given the scripts?** Partially. On paper, Gemini's decisions correspond to their sentences for 18 of 31 beats and the rule-based planner for 0 of 6 — 18 of 37 overall (49%). On screen, none of Gemini's visual decisions is shown, so the match between what a viewer sees and what the narration says is just the headline text; whatever visual sense Gemini made is discarded. Separately, some scripts themselves look weak (ch-26 repeats one sentence three times; ch-2's claims such as "AAMVA recommends you roll down your window to air out your car" read like model output) — this audit didn't check those against their sources.

**3. Is there an AI that checks whether the output matches the script?** No — not in any run. `gemini-frame-review.js` exists and is written to compare rendered frames to the script and plan, but the V2 workflow runs with `--skip-qa`, so it is skipped on every channel; `gemini-visual-challenger.js` exists but only the V1 workflow can reach it, and it reviews a different plan format. It has rejected nothing, because it has never run. The green run was green because the gates it does run check audio, duration, a single frame's file size, and label counts — none of which can tell a designed visual from a line of text.

## What cannot be determined from the repo

- **Frames after beat 0.** Only beat 0 was extracted in CI. The "text-only" finding for beats 1+ comes from the render manifest and the code routing (`MechanismScene` → `TypographyScene`), not from pixels. Extracting more frames would mean decoding the MP4s locally, which this audit's rules exclude.
- **Whether the scripts' facts match their sources.** Prep enforces that cited URLs came from a search and that research has ≥2 domains; this audit didn't re-read the sources against the scripts.
- **Why Gemini's corrective pass returns "no 'beats'".** The logs show the failure, not Gemini's raw response.
- **Why Gemini returned no beats for ch-48** — same.
