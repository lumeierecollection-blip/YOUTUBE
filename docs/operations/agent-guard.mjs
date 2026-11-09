#!/usr/bin/env node
/**
 * Usage control for subagents: explicit model, three active at most, one Opus at a time, no Fable,
 * no duplicate assignment. Wired to PreToolUse, PostToolUse and PostToolUseFailure on Agent, and to
 * SubagentStop. The routing plugin only adds a reminder to each prompt; this is what enforces it.
 *
 * Ledger entries expire after TTL_HOURS, because an agent stopped by an API error may never report
 * a stop. Delete ~/.claude/agent-guard/ledger.json to reset it by hand.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const LEDGER = join(homedir(), ".claude", "agent-guard", "ledger.json");
const MAX_ACTIVE = 3, MAX_OPUS = 1, TTL_HOURS = 2.5;
// These run on a fixed, cheap model defined by the harness, so they need no explicit model.
const FIXED_MODEL_TYPES = new Set(["web-fetch", "claude-code-guide", "statusline-setup"]);

const load = () => { try { return JSON.parse(readFileSync(LEDGER, "utf8")); } catch { return { active: [], log: [] }; } };
const save = (l) => { mkdirSync(dirname(LEDGER), { recursive: true }); writeFileSync(LEDGER, JSON.stringify(l, null, 1)); };
const fresh = (l) => { l.active = l.active.filter((e) => Date.now() - e.at < TTL_HOURS * 3600e3); return l; };
const deny = (reason, l, input) => {
  l.log.push({ at: new Date().toISOString(), decision: "deny", reason, description: input.description, model: input.model });
  save(l);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `agent-guard: ${reason}` } }));
  process.exit(0);
};

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const ev = JSON.parse(raw || "{}");
const l = fresh(load());

if (ev.hook_event_name === "SubagentStop") {
  l.active = l.active.filter((e) => e.agent_id !== ev.agent_id);
  save(l);
} else if (ev.hook_event_name === "PostToolUse") {
  const id = (JSON.stringify(ev.tool_response || "").match(/agentId:?\\?"?\s*:?\s*\\?"?([a-z0-9]{10,})/i) || [])[1];
  const entry = l.active.find((e) => e.tool_use_id === ev.tool_use_id);
  if (entry && id) entry.agent_id = id;
  else if (entry && !/async agent launched/i.test(JSON.stringify(ev.tool_response || ""))) l.active = l.active.filter((e) => e !== entry); // ran in the foreground and has finished
  save(l);
} else if (ev.hook_event_name === "PostToolUseFailure") {
  l.active = l.active.filter((e) => e.tool_use_id !== ev.tool_use_id);
  save(l);
} else if (ev.hook_event_name === "PreToolUse") {
  const input = ev.tool_input || {}, type = input.subagent_type || "general-purpose";
  if (!FIXED_MODEL_TYPES.has(type)) {
    if (type === "fork") deny("fork inherits the expensive parent model; use a named tier", l, input);
    if (!input.model) deny("set model explicitly: haiku for research, sonnet for implementation, opus for documented escalations", l, input);
    if (input.model === "fable") deny("fable is not permitted under the routing policy", l, input);
    if (input.model === "opus" && !/Escalation reason:/i.test(input.prompt || "")) deny('opus requires an "Escalation reason:" line with the evidence in the prompt', l, input);
    if (input.model === "opus" && l.active.filter((e) => e.model === "opus").length >= MAX_OPUS) deny("only one Opus task may be active", l, input);
    if (l.active.length >= MAX_ACTIVE) deny(`${l.active.length} agents are active; the limit is ${MAX_ACTIVE}. Wait for one to finish`, l, input);
    if (l.active.some((e) => e.description === input.description)) deny(`"${input.description}" is already active`, l, input);
    l.active.push({ tool_use_id: ev.tool_use_id, model: input.model, description: input.description, at: Date.now() });
    l.log.push({ at: new Date().toISOString(), decision: "allow", description: input.description, model: input.model });
    save(l);
  }
}
if (!existsSync(LEDGER)) save(l);
