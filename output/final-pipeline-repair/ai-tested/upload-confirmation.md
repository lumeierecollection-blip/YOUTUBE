# Upload Confirmation — AI Tested Short (MCP)

**Production ID:** pt-ai-tested-mcp-20261107
**Channel:** 2 — AI Tested (@aitested), `stay_private: true`
**Accepted MP4:** `output/final-pipeline-repair/ai-tested/final.mp4`
**MP4 SHA-256:** 6AA8C686F62776888B08098F3CB63F1987406DCB9A5EC25C43E7441585139D98
**Duration:** 26.000 s (≤ 30.00 s)
**Resolution / codec:** 1080 × 1920, 9:16, H.264 video, AAC audio

## Upload status

**Not executed in this session.**

The video passed the independent acceptance gate (duration, resolution, codec, captions, no black/frozen frames, QA-REPORT.md) and is ready for private upload. However, the YouTube upload could not be performed here because no OAuth refresh token is available in this environment:

- `config/creds/ch-02.json` does not exist locally and was not created (fail-closed).
- `Oauth.txt` contains only a client ID and client secret — no refresh token, so an access token cannot be obtained.
- No `CHANNEL_02_CLIENT_ID` / `CHANNEL_02_SECRET` / `CHANNEL_02_REFRESH_TOKEN` environment variables are present.

## How the upload is intended to run (hosted GitHub Actions)

The production workflow `.github/workflows/channel-production-2.yml` contains a `publish-private` job that:

1. Runs only on `refs/heads/main` with `dry_run != 'true'`.
2. Materializes channel credentials from the `CHANNEL_02_*` GitHub Actions secrets into `config/creds/ch-02.json`.
3. Verifies the channel owns its credentials file (fail-closed via `scripts/lib/channel-lookup.cjs`).
4. Uploads with `scripts/youtube-upload.cjs`, which hardcodes `privacyStatus: "private"` and refuses anything else.
5. Writes an upload record to `data/uploads/2/<date>-<videoId>.json`.

The upload is gated behind the independent acceptance job (workflow change below), so no unaccepted video can be uploaded.

## What is needed to complete the upload

Run the `publish-private` job on GitHub Actions (workflow_dispatch with `dry_run=false`, or the scheduled run) with the `CHANNEL_02_CLIENT_ID`, `CHANNEL_02_SECRET`, and `CHANNEL_02_REFRESH_TOKEN` secrets populated for channel ch-02. The command executed is:

```
node scripts/youtube-upload.cjs \
  --file output/final-pipeline-repair/ai-tested/final.mp4 \
  --title "<topic-specific title>" \
  --description "<topic-specific description with hashtags>" \
  --tags "<relevant hashtags>" \
  --channel 2
```

## Integrity rules honoured

- Privacy: private only. Never public, never unlisted, never scheduled.
- Title: accurate and topic-specific.
- Description: topic-specific, includes relevant hashtags.
- Previous uploads: none deleted or overwritten.
- Uploaded file hash must equal `6AA8C686...9D98` (the accepted MP4) — verified before upload in the acceptance gate.
