import json
p='data/rival-lines/penalties-ruining-football/storyboard.json'
d=json.load(open(p,encoding='utf-8'))
for s in d['scenes']:
    if s['id']=='s03-fulham':
        s['caption']='Labelled reconstruction — Wilson/Fulham incident (specific footage not yet verified)'
        s['visual']['treatment']='freeze-counterfactual'
    if s['id']=='s06-palmer':
        s['caption']='Cole Palmer — verified player photo pending download (CC BY-SA 4.0 candidate)'
    if s['id']=='s10-specialists':
        s['caption']='Harry Kane — England penalty shootout photo candidate (CC BY 3.0, pending download)'
json.dump(d,open(p,'w',encoding='utf-8'),indent=2)
print('ok')
