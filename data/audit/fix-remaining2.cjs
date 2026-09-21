const fs=require('fs');
let v=fs.readFileSync('src/skills/remotion-render/visual-engine/director/visual-director.js','utf8');
// Remove CAMERA_ALTS block completely
v=v.replace(/const CAMERA_ALTS = \{\r?\n(?:.*\r?\n)*?push_past:.*\r?\n\};\r?\n/,'');
console.log('after CAMERA_ALTS removal, includes:',v.includes('CAMERA_ALTS'));
 // Remove alts lines
v=v.replace(/\r?\n\s*const alts = CAMERA_ALTS\[shot\.camera\];\r?\n\s*if \(alts\) shot\.camera = alts\[Math\.floor\(rng\(\) \* alts\.length\)\];\r?\n/,'\n');
console.log('after alts removal, includes alts:',v.includes('const alts = CAMERA_ALTS'));
 // Ensure import
 if(!v.includes('from "../beat-interpreter')) {
   v=v.replace(/import \{ createHash \}/, 'import { interpretBeat } from "../beat-interpreter.js";\nimport { createHash }');
   console.log('added import');
 }
 fs.writeFileSync('src/skills/remotion-render/visual-engine/director/visual-director.js',v,'utf8');
 console.log('done');
 console.log('verify CAMERA_ALTS:',fs.readFileSync('src/skills/remotion-render/visual-engine/director/visual-director.js','utf8').includes('CAMERA_ALTS'));
