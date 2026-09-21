const fs=require('fs');
let r=fs.readFileSync('src/skills/remotion-render/render.js','utf8');
if(!r.includes('bgMode: channel.bg_mode ?')){
  r=r.replace(
    '      fonts: viSpec\n        ? { primary: viSpec.typography_primary, secondary: viSpec.typography_secondary }\n        : { primary: "DM Sans", secondary: "Noto Serif" },',
    '      fonts: viSpec\n        ? { primary: viSpec.typography_primary, secondary: viSpec.typography_secondary }\n        : { primary: "DM Sans", secondary: "Noto Serif" },\n      bgMode: channel.bg_mode ? channel.bg_mode : "black",'
  );
  fs.writeFileSync('src/skills/remotion-render/render.js',r,'utf8');
  console.log('patched');
} else console.log('already');
console.log(r.includes('bgMode: channel.bg_mode ?') ? 'ok' : 'fail');
