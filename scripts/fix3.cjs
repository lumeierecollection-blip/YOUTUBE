const fs=require('fs');  
const p='C:/Users/user/YOUTUBE/src/skills/remotion-render/render.js';  
const c=fs.readFileSync(p,'utf8');  
const lines=c.split('\n');  
lines[515]='      bgMode: channel.bg_mode ? channel.bg_mode : String.fromCharCode(34)+black+String.fromCharCode(34),';  
fs.writeFileSync(p,lines.join('\n'),'utf8');  
console.log('Fixed'); 
