import {FINISHERS,FINISHER_IMPACT_TICK,FINISHER_DURATION_TICKS} from './rumble-finishers.mjs';
import {FINISHER_SPRITES} from './rumble-finisher-sprite-data.mjs';
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{const t=clamp(n);return t*t*(3-2*t);};
function ring(c,x,y,r,color,alpha=1){c.save();c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=4;c.beginPath();c.ellipse(x,y,Math.max(1,r),Math.max(1,r*.32),0,0,Math.PI*2);c.stroke();c.restore();}
function sprite(c,character,index,x,image){
  const sheet=FINISHER_SPRITES[character];if(!image?.naturalWidth||!sheet)return false;
  const f=sheet.frames[index],scale=sheet.worldHeight/sheet.referenceHeight;
  c.drawImage(image,f.x,f.y,f.width,f.height,x-f.pivotX*scale,500-f.footY*scale,f.width*scale,f.height*scale);return true;
}
/** Presentation only: no health, winner or match-state mutations. */
export function drawFinisher(c,state,{images,reducedMotion,shake,drawFighter}){
  const {player,character}=state.finisher,move=FINISHERS[character],frame=state.phaseTick;
  const hit=FINISHER_IMPACT_TICK,after=frame-hit,travel=ease(after/65),settle=ease((after-65)/30);
  const attacker=state.players[player],loser=state.players[1-player],face=attacker.x<=loser.x?1:-1;
  c.fillStyle='#060907c9';c.fillRect(0,0,1000,600);
  c.save();
  if(!reducedMotion){const zoom=1+.06*Math.sin(clamp(frame/FINISHER_DURATION_TICKS)*Math.PI);c.translate(500,330);c.scale(zoom,zoom);c.translate(-500,-330);if(shake&&after>=0&&after<12)c.translate(Math.sin(after*2)*3,Math.cos(after*3)*2);}
  if(face<0){c.translate(1000,0);c.scale(-1,1);}
  const attackerX=350+80*ease((frame-40)/20);
  const targetX=frame<hit?550:reducedMotion?680:550+220*travel;
  let targetY=0;
  if(!reducedMotion&&after>=0&&after<95&&move.effect!=='freeze')targetY=Math.sin(travel*Math.PI)*(move.effect==='launch'?250:move.effect==='shockwave'?100:150);
  const fallen=after>=(move.effect==='freeze'?85:65);
  const target={...loser,x:targetX,y:targetY,face:-1,vx:0,action:null,crouching:false,grounded:true,hp:1,stun:0,blockstun:0,knockdown:0,previewClip:fallen?'defeat':'hit'};
  drawFighter(c,target,{tick:reducedMotion?0:state.tick,image:images[loser.character]});
  if(move.effect==='freeze'&&after>=0&&after<85){
    c.fillStyle='#77baff66';c.strokeStyle='#b6eaff';c.lineWidth=3;c.beginPath();c.moveTo(targetX-60,500);c.lineTo(targetX-65,295);c.lineTo(targetX,260);c.lineTo(targetX+65,295);c.lineTo(targetX+60,500);c.closePath();c.fill();c.stroke();
  }
  const pose=frame<48?0:frame<135?1:2;
  if(move.effect==='glitch'&&frame>=35&&frame<85&&!reducedMotion){for(let i=3;i>=1;i--){c.save();c.globalAlpha=.1+(3-i)*.05;sprite(c,character,pose,attackerX-i*35,images[`finisher-${character}`]);c.restore();}}
  if(!sprite(c,character,pose,attackerX,images[`finisher-${character}`]))drawFighter(c,{...attacker,x:attackerX,y:0,vx:0,face:1,action:null,grounded:true,stun:0,knockdown:0,previewClip:pose===0?'anticipation':pose===1?'active':'victory'},{tick:state.tick,image:images[character]});
  if(after>=0&&after<95){
    const t=clamp(after/95),radius=reducedMotion?85:35+t*190;
    ring(c,550,move.effect==='shockwave'?500:390,radius,move.color,1-t);
    if(move.effect==='shockwave')ring(c,550,500,radius*.7,move.color,.7*(1-t));
    if(move.effect==='crystal'||move.effect==='freeze')for(let i=0;i<10;i++){
      const angle=i*Math.PI/5,dist=reducedMotion?60:25+t*145,x=550+Math.cos(angle)*dist,y=385+Math.sin(angle)*dist*.65;
      c.save();c.globalAlpha=1-t;c.fillStyle=move.color;c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(0,-13);c.lineTo(6,0);c.lineTo(0,13);c.lineTo(-6,0);c.closePath();c.fill();c.restore();
    }
  }
  if(fallen)ring(c,targetX,505,55+settle*25,move.color,.35);
  c.restore();
  c.fillStyle='#060907';c.fillRect(0,0,1000,65);c.fillRect(0,550,1000,50);
  c.textAlign='center';c.fillStyle=move.color;c.font='700 26px ui-monospace,monospace';c.fillText(move.name.toUpperCase(),500,43);
  c.fillStyle='#edf7ee';c.font='700 13px ui-monospace,monospace';c.fillText(frame<135?'FINISHER':"TOTAL KNOCKOUT",500,581);
}
