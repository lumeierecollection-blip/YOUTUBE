# Provider routing — what was verified, and what could not be

Two-stage, five-provider routing for the pipeline's model calls. Every number
below is quoted from a file that was actually opened; where a figure could not
be sourced in this environment, this file says so instead of supplying one.

## 1. OpenCode cannot express a fallback list. Our runner can.

OpenCode's published config schema has exactly one model field, and it is a
single string:

```
Config.model = {
  "type": "string"
}
```

— `packages/sdk/openapi.json`, `components.schemas.Config.properties.model`,
in `sst/opencode` at commit `d8eb3b80fb1bd8235809d78b62474008fb7a2e46`
(<https://github.com/sst/opencode/blob/d8eb3b8/packages/sdk/openapi.json>).

The same schema's top-level keys contain no fallback, retry, failover, or
backup key:

```
$schema, shell, logLevel, server, command, skills, references, reference,
watcher, snapshot, plugin, share, autoshare, autoupdate, disabled_providers,
enabled_providers, model, small_model, default_agent, subagent_depth,
username, mode, agent, provider, mcp, formatter, lsp, instructions, layout,
permission, tools, attachment, enterprise, tool_output, compaction, experimental
```

The prose docs agree. `packages/web/src/content/docs/models.mdx` at the same
commit says, under "Set a default":

> To set one of these as the default model, you can set the `model` key in your
> OpenCode config.
>
> ```json title="opencode.json" {3}
> {
>   "$schema": "https://opencode.ai/config.json",
>   "model": "lmstudio/google/gemma-3n-e4b"
> }
> ```
>
> Here the full ID is `provider_id/model_id`.

and under "Loading models":

> 2. The model list in the OpenCode config.
>    ```json title="opencode.json"
>    {
>      "$schema": "https://opencode.ai/config.json",
>      "model": "anthropic/claude-sonnet-4-20250514"
>    }
>    ```
>    The format here is `provider/model`.

Searching the English docs for `fallback` returns two hits, neither of which is
a model-fallback feature: an OpenRouter provider option (`"allow_fallbacks":
false`, `providers.mdx:1891`) and a note about Claude Code file conventions
(`rules.mdx:79`). `retry`, `failover`, `multiple models`, and `list of models`
return nothing in `models.mdx`, `config.mdx`, or `agents.mdx`.

**So: a five-provider fallback written as OpenCode config is not valid, and
config that looked like it would be would silently be one string.** The chain
is ours instead, in `scripts/opencode-agent.js`:

```js
const models = String(modelArg).split(",").map((m) => m.trim()).filter(Boolean);
...
for (const model of models) {
```

That is unbounded — five entries is no different from two. Proven, not
assumed, by `scripts/verify-failover-chain.mjs`, which stubs the `opencode`
binary and asserts all five are attempted in order with their full retry
budget.

**`opencode.ai` itself is refused by this environment's egress proxy**
(`EGRESS_BLOCKED`), so the rendered docs page was not read. The quotes above
are from the docs' own source files in the repository the site is built from,
at a pinned commit.

## 2. Ranking the five providers — price only, and why

Source: the models.dev database OpenCode itself reads, `sst/models.dev` at
commit `3daf906b1190e761f44c65248e0505e9b248498b`, files
`providers/<provider>/models/<model>.toml`. Costs are that file's `[cost]`
block, in USD per million tokens.

| Stage-A/B candidate | input | output | `tool_call` |
|---|---|---|---|
| `opencode/mimo-v2.5-free` | 0.00 | 0.00 | `true` |
| `mistral/ministral-3b-latest` | 0.04 | 0.04 | `true` |
| `groq/llama-3.1-8b-instant` | 0.05 | 0.08 | `true` |
| `google/gemini-2.5-flash-lite` | 0.10 | 0.40 | `true` |
| `cerebras/gpt-oss-120b` | 0.35 | 0.75 | not stated in models.dev; declared locally in `.opencode/opencode.json` |

Cerebras and Groq do **not** come out on top by these numbers. OpenCode Zen's
free tier does — 31 of its 97 priced models are `input = 0, output = 0` — and
the research stage is routed there first, with the other four behind it in
ascending price order.

**Throughput could not be ranked.** models.dev publishes no tokens/sec,
throughput, or speed field for any provider (a grep for `^(tps|throughput|
tokens_per_second|speed) *=` across `providers/` matches no file), and every
provider's own pricing/throughput page is refused by this environment's egress
proxy: `mistral.ai`, `docs.mistral.ai`, `help.mistral.ai`,
`inference-docs.cerebras.ai`, `console.groq.com`, `models.dev`, and
`opencode.ai` all return `EGRESS_BLOCKED`. So the "fastest" half of
"fastest/cheapest" is unresolved, and the list is ordered on verified price
alone. Do not fill that gap from memory.

## 3. Extended-reasoning support, per provider

Each row is quoted from that provider's own models.dev TOML at the commit
above. models.dev is an aggregator, not the provider's documentation; where its
file cites the provider's page, that citation is reproduced, but those pages
were themselves unreachable here.

| Provider | Exposes a named reasoning control? | Quoted line | File |
|---|---|---|---|
| Cerebras | Yes — effort, 3 levels | `reasoning_options = [{ type = "effort", values = ["low", "medium", "high"] }]`, above it: `# reasoning_effort = "low"\|"medium"\|"high"; default is "medium".` citing `https://inference-docs.cerebras.ai/capabilities/reasoning#gpt-oss-reasoning-effort` | `providers/cerebras/models/gpt-oss-120b.toml` |
| Groq | Yes — effort, 3 levels | `reasoning_options = [{ type = "effort", values = ["low", "medium", "high"] }]`, above it: `# JSON reasoning_effort: "low" \| "medium" \| "high".` citing `https://console.groq.com/docs/reasoning#options-for-reasoning-effort-gptoss` | `providers/groq/models/openai/gpt-oss-120b.toml` |
| Mistral | Yes — effort, 2 levels | `[[reasoning_options]]` / `type = "effort"` / `values = ["none", "high"]` | `providers/mistral/models/mistral-medium-latest.toml` |
| Google | Yes — effort, 4 levels | `[[reasoning_options]]` / `type = "effort"` / `values = ["minimal", "low", "medium", "high"]` | `providers/google/models/gemini-3.5-flash-lite.toml` |
| OpenCode Zen | Toggle only, and undocumented upstream | `reasoning_options = [{ type = "toggle" }]`; and `provider.toml`: `# Zen does not document reasoning request fields, values, bounds, translation, or passthrough; upstream-native formats are not independently guaranteed by this endpoint table.` | `providers/opencode/models/glm-5-free.toml`, `providers/opencode/provider.toml` |

Two distinctions worth keeping straight, because both are easy to overstate:

- `reasoning = true` is not a reasoning *control*. Mistral's Magistral models
  carry `reasoning = true` with `reasoning_options = []` — a reasoning model
  with no tunable parameter. The rows above deliberately cite models that
  expose a control, not models that merely reason.
- The two models the workflow used before this change,
  `opencode/mimo-v2.5-free` and `opencode/nemotron-3.5-lightning-free`, both
  carry `reasoning_options = []`. The reasoning stage previously had no
  reasoning control available on its first two providers at all.

## 4. Mistral free-tier limits — NOT VERIFIED

The task called for the exact current free-tier limit quoted from Mistral's own
page. That page could not be opened here: `mistral.ai`, `docs.mistral.ai`, and
`help.mistral.ai` are all refused by the egress proxy (`EGRESS_BLOCKED` via
WebFetch, `CONNECT tunnel failed, response 403` via curl). A web search returned
figures, but a search engine's synthesis of a page is not a line quoted from
that page, so no number is recorded here. **This is an open gap**, not a
resolved item; it needs re-checking from an environment that can reach
`docs.mistral.ai`.

Mistral is still in both chains — its *pricing* is quoted above from
models.dev, which is a separate question from its free-tier rate limits — but
nothing in this repo should be tuned to an assumed Mistral free-tier quota
until that page is actually read.
