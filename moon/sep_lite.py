# Low-RAM, resumable voice removal. usage: sep_lite.py <budget_seconds> <id> ...
# Per 30 s block (1 s overlap each side, trimmed): ch2/bg_NNNN.flac (stereo, voice removed), ch2/vo_NNNN.flac (16k mono voice).
# When a video is complete -> bg.flac + vo.flac. Exits cleanly when the time budget is used.
import sys,os,time,subprocess,glob,gc,shutil
import numpy as np, soundfile as sf, torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
torch.set_num_threads(4)
T0=time.time(); budget=float(sys.argv[1]); SR=44100; BLK=30; PAD=1
model=None; last=0
def run(a): subprocess.run(["ffmpeg","-y","-v","error"]+a,check=True)
for vid in sys.argv[2:]:
    D=f"v/{vid}"
    if os.path.exists(f"{D}/bg.flac"): continue
    C=f"{D}/ch2"; os.makedirs(C,exist_ok=True)
    dur=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"{D}/v.mp4"]))
    n=int(np.ceil(dur/BLK)); done=0
    for i in range(n):
        bg,vo=f"{C}/bg_{i:04d}.flac",f"{C}/vo_{i:04d}.flac"
        if os.path.exists(vo): continue
        if time.time()-T0+max(last,45)*1.2>budget:
            print(f"BUDGET {vid} {len(glob.glob(C+'/vo_*.flac'))}/{n} blocks, made {done} now, last block {last:.0f}s",flush=True); sys.exit(0)
        if model is None:
            model=get_model("htdemucs").models[0]; model.eval(); vi=model.sources.index("vocals")
        t=time.time(); start=max(0,i*BLK-PAD); lead=i*BLK-start
        raw=subprocess.check_output(["ffmpeg","-v","error","-ss",str(start),"-t",str(lead+BLK+PAD),"-i",f"{D}/v.mp4","-vn","-ac","2","-ar",str(SR),"-f","f32le","-"])
        x=torch.from_numpy(np.frombuffer(raw,np.float32).reshape(-1,2).T.copy())
        ref=x.mean(0); m,s=ref.mean(),ref.std()+1e-8
        with torch.inference_mode():
            out=apply_model(model,((x-m)/s)[None],shifts=0,split=True,overlap=0.1,device="cpu",num_workers=0)[0]
            voc=out[vi]*s+m
        a=int(lead*SR); b=min(a+BLK*SR,x.shape[1])
        sf.write(bg,(x-voc)[:,a:b].T.numpy().clip(-1,1),SR)
        sf.write(vo+".tmp.flac",voc[:,a:b].mean(0).numpy().clip(-1,1),SR)
        run(["-i",vo+".tmp.flac","-ac","1","-ar","16000",vo]); os.remove(vo+".tmp.flac")
        del x,out,voc,raw; gc.collect(); done+=1; last=time.time()-t
    for s_ in ("bg","vo"):
        open(f"{C}/{s_}.txt","w").write("".join(f"file '{os.path.basename(p)}'\n" for p in sorted(glob.glob(f"{C}/{s_}_[0-9]*.flac")) if not p.endswith('.tmp.flac')))
        run(["-f","concat","-safe","0","-i",f"{C}/{s_}.txt","-c:a","flac",f"{D}/{s_}.flac"])
    shutil.rmtree(C); shutil.rmtree(f"{D}/ch",ignore_errors=True)
    print(f"SEPARATED {vid} ({dur/60:.1f} min)",flush=True)
print("QUEUE DONE")
