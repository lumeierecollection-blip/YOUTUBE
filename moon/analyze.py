# Measured levels + model-based sound description. usage: analyze.py <id>. All labels are model output, not human listening.
import sys,json,subprocess,re
import numpy as np, librosa, torch
from scipy.ndimage import median_filter
from transformers import ASTForAudioClassification, AutoFeatureExtractor, ClapModel, ClapProcessor
torch.set_num_threads(4)
vid=sys.argv[1]; D=f"v/{vid}"; O=f"out/{vid}"; res={"id":vid}
def ff(args): return subprocess.run(["ffmpeg","-hide_banner","-nostats"]+args,capture_output=True,text=True).stderr

# whole-mix loudness and silences
e=ff(["-i",f"{D}/v.mp4","-vn","-af","ebur128=peak=true","-f","null","-"]); tail=e[e.rfind("Summary:"):]
def g(p):
    m=re.search(p,tail); return float(m.group(1)) if m else None
res["mix"]={"integrated_lufs":g(r"I:\s+(-?[\d.]+) LUFS"),"loudness_range_lu":g(r"LRA:\s+(-?[\d.]+) LU"),"true_peak_dbfs":g(r"Peak:\s+(-?[\d.]+) dBFS")}
e=ff(["-i",f"{D}/v.mp4","-vn","-af","silencedetect=noise=-45dB:d=0.35","-f","null","-"])
res["mix_silences"]=[[round(float(a)-float(d),2),round(float(d),2)] for a,d in re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)",e)]

# voice vs background levels, 0.5 s frames
bg,_=librosa.load(f"{D}/bg.flac",sr=48000,mono=True); vo,_=librosa.load(f"{D}/vo.flac",sr=16000,mono=True)
def db(x,r,hop=0.5):
    h=int(r*hop); n=len(x)//h
    return 20*np.log10(np.sqrt(np.mean(x[:n*h].reshape(n,h)**2,axis=1))+1e-9)
b=db(bg,48000); v=db(vo,16000); n=min(len(b),len(v)); b,v=b[:n],v[:n]; speak=v>-38
def med(a): return round(float(np.median(a)),1) if len(a) else None
res["levels"]={"voice_db_when_speaking":med(v[speak]),"background_db_while_speaking":med(b[speak]),"background_db_no_voice":med(b[~speak]),
    "voice_active_share":round(float(speak.mean()),3),"background_below_-55db_share":round(float((b<-55).mean()),3),
    "per_30s_background_db":[med(b[i:i+60]) for i in range(0,n,60)]}
drops=[]; i=0
while i<n:
    if b[i]<-55:
        j=i
        while j<n and b[j]<-55: j+=1
        if j-i>=3: drops.append([i*0.5,(j-i)*0.5])
        i=j
    else: i+=1
res["background_dropouts"]=drops

# tempo / percussive share per 30 s of background
mus=[]
for s in range(0,int(len(bg)/48000),30):
    seg=librosa.resample(bg[s*48000:(s+30)*48000],orig_sr=48000,target_sr=22050)
    if len(seg)<22050*8 or np.sqrt(np.mean(seg**2))<10**(-55/20): continue
    H,P=librosa.effects.hpss(seg); tempo=float(np.atleast_1d(librosa.feature.tempo(y=seg,sr=22050))[0])
    mus.append({"t":s,"bpm_estimate":round(tempo),"percussive_share":round(float(np.sum(P**2)/(np.sum(H**2)+np.sum(P**2)+1e-9)),2),
        "centroid_hz":round(float(np.mean(librosa.feature.spectral_centroid(y=seg,sr=22050))))})
res["music_features_30s"]=mus

# sudden-onset candidates in the background stem (max 8 per minute)
bg22=librosa.resample(bg,orig_sr=48000,target_sr=22050); env=librosa.onset.onset_strength(y=bg22,sr=22050,hop_length=512)
tm=librosa.frames_to_time(np.arange(len(env)),sr=22050,hop_length=512)
base=median_filter(env,size=int(6*22050/512)); score=(env-base)/(np.std(env)+1e-6)
cands=[]
for k in np.argsort(-score):
    if score[k]<2.0 or len(cands)>=int(len(bg)/48000/60*8)+4: break
    if all(abs(tm[k]-c[0])>1.5 for c in cands): cands.append((float(tm[k]),float(score[k])))
cands.sort()

CL={"whoosh":"a whoosh transition sound effect","impact":"a deep cinematic boom impact hit","riser":"a rising tension riser sweep","reverse":"a reverse cymbal swell",
 "click":"a mouse click or interface click","typing":"keyboard typing","tick":"a clock ticking","shutter":"a camera shutter sound","glitch":"a digital glitch static noise",
 "tape":"a tape rewind or record scratch","ding":"a notification ding or bell chime","cash":"a cash register or coins","paper":"paper rustling or page turning",
 "marker":"a marker pen stroke or highlighter swipe","heartbeat":"a heartbeat","crowd":"a crowd cheering or shouting","laughter":"people laughing",
 "gunshot":"gunshot or explosion","siren":"a siren or alarm","ambience":"city street or nature ambience","speech":"a person speaking","music":"music playing with no sound effect"}
clap=ClapModel.from_pretrained("laion/clap-htsat-unfused").eval(); cp=ClapProcessor.from_pretrained("laion/clap-htsat-unfused")
def clapscore(clips,texts,bs=16):
    out=[]
    for i in range(0,len(clips),bs):
        inp=cp(text=texts,audios=clips[i:i+bs],sampling_rate=48000,return_tensors="pt",padding=True)
        with torch.inference_mode(): out.append(clap(**inp).logits_per_audio.softmax(-1).numpy())
    return np.concatenate(out) if out else np.zeros((0,len(texts)))
clips=[bg[max(0,int((t-0.4)*48000)):int((t+1.6)*48000)] for t,_ in cands]
P=clapscore(clips,list(CL.values())); keys=list(CL)
res["onset_events"]=[{"t":round(t,2),"strength":round(s,2),"voice_active":bool(speak[min(int(t*2),n-1)]),
    "clap":[[keys[j],round(float(P[i,j]),2)] for j in np.argsort(-P[i])[:3]]} for i,(t,s) in enumerate(cands)]
MD=["dark ambient drone music","tense suspenseful cinematic underscore","mysterious investigative electronic music","sad emotional piano","soft ambient pads",
 "uplifting inspirational orchestral music","epic orchestral trailer music","lo-fi hip hop beat","trap beat with heavy bass","upbeat electronic pop",
 "synthwave retro music","acoustic guitar music","playful quirky comedic music","no music, silence or noise"]
st=list(range(0,max(1,int(len(bg)/48000)-9),10)); P=clapscore([bg[s*48000:(s+10)*48000] for s in st],MD,bs=8)
res["music_description_10s"]=[{"t":s,"top":[[MD[j],round(float(P[i,j]),2)] for j in np.argsort(-P[i])[:2]]} for i,s in enumerate(st)]
del clap

# AudioSet event tagging (AST) on the background stem, 4 s windows every 2 s
name="MIT/ast-finetuned-audioset-10-10-0.4593"; fx=AutoFeatureExtractor.from_pretrained(name); ast=ASTForAudioClassification.from_pretrained(name).eval()
b16=librosa.resample(bg,orig_sr=48000,target_sr=16000); st=np.arange(0,max(1,len(b16)/16000-3),2.0); tags=[]
for i in range(0,len(st),8):
    batch=[b16[int(s*16000):int((s+4)*16000)] for s in st[i:i+8]]
    with torch.inference_mode(): p=torch.sigmoid(ast(**fx(batch,sampling_rate=16000,return_tensors="pt")).logits).numpy()
    for k,s in enumerate(st[i:i+8]):
        tags.append({"t":float(s),"tags":[[ast.config.id2label[int(j)],round(float(p[k,j]),2)] for j in np.argsort(-p[k])[:6] if p[k,j]>=0.08]})
res["audioset_4s"]=tags
json.dump(res,open(f"{O}/audio.json","w"))
print("analysis ok: onsets",len(res["onset_events"]),"silences",len(res["mix_silences"]),res["mix"],{k:v for k,v in res["levels"].items() if not k.startswith("per_")})
