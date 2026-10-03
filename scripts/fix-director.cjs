const fs=require('fs');  
const p='C:/Users/user/YOUTUBE/src/skills/remotion-render/visual-engine/director/visual-director.js';  
const c=fs.readFileSync(p,'utf8');  
const lines=c.split('\n');  
let inBlock=false;let startIdx=-1;let endIdx=-1;  
