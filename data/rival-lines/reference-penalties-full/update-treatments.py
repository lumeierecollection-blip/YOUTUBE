import json
p='data/rival-lines/penalties-ruining-football/storyboard.json'
d=json.load(open(p,encoding='utf-8'))
# varied backgrounds by section to avoid one-template look
bg_map={
 's01-hook':'#0B3D2E','s02-probability':'#F1EEE7','s03-fulham':'#0B3D2E','s04-history':'#1A1A1A','s05-growth':'#F1EEE7',
 's06-palmer':'#5A1E3A','s07-comparison':'#0B3D2E','s08-welbeck':'#1A1A1A','s09-var':'#F1EEE7','s10-specialists':'#5A1E3A',
 's11-solutions':'#F1EEE7','s12-brentford':'#0B3D2E','s13-counterfactual':'#F1EEE7','s14-creators':'#1A1A1A','s15-graph':'#5A1E3A',
 's16-ethics':'#0B3D2E','s17-shootout':'#1A1A1A','s18-pressure':'#5A1E3A','s19-premier-league':'#F1EEE7','s20-close':'#0B3D2E'
}
for s in d.get('scenes',[]):
    s.setdefault('visual',{})['background']=bg_map.get(s['id'],s['visual'].get('background','#0B3D2E'))
    # mark reconstructions clearly in caption where unresolved specific incident
    if s['id'] in ['s03-fulham','s17-shootout','s18-pressure'] and 'Labelled reconstruction' not in s.get('caption',''):
        s['caption']=(s.get('caption','')+' — Labelled reconstruction').strip(' —')
json.dump(d,open(p,'w',encoding='utf-8'),indent=2)
print('ok')
