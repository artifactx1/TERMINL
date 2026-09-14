import { moonWorld, enemyAt } from "./moon-mission.mjs";
import { drawMoonSky, drawMoonEffects } from "./moon-scenery.js";

export function drawRobot(ctx,x,y,tick,{face=1,moving=false,air=false,shield=false,ghost=false}={}) {
  ctx.save();ctx.translate(Math.round(x+15),Math.round(y+22));ctx.scale(face,1);ctx.globalAlpha=ghost ? .3 : 1;
  if(shield){ctx.strokeStyle="#87e8ff";ctx.lineWidth=2;ctx.shadowBlur=12;ctx.shadowColor="#87e8ff";ctx.beginPath();ctx.ellipse(0,0,27,33,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
  const step=moving&&!air?Math.sin(tick*.4)*4:air?-3:0;
  ctx.fillStyle="#060b14";ctx.fillRect(-18,-25,36,29);ctx.fillRect(-11,3,22,13);
  ctx.fillStyle=ghost?"#a58fe4":"#c5d2b4";ctx.fillRect(-16,-23,32,25);ctx.fillStyle="#71846c";ctx.fillRect(-16,0,32,4);ctx.fillRect(-11,5,22,10);
  ctx.fillStyle="#f3ffe3";ctx.fillRect(-15,-22,30,2);ctx.fillRect(-15,-20,2,17);
  ctx.fillStyle="#183c2b";ctx.fillRect(-12,-19,25,17);ctx.fillStyle="#7dff5c";ctx.shadowColor="#7dff5c";ctx.shadowBlur=7;
  ctx.fillRect(-6,-14,4,5);ctx.fillRect(5,-14,4,5);ctx.fillRect(-3,-5,9,2);ctx.shadowBlur=0;
  ctx.fillStyle="#d6ffe329";ctx.fillRect(-11,-18,22,3);ctx.fillRect(-11,-14,2,9);ctx.fillStyle="#07140e33";for(let row=-17;row< -3;row+=3)ctx.fillRect(-11,row,23,1);
  ctx.fillStyle="#eaf3dc";ctx.fillRect(10,6,3,3);ctx.fillStyle="#ffb354";ctx.fillRect(-7,7,4,4);
  ctx.fillStyle="#73896b";ctx.fillRect(-19,4+step,5,11);ctx.fillRect(15,4-step,5,11);
  ctx.fillStyle="#b1c69a";ctx.fillRect(-10,14+step,7,8);ctx.fillRect(4,14-step,7,8);
  ctx.fillStyle="#475e45";ctx.fillRect(-13,20+step,11,4);ctx.fillRect(3,20-step,11,4);
  ctx.fillStyle="#7dff5c";ctx.fillRect(-2,-30,3,7);ctx.fillRect(-4,-32,7,3);
  if(air){ctx.fillStyle="#66d4ff";ctx.fillRect(-7,23,4,5+tick%6);ctx.fillRect(5,23,4,4+tick%5);}
  ctx.restore();
}

export function drawMoon(ctx,s,width,{art=null,ghost=null}={}) {
  const world=moonWorld(s.level),{platforms:PLATFORMS,pickups:PICKUPS,enemies:ENEMIES,checkpoints:CHECKPOINTS,ground:GROUND}=world;
  const height=540,camera=Math.max(0,Math.min(s.x-width*.3,world.width-width));
  ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;
  drawMoonSky(ctx,s,width,camera,world);
  ctx.save();ctx.translate(-camera,0);
  // Neon signage makes this a place, not a board of controls.
  const signs=[[180,240,world.name.toUpperCase(),world.accent],[world.width*.28,210,world.tag,world.accent],[world.width*.62,210,"STILL EARLY",world.accent],[world.finish-400,195,"EXIT THIS WAY →",world.accent]];
  for(const [x,y,text,color]of signs){if(x-camera>width+200||x-camera< -300)continue;ctx.fillStyle="#08131c";ctx.fillRect(x,y,175,43);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(x+3,y+3,169,37);ctx.fillStyle=color;ctx.font="bold 12px monospace";ctx.textAlign="center";ctx.shadowBlur=8;ctx.shadowColor=color;ctx.fillText(text,x+87,y+26);ctx.shadowBlur=0;ctx.fillStyle="#20352f";ctx.fillRect(x+18,y+43,5,470-y-43);ctx.fillRect(x+153,y+43,5,470-y-43);}
  if(art?.complete&&art.naturalWidth){for(const x of [680,world.width*.4,world.width*.7]){ctx.fillStyle="#27372c";ctx.fillRect(x-5,235,100,108);ctx.drawImage(art,x,240,90,90);ctx.fillStyle="#75a36c";ctx.fillRect(x,335,90,3);}}
  // Toxic liquidity pools below gaps. Their bright surface makes danger legible.
  for(let i=0;i<GROUND.length-1;i++){const x=GROUND[i][1],w=GROUND[i+1][0]-x;ctx.fillStyle="#35232a";ctx.fillRect(x,496,w,60);ctx.fillStyle=world.hazard;ctx.fillRect(x,495,w,5);for(let n=0;n<w;n+=17){ctx.fillStyle=n%2?world.accent:world.hazard;ctx.fillRect(x+n,492+Math.sin(s.tick/12+n)*3,12,4);}ctx.fillStyle=world.hazard+"44";ctx.fillRect(x,501,w,16);}
  for(const p of PLATFORMS){
    if(p.x-camera>width+50||p.x+p.w-camera< -50)continue;
    const collapse=s.crumbling[p.id],age=collapse===undefined?-1:s.tick-collapse;
    if(age>30&&age<240)continue;
    const jitter=p.rug&&age>=0&&age<=30?Math.sin(age*2)*3:0;
    const top=p.y+jitter;ctx.fillStyle=p.rug?"#48344b":world.rock;ctx.fillRect(p.x,top,p.w,p.h);
    ctx.fillStyle=p.rug?"#db96aa":world.edge;ctx.fillRect(p.x,top,p.w,5);ctx.fillStyle=p.rug?"#eac27b":world.accent;ctx.fillRect(p.x,top,p.w,2);
    ctx.fillStyle=p.rug?"#795167":"#ffffff0d";
    for(let xx=p.x+4;xx<p.x+p.w-8;xx+=29){ctx.fillRect(xx,top+10,22,8);if(p.h>30)for(let yy=top+28;yy<540;yy+=20)ctx.fillRect(xx+(yy%40?8:0),yy,20,12);}
    if(!p.rug){
      const shade=ctx.createLinearGradient(0,top+5,0,top+p.h);shade.addColorStop(0,"#00000000");shade.addColorStop(1,"#04081588");ctx.fillStyle=shade;ctx.fillRect(p.x,top+5,p.w,p.h-5);
      ctx.fillStyle="#ffffff1f";ctx.fillRect(p.x,top+5,3,p.h-5);
      if(p.h<40){ctx.fillStyle=world.accent+"80";ctx.fillRect(p.x+12,top+p.h-3,p.w-24,2);ctx.fillStyle="#d6eefc66";for(let n=8;n<p.w;n+=32)ctx.fillRect(p.x+n,top+10,2,2);}
      else{ctx.fillStyle=world.edge+"66";for(let n=12;n<p.w;n+=43)ctx.fillRect(p.x+n,top+5,12,3);}
    }
    if(p.rug){ctx.fillStyle="#2c1833";ctx.font="7px monospace";ctx.textAlign="center";ctx.fillText("RUG PULL",p.x+p.w/2,top+15);}
  }
  for(const p of PICKUPS){if(s.collected.includes(p.id)||p.x-camera< -30||p.x-camera>width+30)continue;const y=p.y+Math.sin(s.tick/14+p.x)*3;
    ctx.shadowBlur=10;ctx.shadowColor=p.kind==="shield"?"#8ee8ff":p.kind==="gem"?"#b79dff":"#ffcc67";
    if(p.kind==="coin"){const w=5+Math.abs(Math.sin(s.tick/13+p.x))*9;ctx.fillStyle="#d9943c";ctx.fillRect(p.x-w/2-2,y-10,w+4,20);ctx.fillStyle="#ffe095";ctx.fillRect(p.x-w/2,y-8,w,16);ctx.fillStyle="#a2702f";ctx.fillRect(p.x-1,y-4,2,8);}
    else{ctx.fillStyle=p.kind==="shield"?"#8ee8ff":"#b79dff";ctx.beginPath();ctx.moveTo(p.x,y-15);ctx.lineTo(p.x+13,y);ctx.lineTo(p.x,y+15);ctx.lineTo(p.x-13,y);ctx.closePath();ctx.fill();ctx.fillStyle="#edfaff";ctx.fillRect(p.x-3,y-6,4,7);}ctx.shadowBlur=0;
  }
  for(const raw of ENEMIES){if(s.defeated.includes(raw.id))continue;const e=enemyAt(raw,s.tick,s.seed);if(e.x-camera< -50||e.x-camera>width+50)continue;const step=Math.sin(s.tick*.2)*3;
    ctx.fillStyle="#391826";ctx.fillRect(e.x-2,e.y+3,36,29);ctx.fillStyle="#ed6c78";ctx.fillRect(e.x,e.y,32,26);ctx.fillStyle="#ffad90";ctx.fillRect(e.x+3,e.y+2,26,5);
    ctx.fillStyle="#351d30";ctx.fillRect(e.x+5,e.y+10,6,6);ctx.fillRect(e.x+21,e.y+10,6,6);ctx.fillRect(e.x+12,e.y+20,8,3);ctx.fillStyle="#ffdaac";ctx.fillRect(e.x+7,e.y+10,2,3);ctx.fillRect(e.x+23,e.y+10,2,3);
    ctx.fillStyle="#9e4764";ctx.fillRect(e.x+2,e.y+27+step,10,5);ctx.fillRect(e.x+21,e.y+27-step,10,5);ctx.fillStyle="#dd7186";ctx.fillRect(e.x+14,e.y-12,4,14);
  }
  for(const x of CHECKPOINTS){const on=s.checkpoint>=x;ctx.fillStyle="#859890";ctx.fillRect(x,387,4,83);ctx.fillStyle=on?"#9bfd7f":"#638b8e";ctx.fillRect(x+4,390,32,19);ctx.fillStyle="#1a3824";ctx.font="10px monospace";ctx.textAlign="left";ctx.fillText(on?"✓":"⚑",x+14,404);}
  // Rocket finish: visible long before the trigger, with a checkered landing pad.
  const rx=world.finish+20;ctx.fillStyle="#364652";ctx.fillRect(rx-30,453,115,17);for(let i=0;i<10;i++){ctx.fillStyle=i%2?"#d5e4c5":"#24382f";ctx.fillRect(rx-30+i*11,453,11,5);}
  ctx.fillStyle="#e5e7d3";ctx.fillRect(rx,345,40,101);ctx.fillRect(rx+5,328,30,17);ctx.fillStyle="#ff9470";ctx.fillRect(rx+10,317,20,12);ctx.fillRect(rx+16,307,8,11);ctx.fillRect(rx-12,409,12,37);ctx.fillRect(rx+40,409,12,37);
  ctx.fillStyle="#364e56";ctx.fillRect(rx+8,355,24,26);ctx.fillStyle="#8deaba";ctx.fillRect(rx+12,359,16,18);ctx.fillStyle="#c4e9e0";ctx.fillRect(rx+14,360,5,7);ctx.fillStyle="#7c8d83";ctx.fillRect(rx+5,439,30,8);
  ctx.fillStyle="#ffc678";ctx.fillRect(rx+10,447,20,5+Math.sin(s.tick/5)*3);ctx.fillStyle="#e3f6bf";ctx.font="bold 11px monospace";ctx.textAlign="center";ctx.fillText(world.level===9?"TRANQUILITY BASE · HOME":"ROCKET READY · BOARD HERE",rx+20,285);
  drawMoonEffects(ctx,s,world);
  if(ghost&&!ghost.dead)drawRobot(ctx,ghost.x,ghost.y,ghost.tick,{face:ghost.face,moving:Math.abs(ghost.vx)>10,air:!ghost.grounded,ghost:true});
  if(!s.invulnerable||s.tick%8<5)drawRobot(ctx,s.x,s.y,s.tick,{face:s.face,moving:Math.abs(s.vx)>10,air:!s.grounded,shield:s.shield});
  if(s.pulse?.text){const age=s.tick-s.pulse.tick;ctx.globalAlpha=Math.max(0,1-age/65);ctx.fillStyle=s.pulse.kind==="hit"?"#ffa093":"#ecffb7";ctx.font="bold 13px monospace";ctx.textAlign="center";ctx.shadowColor="#080d18";ctx.shadowBlur=4;ctx.fillText(s.pulse.text,s.x+15,s.y-16-age*.25);ctx.shadowBlur=0;ctx.globalAlpha=1;}
  ctx.restore();
  // Foreground grasses, dust, and a small location label anchor the world.
  const vignette=ctx.createLinearGradient(0,490,0,540);vignette.addColorStop(0,"#050b1800");vignette.addColorStop(1,"#050b1877");ctx.fillStyle=vignette;ctx.fillRect(0,490,width,50);
}
