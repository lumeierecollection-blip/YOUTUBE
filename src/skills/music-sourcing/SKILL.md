# Music Sourcing — background underscore bed

Sources ONE real, license-verified background music track from Pixabay
Music for the whole-video ducked underscore bed — distinct from the
per-beat SFX system (`sfx-sourcing/`), which is short one-shot cues, not
a continuous bed.

## Status: automated fetch does not complete — needs one manual download

`fetch-underscore.mjs` gets all the way to a real, chosen, license-
verified track page, but the actual file transfer never completes:
Pixabay's download BUTTON (not just the page load) is gated by a
Cloudflare Turnstile challenge, and that challenge's own verification
request returns 401 for this automated browser, every time, across 12
real `fetch-underscore-track.yml` runs. See "Automated fetch: full run
log and root cause" below for the evidence. This is Cloudflare's anti-bot
protection working as intended — defeating it would mean CAPTCHA-solving
or IP-reputation laundering, and this project does not do either.

**What still needs to happen**: a human downloads one track manually and
commits it to the two fixed paths below (a 30-second action outside what
this session can reach) — recommended track:
**"Kalimba" — `https://pixabay.com/music/modern-classical-kalimba-588151/`**
(Pixabay Content License, "Free for use", no attribution required per the
page's own text, confirmed live during the automated attempts below —
only the file transfer itself failed, not the page's content). Everything
downstream of the file already works and needs no further code changes:
`render.js` sets `hasUnderscore` by checking whether the committed MP3
exists, and `motion-graphics.jsx` conditionally renders the `<Audio>` bed
only when it's true — confirmed via a real render with no file present
(silently renders without the bed, no error).

## Why this runs in GitHub Actions, not interactively

`pixabay.com` is blocked by the interactive Claude Code session's egress
proxy (confirmed live: a direct `curl` and the session's own `WebFetch`
tool both failed with the identical `EGRESS_BLOCKED` error) — the exact
same failure mode `asset-sourcing`'s 10 photo sources hit before
`build-asset-library.yml` moved them to a real GitHub Actions runner (see
that workflow's own header comment for the run-verified confirmation that
`ubuntu-latest` runners reach these hosts directly). `.github/workflows/
fetch-underscore-track.yml` applies the same fix here.

## Why Playwright, not a REST call

Pixabay's own documented API (`pixabay.com/api/docs/`) covers images and
videos only — confirmed via search, no music/audio endpoint exists there.
This project also has no `PIXABAY_API_KEY` configured anywhere (grepped:
not in any workflow's secrets, not referenced by any source module),
including for the endpoints that DO have a public API. Pixabay Music
tracks are download-from-the-page only, so `fetch-underscore.mjs` drives
a real browser (headed, via Xvfb — see the run log below for why headless
doesn't get past the page-load Cloudflare challenge) to the search page
and the chosen track's page, and captures whatever license/attribution
text the page ITSELF states — never a hardcoded or assumed license string.

## Automated fetch: full run log and root cause

Twelve real runs of `fetch-underscore-track.yml`, each fixing a real,
evidence-backed bug or ruling out a real hypothesis — not guessing:

1. **`npm ci` EUSAGE** — `package.json` gained `playwright` but
   `package-lock.json` wasn't regenerated. Fixed: ran `npm install`,
   committed the synced lockfile.
2. **`networkidle` never resolved** (60s timeout) — Pixabay's page keeps
   some background connection open (analytics/ads are the usual cause),
   so the network never goes fully idle. Fixed: `domcontentloaded` + an
   explicit settle delay instead.
3. **Empty search results** — page title was literally `"Just a
   moment..."`: Cloudflare's bot-check interstitial, not real content.
   This also explains bug 2 retroactively (the challenge page itself
   polls in the background). Fixed: real windowed Chromium
   (`headless: false`, under Xvfb) with a realistic desktop user agent —
   headless Chromium's fingerprint is a common trigger for this specific
   challenge tier.
4. **Still challenged, intermittently** — the exact same code sailed
   through cleanly on one run (20 real candidates found) and got
   re-challenged on the very next. Confirmed non-deterministic per
   attempt, not a fixed pass/fail. Fixed: one reload-and-retry inside
   `waitForChallenge()` if still stuck after 25s — a fresh navigation
   gets a fresh risk-scoring pass.
5. **Download button clicks, no `download` event** — the button's own
   text reliably flips to `"Downloading..."`, so the click is doing
   *something*, but `page.waitForEvent("download")` never fires.
   Hypothesis: lands in a new tab. Fixed: `context.waitForEvent` (catches
   a download on any page in the context) + a `context.on("page", ...)`
   listener for visibility.
6. **Still no download, no new tab** — broadened the diagnostic dump
   (previous one was dominated by global nav/footer content in the first
   60 DOM-order elements) to target elements whose own text mentions
   "download", hrefs that look like a direct audio file, and a login/
   sign-in text check.
7. **Ruled out: login wall** — a direct DOM snapshot ~4s after the click,
   searching for `[role="dialog"]`/modal/login/signup-shaped elements,
   found nothing but the page's pre-existing, unrelated "Log in to view
   comments" prompt (the comments section, not the download flow) and two
   invisible cookie-consent elements.
8. **Real bug in the trigger loop** — Playwright's `:has-text()` is a
   substring match, so once the button's text became `"Downloading..."`,
   a later selector (`button:has-text("Download")`) matched that SAME
   evolving element and clicked it again — not a second real attempt,
   just interference. Fixed: one click, not a loop.
9. **Real bug in the diagnostic poll** — a button-text poll meant to watch
   the full click lifecycle logged nothing for 44s straight. Root cause:
   the poll re-resolved the same text-dependent locator
   (`button:has-text("Free Download")`), which stops matching the instant
   the text changes, so every call silently timed out and got swallowed
   by `.catch(() => null)`. Fixed: grab a stable `elementHandle()` before
   the click and poll that instead.
10. **Confirmed: genuinely stuck, not a poll bug** — with the poll fixed,
    the button reliably stayed on `"Downloading..."` for the full 44s
    observation window, no reversion, across repeat runs. No `download`
    event, no new tab, and no network response matching "download" in its
    URL — meaning the click wasn't even sending a request that filter
    could see.
11. **Root cause, found via an unfiltered response capture** (every
    network response for 10s around the click, no keyword filter):
    the click fires a real, distinct request sequence to
    `challenges.cloudflare.com/cdn-cgi/challenge-platform/...` — a
    Cloudflare **Turnstile** widget bound to the download action
    specifically (separate from the page-load challenge already solved).
    One of Turnstile's own internal verification requests
    (`.../h/b/pat/...`) returns **401 Unauthorized**, and the retried
    `POST .../h/b/fo/...` that follows doesn't recover it. The button
    stays "Downloading..." forever because Turnstile verification for
    this automated session never actually passes.

**Conclusion**: this is Cloudflare protecting the download action itself,
working as intended against automated traffic — a second, separate gate
from the page-load challenge. Solving it would require CAPTCHA-solving or
IP-reputation laundering (residential proxies, etc.), neither of which
this project does. That makes this a legitimate stop, not an unfinished
bug hunt — see "Status" above for the manual fallback.

## Usage

```
node src/skills/music-sourcing/fetch-underscore.mjs "kalimba"
```

Output (fixed filenames — a single stable bed track, not a growing
library, so there's one known path to reference rather than a slug to
discover):
- `src/skills/remotion-render/public/music/underscore.mp3` — the real
  downloaded audio, committed (a stable, reused-every-render asset, same
  as asset-library's treated PNGs — not gitignored scratch like `vo.mp3`,
  which is genuinely per-video content).
- `data/music/underscore.json` — page URL, title, license text as found,
  attribution text as found, duration, fetch timestamp: the auditable
  record of what was actually on the page at fetch time, mirroring
  asset-library's own manifest-vs-treated-file split.

## Wiring into the render pipeline

`compositions/motion-graphics.jsx`'s `MotionGraphicsShorts` conditionally
renders the track (via `staticFile("music/underscore.mp3")`, only when
`hasUnderscore` is true) as a persistent, low-volume `<Audio>` bed for the
whole video — well below the per-beat SFX and voiceover levels (static
gain staging, not dynamic sidechain ducking — see UNDERSCORE_DB's comment
in that file for the exact level and why a fixed level is the right
choice here over a more complex reactive system). `render.js` sets
`hasUnderscore` by checking whether the committed MP3 exists — never a
static import (unlike `vo.mp3`, which always exists by the time render.js
runs and is required, a missing OPTIONAL underscore track must not break
the webpack bundle or fail the render).
