from PIL import Image, ImageDraw
import os
base='data/rival-lines/reference-penalties-full/frames'
prev='data/rival-lines/penalties-ruining-football-prepared/previews'
out='data/rival-lines/penalties-ruining-football-prepared/previews/comparison-sheet.png'
rows=[
 ('opening-split-s01-hook.png',0,'Opening split (s01-hook, ref 0s)'),
 ('stats-explanatory-s02-probability.png',60,'Stats/explanatory (s02-probability, ref 60s)'),
 ('footage-led-s03-fulham.png',120,'Footage-led (s03-fulham, ref 120s)'),
 ('comparison-s07-comparison.png',360,'Comparison (s07-comparison, ref 360s)'),
 ('incident-s09-var.png',480,'Major incident (s09-var, ref 480s)'),
 ('ending-s20-close.png',1140,'Ending (s20-close, ref 1140s)'),
]
W,H=640,360; pad=20; labelH=36
sheet=Image.new('RGB',(W*2+pad*3, labelH + (H+pad)*len(rows)), (16,24,32))
draw=ImageDraw.Draw(sheet)
for i,(pf,t,lab) in enumerate(rows):
    y=labelH + i*(H+pad)
    draw.text((pad, y-28), lab, fill=(240,240,235))
    ri=int(t/10)+1; rp=os.path.join(base,f'ref-{ri:04d}.jpg')
    if os.path.exists(rp):
        sheet.paste(Image.open(rp).convert('RGB').resize((W,H)),(pad,y))
    pp=os.path.join(prev,pf)
    if os.path.exists(pp):
        sheet.paste(Image.open(pp).convert('RGB').resize((W,H)),(pad*2+W,y))
sheet.save(out)
print(out)
