import {bundle} from "@remotion/bundler";
import {renderStill,selectComposition} from "@remotion/renderer";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {readFileSync,mkdirSync,existsSync} from "node:fs";
const ROOT=join(dirname(fileURLToPath(import.meta.url)),"../../..");
const outDir=join(ROOT,"data/rival-lines/penalties-ruining-football-prepared");
const doc=JSON.parse(readFileSync(join(outDir,"storyboard.json"),"utf8"));
const publicDir=join(outDir,"public");
const picks=[
  {id:'s01-hook', ref:0, label:'opening-split'},
  {id:'s03-fulham', ref:120, label:'footage-led'},
  {id:'s07-comparison', ref:360, label:'comparison'},
  {id:'s02-probability', ref:60, label:'stats-explanatory'},
  {id:'s09-var', ref:480, label:'incident'},
  {id:'s20-close', ref:1140, label:'ending'},
];
mkdirSync(join(outDir,'previews'),{recursive:true});
console.log('bundle start');
const serveUrl=await bundle({entryPoint:join(ROOT,"src/skills/remotion-render/RivalLinesRoot.jsx"),publicDir,onProgress:(p)=>{if(p%25===0)console.log('bundle',p)}});
console.log('bundled');
for(const p of picks){
  const scene=doc.scenes.find(s=>s.id===p.id);
  if(!scene){ console.log('missing',p.id); continue; }
  const comp=await selectComposition({serveUrl,id:'RivalLinesVideo',inputProps:{storyboard:doc,onlySceneId:p.id}});
  const frame=Math.min(comp.durationInFrames-1, Math.floor(comp.durationInFrames*0.55));
  const out=join(outDir,'previews',`${p.label}-${p.id}.png`);
  await renderStill({serveUrl,composition:comp,inputProps:{storyboard:doc,onlySceneId:p.id},output:out,frame,imageFormat:'png'});
  console.log('rendered',out);
}
console.log('done');
