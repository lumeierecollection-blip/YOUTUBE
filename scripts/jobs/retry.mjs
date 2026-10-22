/**
 * Bounded retry with exponential backoff for TRANSIENT failures only.
 * Every call has a hard cap (`attempts`, default 3, max 6) and a per-wait ceiling (`maxMs`);
 * there is no unbounded loop. A non-transient error is thrown at once (no retry).
 *
 * Use it only for idempotent calls (an OAuth token exchange, a GET). Never wrap a video upload:
 * a retried upload that had actually succeeded would post the video twice.
 */
export const MAX_ATTEMPTS = 6;

/** Network resets, timeouts, HTTP 429 / 5xx. OAuth rejections (invalid_grant ...) are NOT transient. */
export function isTransient(err) {
  const s = `${err?.code || ''} ${err?.status || ''} ${err?.message || err || ''}`;
  if (/\b(invalid_grant|invalid_client|unauthorized_client|deleted_client)\b/.test(s)) return false;
  return /\b(ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|UND_ERR_\w+|fetch failed|socket hang up|timeout|timed out|429|500|502|503|504|backendError|rateLimitExceeded)\b/i.test(s);
}

/** Wait before attempt n+1 (n starts at 1): base * 2^(n-1), capped at maxMs. Deterministic (no jitter) for testability. */
export const backoffMs = (n, { baseMs = 1000, maxMs = 15000 } = {}) => Math.min(maxMs, baseMs * 2 ** (n - 1));

export async function withRetry(fn, { attempts = 3, baseMs = 1000, maxMs = 15000, retryable = isTransient, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onRetry } = {}) {
  const cap = Math.max(1, Math.min(MAX_ATTEMPTS, Math.floor(attempts)));
  let last;
  for (let n = 1; n <= cap; n++) {
    try {
      return await fn(n);
    } catch (e) {
      last = e;
      if (n === cap || !retryable(e)) break;
      const wait = backoffMs(n, { baseMs, maxMs });
      onRetry?.(e, n, wait);
      await sleep(wait);
    }
  }
  throw last;
}
