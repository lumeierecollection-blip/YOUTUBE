const fs=require('fs');  
const p='C:/Users/user/YOUTUBE/src/skills/remotion-render/visual-engine/director/visual-director.js';  
const c=fs.readFileSync(p,'utf8');  
const lines=c.split('\n');  
lines.splice(828, 8);  
lines.splice(833, 2);  
fs.writeFileSync(p,lines.join('\n'),'utf8');  
console.log('Director: CAMERA_ALTS removed'); 
