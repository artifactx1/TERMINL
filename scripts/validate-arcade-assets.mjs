/** Asset checks are read-only. --release intentionally rejects development art. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ANIMATION_CLIPS, RIG_ANCHORS, fighterPose, attachmentAnchors } from '../lib/arcade/rumble-render.js';
import { RUMBLE_SPRITES } from '../lib/arcade/rumble-sprites.mjs';
import { SOUND_CUES } from '../lib/arcade/rumble-audio.js';
import { RACE_SOUND_CUES } from '../lib/arcade/race-audio.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const release=process.argv.includes('--release');
const manifest=JSON.parse(await fs.readFile(path.join(root,'data/arcade-assets.json'),'utf8'));
const errors=[],warnings=[],ids=new Set();let decoded=0;
const fail=(id,message)=>errors.push(`${id}: ${message}`);
if(manifest.version!==1)fail('manifest','Unsupported version');
if(!Array.isArray(manifest.assets)||!manifest.assets.length)throw new Error('No asset inventory');
for(const a of manifest.assets){
  if(!a.id||ids.has(a.id))fail(a.id||'asset','Missing or duplicate ID');ids.add(a.id);
  for(const key of ['role','source','provenance','rights','review'])if(typeof a[key]!=='string'||!a[key].trim())fail(a.id,`Missing ${key}`);
  if(!a.games?.length||!a.variants?.length)fail(a.id,'Missing game/variant declarations');
  if(a.review!=='approved'||a.humanApproved!==true){if(release)fail(a.id,'Not human-approved for release');else warnings.push(`${a.id}: development-only, human approval pending`);}
  if(!Number.isInteger(a.decodedBudgetBytes)||a.decodedBudgetBytes<0)fail(a.id,'Invalid decoded memory budget');
  const absolute=path.resolve(root,a.source||'');
  if(!absolute.startsWith(root+path.sep)){fail(a.id,'Source outside repository');continue;}
  try{await fs.access(absolute);}catch{fail(a.id,'Source missing');continue;}
  if(a.dimensions){
    try{
      const meta=await sharp(absolute).metadata();const w=meta.width,h=meta.height;
      if(w!==a.dimensions.width||h!==a.dimensions.height)fail(a.id,'Decoded dimensions differ from manifest');
      if(!w||!h||w>4096||h>4096)fail(a.id,'Texture exceeds dimension limit');
      // A browser Canvas/Image commonly decodes to RGBA even for RGB WebP.
      const bytes=(w||0)*(h||0)*4;decoded+=bytes;if(bytes>a.decodedBudgetBytes)fail(a.id,'Decoded texture exceeds budget');
      for(const frame of a.frames||[]){if(![frame.x,frame.y,frame.width,frame.height].every(Number.isInteger)||frame.x<0||frame.y<0||frame.width<=0||frame.height<=0||frame.x+frame.width>w||frame.y+frame.height>h)fail(a.id,'Invalid atlas frame');}
    }catch{fail(a.id,'Image cannot be decoded');}
  }else{decoded+=Math.max(0,a.decodedBudgetBytes||0);if(!a.geometryBudget)fail(a.id,'No geometry/runtime budget');}
  if(a.role==='character-sprite-atlas'){
    const sheet=RUMBLE_SPRITES[a.character];
    if(!sheet||a.source!=='public'+sheet.src||JSON.stringify(a.frames)!==JSON.stringify(sheet.frames))fail(a.id,'Sprite manifest differs from runtime');
    if(a.frames?.length!==9)fail(a.id,'Expected nine illustrated poses');
  }
  if(a.role==='articulated-character-rig'){
    if(!manifest.assets.some(ref=>ref.id===a.reference&&ref.role==='character-reference-portrait'))fail(a.id,'Missing canonical reference');
    const bounds=a.geometryBudget?.bounds;
    if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite))fail(a.id,'Invalid rig bounds');
    for(const name of Object.keys(RIG_ANCHORS)){
      const at=a.anchors?.[name];if(!Array.isArray(at)||at.length!==2||!at.every(Number.isFinite)){fail(a.id,`Invalid anchor ${name}`);continue;}
      if(bounds&&(at[0]<bounds[0]||at[0]>bounds[2]||at[1]<bounds[1]||at[1]>bounds[3]))fail(a.id,`Out-of-bounds anchor ${name}`);
      if(at[0]!==RIG_ANCHORS[name][0]||at[1]!==RIG_ANCHORS[name][1])fail(a.id,`Anchor ${name} differs from runtime bind pose`);
    }
    for(const clip of ANIMATION_CLIPS)if(!a.clips?.includes(clip))fail(a.id,`Missing animation ${clip}`);
    for(const clip of ANIMATION_CLIPS){
      const fighter={character:a.character,hp:1000,grounded:true,x:500,y:0,face:1,previewClip:clip};
      const pose=fighterPose(fighter,25),posedAnchors=attachmentAnchors(fighter,25);
      if(pose.clip!==clip)fail(a.id,`Animation ${clip} has no working sampler`);
      for(const [name,at] of Object.entries(posedAnchors))if(!at.every(Number.isFinite))fail(a.id,`Animation ${clip} generates an invalid ${name} anchor`);
    }
  }
  if(a.role==='music-ambience-and-effects')for(const clip of SOUND_CUES)if(!a.clips?.includes(clip))fail(a.id,`Missing audio cue ${clip}`);
  if(a.role==='racing-music-ambience-and-effects')for(const clip of RACE_SOUND_CUES)if(!a.clips?.includes(clip))fail(a.id,`Missing racing cue ${clip}`);
}
if(!Number.isInteger(manifest.decodedMemoryBudgetBytes)||decoded>manifest.decodedMemoryBudgetBytes)fail('manifest','Aggregate decoded-memory budget exceeded');
if(release&&manifest.releaseApproved!==true)fail('manifest','Release approval gate is closed');
console.log(JSON.stringify({ok:!errors.length,mode:release?'release':'development',assets:manifest.assets.length,decodedBytes:decoded,budgetBytes:manifest.decodedMemoryBudgetBytes,warnings,errors},null,2));
if(errors.length)process.exitCode=1;
