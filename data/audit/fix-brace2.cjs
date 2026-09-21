const fs=require('fs');
let d=fs.readFileSync('src/skills/remotion-render/visual-engine/directed-scene.jsx','utf8');
let lines=d.split('\n');
let out=[];
for(let i=0;i<lines.length;i++){
  if(i>0 && lines[i].trim()==='}' && lines[i-1].trim()==='}' && lines[i-2].includes('return "none"')){
    console.log('skipping duplicate at',i);
    continue;
  }
  out.push(lines[i]);
}
let nd=out.join('\n');
console.log('changed', nd!==d);
fs.writeFileSync('src/skills/remotion-render/visual-engine/directed-scene.jsx',nd,'utf8');
