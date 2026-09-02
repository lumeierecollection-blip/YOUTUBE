/**
 * Shared fetch helper for the asset-sourcing skill's source modules.
 *
 * Every source module is a real, working API client — but this whole skill
 * is meant to run in CI (daily-pipeline.yml's asset-library build job) or
 * any environment with open egress to these hosts, NOT inside a sandboxed
 * interactive dev session with a restrictive egress allowlist. That
 * limitation is real and is documented in this skill's SKILL.md — it was
 * hit directly while building this: commons.wikimedia.org and
 * huggingface.co were both denied by this session's org egress policy
 * (confirmed via /root/.ccr/README.md's proxy status endpoint), while
 * pypi.org, files.pythonhosted.org, and github.com were allowed. A source
 * module failing here with a network/policy error is not evidence the
 * module is broken; the source modules are exercised by unit-testable pure
 * functions (parseXResponse) instead of live network calls.
 */
const USER_AGENT = "youtube-automation-asset-sourcing/1.0 (offline library build; contact via repo)";

export async function fetchJson(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function downloadFile(url, destPath, { headers = {}, timeoutMs = 30000 } = {}) {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} downloading ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, buf);
    return { bytes: buf.length };
  } finally {
    clearTimeout(t);
  }
}
