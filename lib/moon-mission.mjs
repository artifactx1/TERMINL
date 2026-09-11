import { hash } from "./rug-run.mjs";

export const MOON_TICK_MS = 1000 / 60;
export const MOON_END_TICK = 5400;
export const WORLD_WIDTH = 5100;
export const PLAYER_W = 30;
export const PLAYER_H = 44;
export const LEFT = 1, RIGHT = 2, JUMP = 4;
const DT = 1 / 60;
export const GROUND = [[0,850],[1010,1730],[1940,2700],[2890,3670],[3930,5100]];
export const PLATFORMS = [
  ...GROUND.map(([x,end],i)=>({id:`floor-${i}`,x,y:470,w:end-x,h:100})),
  {id:"p1",x:250,y:375,w:150,h:24},{id:"p2",x:490,y:290,w:140,h:24},
  {id:"p3",x:750,y:370,w:120,h:24},{id:"p4",x:1200,y:370,w:130,h:24},
  {id:"p5",x:1450,y:280,w:130,h:24},{id:"rug1",x:1760,y:400,w:110,h:22,rug:true},
  {id:"p6",x:2150,y:370,w:150,h:24},{id:"p7",x:2410,y:280,w:140,h:24},
  {id:"rug2",x:2750,y:405,w:100,h:22,rug:true},{id:"p8",x:3120,y:360,w:150,h:24},
  {id:"p9",x:3400,y:270,w:130,h:24},{id:"rug3",x:3750,y:380,w:120,h:22,rug:true},
  {id:"p10",x:4100,y:365,w:150,h:24},{id:"p11",x:4380,y:280,w:130,h:24},
];
export const PICKUPS = [
  ...GROUND.flatMap(([start,end],i)=>Array.from({length:Math.floor((end-start-140)/100)},(_,j)=>({id:`c-${i}-${j}`,x:start+120+j*100,y:431,kind:"coin"}))),
  ...PLATFORMS.filter(p=>!p.id.startsWith("floor")).flatMap(p=>[0,1,2].map(i=>({id:`top-${p.id}-${i}`,x:p.x+25+i*35,y:p.y-32,kind:i===1&&["p2","p5","p7","p9","p11"].includes(p.id)?"gem":"coin"}))),
  {id:"shield1",x:550,y:235,kind:"shield"},{id:"shield2",x:2480,y:222,kind:"shield"},
];
export const ENEMIES = [620,1370,2220,3070,3470,4170,4610].map((x,i)=>({id:`e${i}`,home:x,x,y:438,w:32,h:32}));
export const CHECKPOINTS = [1120,2980,4000];
export function newMoon(seed) {
  return {seed,tick:0,input:0,previousInput:0,x:65,y:426,vx:0,vy:0,face:1,grounded:true,jumps:0,coyote:8,
    hp:3,shield:false,invulnerable:0,coins:0,score:0,lastBankValue:0,bestCombo:0,stomps:0,combo:0,
    collected:[],defeated:[],crumbling:{},checkpoint:65,furthest:65,pulse:null,dead:false,ended:false,won:false};
}
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+PLAYER_W>b.x&&a.y<b.y+b.h&&a.y+PLAYER_H>b.y;
export function enemyAt(enemy,tick,seed) {
  const offset=(hash(`${seed}:${enemy.id}`)%100)/100*Math.PI*2;
  return {...enemy,x:enemy.home+Math.sin(tick/85+offset)*48};
}
function damage(s,fall=false) {
  if(!fall&&s.invulnerable>0)return s;
  if(!fall&&s.shield)return {...s,shield:false,invulnerable:80,pulse:{tick:s.tick,text:"SHIELD SAVED YOU",kind:"shield"}};
  const hp=s.hp-1;
  return {...s,hp,score:hp<=0?0:Math.floor(s.score*.8),combo:0,dead:hp<=0,invulnerable:100,
    x:fall?s.checkpoint:s.x,y:fall?380:s.y-12,vx:fall?0:-s.face*170,vy:fall?0:-280,grounded:false,jumps:fall?0:s.jumps,
    pulse:{tick:s.tick,text:hp<=0?"REKT!":fall?"BACK TO CHECKPOINT":"OUCH! −20% SCORE",kind:"hit"}};
}
export function stepMoon(prev) {
  if(prev.ended)return prev;
  let s={...prev,tick:prev.tick+1,invulnerable:Math.max(0,prev.invulnerable-1),pulse:prev.pulse&&prev.tick-prev.pulse.tick<65?prev.pulse:null};
  const direction=Number(!!(s.input&RIGHT))-Number(!!(s.input&LEFT));
  const target=direction*245;
  s.vx+=Math.max(-32,Math.min(32,target-s.vx));
  if(direction)s.face=direction;
  s.coyote=prev.grounded?8:Math.max(0,prev.coyote-1);
  const jumpPressed=!!(s.input&JUMP)&&!(prev.previousInput&JUMP);
  if(jumpPressed&&(s.coyote>0||s.jumps<2)){
    s.vy=-580;s.jumps=s.coyote>0?1:s.jumps+1;s.coyote=0;s.grounded=false;
    s.pulse={tick:s.tick,text:s.jumps===2?"DOUBLE JUMP!":"",kind:"jump"};
  }
  if(!(s.input&JUMP)&&(prev.previousInput&JUMP)&&s.vy< -220)s.vy=-220;
  s.previousInput=s.input;s.vy=Math.min(920,s.vy+1500*DT);
  const lastBottom=prev.y+PLAYER_H;
  s.x=Math.max(0,Math.min(WORLD_WIDTH-PLAYER_W,s.x+s.vx*DT));
  s.y+=s.vy*DT;s.grounded=false;
  for(const p of PLATFORMS){
    const collapse=s.crumbling[p.id];
    if(collapse!==undefined&&s.tick-collapse>30&&s.tick-collapse<240)continue;
    if(s.vy>=0&&lastBottom<=p.y+1&&s.y+PLAYER_H>=p.y&&s.x+PLAYER_W>p.x&&s.x<p.x+p.w){
      s.y=p.y-PLAYER_H;s.vy=0;s.grounded=true;s.jumps=0;
      if(p.rug&&(collapse===undefined||s.tick-collapse>=240))s.crumbling={...s.crumbling,[p.id]:s.tick};
    }
  }
  for(const pickup of PICKUPS){
    if(s.collected.includes(pickup.id)||Math.abs(s.x+15-pickup.x)>26||Math.abs(s.y+22-pickup.y)>33)continue;
    s.collected=[...s.collected,pickup.id];
    if(pickup.kind==="shield"){s.shield=true;s.pulse={tick:s.tick,text:"DIAMOND HANDS SHIELD",kind:"shield"};}
    else{s.coins++;s.combo++;s.bestCombo=Math.max(s.combo,s.bestCombo);const points=pickup.kind==="gem"?500:100;s.score+=points;s.pulse={tick:s.tick,text:`+${points}`,kind:"coin"};}
  }
  for(const raw of ENEMIES){
    if(s.defeated.includes(raw.id))continue;
    const enemy=enemyAt(raw,s.tick,s.seed);
    if(!overlaps(s,enemy))continue;
    if(s.vy>0&&lastBottom<=enemy.y+13){s.defeated=[...s.defeated,enemy.id];s.stomps++;s.score+=250;s.vy=-420;s.jumps=1;s.pulse={tick:s.tick,text:"STOMP! +250",kind:"stomp"};}
    else s=damage(s);
  }
  for(const x of CHECKPOINTS)if(s.x>=x&&s.checkpoint<x){s.checkpoint=x;s.pulse={tick:s.tick,text:"CHECKPOINT SAVED",kind:"checkpoint"};}
  s.furthest=Math.max(s.furthest,s.x);
  if(s.y>620)s=damage(s,true);
  if(s.x>=4950&&!s.dead){s.won=true;s.score+=1000+Math.max(0,Math.floor((MOON_END_TICK-s.tick)/6));}
  s.ended=s.dead||s.won||s.tick>=MOON_END_TICK;
  s.lastBankValue=s.score;
  return s;
}
export function validateMoonReplay(data) {
  if(!data||typeof data.seed!=="string"||!/^[a-zA-Z0-9-]{1,64}$/.test(data.seed)||!Number.isInteger(data.endTick)||data.endTick<1||data.endTick>MOON_END_TICK||!Array.isArray(data.moves)||data.moves.length>1200)return null;
  let last=-1;
  for(const m of data.moves){if(!m||!Number.isInteger(m.tick)||m.tick<=last||m.tick<0||m.tick>=data.endTick||!Number.isInteger(m.input)||m.input<0||m.input>7)return null;last=m.tick;}
  return {seed:data.seed,endTick:data.endTick,moves:data.moves.map(({tick,input})=>({tick,input}))};
}
export function replayMoon(record) {
  const valid=validateMoonReplay(record);if(!valid)throw Error("Invalid Moon Mission replay");
  let s=newMoon(valid.seed),index=0;
  while(s.tick<valid.endTick&&!s.ended){if(valid.moves[index]?.tick===s.tick)s.input=valid.moves[index++].input;s=stepMoon(s);}
  if(s.tick!==valid.endTick||!s.ended)throw Error("Moon Mission must reach an end state");
  return s;
}
export function moonBotReplay(seed,id="chloe") {
  let s=newMoon(seed),moves=[],holdUntil=0;
  while(!s.ended){
    let input=RIGHT;
    const ahead=s.x+105;
    const gap=!GROUND.some(([a,b])=>ahead>=a&&ahead<b);
    const enemy=ENEMIES.some(e=>!s.defeated.includes(e.id)&&enemyAt(e,s.tick,seed).x>s.x&&enemyAt(e,s.tick,seed).x-s.x<85&&s.y>380);
    if(s.grounded&&(gap||enemy)&&s.tick>holdUntil+2)holdUntil=s.tick+18;
    if(!s.grounded&&s.jumps===1&&s.vy> -90&&s.tick>holdUntil+2)holdUntil=s.tick+18;
    if(s.tick<holdUntil)input|=JUMP;
    // Chloe paces herself; Max and Brian commit to riskier continuous movement.
    if(id==="chloe"&&s.tick%310<40)input&=~RIGHT;
    if(input!==s.input){s={...s,input};moves.push({tick:s.tick,input});}
    s=stepMoon(s);
  }
  return {seed,moves,endTick:s.tick};
}
