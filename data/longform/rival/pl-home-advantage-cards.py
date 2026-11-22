"""Cards and fouls per match, normal crowds vs the two empty-stadium samples. Input: the E0 CSVs from football-data.co.uk (see pl-home-advantage.json _source).
Usage: python pl-home-advantage-cards.py <dir with E0_<SSSS>.csv>. Card columns exist from 2000/01. Empty samples: 2019/20 matches from 2020-06-17 (all behind closed doors,
Wikipedia '2019-20 Premier League') and the whole 2020/21 season (largely behind closed doors, some fans in Dec 2020 and from 18 May 2021: not a clean sample)."""
import csv,glob,io,sys,datetime as dt
rows=[]
for f in sorted(glob.glob(sys.argv[1]+'/E0_*.csv')):
    s=f[-8:-4]
    for r in csv.DictReader(io.StringIO(open(f,encoding='latin-1').read())):
        if not r.get('FTR') or r.get('HY','')=='': continue
        d=r['Date']; d=dt.datetime.strptime(d,'%d/%m/%Y' if len(d)==10 else '%d/%m/%y').date()
        rows.append((s,d,int(r['HY']),int(r['AY']),int(r['HF']),int(r['AF'])))
mean=lambda v:round(sum(v)/len(v),2)
def avg(rs): return dict(n=len(rs),HY=mean([r[2] for r in rs]),AY=mean([r[3] for r in rs]),HF=mean([r[4] for r in rs]),AF=mean([r[5] for r in rs]))
restart=[r for r in rows if r[0]=='1920' and r[1]>=dt.date(2020,6,17)]
y2021=[r for r in rows if r[0]=='2021']
crowd=[r for r in rows if r not in restart and r not in y2021]
print('crowd',avg(crowd)); print('restart 2019/20',avg(restart)); print('2020/21',avg(y2021))
