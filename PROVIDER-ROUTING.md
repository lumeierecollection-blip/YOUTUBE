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

### Credentials decide which entries are actually in the chain

`opencode-agent.js` drops a model whose provider has no credential set, before
spending any attempt on it, and prints what it skipped. Without that, a chain
whose first four keys are unset looks exactly like one that got its first
choice: it succeeds, on its last entry, silently. For the reasoning stage that
is the difference between a 4-level effort control and a bare toggle.

OpenCode Zen is deliberately exempt. With no key it keeps only the models
priced at 0 and authenticates them with a literal `"public"` key:

```ts
      if (!ok) {
        for (const [key, value] of Object.entries(input.models)) {
          if (value.cost.input === 0) continue
          delete input.models[key]
        }
      }

      return {
        autoload: Object.keys(input.models).length > 0,
        options: ok ? {} : { apiKey: "public" },
      }
```

— `packages/opencode/src/provider/provider.ts`, sst/opencode @ `d8eb3b8`.

That is not a curiosity, it is how this pipeline has been running. The switch
to Zen free models landed 2026-08-31 00:26 UTC in `cea3b45` with no
`OPENCODE_API_KEY` added, and three topic runs succeeded after it the same day.
So the chain always has a working last resort, and the skip rule must never
remove it.

The rule fails open: a provider not in the table is never skipped, so being
wrong about an env var name cannot silently shorten the chain.

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

**Throughput could not be ranked, and the search for it is exhausted rather
than untried.** What was checked:

| Source | Result |
|---|---|
| `mistral.ai`, `docs.mistral.ai`, `help.mistral.ai` | `EGRESS_BLOCKED` |
| `inference-docs.cerebras.ai`, `console.groq.com` | `EGRESS_BLOCKED` |
| `models.dev`, `opencode.ai` | `EGRESS_BLOCKED` |
| models.dev database (via GitHub) | no `tps`/`throughput`/`tokens_per_second`/`speed` field on any provider |
| `mistralai/platform-docs-public` (via GitHub) | reachable, carries no throughput figure |
| `groq/groq-api-cookbook` (via GitHub) | reachable, no tokens-per-second figure in its markdown |
| `Cerebras/inference-docs` | no such public repository |

Provider throughput claims live on the rendered marketing and docs pages, all
of which are blocked; SDK and cookbook repositories do not carry them. So the
"fastest" half of "fastest/cheapest" is unresolved, and the list is ordered on
verified price alone. Do not fill that gap from memory — the Mistral case in §4
is what happens when a plausible remembered number meets its primary source.

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

## 4. Mistral free-tier limits — Mistral does not publish them

The task called for the exact current free-tier limit quoted from Mistral's own
page. `mistral.ai`, `docs.mistral.ai` and `help.mistral.ai` are all refused by
this environment's egress proxy, so the rendered page could not be opened. But
`github.com/mistralai/platform-docs-public` — the source docs.mistral.ai is
built from — is reachable, and reading it settles the question better than the
rendered page would have.

**There is no number to quote. Mistral does not publish one.**

`public/admin/user-management-finops/tier.md`, at commit
`54bf814a14e01a96852418c2207071027ce7200a`, names the three limit types:

> We enforce three types of limits:
>
> - **Requests per second (RPS)**: the maximum number of concurrent API requests.
> - **Tokens per minute**: throughput limit for token processing (input and output tokens combined).
> - **Tokens per month**: overall consumption cap.

and describes the free tier without a single figure:

> Free mode is enabled by default with limited rate limits, intended for
> **evaluation and prototyping**. To increase your limits, upgrade to a **Scale**
> plan.

Its tier table says the same:

> | $0 / €0 (Free mode) | Free | Limited rate limits for evaluation and prototyping |

The values are per-account and live behind authentication. Both that page and
`src/content/en/docs/admin/billing-usage/usage-limits/page.mdx` send you to your
own console for them:

> Visit Limits to see the current rate limits and usage tier for your Workspace.
> — `https://admin.mistral.ai/plateforme/limits`

A grep of the whole English documentation tree for any numeric rate limit
(`requests per second|minute`, `tokens per minute|month`, `RPS`, `TPM` preceded
by digits) returns nothing.

**So the widely-repeated "1 request/second, 500,000 tokens/minute, 1 billion
tokens/month" figures do not come from Mistral's documentation.** A web search
returns them confidently, which is exactly why a search engine's synthesis was
not admissible here: they trace to third-party aggregators or to someone's
console, not to a page Mistral publishes. Nothing in this repo should be tuned
to them.

The operational consequence is the one this repo already lives with for
Cerebras: a provider's real quota is discovered at runtime from its error
responses, not read off a doc page in advance. The failover chain and the
capped search budget are the right shape for that, and stay as they are.

Mistral's pricing is a separate question from its rate limits, and is quoted in
§2 above from models.dev. That is still an aggregator rather than Mistral's own
page: this docs repository carries no pricing figures either — `src/content/en/
docs/inference/pricing/` contains only a `_meta.md`, so the pricing page is
generated outside it.
