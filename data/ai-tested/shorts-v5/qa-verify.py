import glob, json, os, subprocess, sys

out_dir = sys.argv[1] if len(sys.argv) > 1 else "out"
qa_dir = sys.argv[2] if len(sys.argv) > 2 else "qa"
os.makedirs(qa_dir, exist_ok=True)
ok = True
for f in sorted(glob.glob(os.path.join(out_dir, "*.mp4"))):
    print("Checking", f)
    cmd = ["ffprobe","-v","error","-show_entries","stream=codec_type,codec_name,width,height,duration","-show_entries","format=duration,size,bit_rate","-of","default=noprint_wrappers=1",f]
    res = subprocess.run(cmd, capture_output=True, text=True)
    txt = res.stdout + ("\n" + res.stderr if res.stderr else "")
    with open(os.path.join(qa_dir, os.path.basename(f) + ".txt"), "w", encoding="utf-8") as fh:
        fh.write(txt)
    def probe(args):
        r = subprocess.run(["ffprobe","-v","error",*args,"-of","csv=p=0",f], capture_output=True, text=True)
        return r.stdout.strip().replace(",", "")
    w = probe(["-select_streams","v:0","-show_entries","stream=width"])
    h = probe(["-select_streams","v:0","-show_entries","stream=height"])
    a_raw = probe(["-select_streams","a:0","-show_entries","stream=codec_type"])
    a = a_raw.splitlines()[0].strip() if a_raw else ""
    dur_s = probe(["-show_entries","format=duration"])
    try: dur = float(dur_s)
    except: dur = 0.0
    print(f"  size={w}x{h} audio={a} dur={dur:.2f}s")
    if w != "1080" or h != "1920":
        print("BAD SIZE", f); ok = False
    if a != "audio":
        print("NO AUDIO", f); ok = False
    if dur < 20 or dur > 75:
        print("BAD DURATION", f, dur); ok = False
if not ok:
    sys.exit(1)
print("QA passed")
