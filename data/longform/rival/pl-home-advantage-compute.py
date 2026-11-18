import csv,glob,io,json,datetime as dt
rows=[]
for f in sorted(glob.glob('fd/E0_*.csv')):
    s=f[-8:-4]
    txt=open(f,encoding='latin-1').read()
    for r in csv.DictReader(io.StringIO(txt)):
        if not r.get('FTR'): continue
        d=r['Date']; fmt='%d/%m/%Y' if len(d)==10 else '%d/%m/%y'
        r['_d']=dt.datetime.strptime(d,fmt).date(); r['_s']=s; rows.append(r)
def agg(rs):
    n=len(rs)
    if not n: return None
    h=sum(r['FTR']=='H' for r in rs);a=sum(r['FTR']=='A' for r in rs);dr=n-h-a
    out=dict(n=n,home_win=round(100*h/n,1),draw=round(100*dr/n,1),away_win=round(100*a/n,1),
      hg=round(sum(int(r['FTHG']) for r in rs)/n,2),ag=round(sum(int(r['FTAG']) for r in rs)/n,2))
    for k,c in (('hy','HY'),('ay','AY'),('hf','HF'),('af','AF'),('hr','HR'),('ar','AR')):
        v=[int(r[c]) for r in rs if r.get(c,'')!='']
        out[k]=round(sum(v)/len(v),2) if v else None
    return out
res={}
for s in sorted({r['_s'] for r in rows}): res[s]=agg([r for r in rows if r['_s']==s])
# ghost: first PL match after restart 2020-06-17 until 2020-07-26 ; 20/21 whole season empty except limited fans (record both)
crowd=[r for r in rows if r['_d']<dt.date(2020,3,10) or r['_d']>dt.date(2021,5,23)]
pre19=[r for r in rows if r['_s']=='1920' and r['_d']<dt.date(2020,3,10)]
post19=[r for r in rows if r['_s']=='1920' and r['_d']>=dt.date(2020,6,17)]
res['_1920_before_lockdown']=agg(pre19); res['_1920_restart_empty']=agg(post19)
res['_2021_season']=agg([r for r in rows if r['_s']=='2021'])
res['_2122']=agg([r for r in rows if r['_s']=='2122'])
all_=agg(rows); res['_all_seasons']=all_
json.dump(res,open('homeadv.json','w'),indent=1)
for k,v in res.items(): print(k,v)
