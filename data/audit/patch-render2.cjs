const fs=require('fs');
let r=fs.readFileSync('src/skills/remotion-render/render.js','utf8');
let old="      fonts: viSpec\r\n        ? { primary: viSpec.typography_primary, secondary: viSpec.typography_secondary }\r\n        : { primary: \"DM Sans\", secondary: \"Noto Serif\" },";
console.log('found', r.includes(old));
let nw="      fonts: viSpec\r\n        ? { primary: viSpec.typography_primary, secondary: viSpec.typography_secondary }\r\n        : { primary: \"DM Sans\", secondary: \"Noto Serif\" },\r\n      bgMode: channel.bg_mode ? channel.bg_mode : \"black\",";
if(r.includes(old)){
  r=r.replace(old, nw);
  fs.writeFileSync('src/skills/remotion-render/render.js',r,'utf8');
  console.log('patched2');
}
console.log(r.includes('bgMode: channel.bg_mode ?') ? 'ok' : 'fail');
