const fs=require('fs');
let d=fs.readFileSync('src/skills/remotion-render/visual-engine/directed-scene.jsx','utf8');
let before=d;
d=d.replace('function cameraTransform(camera, progress) {\n  return "none";\n}\n}\n\nfunction shotPhase','function cameraTransform(camera, progress) {\n  return "none";\n}\n\nfunction shotPhase');
console.log('changed', before!==d);
fs.writeFileSync('src/skills/remotion-render/visual-engine/directed-scene.jsx',d,'utf8');
