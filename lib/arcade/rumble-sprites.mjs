import {RUMBLE_SPRITES} from './rumble-sprite-data.mjs';
export {RUMBLE_SPRITES};

/** Authored sheet poses follow simulation phases; artwork never resolves a hit. */
export function spriteFrameFor(f,pose){
  const id=f.action?.id||'heavy',clip=pose.clip;
  if(clip==='victory')return 8;
  if(['hit','knockdown','defeat'].includes(clip))return 6;
  if(['guard','crouch','landing','wake-up','anticipation'].includes(clip))return 7;
  if(clip==='jump')return 5;
  if(clip==='active'||clip==='recovery'&&pose.attack>.35){
    if(/crouch|sweep|low/i.test(id))return 4;
    if(/air/i.test(id))return 5;
    if(id==='light')return 1;
    if(id==='heavy'||id==='downSpecial')return 2;
    return 3;
  }
  return 0;
}

export function drawIllustratedFighter(c,f,pose,image,{tick=0,scale=1}={}){
  const sheet=RUMBLE_SPRITES[f.character];
  if(!sheet||!image?.complete||!image.naturalWidth)return false;
  const index=spriteFrameFor(f,pose),frame=sheet.frames[index];
  // Every pose uses the idle scale, preserving anatomy through kicks, crouches
  // and raised arms instead of stretching every frame to the same rectangle.
  const size=sheet.worldHeight/sheet.frames[0].height*scale;
  let lean=0,lift=0,squash=1;
  if(pose.clip==='idle'){squash=1+Math.sin(tick*.06)*.004;}
  if(pose.clip.startsWith('walk')){lift=-Math.abs(Math.sin(tick*.22))*2*scale;lean=(pose.clip==='walk-forward'?1:-1)*.025;}
  if(pose.clip==='crouch'){squash=.78;}
  if(pose.clip==='landing'||pose.clip==='wake-up'){squash=.88;}
  if(pose.clip==='anticipation'){lean=-.025;}
  if(pose.clip==='active'){lean=.025;}
  if(pose.clip==='knockdown'||pose.clip==='defeat'){
    lean=-1.4;
    // Keep the rotated pose resting on the floor, including either shoe.
    const left=-frame.pivotX*size,right=(frame.width-frame.pivotX)*size;
    const top=-frame.footY*size,bottom=(frame.height-frame.footY)*size;
    lift=-Math.max(...[[left,top],[left,bottom],[right,top],[right,bottom]].map(([x,y])=>x*Math.sin(lean)+y*Math.cos(lean)));
  }
  c.save();c.translate(f.x||0,500-(f.y||0)+lift);c.scale(f.face||1,squash);c.rotate(lean);
  if(f.silhouette)c.filter='brightness(0)';
  // The original detailed pixels are sampled directly. Never send these sheets
  // through the coarse vector-rig scratch surface.
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  c.drawImage(image,frame.x,frame.y,frame.width,frame.height,-frame.pivotX*size,-frame.footY*size,frame.width*size,frame.height*size);
  c.restore();return true;
}
