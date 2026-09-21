const fs=require('fs');
// fix render.js
let r=fs.readFileSync('src/skills/remotion-render/render.js','utf8');
if(!r.includes('bgMode: channel.bg_mode')){
  r=r.replace(
    '      fonts: viSpec\n        ? { primary: viSpec.typography_primary, secondary: viSpec.typography_secondary }\n        : { primary: "DM Sans", secondary: "Noto Serif" },',
    '      fonts: viSpec\n        ? { primary: viSpec.typography_primary, secondary: viSpec.typography_secondary }\n        : { primary: "DM Sans", secondary: "Noto Serif" },\n      bgMode: channel.bg_mode ? channel.bg_mode : "black",'
  );
  fs.writeFileSync('src/skills/remotion-render/render.js',r,'utf8');
  console.log('fixed render.js bgMode');
} else console.log('render.js already has bgMode');

// fix directed-scene cameraTransform
let d=fs.readFileSync('src/skills/remotion-render/visual-engine/directed-scene.jsx','utf8');
if(d.includes('case "push_in"')){
  d=d.replace(/function cameraTransform\(camera, progress\) \{[\s\S]*?default: return "none";[\s\S]*?\}/, 'function cameraTransform(camera, progress) {\n  return "none";\n}');
  fs.writeFileSync('src/skills/remotion-render/visual-engine/directed-scene.jsx',d,'utf8');
  console.log('fixed cameraTransform');
} else console.log('cameraTransform already fixed');

// fix visual-director
let v=fs.readFileSync('src/skills/remotion-render/visual-engine/director/visual-director.js','utf8');
let changed=false;
if(v.includes('CAMERA_ALTS')){
  v=v.replace(/const CAMERA_ALTS = \{[\s\S]*?\};\n/, '');
  changed=true;
  console.log('removed CAMERA_ALTS');
}
if(v.includes('const alts = CAMERA_ALTS')){
  v=v.replace(/\s*const alts = CAMERA_ALTS\[shot\.camera\];\s*\n\s*if \(alts\) shot\.camera = alts\[Math\.floor\(rng\(\) \* alts\.length\)\];\n/, '\n');
  changed=true;
  console.log('removed alts reassignment');
}
if(!v.includes('interpretBeat')){
  v=v.replace("import { createHash }","import { interpretBeat } from \"../beat-interpreter.js\";\nimport { createHash }");
  // check actual import line - simpler add at top
  if(!v.includes('beat-interpreter')){
    v="import { interpretBeat } from \"../beat-interpreter.js\";\n"+v;
  }
  changed=true;
}
if(changed) fs.writeFileSync('src/skills/remotion-render/visual-engine/director/visual-director.js',v,'utf8');
console.log('visual-director fixed:',changed);

// verify
console.log('---verify---');
console.log('render bgMode:',fs.readFileSync('src/skills/remotion-render/render.js','utf8').includes('bgMode: channel.bg_mode'));
console.log('directed cameraTransform:',fs.readFileSync('src/skills/remotion-render/visual-engine/directed-scene.jsx','utf8').includes('return "none"') && !fs.readFileSync('src/skills/remotion-render/visual-engine/directed-scene.jsx','utf8').includes('push_in": return'));
console.log('visual-director CAMERA_ALTS:',fs.readFileSync('src/skills/remotion-render/visual-engine/director/visual-director.js','utf8').includes('CAMERA_ALTS'));
