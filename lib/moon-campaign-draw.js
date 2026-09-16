import {drawMoon} from './moon-draw.js';
import {campaignWorld,platformAt,campaignEnemy,hazardPhase,hazardAt} from './moon-campaign.mjs';

export function drawCampaign(ctx,state,width){
  const world=campaignWorld(state.level),camera=Math.max(0,Math.min(state.x-width*.3,world.width-width));
  drawMoon(ctx,state,width,{world:{...world,platforms:world.platforms.map(p=>platformAt(p,state.tick))},enemyPosition:campaignEnemy});
  ctx.save();ctx.translate(-camera,0);
  for(const h of world.hazards){
    if(h.x-camera>width+200||h.x-camera< -200)continue;
    const phase=hazardPhase(h,state.tick);
    if(h.type==='spikes'){
      ctx.fillStyle='#4f253a';ctx.fillRect(h.x-3,h.y+h.h-5,h.w+6,8);
      for(let n=0;n<h.w;n+=14){ctx.fillStyle='#ff8b95';ctx.beginPath();ctx.moveTo(h.x+n,h.y+h.h);ctx.lineTo(h.x+n+7,h.y);ctx.lineTo(h.x+Math.min(n+14,h.w),h.y+h.h);ctx.fill();ctx.fillStyle='#ffe6c3';ctx.fillRect(h.x+n+6,h.y+3,2,7);}
      continue;
    }
    if(h.type==='saw'){
      const p=hazardAt(h,state.tick),cx=p.x+p.w/2,cy=p.y+p.h/2;
      ctx.strokeStyle='#899fa177';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,h.y-h.range);ctx.lineTo(cx,h.y+h.range+h.h);ctx.stroke();
      ctx.save();ctx.translate(cx,cy);ctx.rotate(state.tick*.13);ctx.fillStyle='#ffe1a3';
      for(let n=0;n<8;n++){ctx.rotate(Math.PI/4);ctx.fillRect(-4,-17,8,10);}
      ctx.fillStyle='#ee766f';ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#283448';ctx.fillRect(-5,-5,10,10);ctx.restore();continue;
    }
    if(h.type==='cannon'){
      const base=h.y+h.h;ctx.fillStyle='#334556';ctx.fillRect(h.x,base-38,38,38);ctx.fillStyle='#a6bad3';ctx.fillRect(h.x-10,base-30,32,19);
      ctx.fillStyle=phase==='warning'?'#ffce6c':'#263140';ctx.fillRect(h.x-10,base-27,6,13);
      if(phase==='warning'){ctx.strokeStyle='#ffce6c99';ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(h.x-16,base-15);ctx.lineTo(h.x-h.travel,base-15);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffe38b';ctx.font='bold 20px monospace';ctx.fillText('!',h.x+14,base-45);}
      if(phase==='active'){const p=hazardAt(h,state.tick);ctx.fillStyle='#ff8054';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#fff2b6';ctx.fillRect(p.x+2,p.y+5,13,10);}
      continue;
    }
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
