import json, os
s=json.load(open('data/rival-lines/penalties-ruining-football/script.json',encoding='utf-8'))
mapping={
 'hook':('Gyokeres tap-in vs penalty (reference example) / generic penalty value','Gyokeres / general', '0-60','Split comparison: tap-in vs penalty'),
 'probability':('xG/penalty probability stats','General', '60-120','Stat graphic/explanation'),
 'fulham':('Wilson one-on-one vs Fulham; Gravenberch foul context','Harry Wilson / Fulham / Gravenberch','120-180','Match footage/reconstruction'),
 'history':('Penalty invention, William McCrum 1891','Historical','180-240','Archive/graphic'),
 'growth':('VAR, modern preparation','General','240-300','VAR/modern footage'),
 'palmer':('Cole Palmer penalty scoring numbers','Cole Palmer / Chelsea','300-360','Player footage/stats'),
 'comparison':('Penalty vs high-quality open-play chance','General','360-420','Comparison graphic'),
 'welbeck':('Wide attack/defender late challenge counterfactual','General example','420-480','Reconstruction'),
 'var':('VAR review atmosphere','General','480-540','VAR footage/reconstruction'),
 'specialists':('Harry Kane penalty record/specialist takers','Harry Kane','540-600','Player footage/stats'),
 'solutions':('Rule/procedure solutions','General','600-660','Graphic'),
 'brentford':('Brentford penalty pressure case study','Brentford','660-720','Team footage/stats'),
 'counterfactual':('Forward near corner of area, foul vs no foul','General','720-780','Reconstruction/graphic'),
 'creators':('Penalty-winning vs assists/creative credit','General','780-840','Graphic'),
 'graph':('Leading scorers total vs open play goals','General','840-900','Chart'),
 'ethics':('Incentives/behaviour','General','900-960','Graphic'),
 'shootout':('Knockout shootout context','General','960-1020','Shootout footage'),
 'pressure':('Roberto Baggio 1994 World Cup final miss','Roberto Baggio / Italy / 1994 WC final','1020-1080','Match footage/reconstruction'),
 'premier-league':('Season accumulation of penalty decisions','Premier League','1080-1140','Stats/compilation'),
 'close':('Conclusion: keep drama, raise threshold','General','1140-1147.6','Closing graphic'),
}
rows=[]
for sec in s['sections']:
    m=mapping.get(sec['id'], (sec['id'],'Unknown',f"{sec['timing_start']}-{sec['timing_end']}",''))
    rows.append({'section':sec['id'],'incident':m[0],'who':m[1],'timing':m[2],'required_visual':m[3],'asset':'','source':'','rights':'','status':'unresolved'})
os.makedirs('data/rival-lines/penalties-ruining-football-prepared',exist_ok=True)
with open('data/rival-lines/penalties-ruining-football-prepared/incident-asset-inventory.json','w',encoding='utf-8') as f: json.dump(rows,f,indent=2)
print(len(rows))
