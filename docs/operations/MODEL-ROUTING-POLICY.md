# Model routing and usage control

## What actually enforces routing

The `model-routing` plugin (v1.0.2, `uliandim/claude-model-routing`) is a skill plus a
`UserPromptSubmit` hook that adds a reminder to each prompt. It does not choose or restrict a
model, and it does not touch subagents. A subagent with no `model` inherits the session's model,
which is why the first nine agents all ran on Opus.

Enforcement is a deterministic guard, `.claude/hooks/agent-guard.mjs` (a local file on the owner's
PC, wired in `.claude/settings.local.json`; a copy is kept at `docs/operations/agent-guard.mjs`).
It runs on PreToolUse, PostToolUse and PostToolUseFailure for the Agent tool, and on SubagentStop.

| Rule | Behaviour |
|---|---|
| Explicit model required | A spawn with no `model` is refused |
| Fable | Refused |
| `fork` | Refused, because it inherits the parent's model |
| Opus | Needs an `Escalation reason:` line in the prompt; one Opus task at a time |
| Concurrency | Three active agents at most |
| Duplicates | A description already active is refused |

Ledger: `~/.claude/agent-guard/ledger.json`. Entries expire after 2.5 hours, because an agent killed
by an API error may never report a stop.

## Tiers

| Tier | Model | Work |
|---|---|---|
| 1 | Haiku | Inspection, research, licence checks, inventories, routine summaries |
| 2 | Sonnet | Scripts, channel implementation, ordinary coding, tests, ordinary debugging |
| 3 | Opus | Architecture, cross-channel failures, security decisions, hard debugging, final review |

Escalate with a short evidence package, never a repository dump. After an Opus decision, routine
work returns to Sonnet or Haiku. Agents have no way to spawn their own agents under this guard
without passing through it.

## Verification (2026-11-09)

Each result was read from that agent's own transcript (`~/.claude/projects/.../agent-<id>.jsonl`): the `params.model` of its API requests and the `message.model` of its responses. The agents also reported the same IDs.

| Test | Requested | Actual |
|---|---|---|
| No model given | none | Refused by the guard before launch |
| Tier 1 | haiku | `claude-haiku-5-5` |
| Tier 2 | sonnet | `claude-sonnet-5-5` |
| Tier 3 | opus, with reason | `claude-opus-5-5` |

Pipe tests also confirmed refusal of Fable, Opus without a reason, a second Opus, a duplicate
description and a fourth agent.

## Known limitations

- The guard governs the Agent tool. It cannot change the model of the main session, which the owner
  selects. Main-session work stays on orchestration and review.
- The owner's `~/.claude/settings.json` sets the default model to `claude-fable-5`, the most
  expensive tier. It was left alone because it is the owner's personal setting. This session runs on
  Opus; a new session may start on Fable unless that is changed with `/model`.
- The guard lives in local settings and applies to sessions started in this project on this PC.
- Every spawned agent starts with about 46,000 tokens of system context before any work (measured in
  the tests above), so spawning is not free even for a small task. Prefer fewer, well-scoped agents.
- A resumed agent keeps its original model. The nine stopped agents ran on Opus, so their unfinished
  work is reassigned to new Sonnet agents instead of being resumed.
