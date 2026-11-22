from PIL import Image
import os
base='data/rival-lines/reference-penalties-full/frames'
rend='data/rival-lines/penalties-ruining-football-prepared/render-frames'
out='data/rival-lines/penalties-ruining-football-prepared/compare'
os.makedirs(out, exist_ok=True)
for t in [0,60,300,600,900,1140]:
    ri = int(t/10)+1
    rp=os.path.join(base,f'ref-{ri:04d}.jpg')
    dp=os.path.join(rend,f'rend-{t:04d}.jpg')
    if not os.path.exists(rp) or not os.path.exists(dp):
        print('missing',t); continue
    a=Image.open(rp).convert('RGB'); b=Image.open(dp).convert('RGB')
    h=360
    a=a.resize((int(a.width*h/a.height),h))
    b=b.resize((int(b.width*h/b.height),h))
    w=a.width+b.width+10
    c=Image.new('RGB',(w,h),(20,20,20))
    c.paste(a,(0,0)); c.paste(b,(a.width+10,0))
    p=os.path.join(out,f'cmp-{t:04d}.jpg')
    c.save(p,quality=90)
    print(p)
