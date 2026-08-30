#!/usr/bin/env node
/* Dump per-frame beat + visual states for the sampled frames, using the REAL
   build pipeline exactly as render-frame.mjs does. */
import { readFileSync } from 'fs';
import { buildMgPackage } from '../../../src/skills/remotion-render/compositions/mg-package.js';
import { chunkTextClauseAware } from '../../../src/skills/remotion-render/compositions/beats.js';
import { narrationSections } from '../../../src/utils/script-narration.js';

const ROOT = 'C:/Users/user/YOUTUBE';
const script = JSON.parse(readFileSync(`${ROOT}/data/research/1/debt-snowball-vs-debt-avalanche-shorts-script.json`, 'utf8'));
const srt = readFileSync(`${ROOT}/data/audit/14/measure/debt-snowball-shorts-vo.srt`, 'utf8');
const sections = narrationSections(script)
  .filter((s) => s.voiceover && s.voiceover.trim())
  .map((s) => ({
    id: s.id, timing: s.timing, voiceover: s.voiceover,
    content: chunkTextClauseAware(s.voiceover),
    visualCue: s.visual_cue || null, bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
    textOverlay: s.text_overlay || null, animationCue: s.animation_cue || null,
    transitionOut: s.transition_out || null, beats: Array.isArray(s.beats) ? s.beats : null,
  }));
const channel = JSON.parse(readFileSync(`${ROOT}/config/channels.json`, 'utf8')).channels
  .find((c) => c.id === 1 || c.channel_id === '1');
const mg = buildMgPackage(srt, {
  sections, hook: script.hook || null, channel,
  iconMap: channel.icon_map || null, bRollFiles: [], imageForSection: () => null,
  totalMs: 73130,
  revealPlacement: channel.script_template && channel.script_template.reveal_placement,
  silenceTechnique: channel.sfx_profile && channel.sfx_profile.silence_technique,
});
const fps = 30;
console.log('total frames', mg.totalFrames);
const frames = { 0:[0,0], 1:[244,8.126], 2:[488,16.251], 3:[731,24.377], 4:[975,32.502], 5:[1219,40.628], 6:[1463,48.753], 7:[1706,56.879], 8:[1950,65.004], 9:[2191,73.03] };
console.log('\n=== ALL BEATS (frame ranges) ===');
mg.beats.forEach((b,i)=>console.log(`beat ${i} start=${b.startFrame} dur=${b.durationInFrames} end=${b.startFrame+b.durationInFrames} archetype=${b.archetype} startFrameRaw=${b.anchorFrame||''}`));
console.log('\n=== LAST 12 BEATS around idx 2191 ===');
mg.beats.forEach((b,i)=>{ if(b.startFrame>=2100){ console.log(`beat ${i} start=${b.startFrame} dur=${b.durationInFrames} end=${b.startFrame+b.durationInFrames} strat=${b.visualPlan&&b.visualPlan.strategy} phrase=${JSON.stringify(String((b.visualPlan&&b.visualPlan.supporting&&b.visualPlan.supporting.phrase)||'').slice(0,30))}`); } });
console.log('totalFrames', mg.totalFrames);
for (const [fn, [idx]] of Object.entries(frames)) {
  const beat = mg.beats.find((b) => idx >= b.startFrame && idx < b.startFrame + b.durationInFrames);
  console.log('--------------');
  console.log(`frame-${fn} idx=${idx}`);
  if (!beat) { console.log('  NO BEAT'); continue; }
  console.log('  anchorFrame', beat.anchorFrame, 'start', beat.startFrame, 'dur', beat.durationInFrames, 'archetype', beat.archetype);
  console.log('  text:', JSON.stringify(String(beat.text||'').slice(0,60)));
  console.log('  strategy:', beat.visualPlan && beat.visualPlan.strategy);
  console.log('  states:', JSON.stringify((beat.visualStates||[]).map(s=>({st:s.startFrame,e:s.end,d:s.dur??(s.end-s.start),a:!!s.anchored,k:s.key}))));
  console.log('  scene.headline:', beat.scene && beat.scene.headline);
  const vs = beat.visualStates || [];
  for (const s of vs) {
    console.log(`    state ${s.name} start=${s.startFrame} end=${s.endFrame} anchored=${!!s.anchored} sustaining=${!!s.sustaining}`);
  }
  // replicate useValueProgress + ease at the sampled absolute frame
  const anchored = (vs||[]).find((x)=>x.anchored);
  const rawP = (!anchored || !(anchored.startFrame > 0)) ? 1 : Math.max(0,Math.min(1, idx / anchored.startFrame));
  // ease = EASE_OUT bezier(0.16,1,0.3,1) evaluated at rawP
  function bez(p){
    const cx0=0.16,cy0=1,cx1=0.3,cy1=1;
    let lo=0,hi=1,px=p;
    for(let i=0;i<20;i++){const t=(lo+hi)/2;const x=3*(1-t)*(1-t)*t*cx0+3*(1-t)*t*t*cx1+t*t*t;if(x<px)lo=t;else hi=t;}
    const t=(lo+hi)/2;
    return 3*(1-t)*(1-t)*t*cy0+3*(1-t)*t*t*cy1+t*t*t;
  }
  console.log(`  useValueProgress -> rawP=${rawP.toFixed(3)} eSubject(eased)=${bez(rawP).toFixed(3)}  (anchored found=${!!anchored})`);
}
