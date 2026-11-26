"""Download the licensed audio slots used by the AI Tested V5 Shorts.
Sources and licences come from config/longform-audio-library.json. Writes assets/audio-licences.json."""
import json, os, sys, urllib.request
ROOT = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(ROOT, "..", "..", "..", "config", "longform-audio-library.json")
lib = json.load(open(LIB, encoding="utf-8"))
by = {a["slot"]: a for a in lib["assets"]}
WANT = {
  "music/m21_suspense.mp3": "MUSIC_SUSPENSE_STEM",
  "music/m22_tech.ogg": "MUSIC_TECH",
  "music/m23_dark.mp3": "MUSIC_ATMOS_DARK",
  "music/m24_space.mp3": "MUSIC_SPACE_1",
  "music/m25_corporate.mp3": "MUSIC_CORPORATE",
  "sfx2/keyboard.mp3": "SFX_KEYBOARD",
  "sfx2/paper.mp3": "SFX_PAPER",
  "sfx2/shutter.mp3": "SFX_SHUTTER",
  "sfx2/mouse_click.mp3": "SFX_MOUSE_CLICK",
  "sfx2/clock.mp3": "SFX_CLOCK",
  "sfx2/whoosh_deep.mp3": "SFX_WHOOSH",
  "sfx2/impact_low.mp3": "SFX_IMPACT",
  "sfx2/riser.mp3": "SFX_RISER",
  "sfx2/record_scratch.mp3": "SFX_RECORD_SCRATCH",
}
out, fail = [], []
for rel, slot in WANT.items():
    a = by[slot]; dst = os.path.join(ROOT, "assets", rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst) or os.path.getsize(dst) < 2000:
        try:
            req = urllib.request.Request(a["download_url"], headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=90) as r, open(dst, "wb") as f: f.write(r.read())
        except Exception as e:
            fail.append((rel, str(e))); continue
    out.append({"file": "assets/" + rel, "slot": slot, "title": a["title"], "creator": a["creator"], "license": a["license"], "license_url": a.get("license_url"), "source_page": a.get("source_page"), "download_url": a["download_url"], "bytes": os.path.getsize(dst), "attribution": a.get("attribution")})
json.dump(out, open(os.path.join(ROOT, "assets", "audio-licences.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("ok", len(out), "fail", fail)
sys.exit(1 if fail else 0)
