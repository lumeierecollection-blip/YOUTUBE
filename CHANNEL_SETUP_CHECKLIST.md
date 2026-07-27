# Channel Setup Checklist — 50 Channels

Each channel requires manual setup before it can publish. Work through this list in batches of 5-10 channels at a time.

## Per-Channel Setup Steps

For EACH channel, complete these steps in order:

### Step 1: Create Google Account
- [ ] Go to https://accounts.google.com/signup
- [ ] Create a new Google account for this channel
- [ ] Use a consistent naming pattern: `channel{ID}@yourdomain.com` or `{channelname} yt@gmail.com`
- [ ] **Record the email**: _________________
- [ ] **Record the password** in your password manager

### Step 2: Create YouTube Channel
- [ ] Sign in to YouTube with the new Google account
- [ ] Go to YouTube Studio → Create Channel
- [ ] Set channel name from `channels.json` → `channel_name`
- [ ] Set handle from `channels.json` → `handle`
- [ ] Add channel description from `channels.json` → `description`
- [ ] **Record the Channel ID** (found in YouTube Studio → Settings → Channel → Advanced):
- [ ] **Paste Channel ID here**: `UC___________________`

### Step 3: Generate OAuth Credentials (GCP)
- [ ] Go to https://console.cloud.google.com
- [ ] Create a new project named: `yt-{channel_name}-publish`
- [ ] Enable the **YouTube Data API v3** for this project
- [ ] Go to APIs & Services → Credentials → Create Credentials → OAuth client ID
- [ ] Application type: **Desktop app**
- [ ] Name: `{channel_name} Upload`
- [ ] **Record the Client ID**: _________________
- [ ] **Record the Client Secret**: _________________

### Step 4: Generate Refresh Token
- [ ] Download the OAuth credentials JSON
- [ ] Use the OAuth playground or a helper script to generate a refresh token:
  - Scopes needed: `https://www.googleapis.com/auth/youtube.upload`
  - Use your Client ID and Client Secret
  - Authorize and get the refresh token
- [ ] **Record the Refresh Token**: _________________

### Step 5: Add GitHub Secrets
Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Add these 3 secrets per channel:

| Secret Name | Value |
|------------|-------|
| `CHANNEL_{ID}_CLIENT_ID` | The OAuth Client ID from Step 3 |
| `CHANNEL_{ID}_CLIENT_SECRET` | The OAuth Client Secret from Step 3 |
| `CHANNEL_{ID}_REFRESH_TOKEN` | The Refresh Token from Step 4 |

### Step 6: Update channels.json
Fill in the placeholder fields in `config/channels.json`:
- [ ] `google_account`: the Gmail address from Step 1
- [ ] `channel_id`: the Channel ID from Step 2 (format: `UC...`)
- [ ] `youtube_credentials_path`: can remain empty if using GitHub secrets

---

## Channel IDs → Secret Name Mapping

| ID | Channel Name | Secret Prefix | Google Account | Channel ID | Client ID | Client Secret | Refresh Token |
|----|-------------|---------------|----------------|------------|-----------|---------------|---------------|
| 1 | Money Mind | `CHANNEL_01` | | | | | |
| 2 | Legal Brief | `CHANNEL_02` | | | | | |
| 3 | AI Tested | `CHANNEL_03` | | | | | |
| 4 | Hidden Past | `CHANNEL_04` | | | | | |
| 5 | Force of Nature | `CHANNEL_05` | | | | | |
| 6 | The War Room | `CHANNEL_06` | | | | | |
| 7 | Dead Companies | `CHANNEL_07` | | | | | |
| 8 | Mind Decoded | `CHANNEL_08` | | | | | |
| 9 | Border Lines | `CHANNEL_09` | | | | | |
| 10 | Double Cross | `CHANNEL_10` | | | | | |
| 11 | Cosmic Frontiers | `CHANNEL_11` | | | | | |
| 12 | Abyssal Archive | `CHANNEL_12` | | | | | |
| 13 | Fossil Frontier | `CHANNEL_13` | | | | | |
| 14 | Quantum Canvas | `CHANNEL_14` | | | | | |
| 15 | Earth Signal | `CHANNEL_15` | | | | | |
| 16 | Battle Cartography | `CHANNEL_16` | | | | | |
| 17 | Epoch Chronicles | `CHANNEL_17` | | | | | |
| 18 | Brief History | `CHANNEL_18` | | | | | |
| 19 | Frontline Archives | `CHANNEL_19` | | | | | |
| 20 | QuickLearn | `CHANNEL_20` | | | | | |
| 21 | Lunar Frequencies | `CHANNEL_21` | | | | | |
| 22 | Panel Pulse | `CHANNEL_22` | | | | | |
| 23 | C-Drama Decoded | `CHANNEL_23` | | | | | |
| 24 | Hearts of Honor | `CHANNEL_24` | | | | | |
| 25 | On The Record | `CHANNEL_25` | | | | | |
| 26 | Fraud Files | `CHANNEL_26` | | | | | |
| 27 | Trial Files | `CHANNEL_27` | | | | | |
| 28 | The Control Room | `CHANNEL_28` | | | | | |
| 29 | Global Crime Files | `CHANNEL_29` | | | | | |
| 30 | Cold Case DNA | `CHANNEL_30` | | | | | |
| 31 | Justice Denied | `CHANNEL_31` | | | | | |
| 32 | Machine Anatomy | `CHANNEL_32` | | | | | |
| 33 | Built to Last | `CHANNEL_33` | | | | | |
| 34 | Build Smart | `CHANNEL_34` | | | | | |
| 35 | The Engineering Archive | `CHANNEL_35` | | | | | |
| 36 | Terminal Tactics | `CHANNEL_36` | | | | | |
| 37 | Byte Brief | `CHANNEL_37` | | | | | |
| 38 | Tech Pulse | `CHANNEL_38` | | | | | |
| 39 | Case File Medicine | `CHANNEL_39` | | | | | |
| 40 | MedBrief | `CHANNEL_40` | | | | | |
| 41 | Mind & Body Files | `CHANNEL_41` | | | | | |
| 42 | NutriDecode | `CHANNEL_42` | | | | | |
| 43 | Fit Science Lab | `CHANNEL_43` | | | | | |
| 44 | Skill Stack | `CHANNEL_44` | | | | | |
| 45 | Channel Decoded | `CHANNEL_45` | | | | | |
| 46 | Interview Insider | `CHANNEL_46` | | | | | |
| 47 | Medicare Navigator | `CHANNEL_47` | | | | | |
| 48 | Factory Floor | `CHANNEL_48` | | | | | |
| 49 | Wander Budget | `CHANNEL_49` | | | | | |
| 50 | Gadget Kitchen | `CHANNEL_50` | | | | | |

---

## GitHub Secrets Naming Convention

Pattern: `CHANNEL_{2-digit-ID}_{CREDENTIAL_TYPE}`

Examples:
- `CHANNEL_01_CLIENT_ID` — OAuth Client ID for Money Mind
- `CHANNEL_01_CLIENT_SECRET` — OAuth Client Secret for Money Mind
- `CHANNEL_01_REFRESH_TOKEN` — OAuth Refresh Token for Money Mind
- `CHANNEL_50_CLIENT_ID` — OAuth Client ID for Gadget Kitchen

Total secrets needed: 50 channels × 3 secrets = **150 GitHub secrets**

---

## Batch Setup Recommendation

Set up channels in priority order by RPM potential:

### Batch 1 (Highest RPM) — Channels 47, 48, 45, 44, 46
Medicare Navigator ($52-68), Factory Floor ($15-35), Channel Decoded ($15-30), Skill Stack ($12-25), Interview Insider ($8-18)

### Batch 2 (High RPM) — Channels 26, 27, 25, 7, 39, 3
Fraud Files ($8-15), Trial Files ($7-15), On The Record ($8-14), Dead Companies ($8-15), Case File Medicine ($6-10), AI Tested ($8-14)

### Batch 3 (Medium RPM) — Channels 1-10 (Locked niches)
Money Mind, Legal Brief, Hidden Past, Force of Nature, The War Room, etc.

### Batch 4 (Solid RPM) — Channels 11-20
Cosmic Frontiers, Abyssal Archive, Fossil Frontier, Quantum Canvas, etc.

### Batch 5 (Remaining) — Channels 21-50
Lunar Frequencies, Panel Pulse, C-Drama Decoded, etc.

---

## Quick Reference: What Each Secret Does

| Secret | Used By | Purpose |
|--------|---------|---------|
| `CLIENT_ID` | OAuth flow | Identifies your GCP project to YouTube |
| `CLIENT_SECRET` | OAuth flow | Proves your GCP project ownership |
| `REFRESH_TOKEN` | Upload script | Gets new access tokens without re-authorizing |

The upload script uses these to authenticate as the channel's Google account and upload videos via the YouTube Data API v3.
