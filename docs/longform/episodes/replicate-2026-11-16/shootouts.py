import json,urllib.request,time,sys
B="https://raw.githubusercontent.com/statsbomb/open-data/master/data/"
def get(p):
    for a in range(3):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(B+p,headers={"User-Agent":"research-bot"}),timeout=60))
        except Exception as e: time.sleep(2)
    raise SystemExit("fail "+p)
S=[(43,3),(43,106),(55,43),(55,282),(223,282),(1267,107),(72,30),(72,107),(53,106),(53,315),(43,55),(43,54)]
out=[]
for c,s in S:
    ms=get(f"matches/{c}/{s}.json")
    for m in ms:
        if m['home_score']!=m['away_score']: continue
        st=m['competition_stage']['name']
        if st in ('Group Stage','Regular Season','First Round','Second Round') and 'Final' not in st: pass
        ev=get(f"events/{m['match_id']}.json")
        k=[e for e in ev if e.get('period')==5 and e['type']['name']=='Shot']
        if not k: continue
        kicks=[(e['team']['name'],e['shot']['outcome']['name']) for e in k]
        out.append({"match_id":m['match_id'],"comp":m['competition']['competition_name'],"season":m['season']['season_name'],"stage":st,"date":m['match_date'],"home":m['home_team']['home_team_name'],"away":m['away_team']['away_team_name'],"kicks":kicks})
        print(out[-1]['comp'],out[-1]['season'],st,out[-1]['home'],out[-1]['away'],len(kicks),flush=True)
json.dump(out,open("shootouts.json","w"),ensure_ascii=False,indent=1)
