/**
 * REKT RUMBLE presentation. Illustrated combat sheets are the primary art;
 * the original canvas rig remains a loading/error fallback and debug aid.
 * Timing is read from simulation, never used to resolve damage here.
 */
import { moveFor, hurtboxFor, INPUT } from './rumble-sim.mjs';
import { drawIllustratedFighter } from './rumble-sprites.mjs';
export const RIG_ANCHORS = Object.freeze({feet:[0,0],hip:[0,-73],chest:[0,-115],head:[0,-158],hat:[0,-190],chain:[3,-123],frontHand:[38,-102],rearHand:[-25,-106],effect:[53,-112]});
export const ANIMATION_CLIPS = Object.freeze(['idle','walk-forward','walk-back','crouch','jump','landing','anticipation','active','recovery','guard','hit','knockdown','wake-up','victory','defeat']);
const INK='#101619', CREAM='#dfdac1';
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function poly(c,points,fill,stroke=INK,line=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}}
function ellipse(c,x,y,rx,ry,fill,stroke=INK,line=2){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}}
function line(c,points,color,width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function label(c,text,x,y,size=12,color=CREAM,align='center'){c.font=`900 ${size}px ui-monospace,monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);}
function costumeLabel(c,text,x,y,size,color,face){c.save();c.translate(x,y);c.scale(face||1,1);label(c,text,0,0,size,color);c.restore();}
function joint(c,a,b,width,color,edge=INK){line(c,[a,b],edge,width+4);line(c,[a,b],color,width);line(c,[[a[0]-width*.17,a[1]],[b[0]-width*.17,b[1]]],'#ffffff15',Math.max(1,width*.18));}
function gradient(c,x,y,r,inner,outer){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,inner);g.addColorStop(1,outer);return g;}

/** Stable authored pose sampling. Explicit previewClip is only for the gallery. */
export function fighterPose(f,tick=0){
  const walking=Math.abs(f.vx||0)>.1, gait=Math.sin(tick*.22), breathe=Math.sin(tick*.06);
  let p={hip:[0,-72],chest:[1,-119],head:[3,-157],rearElbow:[-33,-103],rearHand:[-21,-128],frontElbow:[32,-103],frontHand:[47,-123],rearKnee:[-17,-39],rearFoot:[-24,-5],frontKnee:[19,-38],frontFoot:[30,-5],lean:0,eye:0,clip:'idle',attack:0};
  const forced=f.previewClip;
  if(walking||forced?.startsWith('walk')){
    const stride=forced==='walk-back'?-1:Math.sign((f.vx||1)*(f.face||1));
    p.clip=stride>0?'walk-forward':'walk-back';p.hip[1]+=Math.abs(gait)*3;p.chest[1]+=Math.abs(gait)*3;p.head[1]+=Math.abs(gait)*3;
    p.frontFoot=[24+gait*22,-5-Math.max(0,-gait)*15];p.rearFoot=[-23-gait*22,-5-Math.max(0,gait)*15];p.frontKnee=[18+gait*8,-37];p.rearKnee=[-15-gait*7,-38];p.frontHand[1]+=gait*5;p.rearHand[1]-=gait*5;p.lean=stride*.035;
  }else{p.chest[1]+=breathe*1.6;p.head[1]+=breathe*1.8;p.frontHand[1]+=breathe*2;p.rearHand[1]-=breathe;}
  if(f.crouching||forced==='crouch'){
    p={...p,hip:[-4,-39],chest:[4,-87],head:[13,-124],rearKnee:[-35,-24],rearFoot:[-36,-4],frontKnee:[39,-23],frontFoot:[41,-4],rearElbow:[-27,-68],rearHand:[-7,-112],frontElbow:[38,-67],frontHand:[51,-101],clip:'crouch'};
  }
  if(!f.grounded&&f.y>1||forced==='jump'){
    p={...p,hip:[0,-75],rearKnee:[-26,-65],rearFoot:[-16,-32],frontKnee:[34,-64],frontFoot:[42,-41],rearElbow:[-33,-134],rearHand:[-35,-156],frontElbow:[37,-132],frontHand:[45,-155],lean:-.06,clip:'jump'};
  }
  if(f.landing>0||forced==='landing'){p.hip[1]+=12;p.chest[1]+=14;p.head[1]+=13;p.frontKnee[0]+=12;p.rearKnee[0]-=12;p.clip='landing';}
  const a=f.action;
  if(a||['anticipation','active','recovery'].includes(forced)){
    const id=a?.id||'heavy',timing=moveFor(f.character,id)||{startup:15,active:4,recovery:25};
    const frame=a?.frame??(forced==='anticipation'?3:forced==='active'?timing.startup+1:timing.startup+timing.active+8);
    const startup=a?.startup??timing.startup,active=a?.active??timing.active;
    const phase=forced|| (frame<startup?'anticipation':frame<startup+active?'active':'recovery');
    const extension=phase==='anticipation'?-.25:phase==='active'?1:1-clamp((frame-startup-active)/(a?.recovery??timing.recovery),0,1);
    p.attack=extension;p.clip=phase;p.lean=extension*.11;
    if(/kick|sweep|crouchHeavy|lowHeavy|crouch-heavy/.test(id)){
      p.frontKnee=[lerp(19,54,Math.max(0,extension)),lerp(-38,-77,Math.max(0,extension))];p.frontFoot=[lerp(30,95,Math.max(0,extension)),lerp(-5,/sweep|crouch|low/.test(id)?-20:-86,Math.max(0,extension))];p.chest[0]-=extension*10;p.frontHand=[25,-131];
    }else if(/upper|anti|rising|downSpecial/.test(id)){
      p.frontElbow=[35,-135-extension*9];p.frontHand=[37+extension*13,-134-extension*68];p.chest[0]+=extension*6;p.head[0]-=extension*4;
    }else if(/throw/.test(id)||timing.throw){
      p.frontElbow=[35+extension*12,-107];p.frontHand=[43+extension*44,-119+extension*8];p.rearElbow=[4+extension*26,-109];p.rearHand=[23+extension*51,-100];
    }else if(id==='heavy'){
      // Heavy is an overhead body swing, not the light jab with a longer timer.
      const reach=Math.max(0,extension);
      p.frontElbow=[20+reach*30,-158+reach*36];p.frontHand=[10+reach*90,-190+reach*106];
      p.rearHand=[-22,-132];p.chest[0]+=reach*14;p.head[0]+=reach*8;p.lean=extension*.20;
      p.frontFoot=[38,-5];p.rearFoot=[-32,-5];
    }else if(id==='forwardSpecial'){
      p.chest[0]+=extension*25;p.head[0]+=extension*24;p.lean=extension*.24;
      p.frontElbow=[45+extension*27,-100];p.frontHand=[62+extension*42,-112];
      p.rearElbow=[-35,-98];p.rearHand=[-48,-91];p.rearFoot=[-48,-5];
    }else if(id==='super'){
      p.frontElbow=[35+extension*20,-125];p.frontHand=[48+extension*60,-139];
      p.rearElbow=[-5+extension*35,-95];p.rearHand=[15+extension*73,-104];
      p.chest[0]+=extension*16;p.frontFoot=[43,-5];p.rearFoot=[-36,-5];p.lean=extension*.17;
    }else if(id==='crouchLight'){
      p.frontElbow=[36+extension*20,-42];p.frontHand=[42+extension*44,-28];p.chest[0]+=extension*9;p.head[0]+=extension*6;
    }else if(id==='airHeavy'||id==='airLight'){
      p.frontElbow=[35+extension*10,-90+extension*20];p.frontHand=[43+extension*42,-96+extension*85];p.chest[0]+=extension*12;p.lean=extension*.22;
    }else{
      p.frontElbow=[29+extension*30,-103-extension*17];p.frontHand=[42+extension*58,-123+extension*(/super|special/.test(id)?4:-2)];p.rearHand=[-14,-134];p.chest[0]+=extension*8;p.head[0]+=extension*3;
    }
  }
  if((f.previousInput&INPUT.GUARD)&&!f.action&&f.grounded||f.guarding||f.blockstun>0||forced==='guard'){
    p.frontElbow=[37,p.chest[1]+12];p.frontHand=[37,p.head[1]-7];p.rearElbow=[-14,p.chest[1]+8];p.rearHand=[25,p.head[1]+7];p.head[0]-=5;p.lean=-.065;p.clip='guard';
  }
  if((f.stun>0&&!f.knockdown)||forced==='hit'){
    p.head[0]-=17;p.chest[0]-=10;p.frontElbow=[23,-88];p.frontHand=[46,-103];p.rearElbow=[-35,-107];p.rearHand=[-55,-116];p.lean=-.19;p.eye=1;p.clip='hit';
  }
  if(f.wakeup>0||f.wakeUp>0||(f.knockdown>0&&f.knockdown<=8)||forced==='wake-up'){
    p.hip=[-20,-35];p.chest=[-20,-76];p.head=[-8,-108];p.frontKnee=[26,-25];p.frontFoot=[33,-5];p.rearKnee=[-45,-13];p.rearFoot=[-60,-5];p.frontElbow=[18,-49];p.frontHand=[42,-9];p.rearElbow=[-45,-56];p.rearHand=[-56,-22];p.clip='wake-up';
  }
  if(f.knockdown>8||f.hp<=0||forced==='knockdown'||forced==='defeat'){
    p={...p,hip:[-17,-28],chest:[-29,-72],head:[-26,-111],frontElbow:[7,-55],frontHand:[31,-81],rearElbow:[-50,-49],rearHand:[-64,-71],frontKnee:[22,1],frontFoot:[46,15],rearKnee:[-29,10],rearFoot:[-26,39],lean:-1.25,eye:1,clip:f.hp<=0||forced==='defeat'?'defeat':'knockdown'};
  }
  if(f.victory||forced==='victory'){
    p.frontElbow=[37,-145];p.frontHand=[43,-189];p.rearElbow=[-35,-148];p.rearHand=[-37,-181];p.head[1]-=4;p.eye=2;p.lean=.03;p.clip='victory';
  }
  return p;
}

/** Attachment positions in posed local coordinates; cosmetic-only contract. */
export function attachmentAnchors(f,tick=0){
  const p=fighterPose(f,tick);
  const expanded=['brian','mia','bernie','chloe'].includes(f.character);
  return {feet:[0,0],hip:p.hip,chest:p.chest,head:p.head,hat:[p.head[0],p.head[1]-34],chain:[p.chest[0]+(expanded?0:3),p.chest[1]+(expanded?5:f.character==='diamond'?14:32)],frontHand:p.frontHand,rearHand:p.rearHand,effect:p.frontHand};
}

function iceFist(c,x,y,scale=1){
  c.save();c.translate(x,y);c.scale(scale,scale);
  poly(c,[[-20,-13],[-8,-25],[13,-23],[26,-11],[25,13],[9,27],[-14,18],[-24,1]],'#67c9d7','#123e4c',3);
  poly(c,[[-20,-13],[1,-16],[-4,5],[-24,1]],'#d2feef');poly(c,[[1,-16],[13,-23],[26,-11],[17,3],[-4,5]],'#97f7ee');poly(c,[[-4,5],[17,3],[9,27],[-14,18]],'#2b8eaf');poly(c,[[17,3],[26,-11],[25,13],[9,27]],'#d5ffff');
  line(c,[[-20,-13],[13,-23],[26,-11]],'#f3fffa',3);line(c,[[-14,18],[-4,5],[1,-16]],'#aef4f1',2);
  c.restore();
}
function hand(c,at,diamond,front,hit){
  if(diamond&&front){iceFist(c,at[0],at[1],1);return;}
  ellipse(c,at[0],at[1],diamond?11:10,12,diamond?'#699741':'#bd906c',INK,2.5);
  for(let i=0;i<3;i++)line(c,[[at[0]-5+i*4,at[1]-5],[at[0]-5+i*4,at[1]+1]],diamond?'#45662b':'#795341',1);
  if(hit)line(c,[[at[0]-7,at[1]-7],[at[0]+5,at[1]-10]],'#fff6d3',2);
}
function shoe(c,foot,diamond,front){
  const [x,y]=foot;
  poly(c,[[x-10,y-10],[x+8,y-10],[x+12,y-2],[x+22,y+1],[x+21,y+8],[x-13,y+8]],diamond?'#31282a':'#bbb098',INK,3);
  if(diamond){poly(c,[[x-8,y-8],[x+5,y-8],[x+11,y+1],[x-8,y+2]],'#7f3f38');line(c,[[x-8,y+5],[x+19,y+5]],'#d3cab2',3);for(let i=0;i<3;i++)line(c,[[x-4,y-5+i*3],[x+6,y-4+i*3]],'#c9c6ac',1);}
  else{poly(c,[[x-11,y+1],[x+10,y-1],[x+17,y+4],[x+15,y+7],[x-12,y+7]],'#33342a');line(c,[[x-5,y-5],[x+10,y+3]],front?'#e7d4a2':'#969881',5);for(let i=0;i<3;i++)line(c,[[x+10+i*3,y+1],[x+10+i*3,y+4]],'#715d4c',1);}
}
function head(c,at,diamond,eye,tick){
  const [x,y]=at;c.save();c.translate(x,y);
  if(diamond){
    poly(c,[[-29,-19],[-23,-32],[-9,-36],[5,-32],[17,-30],[25,-18],[34,-9],[34,8],[21,22],[-10,25],[-28,12],[-34,-3]],'#618933',INK,3);
    poly(c,[[-26,-17],[-18,-28],[-9,-30],[-2,-24],[4,-29],[15,-25],[22,-15],[25,-6],[-23,-4]],'#8d9d42',null);
    ellipse(c,12,7,24,8,'#bdb452',null);line(c,[[-17,9],[3,13],[23,10],[29,5]],'#302415',9);line(c,[[-17,7],[3,11],[23,8],[29,3]],'#d5843e',5);
    poly(c,[[-28,-14],[-3,-14],[-4,0],[-20,2],[-27,-4]],'#111718');poly(c,[[1,-14],[28,-14],[25,-1],[8,2],[2,-3]],'#101819');line(c,[[-32,-15],[28,-15]],'#c8ccaa',2);line(c,[[-4,-11],[2,-11]],'#111718',4);
    if(eye!==1){line(c,[[-22,-11],[-13,-10],[-21,-4]],'#bbbda8',2);line(c,[[8,-11],[17,-11],[9,-5]],'#bbbda8',2);}
    else{line(c,[[-19,-9],[-12,-3]],'#eee3c8',2);line(c,[[12,-9],[19,-3]],'#eee3c8',2);}
    line(c,[[-26,15],[-17,21],[8,23]],'#324727',2);
  }else{
    poly(c,[[-18,-27],[7,-28],[23,-12],[21,10],[13,27],[-5,29],[-20,16],[-26,-7]],'#b58b69',INK,3);
    poly(c,[[-20,-9],[-9,-20],[12,-13],[17,10],[8,24],[-7,21],[-14,8]],'#d1a580',null);
    ellipse(c,-20,2,6,9,'#bd9271');ellipse(c,19,1,5,8,'#bd9271');
    poly(c,[[-27,-9],[-25,-29],[-18,-36],[-7,-34],[0,-39],[14,-31],[23,-27],[25,-13],[17,-5],[12,-21],[0,-25],[-12,-16],[-18,-15],[-21,-1]],'#433a2a',INK,2);
    for(let i=0;i<7;i++)line(c,[[-22+i*6,-26+Math.sin(i)*5],[-18+i*6,-18+Math.sin(i)*7]],'#80714b',1.5);
    ellipse(c,-9,0,8,6,'#8e5e52',null);ellipse(c,10,0,8,6,'#85534c',null);
    if(eye===1){line(c,[[-15,-2],[-5,3]],'#28251d',2);line(c,[[5,3],[15,-2]],'#28251d',2);}
    else{ellipse(c,-9,-2,6,2.5,'#dac4a7',null);ellipse(c,10,-2,6,2.5,'#dac4a7',null);ellipse(c,-6,-2,2,2,'#272720',null);ellipse(c,13,-2,2,2,'#272720',null);line(c,[[-16,-7],[-5,-7]],'#443c2c',2);line(c,[[5,-6],[16,-8]],'#443c2c',2);}
    poly(c,[[1,1],[0,9],[6,11],[9,8]],'#a67555',null);ellipse(c,4,18,eye===2?9:7,eye===1?7:4,'#3a3227');line(c,[[-3,17],[10,17]],'#d8caad',2);
    for(let i=0;i<13;i++){const bx=-13+(i%6)*5,by=12+Math.floor(i/6)*5;line(c,[[bx,by],[bx+1,by+2]],'#67523c',.8);}
  }
  // Small expressive stress beads, not an entire-body wobble.
  if(eye===1){ellipse(c,-36,Math.sin(tick*.25)*2,2,4,'#84d6e0',null);}
  c.restore();
}

/** fighter.x is world x, fighter.y is height above the fixed floor. */
function drawVectorFighter(c,f,{tick=0,scale=1,debug=false,preview=false}={}){
  if(['brian','mia','bernie','chloe'].includes(f.character)){drawExpansionFighter(c,f,{tick,scale});if(debug)drawFighterDebug(c,f,{tick,scale,preview});return;}
  const d=f.character==='diamond',p=fighterPose(f,tick),skin=d?'#608337':'#b28a68',cloth=d?'#242c2a':'#2d3431';
  c.save();c.translate(f.x||0,500-(f.y||0));c.scale((f.face||1)*scale,scale);c.rotate(p.lean);
  if(f.silhouette)c.filter='brightness(0)';
  // Far limbs deliberately behind torso; knees and elbows each change pose.
  joint(c,[-12+p.hip[0],p.hip[1]],p.rearKnee,d?22:18,d?'#232b27':'#867093');joint(c,p.rearKnee,p.rearFoot,d?17:12,d?'#30382c':'#b5b09a');shoe(c,p.rearFoot,d,false);
  joint(c,[p.chest[0]-20,p.chest[1]+8],p.rearElbow,d?24:18,cloth);joint(c,p.rearElbow,p.rearHand,d?16:13,d?cloth:skin);hand(c,p.rearHand,d,false,false);
  // Torso is reshaped by hip/chest positions. Distinct costume, not a palette swap.
  const [hx,hy]=p.hip,[tx,ty]=p.chest;
  poly(c,[[tx-25,ty-11],[tx+22,ty-12],[tx+34,ty+10],[hx+26,hy+7],[hx-27,hy+7],[tx-34,ty+12]],cloth,INK,3);
  if(d){
    poly(c,[[tx-10,ty-11],[tx+12,ty-11],[hx+14,hy-8],[hx-14,hy-8]],'#b8b095');poly(c,[[tx-25,ty-9],[tx-10,ty-13],[tx-3,ty+10],[tx-16,ty+18],[hx-22,hy+3]],'#3d4740');poly(c,[[tx+15,ty-13],[tx+25,ty-7],[hx+25,hy+3],[tx+9,ty+16],[tx+17,ty+2]],'#151d1d');line(c,[[tx-25,ty],[hx-25,hy+2]],'#7f8b77',1.5);
    ellipse(c,tx-24,ty+10,4,5,'#baa64c');ellipse(c,tx-24,ty+10,2,3,'#559541',null);poly(c,[[hx-23,hy],[hx+25,hy],[hx+22,hy+13],[hx-26,hy+13]],'#282920');poly(c,[[hx-5,hy+1],[hx+9,hy+1],[hx+9,hy+11],[hx-5,hy+11]],'#b78a39');poly(c,[[hx-1,hy+4],[hx+5,hy+4],[hx+5,hy+8],[hx-1,hy+8]],'#28291e',null);
    line(c,[[hx-18,hy+6],[hx-28,hy+26],[hx-22,hy+34]],'#a98f46',2);
  }else{
    poly(c,[[tx-25,ty+18],[tx-13,ty+22],[tx-17,ty+45],[hx-28,hy+3]],'#414940',null);line(c,[[tx+10,ty+20],[hx+20,hy-6]],'#1d2623',3);
    c.save();c.translate(tx,ty+18);c.rotate(-.04);costumeLabel(c,'REKT',0,0,16,'#bcbca8',f.face);c.restore();
    poly(c,[[hx-25,hy-3],[hx+25,hy-3],[hx+29,hy+31],[hx+3,hy+33],[hx,hy+17],[hx-8,hy+34],[hx-32,hy+31]],'#766081');poly(c,[[hx+4,hy+7],[hx+25,hy+4],[hx+27,hy+28],[hx+7,hy+29]],'#56405e',null);line(c,[[hx-30,hy+29],[hx-9,hy+33]],'#c7b475',3);line(c,[[hx+5,hy+30],[hx+28,hy+28]],'#c7b475',3);costumeLabel(c,'-99%',hx+16,hy+18,8,'#e96d59',f.face);line(c,[[hx-2,hy+1],[hx-4,hy+17]],'#ddd0ad',2);line(c,[[hx+2,hy+1],[hx+4,hy+15]],'#ddd0ad',2);
  }
  // Near leg connects through its own knee; a kick changes this chain only.
  joint(c,[hx+12,hy+(d?15:30)],p.frontKnee,d?23:17,d?'#242b29':'#b28d6d');joint(c,p.frontKnee,p.frontFoot,d?18:12,d?'#34372b':'#504f46');
  if(d){ellipse(c,p.frontKnee[0],p.frontKnee[1],10,8,'#535844');line(c,[[p.frontKnee[0]-8,p.frontKnee[1]-4],[p.frontKnee[0]+5,p.frontKnee[1]+5]],'#9c9672',2);}else{line(c,[[p.frontKnee[0]-4,p.frontKnee[1]+7],[p.frontKnee[0]+5,p.frontKnee[1]+9]],'#d1c9ad',4);}
  shoe(c,p.frontFoot,d,true);
  // Neck, chain attachment, face/head independent of body.
  joint(c,[tx+1,ty-9],[p.head[0],p.head[1]+19],15,skin);
  const chainDrop=d?10:28;
  line(c,[[tx-10,ty-10],[tx-6,ty+3],[tx+3,ty+chainDrop],[tx+12,ty+4],[tx+17,ty-10]],'#493c23',4);line(c,[[tx-10,ty-10],[tx-6,ty+3],[tx+3,ty+chainDrop],[tx+12,ty+4],[tx+17,ty-10]],'#c4a75c',2);
  if(!d){ellipse(c,tx+3,ty+32,6,7,'#bda046');costumeLabel(c,'฿',tx+3,ty+35,9,'#54451f',f.face);}
  head(c,p.head,d,p.eye,tick);
  joint(c,[tx+22,ty+4],p.frontElbow,d?25:18,cloth);joint(c,p.frontElbow,p.frontHand,d?18:14,d?cloth:skin);hand(c,p.frontHand,d,true,p.attack>.8);
  if(!d){line(c,[[p.frontElbow[0]+5,p.frontElbow[1]+5],[lerp(p.frontElbow[0],p.frontHand[0],.6)+5,lerp(p.frontElbow[1],p.frontHand[1],.6)]],'#6b5946',1);}
  if(p.clip==='guard'){c.globalAlpha=.5;line(c,[[p.frontHand[0]+23,p.head[1]-17],[p.frontHand[0]+33,p.head[1]+4],[p.frontHand[0]+30,p.head[1]+35]],d?'#92f4ef':'#e0d495',3);c.globalAlpha=1;}
  c.restore();
  if(debug)drawFighterDebug(c,f,{tick,scale,preview});
}

// Expansion costumes are authored geometry, not recolored Max sprites. Each
// accessory follows its own posed attachment before nearest-neighbor rastering.
function expansionHead(c,at,id,eye,tick,face){
  const [x,y]=at;c.save();c.translate(x,y);
  const woman=id==='mia'||id==='chloe';
  if(woman){
    // Ponytail versus a swept, loose mane and high bun: different silhouettes.
    if(id==='mia'){
      ellipse(c,-25,-23,15,13,'#713b23');
      poly(c,[[-28,-26],[-43,-22],[-46,4],[-35,28],[-22,38],[-27,9],[-17,-13]],'#623820');
      line(c,[[-37,-16],[-39,4],[-29,23]],'#bc773d',3);line(c,[[-29,-27],[-20,-18]],'#e265a4',5);
    }else{
      ellipse(c,-13,-37,16,12,'#85562b');
      poly(c,[[-25,-27],[-37,-10],[-32,24],[-42,42],[-19,31],[-8,11],[11,-16]],'#714727');
      line(c,[[-30,-10],[-27,13],[-31,28]],'#c58e49',4);
    }
    poly(c,[[-19,-22],[2,-28],[19,-14],[21,5],[10,26],[-5,27],[-19,11],[-22,-5]],'#c58c5d',INK,3);
    poly(c,[[-12,-16],[6,-21],[16,-9],[15,8],[6,20],[-8,16]],'#e9b783',null);
    poly(c,[[-23,-14],[-22,-29],[-7,-35],[8,-28],[20,-16],[10,-19],[-1,-26],[-13,-14]],'#79502c');
    if(id==='mia'){
      line(c,[[-17,-25],[15,-24]],'#211c26',5);line(c,[[-14,-26],[-4,-24]],'#87daef',3);line(c,[[3,-26],[13,-24]],'#b790ed',3);
      ellipse(c,-7,-2,6,5,'#efe1bb');ellipse(c,10,-2,6,5,'#efe1bb');ellipse(c,-4,-1,2,3,INK,null);ellipse(c,12,-1,2,3,INK,null);
      line(c,[[-14,-10],[-3,-12]],'#573822',3);line(c,[[4,-12],[16,-8]],'#573822',3);
      ellipse(c,5,16,8,7,'#592622');line(c,[[0,12],[11,12]],'#f3dec1',3);
    }else{
      poly(c,[[-19,-10],[-2,-10],[-1,0],[-14,2]],'#26243e');poly(c,[[3,-10],[21,-10],[18,1],[5,1]],'#24213c');line(c,[[-21,-10],[21,-10]],'#131619',3);line(c,[[-16,-8],[-8,-7]],'#5fbbeb',3);line(c,[[7,-8],[15,-7]],'#a989f2',3);
      line(c,[[0,16],[10,16]],'#784634',3);
    }
    ellipse(c,-20,11,5,9,null,'#d6b548',3);
  }else{
    head(c,[0,0],false,eye,tick);
    if(id==='brian'){
      poly(c,[[-25,-22],[-21,-39],[-15,-47],[-7,-39],[1,-48],[5,-37],[13,-44],[21,-31],[27,-23],[30,4],[36,22],[17,18],[15,-10]],'#946332');
      for(let i=0;i<5;i++)line(c,[[-17+i*8,-34],[i*7-7,-24],[20+i*3,15]],'#d2a064',2);
      poly(c,[[-24,-10],[23,-12],[22,3],[-21,4]],'#202638');line(c,[[-19,-7],[16,-9]],'#9156d7',6);line(c,[[-16,-6],[-5,-6]],'#79dcdf',4);line(c,[[5,-8],[15,-8]],'#e990d7',3);
      line(c,[[-16,16],[-12,23],[5,27],[15,19]],'#654831',5);
    }else{
      poly(c,[[-28,-15],[-27,-34],[-12,-42],[7,-40],[22,-28],[24,-17]],'#34332b');poly(c,[[-29,-17],[29,-20],[37,-12],[-25,-10]],'#777360');costumeLabel(c,'WAGMI',0,-23,7,'#d0ccaf',face);
      line(c,[[-13,13],[-10,20],[9,23],[14,16]],'#594837',2);
    }
  }
  if(eye===1)line(c,[[-32,-9],[-36,-1]],'#97e7f0',3);
  c.restore();
}
function expansionShoe(c,foot,id){
  if(id==='brian'){shoe(c,foot,false,true);return;}
  const [x,y]=foot,color=id==='mia'?'#b8547b':id==='chloe'?'#326fae':'#575246';
  poly(c,[[x-10,y-15],[x+7,y-15],[x+9,y-3],[x+23,y+2],[x+22,y+9],[x-13,y+9]],color,INK,3);
  line(c,[[x-12,y+6],[x+22,y+6]],'#e6ddbc',4);
  for(let i=0;i<3;i++)line(c,[[x-6,y-10+i*4],[x+5,y-9+i*4]],'#e4dac0',2);
  if(id==='chloe')poly(c,[[x-7,y-2],[x+1,y+2],[x+15,y-2],[x+5,y+5]],'#e2e7d7',null);
}
function expansionProp(c,at,id,tick,active,face){
  c.save();c.translate(...at);
  if(id==='brian'){
    poly(c,[[-12,-10],[16,-10],[12,16],[-8,16]],'#ece0b1');ellipse(c,2,-10,14,5,'#d4b676');costumeLabel(c,'REKT',2,5,7,'#cf5738',face);line(c,[[2,-12],[7,-27]],'#927145',3);
  }else if(id==='mia'){
    // Paper ribbon follows the wrist and changes its bend with the attack.
    poly(c,[[-8,-7],[12,-7],[15,12],[8,28],[19,43],[12,60],[-8,59],[-1,41],[-11,26],[-5,11]],'#e9dfbd');
    for(let i=0;i<6;i++)line(c,[[-3+(i%2)*3,4+i*8],[8+(i%2)*3,4+i*8]],i%2?'#ac6b61':'#928978',2);
  }else if(id==='bernie'){
    c.rotate(active?.24:-.35);line(c,[[0,7],[0,-43]],'#d5d1b1',10);line(c,[[-2,4],[-2,-41]],'#737c78',3);
    poly(c,[[-5,-35],[-15,-44],[-15,-60],[-7,-66],[-7,-49],[5,-49],[7,-66],[15,-60],[15,-45],[7,-35]],'#bbbfae',INK,3);ellipse(c,0,9,5,6,'#89938b');
  }else{
    line(c,[[-7,5],[-7,-5],[9,-5],[9,5]],'#d1d5bf',4);
    poly(c,[[-23,6],[26,6],[26,50],[-23,50]],'#606c68',INK,3);poly(c,[[-17,12],[19,12],[19,44],[-17,44]],'#343e3b','#bdc1ac',2);
    ellipse(c,2,28,11,11,'#929d8d');ellipse(c,2,28,5,5,'#414c47');line(c,[[2,20],[2,28],[8,31]],'#d8dcc5',2);for(const [x,y] of [[-20,10],[22,10],[-20,46],[22,46]])c.fillRect(x,y,3,3);
  }
  c.restore();
}
function drawExpansionFighter(c,f,{tick=0,scale=1}={}){
  const id=f.character,p=fighterPose(f,tick),brian=id==='brian',mia=id==='mia',bernie=id==='bernie',chloe=id==='chloe';
  const skin=mia||chloe?'#cd9565':'#b8926f',cloth=brian?'#35477d':mia?'#e1dcc3':bernie?'#353830':'#2766ae';
  const [hx,hy]=p.hip,[tx,ty]=p.chest;
  c.save();c.translate(f.x||0,500-(f.y||0));c.scale((f.face||1)*scale,scale);c.rotate(p.lean);if(f.silhouette)c.filter='brightness(0)';
  joint(c,[hx-12,hy],p.rearKnee,mia?17:21,mia?skin:brian?'#6d704c':'#303b39');joint(c,p.rearKnee,p.rearFoot,mia||brian?13:18,mia||brian?skin:'#35423f');expansionShoe(c,p.rearFoot,id);
  joint(c,[tx-21,ty+6],p.rearElbow,chloe?25:18,mia?skin:cloth);joint(c,p.rearElbow,p.rearHand,chloe?22:13,chloe?cloth:skin);hand(c,p.rearHand,false,false,false);
  poly(c,[[tx-25,ty-12],[tx+23,ty-12],[tx+33,ty+12],[hx+26,hy+8],[hx-27,hy+8],[tx-32,ty+12]],cloth,INK,3);
  if(brian){
    poly(c,[[tx-10,ty-10],[tx+13,ty-11],[hx+18,hy+5],[hx-17,hy+5]],'#dad4b8');costumeLabel(c,'BUY',tx+2,ty+14,12,'#33372e',f.face);costumeLabel(c,'HIGH',tx+2,ty+28,11,'#33372e',f.face);
    for(const side of [-1,1])for(let i=0;i<3;i++){const x=tx+side*(21+i%2*3),y=ty+i*15;line(c,[[x-5,y],[x+5,y]],'#c98497',3);line(c,[[x,y-5],[x,y+5]],'#d7b871',3);}
    poly(c,[[hx-27,hy],[hx+28,hy],[hx+29,hy+30],[hx+4,hy+32],[hx,hy+16],[hx-8,hy+31],[hx-31,hy+28]],'#797b56');costumeLabel(c,'100×',hx+15,hy+23,7,'#ded08b',f.face);poly(c,[[hx-31,hy+9],[hx-17,hy+10],[hx-18,hy+29],[hx-32,hy+27]],'#343b2f');line(c,[[hx-27,hy+15],[hx-21,hy+23]],'#e26455',3);
  }else if(mia){
    poly(c,[[hx-24,hy-10],[hx+23,hy-10],[hx+24,hy+8],[hx-23,hy+8]],skin);line(c,[[tx-22,ty-9],[tx+20,ty-9]],'#514739',3);costumeLabel(c,'MEVD',tx,ty+17,13,'#35392c',f.face);
    poly(c,[[hx-25,hy+4],[hx+25,hy+4],[hx+28,hy+25],[hx+3,hy+27],[hx,hy+16],[hx-7,hy+28],[hx-29,hy+23]],'#567c89');line(c,[[hx-27,hy+23],[hx-7,hy+27]],'#aab7a0',3);line(c,[[hx+5,hy+25],[hx+27,hy+22]],'#aab7a0',3);ellipse(c,hx,hy+7,3,3,'#d7b05b');
  }else if(bernie){
    costumeLabel(c,'FIXIN',tx,ty+10,10,'#ddd1a5',f.face);costumeLabel(c,'THIS',tx,ty+22,10,'#c8bb92',f.face);costumeLabel(c,'BRIDGE',tx,ty+34,9,'#d3c7a5',f.face);
    poly(c,[[hx-27,hy],[hx+26,hy],[hx+27,hy+16],[hx-28,hy+16]],'#34362b');line(c,[[hx-27,hy+4],[hx+26,hy+4]],'#898267',5);for(let i=0;i<3;i++)poly(c,[[hx-23+i*16,hy+7],[hx-12+i*16,hy+7],[hx-12+i*16,hy+25],[hx-23+i*16,hy+25]],'#666651');
  }else{
    poly(c,[[tx-12,ty-10],[tx+13,ty-10],[hx+15,hy+5],[hx-16,hy+5]],'#e3dfc8');costumeLabel(c,'COLD',tx,ty+19,12,'#303930',f.face);
    for(const side of [-1,1]){const x=tx+side*22;line(c,[[x,ty-6],[hx+side*23,hy+3]],'#70a2cd',3);for(let i=0;i<4;i++)line(c,[[x-8,ty+4+i*11],[x+8,ty+4+i*11]],'#153d75',2);}
    line(c,[[tx-23,ty-11],[tx-15,ty-19],[tx-8,ty-11]],'#d8deca',8);line(c,[[tx+8,ty-11],[tx+16,ty-19],[tx+24,ty-11]],'#d8deca',8);
    poly(c,[[hx-26,hy],[hx+26,hy],[hx+28,hy+25],[hx-27,hy+25]],'#303d3a');line(c,[[hx-3,hy+6],[hx-5,hy+20]],'#d4d6bc',2);line(c,[[hx+3,hy+6],[hx+5,hy+20]],'#d4d6bc',2);
  }
  joint(c,[hx+12,hy+(mia||brian?27:14)],p.frontKnee,mia?17:21,mia||brian?skin:'#34423e');joint(c,p.frontKnee,p.frontFoot,mia||brian?13:18,mia||brian?skin:'#34423e');
  if(mia||brian){line(c,[[p.frontKnee[0]-4,p.frontKnee[1]+14],[p.frontFoot[0]-3,p.frontFoot[1]-9]],'#d1cdb2',14);line(c,[[p.frontFoot[0]-9,p.frontFoot[1]-14],[p.frontFoot[0]+5,p.frontFoot[1]-12]],'#96957b',2);}
  if(bernie){poly(c,[[p.frontKnee[0]-8,p.frontKnee[1]-8],[p.frontKnee[0]+9,p.frontKnee[1]-7],[p.frontKnee[0]+7,p.frontKnee[1]+8],[p.frontKnee[0]-9,p.frontKnee[1]+7]],'#9b9479');line(c,[[p.frontKnee[0]-7,p.frontKnee[1]-2],[p.frontKnee[0]+7,p.frontKnee[1]+2]],'#3b4237',3);}
  expansionShoe(c,p.frontFoot,id);joint(c,[tx,ty-10],[p.head[0],p.head[1]+20],13,skin);
  line(c,[[tx-10,ty-10],[tx,ty+4],[tx+12,ty-10]],'#d2b052',3);ellipse(c,tx,ty+5,3,4,'#e5c664');expansionHead(c,p.head,id,p.eye,tick,f.face);
  joint(c,[tx+22,ty+4],p.frontElbow,chloe?26:19,mia?skin:cloth);joint(c,p.frontElbow,p.frontHand,chloe?22:14,chloe?cloth:skin);hand(c,p.frontHand,false,true,p.attack>.8);
  if(mia){c.save();c.translate(...p.rearHand);poly(c,[[-7,-17],[7,-17],[7,8],[-7,8]],'#20262a','#acb5a4',2);line(c,[[-4,-12],[4,-3],[-3,1]],'#d75f7c',2);c.restore();}
  expansionProp(c,p.frontHand,id,tick,p.attack>.5,f.face);
  if(p.clip==='guard')line(c,[[p.frontHand[0]+30,p.head[1]-12],[p.frontHand[0]+39,p.head[1]+8],[p.frontHand[0]+32,p.head[1]+38]],chloe?'#83c5f1':'#e5c884',3);
  c.restore();
}

function drawFighterDebug(c,f,{tick=0,scale=1,preview=false}={}){
  const p=fighterPose(f,tick);c.save();c.translate(f.x||0,500-(f.y||0));c.scale((f.face||1)*scale,scale);c.rotate(p.lean);c.filter='none';
  Object.entries(attachmentAnchors(f,tick)).forEach(([name,[x,y]])=>{ellipse(c,x,y,2.5,2.5,'#ff68df',null);c.save();c.scale(f.face||1,1);label(c,name,x*(f.face||1)+4,y-4,7,'#ffb1e9','left');c.restore();});c.restore();
  if(!preview){
    c.save();const hurt=hurtboxFor(f);c.strokeStyle='#5cffaa';c.fillStyle='#5cffaa12';c.lineWidth=1;
    const x=(f.x||0)+hurt.left,y=500-(f.y||0)-hurt.top;c.fillRect(x,y,hurt.right-hurt.left,hurt.top-hurt.bottom);c.strokeRect(x,y,hurt.right-hurt.left,hurt.top-hurt.bottom);
    const move=f.action&&moveFor(f.character,f.action.id);
    if(move&&f.action.frame>=move.startup&&f.action.frame<move.startup+move.active){const b=move.hitbox,w=b.front,hitX=f.face===1?f.x:f.x-w;c.fillStyle='#ff8f572e';c.strokeStyle='#ff8f57';c.fillRect(hitX,500-f.y-b.top,w,b.top-b.bottom);c.strokeRect(hitX,500-f.y-b.top,w,b.top-b.bottom);}
    c.restore();
  }
}

// One scratch surface per target canvas, reused for both fighters on every
// frame. Weak keys permit disposal when the owning game canvas is unmounted.
// Posed body parts are rasterized at half world resolution, then enlarged with
// nearest-neighbor sampling: actual crisp pixel silhouettes, not a CSS filter
// over an NFT portrait. Simulation and debug boxes retain full precision.
const fighterSurfaces=new WeakMap();
function pixelSurface(target){
  let surface=fighterSurfaces.get(target);if(surface)return surface;
  let canvas;
  if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(200,180);
  else if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=200;canvas.height=180;}
  else return null;
  const context=canvas.getContext('2d');if(!context)return null;
  surface={canvas,context};fighterSurfaces.set(target,surface);return surface;
}

export function drawFighter(c,f,{tick=0,scale=1,debug=false,preview=false,pixelStyle=true,image}={}){
  if(drawIllustratedFighter(c,f,fighterPose(f,tick),image,{tick,scale})){
    if(debug)drawFighterDebug(c,f,{tick,scale,preview});
    return;
  }
  const surface=pixelStyle?pixelSurface(c):null;
  if(!surface){drawVectorFighter(c,f,{tick,scale,debug,preview});return;}
  const small=surface.context;small.setTransform(1,0,0,1,0,0);small.clearRect(0,0,200,180);
  // Feet sit at native (100,135); ±200×[-270,90] world bounds accommodate
  // raised arms, long attacks, crouches and the full horizontal knockdown.
  small.setTransform(.5,0,0,.5,100,-115);
  drawVectorFighter(small,{...f,x:0,y:0},{tick,scale:1});
  c.save();c.imageSmoothingEnabled=false;
  c.drawImage(surface.canvas,Math.round((f.x||0)-200*scale),Math.round(500-(f.y||0)-270*scale),400*scale,360*scale);
  c.restore();if(debug)drawFighterDebug(c,f,{tick,scale,preview});
}

function cabinet(c,x,y,color,tick,index){
  c.save();c.translate(x,y);poly(c,[[0,0],[48,0],[49,23],[62,53],[58,134],[-6,134],[-5,47],[3,26]],'#1b252d','#091219',3);poly(c,[[5,25],[44,25],[50,66],[0,66]],'#344946');poly(c,[[9,32],[39,32],[43,58],[5,58]],'#0b181b');
  c.fillStyle=color;c.globalAlpha=.8;c.fillRect(12,37,23,2);for(let j=0;j<4;j++)c.fillRect(10+j*7,49-(Math.sin(tick*.04+index+j)*6),4,8);c.globalAlpha=1;poly(c,[[-3,73],[50,73],[57,90],[-5,90]],'#2b3637');ellipse(c,10,78,3,3,'#d48457');line(c,[[10,79],[10,72]],'#bbc3a1',2);ellipse(c,37,81,3,2,color);ellipse(c,45,82,3,2,'#df927a');label(c,index%2?'NGMI':'TERMINL',24,14,7,color);c.fillStyle='#43574e';c.fillRect(21,105,16,2);c.restore();
}
function spectator(c,x,y,tick,index){
  const bob=Math.sin(tick*.05+index*3)*2;c.save();c.translate(x,y+bob);ellipse(c,0,28,16,28,'#172423','#091619',2);ellipse(c,0,-1,13,13,index%2?'#46533b':'#574b43','#142122');c.fillStyle='#83bc80';c.fillRect(-7,-3,5,3);c.fillRect(2,-3,5,3);joint(c,[-12,17],[-23,8+Math.sin(tick*.08+index)*8],5,'#25312c');joint(c,[12,17],[22,4-Math.sin(tick*.08+index)*8],5,'#25312c');c.restore();
}
function background(c,stage,tick,images,quality){
  const mall=stage!=='laundromat';
  const g=c.createLinearGradient(0,0,0,600);g.addColorStop(0,mall?'#15152c':'#11282b');g.addColorStop(.7,mall?'#302139':'#203c3b');g.addColorStop(1,'#101d22');c.fillStyle=g;c.fillRect(0,0,1000,600);
  const image=images?.[stage];
  const hasImage=!!(image?.complete&&image.naturalWidth);
  if(hasImage){const cover=Math.max(1000/image.naturalWidth,600/image.naturalHeight),w=image.naturalWidth*cover,h=image.naturalHeight*cover;c.drawImage(image,(1000-w)/2,(600-h)/2,w,h);c.fillStyle='#10151d42';c.fillRect(0,0,1000,600);}
  else{
    for(let i=0;i<8;i++){c.fillStyle=i%2?'#101b2577':'#53616622';c.fillRect(i*140-30,70,110,360);line(c,[[i*140,70],[i*140+55,0]],'#65737a22',3);}
    poly(c,[[0,55],[1000,55],[920,98],[80,98]],'#111b29');line(c,[[0,99],[1000,99]],mall?'#72535e':'#5e8981',2);
    c.strokeStyle='#78857922';c.lineWidth=1;for(let y=150;y<390;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(1000,y);c.stroke();}
  }
  if(mall){
    c.fillStyle='#0c192699';c.fillRect(312,106,374,236);poly(c,[[341,115],[659,115],[650,167],[350,167]],'#262234','#79635c',2);label(c,'DEAD MALL EXCHANGE',500,145,21,'#e7aa90');label(c,'OPEN UNTIL LIQUIDATION',500,184,10,'#b6a397');
    for(let i=0;i<4;i++)cabinet(c,85+i*220,272,i%2?'#df8b97':'#80baa2',tick,i);
    for(let i=0;i<6;i++)spectator(c,350+i*60,316,tick,i);
    c.save();c.translate(904,154);c.rotate(.09);poly(c,[[-57,-24],[55,-24],[55,27],[-57,27]],'#242932','#597574');label(c,'FOOD COURT',0,-5,11,'#d9cbbc');label(c,'CLOSED 2017',0,13,10,'#ce8380');c.restore();
    c.fillStyle='#5ba99414';c.fillRect(120,80,5,270);c.fillRect(875,80,5,270);
  }else{
    c.fillStyle='#142627';c.fillRect(306,115,385,65);label(c,'LIQUIDATION LAUNDROMAT',499,143,19,'#b8d1b5');label(c,'WASH YOUR BAGS • KEEP THE LOSSES',499,162,10,'#bb9884');
    for(let i=0;i<6;i++){
      const x=40+i*160;c.fillStyle='#435552';c.fillRect(x,239,133,163);c.strokeStyle='#152726';c.lineWidth=4;c.strokeRect(x,239,133,163);c.fillStyle='#263e3a';c.fillRect(x+8,249,117,24);label(c,`$${i%2?'0.00':'0.99'}`,x+89,265,10,'#b3c594');ellipse(c,x+68,333,46,49,'#a4afa0','#142927',4);ellipse(c,x+68,333,35,38,'#193534','#546e64',4);
      c.save();c.translate(x+68,333);c.rotate(tick*(i%2?.018:-.014)+i);for(let j=0;j<3;j++){c.rotate(Math.PI*2/3);poly(c,[[0,-3],[17,-29],[28,-9],[12,7]],j===1?'#b99a70':'#486762',null);}c.restore();ellipse(c,x+28,261,4,4,'#d0af70');
    }
    line(c,[[12,203],[980,203],[980,304]],'#50685d',12);line(c,[[12,200],[980,200]],'#9caaa1',3);label(c,'DO NOT FEED THE MACHINES',500,221,10,'#a1ab8e');
    if(quality==='high')for(let i=0;i<4;i++){const x=135+i*250,y=237-((tick*.5+i*23)%65);ellipse(c,x+Math.sin(tick*.025+i)*12,y,17,9,'#adc2b30b',null);}
  }
  // Immutable combat plane; landmarks and scenery never masquerade as collision.
  poly(c,[[0,403],[1000,403],[1000,600],[0,600]],mall?(hasImage?'#28273280':'#282732'):(hasImage?'#2b3b3880':'#2b3b38'),null);
  for(let i=-4;i<14;i++)line(c,[[500+(i-5)*58,403],[500+(i-5)*142,600]],'#9ca2931c',1);
  for(const y of [416,438,471,519,585])line(c,[[0,y],[1000,y]],'#9ca29320',1);
  line(c,[[0,500],[1000,500]],'#c5c6a54a',2);line(c,[[0,505],[1000,505]],'#060f19',2);
  c.fillStyle='#080f1755';c.fillRect(0,550,1000,50);
  if(quality==='high'){
    c.fillStyle=gradient(c,500,360,420,mall?'#c6835112':'#80d8bc12','#00000000');c.fillRect(0,0,1000,600);
    for(let i=0;i<18;i++){const x=(i*127+tick*.1)%1000,y=100+((i*73-tick*.04)%370+370)%370;ellipse(c,x,y,1,1,'#d1ccb42a',null);}
  }
}

function effects(c,state,tick,reducedMotion){
  for(const e of state.events||[]){
    const age=tick-e.tick;if(age<0||age>38)continue;
    const target=state.players[e.type==='hit'||e.type==='throw'?1-(e.player??0):(e.player??0)];
    const x=target?.x??e.x??500,y=500-(target?.y??e.y??0)-(target?.crouching?55:115),hit=/hit|counter|throw|super|break/.test(e.type),block=/block|guard|tech/.test(e.type);
    if(hit||block){
      const t=clamp(age/20,0,1),r=12+t*45;c.save();c.translate(x,y);c.globalAlpha=1-t;
      if(block){c.strokeStyle='#a5ecdf';c.lineWidth=3;c.beginPath();c.arc(0,0,r,-1.2,1.2);c.stroke();}
      else{for(let j=0;j<8;j++){const a=j*Math.PI/4+.15;c.save();c.rotate(a);poly(c,[[r*.5,0],[r+14,3],[r*.65,6],[r*.5,0]],j%2?'#ffebbb':'#e58b71',null);c.restore();}ellipse(c,0,0,Math.max(1,13-age),Math.max(1,13-age),'#fff3cb',null);}
      c.restore();
    }
    if(e.text&&age<38){c.save();c.globalAlpha=1-age/38;label(c,e.text.toUpperCase(),x,y-48-(reducedMotion?0:age*.5),12,block?'#b2efe3':'#ffe0b0');c.restore();}
  }
  if(state.phase==='roundOver'||state.phase==='finished'){
    const losing=state.players.find(p=>p.hp<=0),age=state.phaseTick||0;
    if(losing){
      for(let i=0;i<8;i++){const t=clamp((age-i*3)/60,0,1);if(!t)continue;const x=losing.x+(i-3.5)*20*t,y=475-Math.sin(t*Math.PI)*100-i*3;c.save();c.translate(x,y);c.rotate((reducedMotion?0:Math.sin(i+age*.04))*.35);poly(c,[[-10,-24],[12,-24],[12,22],[8,18],[4,22],[0,18],[-5,22],[-10,18]],'#d9d4bb','#736a60',1);for(let j=0;j<4;j++)line(c,[[-5,-15+j*6],[7,-15+j*6]],'#a88d78',1);c.restore();}
      if(age>25)label(c,'ROUND SETTLED',clamp(losing.x,160,840),556,13,'#d7b3a3');
    }
  }
}

/** Pure presentation. Layout scales from a 1000×600 authored view. */
export function drawRumble(c,state,{width=1000,height=600,images={},debug=false,reducedMotion=false,quality='high',interpolation=0,effectTick=state?.tick,shake=true,pixelStyle=true}={}){
  if(!c||!state?.players)return;
  c.save();c.clearRect(0,0,width,height);c.scale(width/1000,height/600);c.beginPath();c.rect(0,0,1000,600);c.clip();
  const tick=state.tick+(reducedMotion?0:clamp(interpolation,0,1));
  const recent=(state.events||[]).find(e=>/hit|super|throw/.test(e.type)&&effectTick-e.tick>=0&&effectTick-e.tick<5);
  if(recent&&!reducedMotion&&shake)c.translate(Math.sin(tick*2.7)*2.2,Math.cos(tick*3.1)*1.2);
  background(c,state.stage,reducedMotion?0:tick,images,quality);
  if(state.bounds?.warning||state.bounds?.active){
    const active=state.bounds.active,alpha=active?.2:.07+(reducedMotion?0:Math.sin(tick*.17)*.04);c.fillStyle=`rgba(214,192,133,${alpha})`;c.fillRect(0,295,160,215);c.fillRect(840,295,160,215);
    for(const x of [160,840]){line(c,[[x,295],[x,507]],active?'#e5ccb4':'#b9a374',2);label(c,active?'STEAM':'CLOSING',x===160?78:922,289,11,'#e0ca9f');}
    if(active&&!reducedMotion)for(let i=0;i<10;i++){const y=510-((tick*2+i*25)%210);ellipse(c,(i%2?922:78)+Math.sin(tick*.07+i)*28,y,34,19,'#d4d8bc19',null);}
  }
  state.players.forEach((f,i)=>{
    const x=f.x+(f.vx||0)*interpolation,shadowWidth=Math.max(18,42-(f.y||0)*.08);
    ellipse(c,x,506,shadowWidth,8,'#0409128c',null);
    const winner=(state.phase==='roundOver'?state.roundWinner:state.phase==='finished'?state.winner:null)===i;
    const landing=(state.events||[]).some(e=>e.type==='land'&&e.player===i&&tick-e.tick<6);
    drawFighter(c,{...f,x,landing:landing?1:0,victory:winner||f.victory},{tick,scale:1,debug,pixelStyle,image:images[f.character]});
  });
  effects(c,state,effectTick,reducedMotion);
  if(debug){label(c,`FRAME ${state.tick} · ${state.stage} · AUTHORITATIVE HITBOXES IN TRAINING`,500,591,9,'#8cd9b6');}
  c.restore();
}
