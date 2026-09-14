import { hash } from "./rug-run.mjs";

const TAU=Math.PI*2;
function glow(ctx,x,y,r,color) {
  const light=ctx.createRadialGradient(x,y,0,x,y,r);
  light.addColorStop(0,color);light.addColorStop(1,"#00000000");
  ctx.fillStyle=light;ctx.fillRect(x-r,y-r,r*2,r*2);
}
function ridge(ctx,width,camera,depth,base,color,salt) {
  const spacing=115,offset=camera*depth,first=Math.floor(offset/spacing)-1;
  ctx.beginPath();ctx.moveTo(-spacing,540);
  for(let i=first;i<first+Math.ceil(width/spacing)+4;i++)ctx.lineTo(i*spacing-offset,base-hash(`${salt}-${i}`)%125);
  ctx.lineTo(width+spacing,540);ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function crystal(ctx,x,y,size,color) {
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-size);ctx.lineTo(x+size*.28,y-size*.65);ctx.lineTo(x+size*.22,y);ctx.lineTo(x-size*.2,y);ctx.lineTo(x-size*.3,y-size*.7);ctx.closePath();ctx.fill();
  ctx.fillStyle="#ffffff38";ctx.beginPath();ctx.moveTo(x,y-size);ctx.lineTo(x+size*.04,y);ctx.lineTo(x-size*.2,y);ctx.lineTo(x-size*.3,y-size*.7);ctx.closePath();ctx.fill();
}

export function drawMoonSky(ctx,s,width,camera,world) {
  const sky=ctx.createLinearGradient(0,0,0,540);sky.addColorStop(0,world.sky[0]);sky.addColorStop(1,world.sky[1]);ctx.fillStyle=sky;ctx.fillRect(0,0,width,540);
  for(let i=0;i<90;i++){
    const x=((hash(`star${i}`)%2200-camera*.06)%2200+2200)%2200,y=hash(`sky${i}`)%350;
    ctx.globalAlpha=.35+.3*Math.sin(s.tick/70+i);ctx.fillStyle=i%7?"#d5e9ff":world.accent;
    ctx.fillRect(x,y,i%7?1:2,2);
    if(i%17===0){ctx.fillRect(x-3,y,7,1);ctx.fillRect(x,y-3,1,7);}
  }ctx.globalAlpha=1;
  const px=width*.73-camera*.025,py=world.biome==="moon"?132:125,r=world.biome==="moon"?69:world.biome==="desert"?75:48;
  glow(ctx,px,py,r*2.5,world.accent+"26");
  const planet=ctx.createLinearGradient(px-r,py-r,px+r,py+r);
  planet.addColorStop(0,world.biome==="moon"?"#99f4ff":world.accent);planet.addColorStop(1,world.biome==="desert"?"#e58585":"#4b5688");
  ctx.fillStyle=planet;ctx.beginPath();ctx.arc(px,py,r,0,TAU);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(px,py,r,0,TAU);ctx.clip();
  if(world.biome==="moon"){
    ctx.fillStyle="#458898";
    for(let i=0;i<9;i++){const xx=px-r+(hash(`land${i}`)%(r*2)),yy=py-r+(hash(`lat${i}`)%(r*2));ctx.beginPath();ctx.ellipse(xx,yy,15+i,8+i,1,0,TAU);ctx.fill();}
    ctx.strokeStyle="#eaffff60";ctx.lineWidth=6;for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(px-20+i*16,py-40+i*25,r,10,-.2,0,TAU);ctx.stroke();}
  }else if(world.biome!=="desert"){
    for(let i=0;i<7;i++){ctx.fillStyle="#24345525";ctx.beginPath();ctx.arc(px-30+hash(`crater${i}`)%70,py-30+hash(`cy${i}`)%65,5+i*1.7,0,TAU);ctx.fill();}
  }
  ctx.restore();
  if(world.biome==="station"||world.biome==="cloud"){
    ctx.strokeStyle=world.accent+"70";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(px,py,r*1.7,r*.25,-.3,0,TAU);ctx.stroke();
  }
  ridge(ctx,width,camera,.12,385,world.sky[1]+"70",world.biome+"far");
  ridge(ctx,width,camera,.23,445,world.rock,world.biome+"near");

  const depth=.38,spacing=world.biome==="city"?110:160,offset=camera*depth,first=Math.floor(offset/spacing)-2;
  for(let i=first;i<first+Math.ceil(width/spacing)+4;i++){
    const seed=hash(`${world.biome}-${i}`),x=i*spacing-offset,h=100+seed%155,base=450;
    if(world.biome==="city"||world.biome==="station"||world.biome==="lava"){
      const w=68+seed%40,y=base-h;ctx.fillStyle="#0d1b32";ctx.fillRect(x,y,w,h);
      ctx.fillStyle=world.rock;ctx.fillRect(x+w-10,y+8,10,h-8);
      ctx.fillStyle=world.accent+"55";ctx.fillRect(x,y,w,2);
      for(let row=0;row<Math.floor(h/19)-1;row++)for(let col=0;col<Math.floor(w/17)-1;col++){
        if(hash(`${i}-${row}-${col}`)%4===0)continue;
        ctx.fillStyle=(row+col)%5===0?"#ffc89e77":world.accent+"55";ctx.fillRect(x+10+col*17,y+15+row*19,5,8);
      }
      if(i%3===0){ctx.fillStyle="#7495a3";ctx.fillRect(x+w*.5,y-27,2,27);ctx.fillStyle=world.accent;ctx.fillRect(x+w*.5-2,y-29,6,4);}
      if(world.biome==="station"){
        ctx.strokeStyle="#56859a";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+70,y-60);ctx.lineTo(x+130,y-60);ctx.lineTo(x+125,y-35);ctx.stroke();
        ctx.fillStyle="#10253c";ctx.fillRect(x+25,y-70,90,10);
      }
      if(world.biome==="lava"){
        ctx.fillStyle="#182231";ctx.fillRect(x+20,y-40,18,40);
        for(let n=0;n<4;n++){const drift=(s.tick*.28+n*23)%100;ctx.globalAlpha=(1-drift/100)*.2;ctx.fillStyle=world.accent;ctx.beginPath();ctx.arc(x+29+drift*.3,y-40-drift,12+drift*.16,0,TAU);ctx.fill();}ctx.globalAlpha=1;
      }
    }else if(world.biome==="forest"){
      ctx.fillStyle="#103238";ctx.fillRect(x+30,base-h,15,h);
      for(let n=0;n<3;n++){ctx.fillStyle=n%2?"#1b4946":"#123e40";ctx.beginPath();ctx.moveTo(x+38,base-h-55+n*37);ctx.lineTo(x+100-n*8,base-40+n*12);ctx.lineTo(x-22+n*8,base-40+n*12);ctx.closePath();ctx.fill();}
      ctx.strokeStyle="#a6f1a02b";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+38,base-h-55);ctx.lineTo(x-22,base-40);ctx.stroke();
    }else if(world.biome==="crystal"||world.biome==="ice"){
      crystal(ctx,x+35,base,h,world.biome==="ice"?"#699fc099":"#7d6abc88");crystal(ctx,x+75,base,h*.5,world.accent+"55");
      if(world.biome==="crystal"){ctx.fillStyle="#15152f";ctx.beginPath();ctx.moveTo(x-50,0);ctx.lineTo(x+45,70+seed%55);ctx.lineTo(x+100,0);ctx.fill();}
    }else if(world.biome==="desert"){
      ctx.fillStyle="#865761";ctx.fillRect(x+15,base-h*.6,65,h*.6);ctx.fillRect(x+25,base-h*.6-12,45,12);
      ctx.fillStyle="#bd827666";ctx.fillRect(x+15,base-h*.6,5,h*.6);
      ctx.fillStyle="#472f48";ctx.fillRect(x+39,base-55,21,55);
    }else if(world.biome==="cloud"){
      ctx.fillStyle="#f6d6ed35";ctx.beginPath();ctx.ellipse(x+40,base-h,100,20,0,0,TAU);ctx.ellipse(x+25,base-h-14,48,29,0,0,TAU);ctx.fill();
    }else{
      ctx.fillStyle="#222e4b";ctx.beginPath();ctx.ellipse(x+50,base-10,70,h*.3,0,Math.PI,TAU);ctx.fill();
      ctx.strokeStyle="#b9c7ee30";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x+40,base-12,39,10,-.1,0,TAU);ctx.stroke();
      if(i%3===0){ctx.fillStyle="#263651";ctx.fillRect(x+20,base-h,17,h);ctx.fillRect(x+14,base-h,29,6);}
    }
  }
  const mist=ctx.createLinearGradient(0,340,0,480);mist.addColorStop(0,"#00000000");mist.addColorStop(1,world.sky[1]+"88");ctx.fillStyle=mist;ctx.fillRect(0,340,width,140);
  // Bounded, deterministic weather: no per-frame particle allocations.
  for(let i=0;i<26;i++){
    const x=((hash(`mote${i}`)%2000-camera*.55+s.tick*(world.biome==="ice"?.15:.04))%2000+2000)%2000;
    const y=70+(hash(`my${i}`)+(world.biome==="lava"?-s.tick*.35:world.biome==="ice"?s.tick*.45:Math.sin(s.tick/60+i)*12)+900)%370;
    ctx.globalAlpha=.25+.25*Math.sin(i+s.tick/45);ctx.fillStyle=world.biome==="ice"?"#ffffff":world.accent;ctx.fillRect(x,y,i%3?2:3,i%3?2:3);
  }ctx.globalAlpha=1;
}

export function drawMoonEffects(ctx,s,world) {
  // Ground contact shadow follows the nearest visible platform below the hero.
  const floor=world.platforms.filter(p=>s.x+24>p.x&&s.x+6<p.x+p.w&&p.y>=s.y+43&&!(s.crumbling[p.id]!==undefined&&s.tick-s.crumbling[p.id]>30&&s.tick-s.crumbling[p.id]<240)).sort((a,b)=>a.y-b.y)[0];
  if(floor){const distance=floor.y-s.y-44;ctx.globalAlpha=Math.max(.08,.35-distance/700);ctx.fillStyle="#040815";ctx.beginPath();ctx.ellipse(s.x+15,floor.y+3,Math.max(7,18-distance/20),4,0,0,TAU);ctx.fill();ctx.globalAlpha=1;}
  if(Math.abs(s.vx)>100&&s.grounded){
    for(let i=0;i<5;i++){const age=(s.tick+i*5)%24;ctx.globalAlpha=(1-age/24)*.4;ctx.fillStyle=world.edge;ctx.fillRect(s.x+15-s.face*age*1.5,s.y+42-age*.25,3,3);}ctx.globalAlpha=1;
  }
  if(!s.grounded&&s.vy<0){glow(ctx,s.x+15,s.y+48,25,"#77dfff33");}
  if(s.pulse&&s.tick-s.pulse.tick<24&&["coin","stomp","checkpoint","shield"].includes(s.pulse.kind)){
    const age=s.tick-s.pulse.tick;ctx.globalAlpha=1-age/24;ctx.fillStyle=s.pulse.kind==="coin"?"#ffdf83":world.accent;
    for(let i=0;i<8;i++){const a=i*TAU/8;ctx.fillRect(s.x+15+Math.cos(a)*age*1.8,s.y+18+Math.sin(a)*age*1.8+age*age*.02,3,3);}ctx.globalAlpha=1;
  }
}
