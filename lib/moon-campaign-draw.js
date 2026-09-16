import {drawMoon} from './moon-draw.js';
import {campaignWorld,platformAt,campaignEnemy,hazardPhase} from './moon-campaign.mjs';

export function drawCampaign(ctx,state,width){
  const world=campaignWorld(state.level),camera=Math.max(0,Math.min(state.x-width*.3,world.width-width));
  drawMoon(ctx,state,width,{world:{...world,platforms:world.platforms.map(p=>platformAt(p,state.tick))},enemyPosition:campaignEnemy});
  ctx.save();ctx.translate(-camera,0);
  for(const h of world.hazards){
    if(h.x-camera>width+50||h.x-camera< -50)continue;
    const phase=hazardPhase(h,state.tick);
    ctx.fillStyle='#263c49';ctx.fillRect(h.x-5,h.y+h.h-7,h.w+10,10);
    ctx.fillStyle=phase==='warning'?'#ffe38b':'#718b91';ctx.fillRect(h.x,h.y+h.h-5,h.w,4);
    if(phase==='warning'){ctx.fillStyle='#ffdc7c';ctx.font='bold 22px monospace';ctx.textAlign='center';ctx.fillText('!',h.x+h.w/2,h.y+20);}
    if(phase==='active'){ctx.fillStyle=world.biome==='station'?'#86e8ff':'#ff8054';ctx.fillRect(h.x,h.y,h.w,h.h);ctx.fillStyle='#fff2b6';for(let i=0;i<3;i++)ctx.fillRect(h.x+4+i*11,h.y+(state.tick+i)%8,5,h.h-8);}
  }
  const boss=state.boss;
  if(boss?.hp){
    const {x,y}=boss,open=boss.phase==='exposed';
    ctx.globalAlpha=boss.invulnerable&&state.tick%6<3?.55:1;
    ctx.fillStyle='#111b2d';ctx.fillRect(x-8,y+9,112,94);
    ctx.fillStyle=open?'#8cdbf4':'#8b70b3';ctx.fillRect(x,y,96,91);
    ctx.fillStyle='#dbccf1';ctx.fillRect(x+4,y+3,88,7);
    ctx.fillStyle='#17293b';ctx.fillRect(x+11,y+18,74,42);
    ctx.fillStyle=open?'#c1ff9a':boss.phase==='warning'?'#ffe097':'#ff8391';
    ctx.fillRect(x+22,y+29,15,10);ctx.fillRect(x+59,y+29,15,10);ctx.fillRect(x+35,y+48,26,4);
    ctx.fillStyle='#a3a8c3';ctx.fillRect(x-12,y+51,15,46);ctx.fillRect(x+93,y+51,15,46);
    ctx.fillStyle='#4f5274';const step=boss.phase==='charge'?Math.sin(state.tick*.25)*5:0;
    ctx.fillRect(x+8,y+91,28,25+step);ctx.fillRect(x+62,y+91,28,25-step);
    ctx.fillStyle='#f1c877';ctx.fillRect(x+28,y-14,12,17);ctx.fillRect(x+47,y-22,12,25);ctx.fillRect(x+66,y-14,12,17);
    ctx.globalAlpha=1;ctx.fillStyle=open?'#a2ffbe':'#ffcc93';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText(open?'STOMP NOW!':boss.phase==='warning'?'CHARGE INCOMING':'ARMOR UP',x+48,y-35);
    for(const shot of state.shots){ctx.fillStyle='#ffb16f';ctx.fillRect(shot.x,shot.y,shot.w,shot.h);ctx.fillStyle='#fff1b8';ctx.fillRect(shot.x+4,shot.y+4,shot.w-8,4);}
    ctx.fillStyle='#b98afa';for(let i=0;i<4;i++)ctx.fillRect(world.finish-24+i*12,315,4,155);
  }
  ctx.restore();
}
