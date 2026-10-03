const fs=require('fs');  
const p='C:/Users/user/YOUTUBE/src/skills/remotion-render/render.js';  
const c=fs.readFileSync(p,'utf8');  
const lines=c.split('\n');  
const q=String.fromCharCode(34);  
lines[515]='      bgMode: channel.bg_mode ? channel.bg_mode : '+q+'black'+q+',';  
fs.writeFileSync(p,lines.join('\n'),'utf8');  
console.log('Fixed line 516'); 
