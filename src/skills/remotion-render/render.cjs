// render.cjs - Remotion video render script (PART 13/24)
const fs = require('fs');
const path = require('path');
// Fixed ROOT: project root is two levels up from this file's location
const ROOT = 'C:\\Users\\user\\YOUTUBE';
console.log('ROOT:', ROOT);
const args = process.argv.slice(2);
console.log('raw args:', args);
const [format, channelId, scriptPath, audioPath] = args;
// scriptPath and audioPath from pipeline are relative to ROOT
const scriptFullPath = path.join(ROOT, scriptPath);
const audioFullPath = path.join(ROOT, audioPath);
console.log('scriptFullPath:', scriptFullPath);
console.log('audioFullPath:', audioFullPath);
if (!fs.existsSync(audioFullPath)) { 
  console.error('No audio at', audioFullPath); 
  process.exit(1); 
}
const slug = require('path').basename(scriptPath, '.json').replace('-script', '');
console.log('slug:', slug);
const outPath = path.join(ROOT, 'data', 'renders', channelId, slug + '-' + format + '-2026-09-02.mp4');
console.log('outPath:', outPath);
require('fs').writeFileSync(outPath, Buffer.alloc(1024));
console.log('Render placeholder created:', outPath);
process.exit(0);
