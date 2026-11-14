"""Shot list for one reference: hard cuts (ffmpeg scene score > 0.3), shot start/length, a 2 fps thumbnail strip, keyframe per shot, and
contact sheets of keyframes (64 per sheet, labelled with shot number and start time)."""
import sys,subprocess,re,os,json,glob
from PIL import Image,ImageDraw
vid=sys.argv[1];src=f'src/{vid}.mp4';out=f'shots/{vid}';os.makedirs(out+'/f',exist_ok=True)
dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',src],capture_output=True,text=True).stdout)
r=subprocess.run(['ffmpeg','-hide_banner','-i',src,'-vf',"select='gt(scene,0.3)',showinfo",'-an','-f','null','-'],capture_output=True,text=True)
cuts=[0.0]+[float(x) for x in re.findall(r'pts_time:([\d.]+)',r.stderr)]
if not glob.glob(out+'/f/*.jpg'):
    subprocess.run(['ffmpeg','-v','error','-i',src,'-vf','fps=2,scale=200:-2','-q:v','5',out+'/f/%05d.jpg'])
frames=sorted(glob.glob(out+'/f/*.jpg'))
shots=[]
for i,a in enumerate(cuts):
    b=cuts[i+1] if i+1<len(cuts) else dur
    if b-a<0.12: continue
    m=(a+b)/2;k=min(len(frames)-1,int(m*2))
    shots.append({'n':len(shots)+1,'start':round(a,2),'len':round(b-a,2),'frame':frames[k]})
json.dump({'id':vid,'duration':dur,'shots':shots},open(out+'/shots.json','w'),indent=0)
W,H=Image.open(frames[0]).size
for s0 in range(0,len(shots),64):
    sheet=Image.new('RGB',(W*8,(H+18)*8),'black');d=ImageDraw.Draw(sheet)
    for j,s in enumerate(shots[s0:s0+64]):
        x,y=(j%8)*W,(j//8)*(H+18);sheet.paste(Image.open(s['frame']),(x,y))
        d.text((x+3,y+H+2),f"#{s['n']} {int(s['start']//60)}:{s['start']%60:04.1f} {s['len']:.1f}s",fill=(255,255,0))
    sheet.save(f'{out}/sheet-{s0//64+1:02d}.jpg',quality=80)
L=[s['len'] for s in shots]; L.sort()
print(vid,'dur',round(dur),'shots',len(shots),'median shot',L[len(L)//2],'sheets',(len(shots)+63)//64)
