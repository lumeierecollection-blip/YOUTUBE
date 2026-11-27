# Audio design analysis of the reference videos

Method and limits: speech is located with word timestamps; the bed under it is measured in the gaps; events are heuristic detections (see `sound-effects-inventory.md`). Nobody listened to these videos for this report. Statements about mood and instrumentation are estimates. Timestamps are m:ss.

## Cross-video summary

| Video | Length | Speech share | Voice level dB | Bed vs voice dB (median) | Music-likely sections | Impacts/min | Whooshes/min | Ticks/min |
|---|---|---|---|---|---|---|---|---|
| football-made-simple: Flick's Barcelona Tactics Are Crazy | 11:23.0 | 0.911 | 33.8 | -12.15 | 4 of 4 | 0.2 | 1.2 | 2.7 |
| football-made-simple: How Chelsea's Tactics Beat United | 8:55.0 | 0.728 | 34.3 | -12.5 | 3 of 3 | 1.1 | 1.1 | 2.5 |
| football-made-simple: This Was Elite Tactical Problem Solv | 8:19.4 | 0.802 | 39.0 | -11.95 | 4 of 4 | 1.0 | 1.0 | 4.6 |
| football-made-simple: How Mourinho's Tactics Won El Classi | 8:40.3 | 0.877 | 34.2 | -11.3 | 3 of 3 | 0.2 | 0.5 | 2.1 |
| football-made-simple: The Tactics Of Every Post-Ferguson U | 83:43.1 | 0.889 | 42.5 | -11.4 | 46 of 46 | 0.6 | 0.8 | 4.3 |
| intrcpt: Penalties Are Ruining Football | 19:07.5 | 0.869 | 36.9 | -9.45 | 14 of 16 | 0.7 | 2.0 | 5.0 |
| intrcpt: Why The Premier League Needs Viníciu | 18:44.8 | 0.83 | 33.0 | -11.7 | 14 of 15 | 1.2 | 2.7 | 5.9 |
| intrcpt: How To Sink A Football Club ft. Manc | 20:05.8 | 0.844 | 30.2 | -9.4 | 11 of 13 | 0.6 | 2.1 | 5.6 |
| intrcpt: How To Lose A Ballon d'Or ft. 2024 J | 21:20.2 | 0.852 | 30.6 | -14.0 | 13 of 14 | 0.9 | 2.4 | 6.0 |
| intrcpt: Could Anyone Score 91 Goals In A Yea | 25:44.7 | 0.835 | 31.6 | -12.05 | 18 of 21 | 0.7 | 2.2 | 6.0 |
| intrcpt: What’s the Point Of International Br | 15:35.1 | 0.847 | 28.8 | -11.7 | 13 of 13 | 0.8 | 1.0 | 5.4 |
| intrcpt: Why Losing Games Might Be Better Tha | 22:17.8 | 0.829 | 28.6 | -11.100000000000001 | 18 of 18 | 0.4 | 1.4 | 6.6 |
| intrcpt: The One Change The Premier League De | 21:12.0 | 0.853 | 27.5 | -8.3 | 15 of 18 | 0.0 | 1.7 | 5.1 |
| intrcpt: Why Are Left-Footed Players So Speci | 16:44.8 | 0.86 | 30.7 | -11.0 | 14 of 16 | 0.4 | 2.4 | 3.5 |
| intrcpt: Why Are Premier League Stadiums So S | 19:58.3 | 0.865 | 29.5 | -9.6 | 13 of 15 | 0.6 | 1.6 | 5.2 |
| paper-pitch: How Hard Is It To Score 1,000 Goals? | 9:12.0 | 0.798 | 44.7 | -14.45 | 4 of 10 | 0.1 | 0.2 | 7.4 |
| paper-pitch: How To Win the Ballon d'Or? | 10:42.9 | 0.801 | 44.7 | n/a | 0 of 8 | 0.1 | 0.4 | 5.5 |
| paper-pitch: Could Manchester United Actually Get | 9:16.6 | 0.834 | 44.6 | -13.7 | 8 of 9 | 0.0 | 0.9 | 6.3 |
| football-realm: Jose Mourinho Was Right All Along. | 11:58.7 | 0.828 | 43.7 | -16.7 | 5 of 8 | 3.5 | 0.8 | 5.0 |

## Patterns by channel

- **football-made-simple** (5 videos): speech covers 84% of runtime on average; median bed level -11.95 dB against the voice; 0.6 impact candidates and 0.9 whoosh candidates per minute.
- **intrcpt** (10 videos): speech covers 85% of runtime on average; median bed level -11.05 dB against the voice; 0.6 impact candidates and 2.0 whoosh candidates per minute.
- **paper-pitch** (3 videos): speech covers 81% of runtime on average; median bed level -14.075 dB against the voice; 0.1 impact candidates and 0.5 whoosh candidates per minute.
- **football-realm** (1 videos): speech covers 83% of runtime on average; median bed level -16.7 dB against the voice; 3.5 impact candidates and 0.8 whoosh candidates per minute.

## Per-video timeline

### Flick's Barcelona Tactics Are Crazy (N8PZt_9_adI, football-made-simple)

Length 11:23.0; first word at 0:00.0; speech 91% of runtime; music floor 15.7 dB over a room floor of 1.7 dB.

Recognition hits: 3:00.0 "Infini" by Tristan Barton (single_clip)

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:01.8 to 7:09.8 | yes | -12.0 | 123 | mid-tempo, bright, moderate | 2 | 9 |
| 7:11.6 to 8:50.8 | yes | -10.2 | 129 | upbeat, neutral, prominent | 0 | 3 |
| 8:57.0 to 9:58.0 | yes | -14.8 | 123 | mid-tempo, bright, moderate | 0 | 0 |
| 10:10.2 to 11:23.4 | yes | -12.3 | 103 | mid-tempo, neutral, moderate | 0 | 2 |

### How Chelsea's Tactics Beat United (KC2Vgjw282s, football-made-simple)

Length 8:55.0; first word at 0:00.0; speech 73% of runtime; music floor 2.8 dB over a room floor of -11.2 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:10.9 to 1:52.6 | yes | -12.7 | 136 | upbeat, bright, moderate | 2 | 3 |
| 1:57.2 to 5:46.3 | yes | -11.4 | 129 | upbeat, bright, prominent | 6 | 2 |
| 5:51.2 to 8:55.6 | yes | -12.5 | 161 | upbeat, bright, moderate | 1 | 4 |

### This Was Elite Tactical Problem Solving (Nx8h403Sj_s, football-made-simple)

Length 8:19.4; first word at 0:00.0; speech 80% of runtime; music floor 16.2 dB over a room floor of 2.2 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:10.1 to 1:18.3 | yes | -11.9 | 112 | mid-tempo, bright, prominent | 3 | 0 |
| 1:32.3 to 4:17.5 | yes | -13.0 | 161 | upbeat, neutral, moderate | 3 | 5 |
| 4:46.3 to 6:24.2 | yes | -6.5 | 123 | mid-tempo, neutral, prominent | 0 | 0 |
| 6:45.1 to 8:25.9 | yes | -12.0 | 123 | mid-tempo, neutral, moderate | 2 | 1 |

### How Mourinho's Tactics Won El Classico (oZaPKaIVIA0, football-made-simple)

Length 8:40.3; first word at 0:00.0; speech 88% of runtime; music floor 22.1 dB over a room floor of 8.1 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:04.0 to 2:09.9 | yes | -10.8 | 117 | mid-tempo, bright, prominent | 1 | 3 |
| 2:17.4 to 2:39.1 | yes | -11.5 | 117 | mid-tempo, bright, prominent | 0 | 0 |
| 2:44.4 to 8:40.8 | yes | -11.3 | 112 | mid-tempo, bright, prominent | 1 | 1 |

### The Tactics Of Every Post-Ferguson United Manager (Dki5tjN0rDE, football-made-simple)

Length 83:43.1; first word at 0:00.0; speech 89% of runtime; music floor 21.1 dB over a room floor of 7.1 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:03.8 to 1:04.3 | yes | -13.0 | 108 | mid-tempo, neutral, moderate | 1 | 2 |
| 1:14.3 to 3:37.2 | yes | -11.5 | 108 | mid-tempo, neutral, prominent | 0 | 2 |
| 3:39.4 to 5:08.8 | yes | -11.6 | 129 | upbeat, neutral, prominent | 0 | 2 |
| 5:16.6 to 5:59.0 | yes | -13.1 | 136 | upbeat, neutral, moderate | 0 | 1 |
| 6:03.0 to 7:06.2 | yes | -13.7 | 117 | mid-tempo, bright, moderate | 0 | 1 |
| 7:09.7 to 8:00.4 | yes | -10.0 | 108 | mid-tempo, neutral, prominent | 0 | 0 |
| 8:13.1 to 8:33.3 | yes | -11.3 | 136 | upbeat, bright, prominent | 1 | 2 |
| 8:36.4 to 10:46.9 | yes | -12.0 | 129 | upbeat, neutral, moderate | 1 | 0 |
| 10:48.4 to 12:07.8 | yes | -11.2 | 123 | mid-tempo, neutral, prominent | 2 | 3 |
| 12:11.7 to 12:31.2 | yes | -9.5 | 129 | upbeat, bright, prominent | 0 | 0 |
| 12:35.4 to 13:40.0 | yes | -10.9 | 136 | upbeat, neutral, prominent | 1 | 0 |
| 13:59.9 to 14:20.2 | yes | -14.4 | 129 | upbeat, neutral, moderate | 2 | 0 |
| 14:31.0 to 16:40.2 | yes | -12.1 | 129 | upbeat, neutral, moderate | 1 | 7 |
| 16:41.6 to 17:04.2 | yes | -7.8 | 129 | upbeat, neutral, prominent | 0 | 0 |
| 17:08.2 to 17:20.4 | yes | -10.9 | 112 | mid-tempo, bright, prominent | 0 | 0 |
| 17:29.6 to 17:58.4 | yes | -21.1 | 108 | mid-tempo, neutral, very low under voice | 2 | 0 |
| 18:09.9 to 18:47.2 | yes | -20.3 | 123 | mid-tempo, bright, very low under voice | 3 | 0 |
| 18:48.9 to 19:10.7 | yes | -8.7 | 123 | mid-tempo, neutral, prominent | 0 | 0 |
| 19:11.6 to 21:54.1 | yes | -11.7 | 129 | upbeat, neutral, prominent | 0 | 3 |
| 21:55.3 to 22:23.6 | yes | -19.4 | 129 | upbeat, bright, moderate | 0 | 0 |
| 22:38.2 to 24:51.0 | yes | -12.2 | 108 | mid-tempo, neutral, moderate | 1 | 3 |
| 24:59.2 to 26:05.2 | yes | -10.9 | 117 | mid-tempo, neutral, prominent | 0 | 0 |
| 26:10.2 to 26:51.0 | yes | -18.3 | 123 | mid-tempo, neutral, moderate | 2 | 0 |
| 26:50.1 to 32:23.3 | yes | -11.3 | 136 | upbeat, neutral, prominent | 0 | 7 |
| 32:24.5 to 32:41.4 | yes | -14.3 | 112 | mid-tempo, neutral, moderate | 1 | 1 |
| 32:54.2 to 35:01.8 | yes | -9.6 | 117 | mid-tempo, neutral, prominent | 0 | 0 |
| 35:03.5 to 35:15.0 | yes | -7.7 | 123 | mid-tempo, bright, prominent | 0 | 0 |
| 35:26.6 to 36:13.5 | yes | -16.2 | 112 | mid-tempo, neutral, moderate | 1 | 1 |
| 36:16.9 to 45:36.8 | yes | -11.2 | 112 | mid-tempo, bright, prominent | 4 | 8 |
| 45:39.9 to 50:02.0 | yes | -12.6 | 117 | mid-tempo, bright, moderate | 5 | 1 |
| 50:09.3 to 52:12.2 | yes | -11.6 | 123 | mid-tempo, bright, prominent | 0 | 1 |
| 52:13.8 to 53:13.6 | yes | -11.8 | 136 | upbeat, bright, prominent | 1 | 0 |
| 53:17.3 to 57:15.3 | yes | -11.2 | 129 | upbeat, bright, prominent | 5 | 0 |
| 57:22.2 to 57:54.4 | yes | -9.5 | 136 | upbeat, bright, prominent | 1 | 0 |
| 57:58.8 to 60:00.0 | yes | -9.5 | 129 | upbeat, bright, prominent | 0 | 1 |
| 60:01.9 to 64:24.9 | yes | -9.7 | 117 | mid-tempo, neutral, prominent | 2 | 4 |
| 64:25.8 to 65:17.3 | yes | -11.3 | 123 | mid-tempo, bright, prominent | 0 | 0 |
| 65:35.9 to 66:46.8 | yes | -17.8 | 123 | mid-tempo, bright, moderate | 2 | 0 |
| 66:50.4 to 68:06.1 | yes | -11.2 | 129 | upbeat, bright, prominent | 0 | 0 |
| 68:09.8 to 69:45.8 | yes | -13.5 | 112 | mid-tempo, bright, moderate | 1 | 0 |
| 69:51.5 to 70:12.2 | yes | -9.5 | 103 | mid-tempo, neutral, prominent | 0 | 0 |
| 70:28.1 to 73:40.4 | yes | -10.5 | 123 | mid-tempo, bright, prominent | 1 | 5 |
| 73:40.9 to 76:33.0 | yes | -10.3 | 112 | mid-tempo, bright, prominent | 0 | 4 |
| 76:34.1 to 82:30.6 | yes | -10.4 | 129 | upbeat, bright, prominent | 3 | 4 |
| 82:32.9 to 82:46.9 | yes | -12.5 | 117 | mid-tempo, neutral, moderate | 0 | 0 |
| 82:55.2 to 83:56.1 | yes | -17.0 | 117 | mid-tempo, bright, moderate | 3 | 0 |

### Penalties Are Ruining Football (KRiP6lrk-gQ, intrcpt)

Length 19:07.5; first word at 0:00.0; speech 87% of runtime; music floor 18.6 dB over a room floor of 4.6 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:04.0 to 0:39.8 | no | -21.8 | 108 | mid-tempo, bright, very low under voice | 3 | 4 |
| 0:41.3 to 1:21.8 | yes | -9.0 | 129 | upbeat, neutral, prominent | 0 | 1 |
| 1:27.7 to 1:57.8 | yes | -7.8 | 123 | mid-tempo, dark/warm, prominent | 0 | 0 |
| 2:01.9 to 3:28.5 | yes | -8.2 | 112 | mid-tempo, neutral, prominent | 1 | 5 |
| 3:30.8 to 3:55.4 | yes | -7.1 | 108 | mid-tempo, neutral, prominent | 1 | 1 |
| 3:57.4 to 5:06.9 | yes | -9.6 | 136 | upbeat, neutral, prominent | 0 | 0 |
| 5:08.6 to 7:06.0 | yes | -10.6 | 123 | mid-tempo, neutral, prominent | 0 | 5 |
| 7:07.4 to 9:03.1 | yes | -10.6 | 108 | mid-tempo, neutral, prominent | 1 | 2 |
| 9:04.8 to 9:51.2 | yes | -10.0 | 108 | mid-tempo, dark/warm, prominent | 1 | 2 |
| 9:52.1 to 12:07.4 | yes | -7.9 | 136 | upbeat, dark/warm, prominent | 0 | 1 |
| 12:12.4 to 12:45.5 | no | -18.9 | 129 | upbeat, dark/warm, moderate | 1 | 0 |
| 12:48.8 to 15:57.6 | yes | -10.7 | 103 | mid-tempo, dark/warm, prominent | 1 | 3 |
| 16:10.8 to 16:39.2 | yes | -12.9 | 117 | mid-tempo, dark/warm, moderate | 0 | 1 |
| 16:44.0 to 17:25.2 | yes | -8.2 | 123 | mid-tempo, dark/warm, prominent | 0 | 3 |
| 17:31.8 to 17:50.4 | yes | -12.8 | 136 | upbeat, neutral, moderate | 0 | 0 |
| 17:51.9 to 19:09.9 | yes | -9.3 | 123 | mid-tempo, dark/warm, prominent | 1 | 8 |

### Why The Premier League Needs Vinícius Jr (yEa47CYLALA, intrcpt)

Length 18:44.8; first word at 0:00.1; speech 83% of runtime; music floor 13.5 dB over a room floor of -0.5 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:03.1 to 2:20.2 | yes | -8.1 | 103 | mid-tempo, dark/warm, prominent | 4 | 7 |
| 2:23.6 to 2:59.0 | yes | -5.8 | 129 | upbeat, dark/warm, prominent | 3 | 0 |
| 3:00.5 to 3:34.4 | yes | -11.5 | 112 | mid-tempo, dark/warm, prominent | 1 | 1 |
| 3:35.5 to 3:53.1 | no | -19.5 | 136 | upbeat, neutral, moderate | 1 | 0 |
| 4:00.6 to 4:46.0 | yes | -10.1 | 112 | mid-tempo, dark/warm, prominent | 0 | 3 |
| 4:50.8 to 6:19.6 | yes | -10.4 | 129 | upbeat, dark/warm, prominent | 0 | 6 |
| 6:25.6 to 6:55.8 | yes | -11.9 | 96 | mid-tempo, dark/warm, prominent | 1 | 3 |
| 7:03.5 to 7:45.3 | yes | -12.1 | 136 | upbeat, dark/warm, moderate | 0 | 2 |
| 7:46.5 to 9:27.1 | yes | -12.2 | 136 | upbeat, dark/warm, moderate | 1 | 3 |
| 9:28.5 to 10:26.4 | yes | -12.5 | 108 | mid-tempo, neutral, moderate | 2 | 3 |
| 10:27.9 to 11:18.0 | yes | -6.3 | 123 | mid-tempo, dark/warm, prominent | 0 | 0 |
| 11:22.3 to 13:36.1 | yes | -13.2 | 117 | mid-tempo, dark/warm, moderate | 0 | 3 |
| 13:38.7 to 14:33.3 | yes | -13.1 | 136 | upbeat, dark/warm, moderate | 2 | 2 |
| 14:37.1 to 18:01.8 | yes | -10.9 | 123 | mid-tempo, dark/warm, prominent | 1 | 12 |
| 18:05.3 to 18:47.0 | yes | -15.8 | 152 | upbeat, dark/warm, moderate | 4 | 3 |

### How To Sink A Football Club ft. Manchester United (7ON_R4zJWiU, intrcpt)

Length 20:05.8; first word at 0:00.1; speech 84% of runtime; music floor 15.8 dB over a room floor of 1.8 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:01.4 to 1:45.9 | yes | -8.5 | 117 | mid-tempo, dark/warm, prominent | 4 | 4 |
| 1:46.2 to 2:01.3 | no | -29.3 | 161 | upbeat, bright, very low under voice | 0 | 1 |
| 2:09.8 to 2:30.5 | yes | -4.8 | 103 | mid-tempo, dark/warm, prominent | 0 | 2 |
| 2:31.9 to 2:40.7 | yes | -8.0 | n/a | tempo unclear, dark/warm, prominent | 0 | 2 |
| 3:03.6 to 4:09.5 | yes | -9.4 | 117 | mid-tempo, dark/warm, prominent | 0 | 0 |
| 4:13.4 to 5:14.8 | yes | -12.2 | 117 | mid-tempo, neutral, moderate | 3 | 1 |
| 5:15.9 to 9:24.9 | yes | -7.1 | 123 | mid-tempo, dark/warm, prominent | 1 | 10 |
| 9:29.1 to 11:12.2 | yes | -9.5 | 108 | mid-tempo, dark/warm, prominent | 1 | 2 |
| 11:14.9 to 11:48.3 | yes | -11.9 | 129 | upbeat, dark/warm, prominent | 1 | 4 |
| 11:51.1 to 15:07.8 | yes | -9.0 | 123 | mid-tempo, dark/warm, prominent | 0 | 4 |
| 15:11.6 to 15:33.7 | yes | -12.5 | 123 | mid-tempo, neutral, moderate | 0 | 1 |
| 15:36.1 to 17:45.2 | yes | -11.7 | 136 | upbeat, dark/warm, prominent | 0 | 5 |
| 17:47.5 to 20:10.4 | no | -15.6 | 136 | upbeat, neutral, moderate | 1 | 5 |

### How To Lose A Ballon d'Or ft. 2024 Jude Bellingham (Qb0QNQ_qyzY, intrcpt)

Length 21:20.2; first word at 0:00.1; speech 85% of runtime; music floor 10.2 dB over a room floor of -3.8 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:03.8 to 0:44.3 | yes | -19.5 | 123 | mid-tempo, neutral, moderate | 4 | 3 |
| 0:48.8 to 1:26.0 | yes | -15.1 | 123 | mid-tempo, neutral, moderate | 0 | 2 |
| 1:27.0 to 1:54.7 | yes | -11.4 | 152 | upbeat, neutral, prominent | 1 | 1 |
| 1:56.0 to 2:45.7 | yes | -10.2 | 129 | upbeat, dark/warm, prominent | 2 | 3 |
| 2:50.8 to 4:17.5 | yes | -14.0 | 112 | mid-tempo, neutral, moderate | 1 | 3 |
| 4:24.5 to 5:50.1 | yes | -14.5 | 144 | upbeat, neutral, moderate | 1 | 3 |
| 5:55.0 to 6:40.3 | yes | -13.6 | 144 | upbeat, dark/warm, moderate | 2 | 3 |
| 6:42.5 to 7:32.2 | yes | -8.4 | 112 | mid-tempo, dark/warm, prominent | 0 | 2 |
| 7:36.6 to 8:43.1 | yes | -15.7 | 103 | mid-tempo, neutral, moderate | 0 | 2 |
| 8:54.7 to 12:46.2 | yes | -12.5 | 129 | upbeat, dark/warm, moderate | 1 | 5 |
| 12:50.4 to 13:11.3 | no | -20.4 | 112 | mid-tempo, neutral, very low under voice | 0 | 1 |
| 13:14.7 to 15:46.1 | yes | -11.5 | 123 | mid-tempo, dark/warm, prominent | 1 | 6 |
| 15:47.5 to 20:34.3 | yes | -14.7 | 108 | mid-tempo, dark/warm, moderate | 1 | 11 |
| 20:39.5 to 21:22.8 | yes | -16.3 | 117 | mid-tempo, dark/warm, moderate | 2 | 6 |

### Could Anyone Score 91 Goals In A Year Ever Again? (shDKeVwHFmI, intrcpt)

Length 25:44.7; first word at 0:06.8; speech 84% of runtime; music floor 14.0 dB over a room floor of 0.0 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:03.4 to 0:32.3 | no | -27.4 | 108 | mid-tempo, bright, very low under voice | 4 | 1 |
| 0:37.5 to 1:29.7 | yes | -10.3 | 144 | upbeat, dark/warm, prominent | 0 | 1 |
| 1:28.9 to 1:53.4 | no | -17.6 | 123 | mid-tempo, neutral, moderate | 3 | 0 |
| 1:54.2 to 4:00.2 | yes | -12.1 | 103 | mid-tempo, neutral, moderate | 0 | 4 |
| 4:04.0 to 4:39.8 | yes | -11.2 | 144 | upbeat, neutral, prominent | 2 | 2 |
| 4:42.2 to 5:30.9 | yes | -7.1 | 123 | mid-tempo, dark/warm, prominent | 0 | 2 |
| 5:31.8 to 6:09.3 | yes | -12.4 | 112 | mid-tempo, neutral, moderate | 1 | 2 |
| 6:12.1 to 6:44.3 | yes | -14.1 | 123 | mid-tempo, neutral, moderate | 1 | 0 |
| 6:47.2 to 8:44.2 | yes | -14.6 | 123 | mid-tempo, neutral, moderate | 0 | 3 |
| 8:47.7 to 9:20.6 | yes | -10.4 | 152 | upbeat, neutral, prominent | 0 | 1 |
| 9:27.7 to 11:22.0 | yes | -12.0 | 123 | mid-tempo, dark/warm, moderate | 0 | 5 |
| 11:41.1 to 13:40.9 | yes | -14.2 | 123 | mid-tempo, neutral, moderate | 1 | 4 |
| 13:44.7 to 15:11.3 | yes | -9.7 | 112 | mid-tempo, dark/warm, prominent | 0 | 0 |
| 15:13.0 to 17:21.3 | no | -19.4 | 117 | mid-tempo, neutral, moderate | 2 | 4 |
| 17:24.5 to 17:56.7 | yes | -9.6 | 129 | upbeat, dark/warm, prominent | 0 | 1 |
| 17:57.3 to 19:16.2 | yes | -11.9 | 152 | upbeat, dark/warm, prominent | 0 | 2 |
| 19:17.8 to 20:15.8 | yes | -16.6 | 117 | mid-tempo, neutral, moderate | 2 | 4 |
| 20:20.2 to 21:19.0 | yes | -10.3 | 129 | upbeat, dark/warm, prominent | 0 | 3 |
| 21:23.7 to 24:37.5 | yes | -14.3 | 112 | mid-tempo, dark/warm, moderate | 1 | 11 |
| 24:39.6 to 25:20.2 | yes | -15.1 | 129 | upbeat, neutral, moderate | 0 | 3 |
| 25:21.3 to 25:48.5 | yes | -16.0 | 129 | upbeat, dark/warm, moderate | 0 | 0 |

### What’s the Point Of International Breaks? (b1XMvWwJpRs, intrcpt)

Length 15:35.1; first word at 0:00.0; speech 85% of runtime; music floor 7.8 dB over a room floor of -6.2 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:02.4 to 1:37.0 | yes | -14.0 | 108 | mid-tempo, neutral, moderate | 5 | 1 |
| 1:40.8 to 2:25.0 | yes | -9.6 | 129 | upbeat, dark/warm, prominent | 1 | 1 |
| 2:28.1 to 4:24.5 | yes | -14.6 | 117 | mid-tempo, dark/warm, moderate | 1 | 3 |
| 4:25.8 to 6:02.1 | yes | -10.0 | 108 | mid-tempo, neutral, prominent | 0 | 3 |
| 6:10.1 to 6:40.2 | yes | -12.4 | 108 | mid-tempo, dark/warm, moderate | 0 | 1 |
| 6:42.0 to 7:29.9 | yes | -10.6 | 129 | upbeat, dark/warm, prominent | 0 | 0 |
| 7:32.7 to 9:20.6 | yes | -16.7 | 136 | upbeat, neutral, moderate | 1 | 2 |
| 9:31.7 to 10:54.6 | yes | -9.3 | 129 | upbeat, dark/warm, prominent | 0 | 1 |
| 10:56.9 to 11:42.4 | yes | -15.4 | 117 | mid-tempo, neutral, moderate | 1 | 0 |
| 11:46.1 to 12:24.0 | yes | -11.6 | 99 | mid-tempo, dark/warm, prominent | 1 | 1 |
| 12:25.2 to 13:19.1 | yes | -6.7 | 136 | upbeat, dark/warm, prominent | 0 | 1 |
| 13:28.4 to 14:34.9 | yes | -13.3 | 112 | mid-tempo, dark/warm, moderate | 0 | 1 |
| 14:42.1 to 15:38.1 | yes | -11.7 | 123 | mid-tempo, neutral, prominent | 0 | 0 |

### Why Losing Games Might Be Better Than Drawing Them (pxVvXxNCF2I, intrcpt)

Length 22:17.8; first word at 0:00.1; speech 83% of runtime; music floor 10.1 dB over a room floor of -3.9 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:01.4 to 0:27.9 | yes | -17.6 | 112 | mid-tempo, neutral, moderate | 0 | 0 |
| 0:34.9 to 0:57.1 | yes | -7.8 | 144 | upbeat, dark/warm, prominent | 0 | 0 |
| 1:05.5 to 2:05.4 | yes | -13.0 | 96 | mid-tempo, dark/warm, moderate | 2 | 1 |
| 2:09.1 to 2:34.0 | yes | -9.8 | 117 | mid-tempo, neutral, prominent | 0 | 0 |
| 2:38.3 to 3:17.9 | yes | -11.4 | 123 | mid-tempo, dark/warm, prominent | 2 | 1 |
| 3:25.1 to 4:12.4 | yes | -8.1 | 117 | mid-tempo, dark/warm, prominent | 0 | 0 |
| 4:15.3 to 5:11.2 | yes | -11.7 | 108 | mid-tempo, neutral, prominent | 0 | 0 |
| 5:13.4 to 5:49.9 | yes | -5.8 | 112 | mid-tempo, neutral, prominent | 0 | 0 |
| 5:51.7 to 6:14.1 | yes | -15.6 | 96 | mid-tempo, neutral, moderate | 0 | 2 |
| 6:17.4 to 7:38.2 | yes | -8.4 | 129 | upbeat, neutral, prominent | 0 | 1 |
| 7:40.4 to 9:21.1 | yes | -17.3 | 112 | mid-tempo, neutral, moderate | 0 | 0 |
| 9:27.2 to 12:56.3 | yes | -9.9 | 117 | mid-tempo, dark/warm, prominent | 2 | 8 |
| 12:59.4 to 14:55.0 | yes | -9.1 | 108 | mid-tempo, dark/warm, prominent | 0 | 3 |
| 14:57.0 to 16:51.9 | yes | -11.3 | 144 | upbeat, neutral, prominent | 2 | 1 |
| 16:59.6 to 17:51.4 | yes | -8.9 | 108 | mid-tempo, dark/warm, prominent | 0 | 1 |
| 17:56.1 to 19:20.0 | yes | -11.6 | 108 | mid-tempo, dark/warm, prominent | 1 | 4 |
| 19:23.5 to 20:22.9 | yes | -12.1 | 117 | mid-tempo, dark/warm, moderate | 0 | 3 |
| 20:28.0 to 22:20.9 | yes | -10.9 | 136 | upbeat, dark/warm, prominent | 0 | 6 |

### The One Change The Premier League Desperately Needs (gePZey0fdiQ, intrcpt)

Length 21:12.0; first word at 0:00.2; speech 85% of runtime; music floor 13.7 dB over a room floor of -0.3 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:02.8 to 0:22.5 | yes | -5.5 | 117 | mid-tempo, neutral, prominent | 0 | 2 |
| 0:35.1 to 0:56.6 | yes | -6.9 | 112 | mid-tempo, neutral, prominent | 0 | 1 |
| 1:00.4 to 1:31.4 | yes | -7.3 | 112 | mid-tempo, dark/warm, prominent | 0 | 0 |
| 1:35.7 to 2:33.3 | yes | -6.9 | 123 | mid-tempo, dark/warm, prominent | 1 | 2 |
| 2:32.6 to 3:50.4 | yes | -10.0 | 112 | mid-tempo, dark/warm, prominent | 0 | 3 |
| 3:54.8 to 4:07.0 | yes | -4.4 | 136 | upbeat, neutral, prominent | 0 | 0 |
| 4:15.8 to 5:38.4 | yes | -10.9 | 112 | mid-tempo, dark/warm, prominent | 0 | 2 |
| 5:43.2 to 6:11.9 | yes | -10.9 | 144 | upbeat, neutral, prominent | 0 | 0 |
| 6:16.5 to 6:46.8 | yes | -9.6 | 129 | upbeat, neutral, prominent | 0 | 0 |
| 6:48.7 to 7:09.7 | yes | -7.7 | 136 | upbeat, dark/warm, prominent | 0 | 0 |
| 7:22.0 to 8:13.5 | yes | -9.1 | 92 | mid-tempo, neutral, prominent | 0 | 0 |
| 8:17.6 to 10:06.7 | yes | -8.3 | 112 | mid-tempo, dark/warm, prominent | 0 | 7 |
| 10:12.7 to 12:05.7 | yes | -8.2 | 103 | mid-tempo, dark/warm, prominent | 0 | 2 |
| 12:10.4 to 13:07.6 | no | -16.1 | 123 | mid-tempo, neutral, moderate | 0 | 1 |
| 13:09.5 to 14:38.0 | yes | -8.9 | 129 | upbeat, neutral, prominent | 0 | 2 |
| 14:39.0 to 18:36.0 | no | -14.8 | 117 | mid-tempo, neutral, moderate | 0 | 6 |
| 18:38.2 to 19:09.8 | no | -16.2 | 112 | mid-tempo, dark/warm, moderate | 0 | 3 |
| 19:12.3 to 21:15.8 | yes | -10.0 | 129 | upbeat, dark/warm, prominent | 0 | 4 |

### Why Are Left-Footed Players So Special? (gp4cftwGLcQ, intrcpt)

Length 16:44.8; first word at 0:00.1; speech 86% of runtime; music floor 12.6 dB over a room floor of -1.4 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:07.3 to 1:05.4 | yes | -15.3 | 123 | mid-tempo, neutral, moderate | 2 | 1 |
| 1:13.7 to 2:12.7 | yes | -5.3 | 108 | mid-tempo, dark/warm, prominent | 1 | 4 |
| 2:13.6 to 2:52.2 | yes | -11.5 | 123 | mid-tempo, dark/warm, prominent | 2 | 0 |
| 2:59.2 to 3:32.8 | yes | -4.2 | 136 | upbeat, dark/warm, prominent | 0 | 1 |
| 3:40.8 to 3:41.0 | no | -37.7 | n/a | tempo unclear, bright, very low under voice | 0 | 0 |
| 4:10.5 to 4:25.5 | yes | -12.5 | 112 | mid-tempo, dark/warm, moderate | 1 | 1 |
| 4:34.4 to 5:01.9 | yes | -13.4 | 123 | mid-tempo, neutral, moderate | 0 | 1 |
| 5:03.0 to 5:24.4 | no | -19.3 | 129 | upbeat, neutral, moderate | 0 | 1 |
| 5:30.2 to 7:04.1 | yes | -5.8 | 117 | mid-tempo, dark/warm, prominent | 0 | 3 |
| 7:06.7 to 7:32.7 | yes | -16.0 | 136 | upbeat, neutral, moderate | 0 | 1 |
| 7:37.8 to 9:00.9 | yes | -7.3 | 112 | mid-tempo, dark/warm, prominent | 0 | 2 |
| 9:02.5 to 10:01.6 | yes | -9.3 | 108 | mid-tempo, dark/warm, prominent | 0 | 4 |
| 10:03.5 to 10:50.5 | yes | -7.9 | 112 | mid-tempo, dark/warm, prominent | 0 | 1 |
| 10:56.3 to 12:49.4 | yes | -12.6 | 129 | upbeat, dark/warm, moderate | 0 | 10 |
| 12:53.4 to 15:08.6 | yes | -13.9 | 108 | mid-tempo, neutral, moderate | 0 | 6 |
| 15:15.5 to 16:48.2 | yes | -10.5 | 136 | upbeat, dark/warm, prominent | 0 | 0 |

### Why Are Premier League Stadiums So Small? (BQ7OL0QUutE, intrcpt)

Length 19:58.3; first word at 0:00.1; speech 86% of runtime; music floor 16.0 dB over a room floor of 2.0 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:02.0 to 0:50.0 | yes | -9.6 | 129 | upbeat, dark/warm, prominent | 1 | 3 |
| 0:53.5 to 1:40.0 | yes | -4.3 | 103 | mid-tempo, dark/warm, prominent | 0 | 1 |
| 1:44.9 to 2:05.5 | yes | -12.4 | 161 | upbeat, neutral, moderate | 0 | 0 |
| 2:11.9 to 3:27.0 | yes | -12.2 | 129 | upbeat, dark/warm, moderate | 0 | 2 |
| 3:30.4 to 4:11.7 | yes | -12.1 | 117 | mid-tempo, dark/warm, moderate | 2 | 0 |
| 4:16.2 to 6:08.7 | yes | -6.2 | 144 | upbeat, dark/warm, prominent | 0 | 3 |
| 6:14.8 to 7:40.7 | yes | -6.8 | 123 | mid-tempo, dark/warm, prominent | 0 | 3 |
| 7:49.6 to 12:38.7 | no | -14.1 | 123 | mid-tempo, neutral, moderate | 5 | 5 |
| 12:44.2 to 13:26.0 | yes | -10.8 | 129 | upbeat, dark/warm, prominent | 1 | 2 |
| 13:31.5 to 15:07.4 | yes | -10.3 | 117 | mid-tempo, neutral, prominent | 0 | 3 |
| 15:12.6 to 15:36.7 | yes | -4.4 | 103 | mid-tempo, dark/warm, prominent | 0 | 0 |
| 15:38.9 to 16:20.0 | no | -13.9 | 123 | mid-tempo, neutral, moderate | 1 | 0 |
| 16:21.9 to 16:47.7 | yes | -6.0 | 129 | upbeat, neutral, prominent | 0 | 1 |
| 16:51.1 to 18:00.6 | yes | -5.5 | 136 | upbeat, neutral, prominent | 0 | 3 |
| 18:02.5 to 20:00.3 | yes | -9.7 | 129 | upbeat, dark/warm, prominent | 1 | 3 |

### How Hard Is It To Score 1,000 Goals? (B264MXP1nDc, paper-pitch)

Length 9:12.0; first word at 0:00.0; speech 80% of runtime; music floor 28.5 dB over a room floor of 14.5 dB.

Credited music: "Illusions", "Stand", "Shadows" by Anno Domini Beats (YouTube Audio Library (as credited in the video description)). Placement unknown.

Recognition hits: 3:24.0 "Miss Me" by Senpai Ru (single_clip_contradicts_credit)

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:01.5 to 3:03.1 | yes | -15.2 | 112 | mid-tempo, neutral, moderate | 0 | 0 |
| 3:04.7 to 4:11.1 | no | -17.4 | 123 | mid-tempo, neutral, moderate | 0 | 0 |
| 4:14.8 to 4:35.1 | yes | -12.5 | 108 | mid-tempo, neutral, moderate | 0 | 0 |
| 4:36.3 to 4:58.4 | no | -17.0 | 96 | mid-tempo, neutral, moderate | 0 | 0 |
| 5:00.4 to 5:17.5 | no | -18.3 | 136 | upbeat, neutral, moderate | 0 | 0 |
| 5:25.7 to 6:10.2 | no | -17.8 | 129 | upbeat, neutral, moderate | 0 | 0 |
| 6:12.9 to 6:51.7 | no | -17.3 | 136 | upbeat, neutral, moderate | 0 | 0 |
| 6:58.9 to 7:23.1 | yes | -13.7 | 123 | mid-tempo, neutral, moderate | 0 | 0 |
| 7:24.7 to 8:48.7 | yes | -15.3 | 129 | upbeat, neutral, moderate | 1 | 2 |
| 8:51.6 to 9:13.0 | no | -16.2 | 129 | upbeat, neutral, moderate | 0 | 0 |

### How To Win the Ballon d'Or? (0urnhOl8MYY, paper-pitch)

Length 10:42.9; first word at 0:00.0; speech 80% of runtime; music floor 35.0 dB over a room floor of 21.0 dB.

Credited music: "Illusions", "Stand", "Shadows" by Anno Domini Beats (YouTube Audio Library (as credited in the video description)). Placement unknown.

Recognition hits: 1:30.0 "Stolen Stars" by Reflective Realm Retreat (single_clip_contradicts_credit); 10:29.0 "Miss Me" by Senpai Ru (single_clip_contradicts_credit)

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:02.5 to 2:33.9 | no | -15.9 | 123 | mid-tempo, neutral, moderate | 0 | 0 |
| 2:35.5 to 3:15.5 | no | -19.6 | 112 | mid-tempo, neutral, moderate | 0 | 1 |
| 3:17.1 to 4:54.6 | no | -17.3 | 123 | mid-tempo, neutral, moderate | 0 | 0 |
| 4:55.6 to 6:00.4 | no | -17.7 | 99 | mid-tempo, neutral, moderate | 0 | 0 |
| 6:03.1 to 7:42.3 | no | -16.3 | 136 | upbeat, neutral, moderate | 1 | 0 |
| 7:43.8 to 8:26.0 | no | -16.8 | 117 | mid-tempo, neutral, moderate | 0 | 0 |
| 8:28.8 to 8:55.4 | no | -16.4 | 123 | mid-tempo, neutral, moderate | 0 | 1 |
| 8:57.1 to 10:48.1 | no | -17.4 | 129 | upbeat, neutral, moderate | 0 | 2 |

### Could Manchester United Actually Get Relegated? (IgszEI2iszk, paper-pitch)

Length 9:16.6; first word at 0:00.0; speech 83% of runtime; music floor 27.5 dB over a room floor of 13.5 dB.

Credited music: "Illusions", "Stand", "Shadows" by Anno Domini Beats (YouTube Audio Library (as credited in the video description)). Placement unknown.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:01.2 to 0:36.0 | no | -26.6 | 117 | mid-tempo, bright, very low under voice | 0 | 1 |
| 0:40.1 to 2:17.9 | yes | -14.3 | 129 | upbeat, neutral, moderate | 0 | 1 |
| 2:20.0 to 4:23.8 | yes | -12.7 | 123 | mid-tempo, neutral, moderate | 0 | 1 |
| 4:30.0 to 5:37.0 | yes | -13.9 | 123 | mid-tempo, neutral, moderate | 0 | 1 |
| 5:38.4 to 6:10.5 | yes | -11.3 | 129 | upbeat, dark/warm, prominent | 0 | 0 |
| 6:12.3 to 6:40.4 | yes | -16.5 | 129 | upbeat, dark/warm, moderate | 0 | 0 |
| 6:43.6 to 7:37.4 | yes | -13.5 | 108 | mid-tempo, neutral, moderate | 0 | 2 |
| 7:37.8 to 8:07.2 | yes | -15.8 | 112 | mid-tempo, bright, moderate | 0 | 1 |
| 8:10.1 to 9:16.7 | yes | -13.1 | 161 | upbeat, dark/warm, moderate | 0 | 1 |

### Jose Mourinho Was Right All Along. (YN31DA3o2Qs, football-realm)

Length 11:58.7; first word at 0:00.1; speech 83% of runtime; music floor 25.4 dB over a room floor of 11.4 dB.

| Section | Music likely | Bed vs voice dB | Tempo bpm | Feel (estimate) | Impacts | Whooshes |
|---|---|---|---|---|---|---|
| 0:02.0 to 0:40.4 | no | -19.6 | 136 | upbeat, neutral, moderate | 4 | 0 |
| 1:07.6 to 1:36.0 | no | -22.7 | 136 | upbeat, neutral, very low under voice | 4 | 2 |
| 1:59.5 to 2:55.3 | yes | -16.7 | 112 | mid-tempo, neutral, moderate | 7 | 3 |
| 2:58.9 to 3:14.8 | no | -18.3 | 129 | upbeat, bright, moderate | 1 | 0 |
| 3:20.7 to 3:36.4 | yes | -13.9 | 129 | upbeat, bright, moderate | 1 | 0 |
| 3:41.4 to 7:00.3 | yes | -15.4 | 117 | mid-tempo, neutral, moderate | 6 | 1 |
| 7:07.5 to 9:20.2 | yes | -17.9 | 129 | upbeat, neutral, moderate | 3 | 2 |
| 9:28.0 to 11:58.9 | yes | -17.2 | 123 | mid-tempo, neutral, moderate | 8 | 1 |

