# Gemini Script Stage + Pipeline Audit — STATUS (run failed)

Date: 2026-10-03
HEAD at the run: 70e53f6 (main)
Verification run: 37149091704. This was the only run made for this task.
Commits:

| Commit | Change |
|---|---|
| ab062dc | Gemini script stage |
| 6b176a5 | Manual publish path |
| 4cbc9a8 | Voice hard gate |
| 70e53f6 | Audit |

**Result: 0 of 6 channels produced a video. The run concluded `failure`.** Each part
behaved as built:
- **Gemini wrote every script.** No Ollama fallback was needed.
- **The voice gate skipped three channels.** It released their topics, and the other
  channels carried on.
- **Nothing was uploaded.**

The failures are below, with their causes. The spec says a failed run gets this STATUS doc
and no second run, so nothing was run again.

## Per channel (E.2)

| Ch | Prep | Script model | Voice, first ask | Voice, re-ask | Outcome |
|---|---|---|---|---|---|
| 1 | success | Gemini, both attempts | FAIL (5) | **FAIL** (3): "Amber Lee calculated…" starts with a full name, and 4 sentences start with a name | **Skipped by the voice gate.** blocked-voice-1.txt written, topic released |
| 2 | success | Gemini | FAIL (5) | **PASS**. Narrative still FAILs on the hook (2 sentences), which is log-and-continue | Rendered → **rejected**: `canvas-coverage`, NUMBER-FULL beats 3 and 7 span 59.2% and 59.1% (< 60%). Not uploaded |
| 9 | success | Gemini | FAIL (3) | **PASS**. Narrative still FAILs on payoff and close | Rendered → **rejected**: beat-check found a wrong-person photo on beat 5. Local audit 17/17 PASS. Not uploaded |
| 26 | **failure** | Gemini, all 5 attempts | Attempt 3: FAIL (4) | Re-ask attempts 4 and 5 failed the length gate (SCR-16: 79 and 76 words, under 86) | Prep failed: script gate after 5 attempts. Topic released |
| 44 | success | Gemini, all 5 attempts | Attempt 2: FAIL (4) | **FAIL** (1): two sentences in a row start with "MDPI" | **Skipped by the voice gate.** Topic released |
| 48 | success | Gemini, all 4 attempts | Attempt 3: FAIL (2) | **FAIL** (1): the setup's question "Can a tiny workshop outperform a sprawling industrial giant?" names nothing | **Skipped by the voice gate.** Topic released |

Every call logged `[script] ch-N: using gemini (gemini-3.5-flash-lite)`. Calls took 2.5–3.3
s, against about 2 minutes per qwen2.5:3b call. No call fell back to Ollama.

### What changed versus qwen2.5:3b

- **No copied example.** The removed line does not appear in any script.
- **No repeated beats.** The narrative re-ask works: ch-1 went from 1 of 5 beats passing to
  4 of 5, and ch-9 from 3 to 3 with different failures.
- **New problem: length.** Gemini writes **short**, 75–82 words against the 86-word floor.
  This happened on ch-26 (4 attempts), ch-44 (3) and ch-48 (2), and it is why ch-26 failed.
  The prompt's per-beat caps (HOOK ≤ 12 · SETUP ≤ 35 · …) were written to rein in qwen's
  169–196-word scripts. Gemini reads them as targets to stay under.
- **New problem: tokens recombined into new claims.** Every name and number traces to the
  research, but some sentences combine them into claims the research does not make:
  - ch-2's "Courts enforce 6 votes inside Service Employees International Union Local 32BJ
    agreements". A research number "6 votes" is attached to an unrelated organization.
  - ch-9's "his 1 trip". The research extracted the number 1 from "one of his first foreign
    trips".
  - ch-9's "to defy Israel". The research says "amid Iran's confrontation with Israel".
  SCR-14 checks that cited URLs are in the research, not what each sentence claims, so this
  passes every gate today. It is a real hard-rule risk ("no claim that didn't come from a
  source"). ch-2 and ch-9 were rejected for other reasons, so neither was uploaded.

## Full scripts

The last script the run kept for each channel: the voice-gate-blocked version for 1, 44 and
48, the rendered version for 2 and 9, and the last attempt for 26.

### ch-1 — `a-new-study-on-the-effect-of-high-interest-debt-2026-shorts`

105 words.

- **hook:** Walton College researchers proved paying $23 extra on the wrong loan destroys your savings.
- **setup:** Sage Cognition Press data shows 23% of borrowers hold older accounts months apart from newer ones. Ella Mao and Rafael M Batista tracked how consumers target legacy balances first. Which loan actually bleeds your wallet fastest?
- **rehook:** Except emotional attachment to legacy accounts hides a massive financial trap.
- **payoff:** Neale Mahoney and Abigail B Sussman revealed that prioritizing older installment debt spikes your total interest. Jessica Min confirmed prepayment parameters dictate real savings over nostalgia. Amber Lee calculated $23 wasted on every poor choice.
- **close:** Target high-interest revolving debt first using PNAS Nexus guidelines.

### ch-2 — `new-york-court-rules-mandatory-arbitration-agreements-shorts`

96 words.

- **hook:** New York Life Ins. Co. forced Kartal into arbitration, stripping away public court rights instantly.
- **setup:** New York State Human Rights Law bans mandatory arbitration for sexual harassment claims completely. CVP 7515 also outlaws mandatory clauses across employment agreements. Did NYSHRL actually stop employers from using these clauses?
- **rehook:** Except the FAA crushes state protections entirely.
- **payoff:** Federal law completely overrides NYSHRL rules. Courts enforce 6 votes inside Service Employees International Union Local 32BJ agreements. Kartal lost public trial rights at New York Life Ins. Co. under FAA rules.
- **close:** Check every CVP contract clause before signing employment agreements today.

### ch-9 — `iran-russia-economic-ties-2026-shorts`

110 words.

- **hook:** What happens when Tehran and Moscow sign a treaty that bypasses the West entirely in 2025?
- **setup:** President Raisi flew to Moscow for his 1 trip to cement this alliance. Western sanctions forced Russia into deeper economic integration with Iran. Grain trade and nuclear plants replaced old rivalries, but how far will this partnership go?
- **rehook:** Except this 2025 cooperation treaty focuses purely on trade instead of military pacts.
- **payoff:** Foreign Minister Amirabdollahian backed the pivot toward Moscow. Russia found non-Western partners to offset deteriorating ties with Europe. Both capitals now share grain shipments and nuclear technology to defy Israel and Western sanctions.
- **close:** Moscow and Tehran keep expanding trade routes across Eurasia today.

### ch-26 — `ed-1417-crore-ponzi-fraud-shorts`

76 words: under the length gate.

- **hook:** Unique Exports took ₹1,417.86 crore from 35,759 investors before the ED struck.
- **setup:** S. Naveen Kumar and S. Muthuselvam promised massive returns on agricultural shipments. Chennai headquarters processed millions from eager clients. What hid behind Unique Exports?
- **rehook:** Except the agricultural exports were entirely fake.
- **payoff:** Federal investigators arrested two masterminds behind the scam. The Enforcement Directorate uncovered a massive fraud totalling ₹1,417.86 crore. 35,759 victims lost their money.
- **close:** Check every agricultural investment with the ED before sending funds.

### ch-44 — `impact-ai-on-communication-skills-2026-shorts`

97 words.

- **hook:** MDPI research proves artificial intelligence is driving up the exact market value of human communication skills inside modern workplaces.
- **setup:** HRKatha surveyed HR leaders tracking organizational performance across offices. Frontiers published papers detailing how algorithms distribute messages between teams. Which language proficiencies do executives demand most today?
- **rehook:** Except HRKatha found HR leaders value language proficiency far more than five years ago.
- **payoff:** Frontiers tracked artificial intelligence entering intelligence maturity across enterprise software. MDPI documented leaders transforming employee performance through targeted dialogue. MDPI data reveals exact leadership communication gains.
- **close:** Upgrade your HRKatha language strategies before MDPI workplaces automate leadership roles.

### ch-48 — `how-microfactories-change-manufacturing-playbook-202-shorts`

111 words.

- **hook:** Caracol's additive manufacturing robot cuts lead times by 50% while massive traditional factories lose ground to agile local spaces.
- **setup:** Zapp EV builds 20,000 personalized electric motorcycles annually inside a compact facility in Bangkok. Forrester reports that these urban workshops now challenge legacy production paradigms. Can a tiny workshop outperform a sprawling industrial giant?
- **rehook:** Bain & Company calls this the back-to-local moment as Zapp EV scales output faster than legacy plants.
- **payoff:** Additive manufacturing delivers custom parts with zero tooling waste. Manufacturing Dive confirms these decentralized setups slash delivery delays. Bangkok units ship customized vehicles directly to urban buyers.
- **close:** Track Zapp EV and Caracol to watch 20,000 localized units disrupt legacy supply chains.

## Audit (Part D / E.3)

### Workflows

| Workflow (path) | Trigger | GitHub state | Can upload | Can commit |
|---|---|---|---|---|
| `.github/workflows/daily-pipeline-v2.yml` (id 357940354) | cron `0 6 * * *` (main only) + workflow_dispatch | **active** — the only one | Yes, private: approved/ on main; approved-review/ only through the manual review-publish job | Yes: topic-log, publish-queue |
| `.github/workflows/network-policy-check.yml` (id 339763547) | push (old branch only, now absent) | disabled_manually | No | No |
| `.github/workflows/review-publish.yml` (id 334402508) | — | deleted (file gone from main) | — | — |
| `.github/workflows/daily-pipeline.yml` V1 (id 318159622) | — | deleted | — | — |
| `fetch-underscore-track.yml`, `build-asset-library.yml`, `tts-probe.yml` | — | deleted | — | — |
| `.github/workflows-deprecated/daily-pipeline.deprecated.yml` | workflow_dispatch only; cron removed | not loaded (outside `.github/workflows`) | publish job `if: false` | — |
| `.github/workflows-deprecated/review-publish.deprecated.yml` | workflow_dispatch only; push trigger removed | not loaded | job `if: false` | — |

`gh workflow list --all` shows only "Daily Pipeline — Optimized v2" as active. One deviation
from the spec: the file is named `daily-pipeline-v2.yml`, not `daily-render.yml`. Renaming it
would create a new workflow id and gains nothing.

**Schedules outside `.github/workflows/`:** none other than the V1 file's cron, which was
removed earlier. A search of every *.yml / *.yaml found only daily-pipeline-v2's cron.

**Claude-side schedulers:** this session has no crons. The account has five routines, all
disabled, one-time and already fired: four cutout or QA-run checks from 2026-09-23..30. None
can fire.

**Uploaders in code:** `src/skills/youtube-publish/run.js` (live) and
`scripts/youtube-upload.cjs` (V1 only). Both now refuse any channel outside 1, 2, 9, 26, 44,
48. Both hardcode `privacyStatus: "private"`.

### What the audit found and fixed

1. **Development branches uploaded.** v2 had been dispatched 135 times on
   `claude/visual-rebuild-from-5f91e75`, and 5 times on `claude/variety-sfx-specificity`.
   Its publish steps never checked the branch. That branch's own publish queue records 3
   private ch-48 uploads: `knusFXg2nKU` (Oct 1), `yTU7ROhYZUA` (Oct 2) and `OXgzeVBUZNE`
   (Oct 3). All 3 are queued cancelled, so they stay private. Development-branch output is
   the most likely source of "output from old pipelines". Fixed on main: every publish step
   and the review-publish job now require `github.ref == 'refs/heads/main'`.
2. **review-publish.deprecated.yml** still had a `push` trigger. It is removed.
3. **V1's publish job** could run if the file were ever restored. It is now `if: false`.
4. **`youtube-upload.cjs`** had no channel allow-list. It has one now.

### Branches

| Branch | Last commit | vs main | Workflows on it | Action |
|---|---|---|---|---|
| `claude/render-preview-video-az9hd3` | 2026-08-31 | 0 ahead | V1 (cron + dispatch, uploads), review-publish (push) | **deleted** (stale > 30 days). Local backup: `backup/claude/render-preview-video-az9hd3` |
| `claude/render-short-qngorq` | 2026-09-03 00:29 | **2 ahead** | same | **deleted** (stale). Local backup keeps its 2 unmerged commits: `backup/claude/render-short-qngorq` (1331a38) |
| `claude/fix-provider-secret-mapping` | 2026-09-09 | 12 ahead | V1, review-publish | kept (< 30 days) |
| `claude/render-reliability-fixes` | 2026-09-17 | 2 ahead | old v2, V1, review-publish | kept (< 30 days) |
| `claude/visual-pipeline-qa-loop-ebqcuy` | 2026-09-24 | 0 ahead | old v2, V1, review-publish | kept (< 30 days) |
| `claude/variety-sfx-specificity` | 2026-10-03 | 0 ahead | old v2, review-publish | kept (< 30 days) |
| `claude/visual-rebuild-from-5f91e75` | 2026-10-03 | 0 ahead | old v2, V1, review-publish | kept (the spec says so) |

**Remaining risk, not fixable from main:** the five kept branches hold **old** copies of
`daily-pipeline-v2.yml`, without the main-only gate. A manual
`gh workflow run daily-pipeline-v2.yml --ref <that branch>` would still run that branch's
copy and could upload approved renders privately. A schedule never fires off the default
branch, the push triggers on those branches belong to disabled or deleted workflows, and
nothing dispatches automatically. So this needs a deliberate manual dispatch. Ways to close
it, which are your call:
- Delete the three branches that are 0 commits ahead, since they are fully merged:
  visual-pipeline-qa-loop, variety-sfx-specificity, and visual-rebuild if you no longer
  need it as a reference.
- Or move the CHANNEL_* secrets into a GitHub Environment restricted to `main`. That closes
  it for every branch, including future ones.

**Branch protection on main:** none. `branches/main/protection` returns 404 "Branch not
protected", and there are no rulesets. The repo is **public**, and
`lumeierecollection-blip` is the only collaborator. Fork pull requests can't read secrets,
and no workflow uses `pull_request_target`, so only the owner (and the workflows'
GITHUB_TOKEN) can push to main. Protection that blocks direct pushes would also block the
pipeline's own topic-log and publish-queue pushes, so I did not add any.

**Workflow runs:** the 93 failed runs older than 30 days were deleted.

### Publish path (B)

- **Manual only.** The `review-publish` job in `daily-pipeline-v2.yml` runs only when
  `github.event_name == 'workflow_dispatch' && inputs.publish == 'true' && github.ref == main`.
  A cron run never meets that condition. This run showed it `skipped`.
- **Six channels only.** `PUBLISH_CHANNELS = [1, 2, 9, 26, 44, 48]` is hardcoded in the job,
  in `run.js` and in `youtube-upload.cjs`. Checked locally:
  `run.js 5 --dry-run` exits 1 with "not a publish channel".
- **Private only.** Uploads use `privacyStatus: "private"`. Review uploads are queued
  `cancelled`, so they are never flipped public automatically.
- **One public path remains, by design.** The daily job's `process-queue` step flips
  **approved/** uploads public after the channel's `publish_delay_hours`. This is CLAUDE.md's
  hard rule "private first, then auto-public after the channel's configured delay", so I
  left it. If "no public path" means that too, it is a one-line change, but it reverses a
  CLAUDE.md rule, so the decision is yours.
- **⚠ One upload is due to go public.** The ch-2 video `XrYfQCWRskc` ("Are License Plate
  Reader Database Searches a Fourth…") came from main run 37117571148, earlier today. It is
  private and NOT cancelled, and its go-public time (2026-10-03 12:01 UTC) has passed. The
  next daily render job that reaches `process-queue` will make it public. To keep it
  private: `node src/skills/youtube-publish/run.js cancel 2 XrYfQCWRskc`, then commit
  `data/publish-queue/2/publish-queue.json`. Not done here, because it is your call.
- **How to use it:**
  `gh workflow run daily-pipeline-v2.yml --ref main -f publish=true -f review_run_id=<run> -f channels=<ids>`.
  The review queue artifact lasts 14 days. The SEO and thumbnail artifact lasts 1 day; after
  that the upload uses the channel's fallback title.
- **Not exercised.** This run had no approved-review video, so the path's download and
  upload steps were not run in CI.

## Failures and next fixes, most severe first

1. **Recombined claims (hard-rule risk).** Gemini builds sentences whose tokens all trace to
   research, but whose claims do not; see ch-2 and ch-9 above. Needs a claim-level check, for
   example a second Gemini pass that verifies each sentence against key_facts, before any of
   these scripts is uploaded.
2. **Scripts too short.** Gemini writes 75–82 words against an 86 floor; ch-26's prep failed
   on it. Fix: replace the per-beat "≤" caps in `prompts/write-script.md` with ranges
   ("SETUP 30–35 words"), or make fit-short-style padding impossible and just state "aim for
   100".
3. **NUMBER-FULL coverage at 59.1–59.2%.** ch-2 hit it this run and ch-26 (58.9%) last run.
   The same composition fails twice, and it is the only canvas failure left. It needs a
   look at a rendered NUMBER-FULL frame; the cause is likely the 96–104 px non-hero headline
   tier.
4. **Voice rules vs. the narrative's setup question.** A setup must end on a question, but a
   question of more than 8 words that names nothing fails voice (ch-48). The same goes for
   "Except …" re-hook lines (ch-1, ch-48). Either the turn-line exemption should cover the
   setup's last line and the re-hook, or the prompt should say the question must name
   something.
5. **ch-9 wrong-person photo.** The person-identity check caught it, so this is the safety
   working, not a leak.
6. **The self-heal job failed.** It wrote `blocked-tts.txt`, a misdiagnosis, since no TTS
   failed. It pushed nothing.
7. **Unexplained headline size.** One ch-9 render attempt logged a 240 px headline on beat 1;
   the spec range is 80–140. The final attempt logged 96. Worth a look with the frame.
