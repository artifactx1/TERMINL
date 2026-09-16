import {MOON_WORLDS, newMoon, PLAYER_W, PLAYER_H, LEFT, RIGHT, JUMP} from './moon-mission.mjs';
export {LEFT,RIGHT,JUMP,PLAYER_W,PLAYER_H};
export const CAMPAIGN_KEY='terminl:moon-campaign:v1';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const routes=[
  {mechanic:'Jump the spikes. Stomp the patrols.',lengths:[980,1150,860,1040],heights:[470,470,435,470],gap:85},
  {mechanic:'Watch for yellow. Clear the rooftop vents.',lengths:[760,870,720,990],heights:[470,395,330,410],gap:115},
  {mechanic:'Thread the saws and hopping sentries.',lengths:[1080,780,920,850],heights:[470,440,400,470],gap:135},
  {mechanic:'Climb narrow stairs above the spike beds.',lengths:[700,760,820,900],heights:[470,390,310,390],gap:155},
  {mechanic:'Keep moving. The high route crumbles.',lengths:[830,920,750,1080],heights:[470,450,430,470],gap:180},
  {mechanic:'Brake before the traps. Ice carries momentum.',lengths:[920,850,780,1060],heights:[470,430,390,450],gap:190},
  {mechanic:'Bait the cannons. Jump the crossfire.',lengths:[770,940,830,860],heights:[470,430,470,410],gap:205},
  {mechanic:'Time the moving platforms between saws.',lengths:[720,810,750,900],heights:[440,370,410,340],gap:220},
  {mechanic:'Chain your jumps through the security grid.',lengths:[800,950,720,890],heights:[470,400,340,430],gap:230},
  {mechanic:'Survive the trap gauntlet. Defeat the Warden.',lengths:[850,740,960,800],heights:[470,395,340,430],gap:240},
];

export const CAMPAIGN_WORLDS=MOON_WORLDS.map((palette,level)=>{
  const route=routes[level],ground=[],platforms=[],pickups=[],enemies=[],hazards=[],checkpoints=[];
  let x=0;
  const count=14+level;
  for(let i=0;i<count;i++){
    const length=route.lengths[i%4],y=i===0||i===count-1?470:route.heights[i%4];
    ground.push([x,x+length,y]);platforms.push({id:`floor-${i}`,x,y,w:length,h:600-y});
    if(i>0)checkpoints.push({x:x+65,y:y-PLAYER_H});
    for(let n=130;n<length-65;n+=110)pickups.push({id:`coin-${i}-${n}`,x:x+n,y:y-38,kind:'coin'});
    // Alternating stairways and high routes make each biome's silhouette distinct.
    for(let n=0;n<3;n++){
      const px=x+210+n*175,py=y-80-(n%2)*75;
      if(px+135>x+length-70)continue;
      const p={id:`ledge-${i}-${n}`,x:px,y:py,w:150-level*5,h:23,rug:level>=4&&n===1&&i%2===1};platforms.push(p);
      pickups.push({id:`gem-${i}-${n}`,x:px+p.w/2,y:py-30,kind:n===1?'gem':'coin'});
    }
    if(i%(3+Math.floor(level/3))===1)pickups.push({id:`shield-${i}`,x:x+385,y:y-180,kind:'shield'});
    if(i||level)enemies.push({id:`enemy-${i}`,home:x+length*.72,x:x+length*.72,y:y-32,w:32,h:32,range:45+level*4,pace:90-level*4,hopper:level>=2&&i%3!==0});
    if(level>=3&&i%3<1+Math.floor(level/6))enemies.push({id:`guard-${i}`,home:x+length*.38,x:x+length*.38,y:y-32,w:32,h:32,range:36+level*2,pace:70-level*2,hopper:level>=8});
    // Safe approach -> isolated lesson -> mixed obstacles. Danger stays away from
    // checkpoint landings; later routes layer more traps and narrower high paths.
    const slots=1+Math.floor(level/3)+(i%3<level%3?1:0);
    const types=level===0?['spikes']:level===1?['spikes','vent']:level<6?['spikes','vent','saw']:['spikes','vent','saw','cannon'];
    for(let n=0;n<slots;n++){
      const type=types[(i+n)%types.length],hx=x+280+(length-480)*(n+.5)/slots;
      const h=type==='spikes'?22:type==='saw'?30:50+level*3;
      hazards.push({id:`trap-${i}-${n}`,type,x:hx,y:y-(type==='saw'?100:h),w:type==='spikes'?42+level*4:type==='saw'?30:38,h,
        period:250-level*9,offset:i*29+n*67,warning:50-level*2,active:60+level*4,range:28+level*3,travel:130+level*4});
    }
    const gap=route.gap+(i%3)*8;
    if(i<count-1&&level>=4){const w=100-level*5;platforms.push({id:`bridge-${i}`,x:x+length+(gap-w)/2,y:y-50,w,h:20,rug:level===4||level===6||level===9,move:level===7||level===8?{axis:'y',range:32,period:180+i%3*30}:null});}
    x+=length+(i<count-1?gap:0);
  }
  let arena=null;
  if(level===9){arena={start:x-150,end:x+1100};ground.at(-1)[1]=arena.end;platforms.find(p=>p.id===`floor-${count-1}`).w+=1250;x=arena.end;checkpoints.push({x:arena.start+35,y:426});}
  const tip=level===0?'Spikes hurt from any side. Stomp pink sentries; use the high route to avoid traps.':level===1?'Yellow vents are about to fire. Wait on clear ground, then jump across.':level<4?'Saws cannot be stomped. Watch their vertical path before committing to a jump.':level<6?'Pink platforms collapse underfoot. Keep a second jump ready for the landing.':level===6?'A dotted yellow line warns of incoming fire. Jump the bolt or take the high route.':level<9?'Wait for an opening, then chain moving platforms and double jumps through the traps.':'Every trap returns. The Warden charges faster and sends more waves as it weakens.';
  return {...palette,...route,tip,level,width:x,finish:x-100,ground,platforms,pickups,enemies,hazards,checkpoints,arena,timeLimit:(300+level*20)*60};
});
export function campaignWorld(level){const world=CAMPAIGN_WORLDS[level];if(!Number.isInteger(level)||!world)throw Error('Unknown campaign level');return world;}
export function platformAt(p,tick){return p.move?{...p,[p.move.axis]:p[p.move.axis]+Math.sin(tick/p.move.period*Math.PI*2)*p.move.range}:p;}
export function campaignEnemy(e,tick){return {...e,x:e.home+Math.sin(tick/e.pace)*e.range,y:e.y-(e.hopper?Math.max(0,Math.sin(tick/38))*65:0)};}
export function hazardPhase(h,tick){if(h.type==='spikes'||h.type==='saw')return 'active';const phase=(tick+h.offset)%h.period;return phase<(h.warning??45)?'warning':phase<(h.warning??45)+(h.active??55)?'active':'idle';}
/** Shared by collision and drawing so moving traps never have invisible hitboxes. */
export function hazardAt(h,tick){
  if(h.type==='saw')return {...h,y:h.y+Math.sin((tick+h.offset)/h.period*Math.PI*2)*h.range};
  if(h.type==='cannon'){const age=(tick+h.offset)%h.period-h.warning;return {...h,x:h.x-h.travel*clamp(age/h.active,0,1),y:h.y+h.h-25,w:26,h:20};}
  return h;
}
export function newCampaignLevel(level=0,checkpoint=-1){
  const world=campaignWorld(level),point=world.checkpoints[checkpoint];
  return {...newMoon(`campaign-${level}`,level),campaign:true,x:point?.x||65,y:point?.y??426,checkpoint:point?.x||65,checkpointY:point?.y??426,checkpointIndex:point?checkpoint:-1,
    furthest:point?.x||65,collected:point?world.pickups.filter(p=>p.x<point.x).map(p=>p.id):[],boss:world.arena?{active:false,hp:6,x:world.arena.start+570,y:350,w:96,h:120,tick:0,cycle:0,phase:'guard',invulnerable:0}:null,shots:[]};
}
const overlap=(s,e)=>s.x<e.x+e.w&&s.x+PLAYER_W>e.x&&s.y<e.y+e.h&&s.y+PLAYER_H>e.y;
function hurt(s,fall=false){
  if(!fall&&s.invulnerable)return s;
  if(!fall&&s.shield)return {...s,shield:false,invulnerable:90,pulse:{tick:s.tick,text:'SHIELD SAVED YOU',kind:'shield'}};
  const hp=Math.max(0,s.hp-1);
  return {...s,hp,dead:hp===0,invulnerable:110,combo:0,x:fall?s.checkpoint:s.x,y:fall?s.checkpointY:s.y-12,vx:fall?0:-s.face*140,vy:fall?0:-260,grounded:false,jumps:0,pulse:{tick:s.tick,text:hp===0?'TRY AGAIN':fall?'CHECKPOINT':'OUCH!',kind:'hit'}};
}
function stepBoss(s,world,lastBottom){
  const a=world.arena;if(!a||!s.boss.hp)return s;
  const boss={...s.boss};s.boss=boss;
  if(!boss.active&&s.x>=a.start){boss.active=true;s.checkpoint=a.start+35;s.checkpointY=426;s.checkpointIndex=world.checkpoints.length-1;s.pulse={tick:s.tick,text:'THE LIQUIDATION WARDEN',kind:'boss'};}
  if(!boss.active)return s;
  s.x=clamp(s.x,a.start+10,a.end-PLAYER_W-10);
  boss.tick++;boss.invulnerable=Math.max(0,boss.invulnerable-1);
  const phase=boss.tick%300,stage=boss.hp>4?0:boss.hp>2?1:2;
  boss.phase=phase<60?'warning':phase<140?'charge':phase<230?'exposed':'guard';
  if(phase===60){boss.direction=s.x<boss.x?-1:1;boss.cycle++;}
  if(boss.phase==='charge')boss.x=clamp(boss.x+(boss.direction||-1)*(3.2+stage*.8),a.start+160,a.end-220);
  if(phase===140||stage>=1&&phase===165||stage===2&&phase===190){s.shots=[...s.shots,...[-1,1].map(direction=>({x:boss.x+48,y:449,w:24,h:21,vx:direction*(4+stage*.8)}))];}
  if(overlap(s,boss)){
    if(s.vy>0&&lastBottom<=boss.y+20){
      s.vy=-550;s.jumps=1;s.y=boss.y-PLAYER_H;
      if(boss.phase==='exposed'&&!boss.invulnerable){boss.hp--;boss.invulnerable=65;s.score+=750;s.pulse={tick:s.tick,text:boss.hp?'WARDEN HIT!':'WARDEN DEFEATED!',kind:'stomp'};if(!boss.hp){s.shots=[];s.score+=3000;}}
      else s.pulse={tick:s.tick,text:'ARMOR UP · WAIT FOR BLUE',kind:'boss'};
    }else s=hurt(s);
  }
  s.shots=s.shots.map(p=>({...p,x:p.x+p.vx})).filter(p=>p.x>a.start&&p.x<a.end);
  for(const shot of s.shots)if(overlap(s,shot))s=hurt(s);
  return s;
}
export function stepCampaign(prev){
  if(prev.ended)return prev;
  const world=campaignWorld(prev.level);
  let s={...prev,tick:prev.tick+1,invulnerable:Math.max(0,prev.invulnerable-1),pulse:prev.pulse&&prev.tick-prev.pulse.tick<65?prev.pulse:null};
  const direction=Number(!!(s.input&RIGHT))-Number(!!(s.input&LEFT)),ice=world.biome==='ice';
  s.vx+=clamp(direction*245-s.vx,-(ice?10:32),ice?10:32);if(direction)s.face=direction;
  s.coyote=prev.grounded?8:Math.max(0,prev.coyote-1);
  if(s.input&JUMP&&!(prev.previousInput&JUMP)&&(s.coyote||s.jumps<2)){s.vy=-580;s.jumps=s.coyote?1:s.jumps+1;s.grounded=false;s.coyote=0;}
  if(!(s.input&JUMP)&&prev.previousInput&JUMP&&s.vy< -220)s.vy=-220;
  s.previousInput=s.input;s.vy=Math.min(920,s.vy+25);
  const lastBottom=prev.y+PLAYER_H;
  s.x=clamp(s.x+s.vx/60,0,world.width-PLAYER_W);s.y+=s.vy/60;s.grounded=false;
  for(const raw of world.platforms){
    const p=platformAt(raw,s.tick),before=platformAt(raw,prev.tick),age=s.tick-(s.crumbling[p.id]??-9999);
    if(p.rug&&age>30&&age<240)continue;
    if(s.vy>=0&&lastBottom<=before.y+2&&s.y+PLAYER_H>=p.y&&s.x+PLAYER_W>p.x&&s.x<p.x+p.w){s.y=p.y-PLAYER_H;s.vy=0;s.grounded=true;s.jumps=0;if(p.rug&&(age<0||age>=240))s.crumbling={...s.crumbling,[p.id]:s.tick};}
    // Raised ground has solid sides; elevated ledges remain one-way jump platforms.
    else if(p.id.startsWith('floor')&&s.y+PLAYER_H>p.y+3&&prev.y+PLAYER_H>p.y+3&&s.y<p.y+p.h){if(prev.x+PLAYER_W<=p.x&&s.x+PLAYER_W>p.x)s.x=p.x-PLAYER_W;else if(prev.x>=p.x+p.w&&s.x<p.x+p.w)s.x=p.x+p.w;}
  }
  for(const p of world.pickups){if(s.collected.includes(p.id)||Math.abs(s.x+15-p.x)>26||Math.abs(s.y+22-p.y)>33)continue;s.collected=[...s.collected,p.id];if(p.kind==='shield'){s.shield=true;s.pulse={tick:s.tick,text:'SHIELD',kind:'shield'};}else{s.coins++;s.score+=p.kind==='gem'?500:100;s.pulse={tick:s.tick,text:p.kind==='gem'?'+500':'+100',kind:'coin'};}}
  for(const raw of world.enemies){if(s.defeated.includes(raw.id))continue;const e=campaignEnemy(raw,s.tick);if(!overlap(s,e))continue;if(s.vy>0&&lastBottom<=e.y+16){s.defeated=[...s.defeated,e.id];s.stomps++;s.score+=250;s.vy=-440;s.jumps=1;s.pulse={tick:s.tick,text:'STOMP! +250',kind:'stomp'};}else s=hurt(s);}
  for(const h of world.hazards)if(hazardPhase(h,s.tick)==='active'&&overlap(s,hazardAt(h,s.tick)))s=hurt(s);
  world.checkpoints.forEach((p,index)=>{if(s.grounded&&s.x>=p.x&&s.x<p.x+180&&index>s.checkpointIndex){s.checkpoint=p.x;s.checkpointY=p.y;s.checkpointIndex=index;s.pulse={tick:s.tick,text:'CHECKPOINT SAVED',kind:'checkpoint'};}});
  s.furthest=Math.max(s.furthest,s.x);if(s.y>640)s=hurt(s,true);
  if(!s.dead)s=stepBoss(s,world,lastBottom);
  if(s.x>=world.finish&&!s.dead&&(!s.boss||s.boss.hp===0)){s.won=true;s.score+=1500;}
  s.ended=s.dead||s.won||s.tick>=world.timeLimit;s.lastBankValue=s.score;return s;
}

export function readCampaign(raw){
  let p;try{p=JSON.parse(raw);}catch{};
  const completed=Array.isArray(p?.completed)?[...new Set(p.completed.filter(n=>Number.isInteger(n)&&n>=0&&n<10))].sort((a,b)=>a-b):[];
  let unlocked=0;while(completed.includes(unlocked)&&unlocked<9)unlocked++;
  const level=Number.isInteger(p?.current)&&p.current>=0&&p.current<=unlocked?p.current:unlocked;
  const checkpoint=Number.isInteger(p?.checkpoint)&&p.checkpoint>=0&&p.checkpoint<campaignWorld(level).checkpoints.length?p.checkpoint:-1;
  return {version:1,completed,unlocked,current:level,checkpoint,best:Array.from({length:10},(_,i)=>Number.isFinite(p?.best?.[i])?clamp(Math.floor(p.best[i]),0,1000000):0)};
}
export function clearCampaignLevel(save,state){
  if(!state.won||state.boss?.hp>0)return save;
  const completed=[...new Set([...save.completed,state.level])],best=[...save.best];best[state.level]=Math.max(best[state.level],state.score);
  return readCampaign(JSON.stringify({...save,completed,best,current:Math.min(9,state.level+1),checkpoint:-1}));
}
