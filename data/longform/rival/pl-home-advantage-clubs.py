"""Points per match at home vs away, per club and league-wide, 1993/94-2025/26. Only clubs with at least 300 home matches in the data. Usage: python pl-home-advantage-clubs.py <dir with E0_<SSSS>.csv>"""
import csv,glob,io,collections,sys
st=collections.defaultdict(lambda:{'hn':0,'hp':0,'an':0,'ap':0})
for f in sorted(glob.glob(sys.argv[1]+'/E0_*.csv')):
    for r in csv.DictReader(io.StringIO(open(f,encoding='latin-1').read())):
        if not r.get('FTR'): continue
        h,a,res=r['HomeTeam'],r['AwayTeam'],r['FTR']
        st[h]['hn']+=1; st[h]['hp']+=3 if res=='H' else 1 if res=='D' else 0
        st[a]['an']+=1; st[a]['ap']+=3 if res=='A' else 1 if res=='D' else 0
for t in ('Newcastle','Crystal Palace'):
    v=st[t]; print(t,'home matches',v['hn'],'home ppg',round(v['hp']/v['hn'],2),'away ppg',round(v['ap']/v['an'],2))
print('league home ppg',round(sum(v['hp'] for v in st.values())/sum(v['hn'] for v in st.values()),2),'away ppg',round(sum(v['ap'] for v in st.values())/sum(v['an'] for v in st.values()),2))
print('clubs with >=300 home matches:',sum(v['hn']>=300 for v in st.values()))
