---
name: youtube-publish
description: Use to upload a finished, rendered video to YouTube for a specific channel. Uploads as private first, then automatically flips to public after the channel's configured review delay unless the user has cancelled it.
---

# YouTube Publish Skill

## Purpose
Upload the finished video + thumbnail to the correct channel's YouTube
account, using that channel's own OAuth credentials, then auto-publish
after a delay so the pipeline runs hands-free while still leaving a
window to catch a bad video before it goes live.

## Process
1. Look up the channel's YouTube API credentials from its config
   (per-channel Google account / GCP project — never share credentials
   across channels).
2. Upload the video via `videos.insert` with `privacyStatus: private`.
3. Attach the thumbnail via `thumbnails.set`.
4. Set title/description from the script's confirmed hook and topic.
5. Log the upload (video ID, channel, scheduled go-public time = now +
   `publish_delay_hours` from channel config) to a publish queue file —
   this is what a separate scheduled job reads to flip videos public.
6. Report the private video link to the user immediately, with the exact
   go-public time, so there's a real window to review it.
7. A separate scheduled step (run on every pipeline cron cycle) checks the
   publish queue: any entry past its go-public time and not marked
   "cancelled" gets `privacyStatus` set to `public` via `videos.update`.

## Rules
- Never reuse one channel's credentials for another channel's upload —
  double-check the channel ID in the config matches the token being used
  before calling the API.
- The go-public step must only ever act on entries already logged in the
  publish queue with a matching channel ID and elapsed delay — never
  publish something outside that queue.
- Provide a simple way to cancel a queued publish (e.g. a `cancelled: true`
  flag in the queue entry, settable via a command or a file edit) — check
  this flag immediately before every publish action, not just at queue
  time.
- If an upload or the later publish step fails, report the failure — don't
  retry with a different channel's credentials as a fallback.
