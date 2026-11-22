# Script engine

Turns fetched research into a script that has been *stopped* from advancing unless it holds together. It is not a
request to "write better"; each gate below is code that blocks, and each rule has an ID in its finding.

```
sources (fetched pages)
  -> claims.mjs        claim records; excerpt verbatim in the page, numbers and names inside the excerpt, channel claim_categories
  -> blueprint.mjs     central question, beats, links, questions raised/answered; deterministic checks, then one model check;
                       beats that do not serve the question are removed; no narration exists until this passes
  -> writer.mjs        4 hooks, strongest HONEST one chosen by code; sentences with claim_ids, a stated reason each follows,
                       on-screen text; duration from the voice's MEASURED words per minute; too long => narrow, never speed up
  -> continuity.mjs    CON-01..16 deterministic, then one model review; a critical finding blocks narration
  -> traceability.mjs  TRC-01..06 (sentence <- claims) and SCN-00..05 (scene <- sentence, picture <- claims)
  -> critic.mjs        independent role and, where a second key exists, a different provider; critique.schema.json + 13 questions
  -> engine.mjs        orchestration, per-channel rules (channels.mjs), bounded revision loop, honest status
```

Statuses: `approved`, `rejected`, `rejected_blueprint`, `blocked_input`, `blocked_provider` (quota/outage, not a quality
verdict), `blocked_model`. A script is released only as `approved`, only after a critic that is not the writer approved the same
draft and every deterministic and model gate passed.

Run the tests (no network, no keys, no node_modules): `node --test platform/script-engine/*.test.mjs`.
Live run on GitHub: push `preview/_script-engine`; `platform/channels/_script-engine/preview.mjs` fetches real pages and calls the models.

`SCRIPT_ENGINE_DEBUG=1` prints every deterministic finding per round.

Limits, stated plainly:
- The continuity rules are heuristics on word overlap, stems and patterns. They are tuned to over-flag. They cannot judge whether
  a sentence *means* something false that happens to reuse the claim's words (for example attaching one number to the wrong group);
  that is the model review's and the critic's job, and they can be wrong too.
- `gate-script.js`, `validate-script-claims.cjs` and the other gates of the old pipeline are not called here; this engine has its own
  and does not replace them in the daily pipeline.
- Rule IDs (CON, TRC, SCN, DUR, HOOK, CLM, PKG, AIT, HP, RSF, DL, GM, RL, CS, WV) are not yet in `CHECK-REGISTER.md`; that file is
  not in this engine's ownership.
