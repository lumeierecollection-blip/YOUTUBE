const fs=require('fs');const p='C:/Users/user/YOUTUBE/src/skills/remotion-render/visual-engine/directed-scene.jsx'; 
const c=fs.readFileSync(p,'utf8');const lines=c.split('\n'); 
for(let i=0;i<lines.length;i++){ 
  if(lines[i].includes('function cameraTransform')){ 
    let end=i+1; 
