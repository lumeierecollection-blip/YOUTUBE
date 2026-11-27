# Shazam over the voice-removed stem. usage: music_id.py <id> [step_s]  (backs off when rate limited)
import sys,json,asyncio,subprocess,time
from shazamio import Shazam
vid=sys.argv[1]; src=f"v/{vid}/bg.flac"; STEP=int(sys.argv[2]) if len(sys.argv)>2 else 15; WIN=12; CAP=2700; T0=time.time()
async def main():
    sh=Shazam(); res=[]; t=0.0
    dur=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",src]))
    while t<dur-4:
        r={"t":t}
        if time.time()-T0>CAP:
            r["not_checked"]=True
        else:
            subprocess.run(["ffmpeg","-y","-v","error","-ss",str(t),"-t",str(WIN),"-i",src,"-ac","1","-ar","16000","w.wav"],check=True)
            for attempt in range(3):
                try:
                    j=await asyncio.wait_for(sh.recognize("w.wav"),timeout=100); r.pop("error",None); tr=j.get("track")
                    if tr:
                        m=j.get("matches") or [{}]
                        md={x["title"]:x["text"] for s in tr.get("sections",[]) for x in s.get("metadata",[]) or []}
                        r.update(key=tr.get("key"),title=tr.get("title"),artist=tr.get("subtitle"),url=tr.get("url"),genre=(tr.get("genres") or {}).get("primary"),album=md.get("Album"),label=md.get("Label"),offset=m[0].get("offset"),timeskew=m[0].get("timeskew"),freqskew=m[0].get("frequencyskew"))
                    break
                except Exception as e:
                    r["error"]=type(e).__name__; await asyncio.sleep(45)
            await asyncio.sleep(3)
        res.append(r); t+=STEP
        json.dump(res,open(f"out/{vid}/shazam.json","w"),indent=1,ensure_ascii=False)
    print("windows",len(res),"matched",sum(1 for r in res if r.get("title")),"failed",sum(1 for r in res if r.get("error")),"not_checked",sum(1 for r in res if r.get("not_checked")))
asyncio.run(main())
