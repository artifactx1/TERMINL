/** REKT RUMBLE rules v1. Pure 60 Hz simulation; no clocks, assets or random sources. */
export const INPUT = Object.freeze({ LEFT:1, RIGHT:2, JUMP:4, DOWN:8, LIGHT:16, HEAVY:32, SPECIAL:64, GUARD:128, DASH:256, THROW:512, SUPER:1024 });
export const CHARACTERS = Object.freeze({
  max: { id:'max', name:'Margin Call Max', archetype:'Commitment grappler', speed:3.7, jump:14.8, color:'#ffba69', victory:'A receipt longer than his portfolio.' },
  diamond: { id:'diamond', name:'Diamond Hands Pepe', archetype:'Defensive bruiser', speed:3.2, jump:14.4, color:'#77eac7', victory:'Still holding. Even the trophy.' },
  brian: { id:'brian', name:'Buy-High Brian', archetype:'All-in brawler', speed:3.55, jump:14.5, color:'#f8a95d', victory:'Bought the top. Punched through the ceiling.' },
  mia: { id:'mia', name:'MEV Mia', archetype:'Fast pressure', speed:4.5, jump:15.6, color:'#ff86c2', victory:'This receipt finally has a win on it.' },
  bernie: { id:'bernie', name:'Bridge Burn Bernie', archetype:'Long-reach punisher', speed:3.35, jump:14.1, color:'#ff7557', victory:'The bridge is still broken. You are too.' },
  chloe: { id:'chloe', name:'Cold Storage Chloe', archetype:'Armored counter-hitter', speed:3.0, jump:14.2, color:'#77baff', victory:'Offline for six years. Still ahead.' },
});
export const STAGES = Object.freeze([
  { id:'dead-mall', name:'Dead Mall Exchange', description:'Fixed arena. Play the distance between shuttered shops.', mechanic:'none' },
  { id:'laundromat', name:'Liquidation Laundromat', description:'Steam warns for two seconds before closing the side lanes for six seconds. Casual rules.', mechanic:'steam-boundaries' },
]);
const normal = (id,name,input,startup,active,recovery,damage,range,level='mid',extra={}) => ({ id,name,input,startup,active,recovery,damage,range,level,hitstun:18,blockstun:10,pushback:20,meterGain:45,cost:0,cancels:[],hitbox:{front:range,bottom:60,top:150},counterplay:'Guard, then punish the recovery from outside its range.',...extra });
function movesFor(id) {
  const max=id==='max';
  return {
    light:normal('light',max?'Receipt Jab':'Diamond Knuckle','Light',6,3,13,55,max?75:85,'mid',{cancels:['special','downSpecial','forwardSpecial'],counterplay:'A short check. Walk outside its reach and whiff-punish.'}),
    heavy:normal('heavy',max?'Portfolio Swing':'Bag Holder','Heavy',15,4,25,max?125:115,max?115:145,'mid',{hitstun:25,pushback:35,counterplay:'Long startup and recovery. Jump it or block and take your turn.'}),
    crouchLight:normal('crouchLight','Low Bid','Down + light',7,3,14,45,88,'low',{hitbox:{front:88,bottom:0,top:34},cancels:['special','downSpecial','forwardSpecial'],counterplay:'Crouch-guard. Standing guard loses to this low.'}),
    crouchHeavy:normal('crouchHeavy',max?'Margin Sweep':'Cold Storage Sweep','Down + heavy',16,4,27,100,125,'low',{hitbox:{front:125,bottom:0,top:35},knockdown:27,hitstun:25,counterplay:'Crouch-guard or jump; very punishable on a blocked sweep.'}),
    airLight:normal('airLight','Air Drop','Jump + light',7,4,15,60,78,'high',{hitbox:{front:78,bottom:-48,top:58},counterplay:'Stand-guard or anti-air. Crouch-guard loses to airborne overheads.'}),
    airHeavy:normal('airHeavy',max?'Falling Wedge':'Diamond Descent','Jump + heavy',12,5,24,100,106,'high',{hitbox:{front:106,bottom:-65,top:62},hitstun:24,pushback:30,counterplay:'Stand-guard and punish the landing recovery, or anti-air early.'}),
    special:normal('special',max?'Margin Call':'Cold Wallet Wall','Special',max?24:18,5,max?35:28,max?170:120,max?82:160,'mid',{throw:max,armor:!max?1:0,hitstun:28,pushback:50,meterGain:75,counterplay:max?'Command grab: jump or retreat during the long wind-up. Throw can be escaped.':'One armor hit during startup, not invulnerability. Throw it or punish its recovery.'}),
    downSpecial:normal('downSpecial',max?'Liquidation Lift':'Diamond Spire','Down + special',10,6,32,130,85,'mid',{hitbox:{front:85,bottom:0,top:230},launch:8,hitstun:30,meterGain:65,counterplay:'Anti-air covers the space overhead. Bait on the ground and punish recovery.'}),
    forwardSpecial:normal('forwardSpecial',max?'Leverage Lunge':'Vault Breaker','Forward + special',19,6,32,max?145:135,95,'mid',{travel:max?7:5,pushback:55,hitstun:28,meterGain:65,counterplay:'Advancing attack commits to its lane. Guard and punish the long recovery.'}),
    throw:normal('throw',max?'Forced Liquidation':'Diamond Handshake','Throw',5,2,27,max?145:120,62,'mid',{throw:true,meterGain:60,knockdown:32,counterplay:'Jump, stay outside grab range, or press Throw within the six-frame escape window.'}),
    super:normal('super',max?'Maximum Leverage':'Never Selling','Super · 100% meter',14,8,48,300,170,'mid',{cost:1000,invuln:8,hitstun:35,knockdown:36,pushback:80,meterGain:0,counterplay:'Costs a full meter. Guard the flash, then punish its huge recovery.'}),
  };
}
// Expansion profiles are explicit authored move data. The two original sets
// above are unchanged so existing v1 replay inputs keep their original result.
function expansionMoves(id) {
  const sets={
    brian:[
      ['FOMO Check',7,3,14,65,82],['Buy the Top',18,5,29,155,133],['Exit Bid',8,3,15,50,85],['Average Down',18,4,29,120,130],['Bull Trap',8,4,17,70,84],['Generational Top',14,5,28,120,112],['Full Send',22,5,34,160,100],['Ceiling Buyer',12,6,34,145,91],['Market Buy',23,6,36,165,108],['Bag Transfer',6,2,29,145,64],['All-Time High',19,8,52,340,177],
    ],
    mia:[
      ['Priority Tap',4,3,10,42,69],['Slippage Slap',11,4,20,88,108],['Dust Sweep',5,3,11,35,78],['Failed Transaction',12,4,23,82,113],['Fast Fill',5,4,12,46,73],['Sandwich Drop',9,5,20,85,94],['Receipt Whip',12,4,21,85,148],['Priority Fee',7,5,28,100,76],['Skip the Queue',12,5,25,95,88],['Refund Request',4,2,24,100,59],['No More Slippage',10,7,43,265,145],
    ],
    bernie:[
      ['Socket Check',8,3,16,62,99],['Wrench Swing',20,5,32,145,180],['Loose Bolt',9,3,16,50,104],['Bridge Out',19,4,30,120,155],['Toll Booth',8,4,17,65,95],['Falling Infrastructure',15,5,28,120,135],['Emergency Repair',25,5,37,165,175],['Support Beam',13,6,35,150,113],['Cross-Chain Crash',25,6,38,155,137],['Maintenance Window',7,2,31,135,68],['Final Bridge Exploit',22,8,55,350,190],
    ],
    chloe:[
      ['Cold Check',7,3,15,58,83],['Safe Deposit',19,5,29,135,128],['Private Key',8,3,15,48,86],['Air-Gap Sweep',17,4,28,110,121],['Offline Drop',8,4,16,65,78],['Cold Front',13,5,26,110,105],['Vault Door',23,5,34,145,123],['Deep Freeze',11,6,33,135,89],['Secure Transfer',22,6,34,140,100],['Self Custody',6,2,28,135,64],['Six-Year Hold',18,8,50,320,158],
    ],
  };
  const keys=['light','heavy','crouchLight','crouchHeavy','airLight','airHeavy','special','downSpecial','forwardSpecial','throw','super'];
  const base=movesFor('diamond');
  return Object.fromEntries(keys.map((key,i)=>{
    const [name,startup,active,recovery,damage,range]=sets[id][i];
    const m={...base[key],name,startup,active,recovery,damage,range,hitbox:{...base[key].hitbox,front:range}};
    if(key==='special'){
      m.armor=id==='chloe'?1:0;m.throw=false;
      m.counterplay=id==='chloe'?'The safe absorbs one startup hit, not throws. Bait it, then punish the recovery.':id==='mia'?'Fast receipt pressure, but no armor. Step outside its reach and punish the whiff.':id==='bernie'?'A long wrench wind-up. Close the gap before it is active, or block and punish.':'A heavy all-in swing with no protection. Interrupt the wind-up or punish on block.';
    }
    if(key==='forwardSpecial')m.travel={brian:8,mia:9,bernie:4,chloe:4.5}[id];
    if(key==='downSpecial')m.launch=id==='mia'?10:8;
    if(key==='light'||key==='crouchLight')m.hitstun=id==='mia'?16:18;
    if(key==='super')m.counterplay='Full-meter commitment. Guard the startup flash, then punish the long recovery. No guaranteed damage.';
    return [key,m];
  }));
}
export const MOVES = Object.freeze({max:movesFor('max'),diamond:movesFor('diamond'),...Object.fromEntries(['brian','mia','bernie','chloe'].map(id=>[id,expansionMoves(id)]))});
for(const set of Object.values(MOVES)) for(const m of Object.values(set)) { m.hitAdvantage=m.hitstun-m.recovery; m.blockAdvantage=m.blockstun-m.recovery; }
export const moveFor = (character,id) => Object.hasOwn(MOVES,character)&&Object.hasOwn(MOVES[character],id)?MOVES[character][id]:null;
export const hurtboxFor = p => ({left:-22,right:22,bottom:0,top:p.crouching?105:170});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const quant=n=>Math.round(n*1000)/1000;
const fighter=(character,x,face)=>({character,x,y:0,vx:0,vy:0,face,hp:1000,meter:0,action:null,stun:0,blockstun:0,grounded:true,crouching:false,previousInput:0,invuln:0,knockdown:0,combo:0,comboTimer:0,buffer:null,throwPending:null});
/** @returns {import('./contracts').FightState} */
export function createFight({characters=['max','diamond'],stage='dead-mall'}={}) {
  if(!Array.isArray(characters)||characters.length!==2||characters.some(c=>typeof c!=='string'||!Object.hasOwn(CHARACTERS,c))) throw new Error('Unknown fighter');
  if(!STAGES.some(s=>s.id===stage)) throw new Error('Unknown stage');
  return {version:1,tick:0,phase:'intro',phaseTick:0,round:1,wins:[0,0],winner:null,stage,players:[fighter(characters[0],320,1),fighter(characters[1],680,-1)],roundTicks:3600,events:[],bounds:{left:42,right:958,warning:false,active:false},hitstop:0,draws:0};
}
function emit(s,type,player,text) {
  const p=s.players[player];
  s.events.push({id:`${s.tick}:${s.events.filter(e=>e.tick===s.tick).length}`,tick:s.tick,type,...(p?{player,x:p.x,y:p.y}:{}),...(text?{text}: {})});
  s.events=s.events.slice(-24);
}
function finishRound(s) {
  const [a,b]=s.players; const winner=a.hp===b.hp?null:a.hp>b.hp?0:1;
  if(winner!==null) s.wins[winner]++; else s.draws++;
  s.roundWinner=winner;s.phase='roundOver';s.phaseTick=0;
  emit(s,winner===null?'draw':'roundWin',winner,winner===null?'DOUBLE REKT · DRAW':`ROUND ${s.round} SECURED`);
}
function newRound(s) {
  s.round++; s.players=s.players.map((p,i)=>({...fighter(p.character,i?680:320,i?-1:1),meter:Math.min(1000,p.meter)}));
  s.roundTicks=3600;s.phase='intro';s.phaseTick=0;s.hitstop=0;
}
function validMask(mask) { return Number.isInteger(mask)&&mask>=0&&mask<=2047?mask:0; }
function requestedMove(p,mask,edge) {
  if(edge&INPUT.SUPER) return 'super';
  if(edge&INPUT.THROW) return 'throw';
  if(edge&INPUT.SPECIAL) return mask&INPUT.DOWN?'downSpecial':mask&(p.face===1?INPUT.RIGHT:INPUT.LEFT)?'forwardSpecial':'special';
  if(edge&INPUT.HEAVY) return !p.grounded?'airHeavy':mask&INPUT.DOWN?'crouchHeavy':'heavy';
  if(edge&INPUT.LIGHT) return !p.grounded?'airLight':mask&INPUT.DOWN?'crouchLight':'light';
  return null;
}
function startAction(s,p,id,slot) {
  const m=moveFor(p.character,id); if(!m||p.meter<m.cost||(!p.grounded&&(m.throw||id==='super'))) return false;
  p.meter-=m.cost;p.action={id,frame:0,hit:false};p.buffer=null;
  p.crouching=id.startsWith('crouch');
  if(m.cost) emit(s,'super',slot,m.name);
  return true;
}
function tickPlayer(s,p,slot,mask) {
  const edge=mask&~p.previousInput; p.previousInput=mask;
  p.invuln=Math.max(0,p.invuln-1);p.stun=Math.max(0,p.stun-1);p.blockstun=Math.max(0,p.blockstun-1);p.knockdown=Math.max(0,p.knockdown-1);
  p.comboTimer=Math.max(0,p.comboTimer-1); if(!p.comboTimer) p.combo=0;
  if(p.throwPending) {
    if(edge&INPUT.THROW) {
      const attacker=s.players[p.throwPending.attacker];p.throwPending=null;p.stun=8;attacker.stun=8;attacker.action=null;p.invuln=20;attacker.invuln=20;p.vx=-p.face*5;attacker.vx=-attacker.face*5;emit(s,'tech',slot,'THROW ESCAPED');
    } else if(--p.throwPending.timer<=0) {
      const grab=p.throwPending;p.throwPending=null;p.hp=Math.max(0,p.hp-grab.damage);p.knockdown=32;p.stun=32;p.vx=-p.face*9;p.combo=0;s.players[grab.attacker].meter=clamp(s.players[grab.attacker].meter+60,0,1000);emit(s,'throw',grab.attacker,'FORCED LIQUIDATION');
    }
    return;
  }
  const request=requestedMove(p,mask,edge);if(request) p.buffer={id:request,ttl:6};
  else if(p.buffer&&--p.buffer.ttl<=0) p.buffer=null;
  if(p.action) {
    p.action.frame++;
    const m=moveFor(p.character,p.action.id);
    if(p.action.frame>=m.startup+m.active+m.recovery) p.action=null;
    else if(p.action.hit&&p.buffer&&m.cancels.includes(p.buffer.id)&&p.action.frame<m.startup+m.active+5) startAction(s,p,p.buffer.id,slot);
  }
  const locked=p.stun||p.blockstun||p.knockdown;
  if(locked) p.action=null;
  // Defense can switch high/low during blockstun; movement still remains locked.
  if(p.grounded&&!p.action&&!p.stun&&!p.knockdown)p.crouching=!!(mask&INPUT.DOWN);
  if(!locked&&!p.action) {
    p.face=s.players[1-slot].x>=p.x?1:-1;p.crouching=!!(mask&INPUT.DOWN)&&p.grounded;
    if(p.buffer) startAction(s,p,p.buffer.id,slot);
    if(!p.action) {
      const dir=Number(!!(mask&INPUT.RIGHT))-Number(!!(mask&INPUT.LEFT));
      p.vx=p.crouching||mask&INPUT.GUARD?0:dir*CHARACTERS[p.character].speed;
      if((edge&INPUT.DASH)&&p.grounded&&!p.crouching&&!(mask&INPUT.GUARD)) {p.dash=12;p.dashDirection=dir||p.face;emit(s,'dash',slot);}
      if((edge&INPUT.JUMP)&&p.grounded&&!p.crouching) {p.vy=CHARACTERS[p.character].jump;p.grounded=false;p.dash=0;emit(s,'jump',slot);}
    }
  }
  if(p.dash>0) {if(locked||p.action)p.dash=0;else{p.vx=p.dashDirection*8;p.dash--;}}
  if(p.action) {const m=moveFor(p.character,p.action.id);p.vx=m.travel&&p.action.frame>=m.startup-8&&p.action.frame<m.startup+m.active?p.face*m.travel:p.vx*.5;}
  if(locked) p.vx*=.84;
  p.x=quant(p.x+p.vx);
  if(!p.grounded) {p.y=quant(p.y+p.vy);p.vy=quant(p.vy-.62);if(p.y<=0){p.y=0;p.vy=0;p.grounded=true;emit(s,'land',slot);}}
}
function attackContact(s,slot,inputs) {
  const a=s.players[slot],b=s.players[1-slot],action=a.action;
  if(!action||action.hit||a.stun||a.blockstun||a.throwPending||b.invuln||b.throwPending) return null;
  const m=moveFor(a.character,action.id),f=action.frame;
  if(f<m.startup||f>=m.startup+m.active) return null;
  const dist=(b.x-a.x)*a.face;
  if(dist < -22||dist>m.range+22) return null;
  const hurtbox=hurtboxFor(b),hurtTop=b.y+hurtbox.top,hurtBottom=b.y+hurtbox.bottom;
  if(a.y+m.hitbox.top<hurtBottom||a.y+m.hitbox.bottom>hurtTop) return null;
  const defense=b.action&&moveFor(b.character,b.action.id);
  if(defense?.invuln&&b.action.frame<defense.invuln) return null;
  if(m.throw) {if(!a.grounded||!b.grounded||b.stun||b.blockstun||b.knockdown) return null;return {slot,m,kind:'grab'};}
  const guarding=!!(inputs[1-slot]&INPUT.GUARD)&&!b.action&&!b.stun&&!b.knockdown&&b.grounded;
  const correctLevel=m.level==='low'?b.crouching:m.level==='high'?!b.crouching:true;
  if(guarding&&correctLevel) return {slot,m,kind:'block'};
  if(defense?.armor&&b.action.frame<defense.startup&&!b.action.armored) return {slot,m,kind:'armor'};
  return {slot,m,kind:'hit',reason:guarding&&!correctLevel?`${m.level.toUpperCase()} · WRONG GUARD`:b.action?'COUNTER / RECOVERY PUNISH':'CLEAN HIT'};
}
function applyContact(s,c) {
  const {slot,m,kind}=c,a=s.players[slot],b=s.players[1-slot];
  if(a.action) a.action.hit=true;
  if(kind==='grab') {b.throwPending={attacker:slot,damage:m.damage,timer:6};b.action=null;b.stun=8;a.stun=8;emit(s,'grab',slot,'THROW NOW TO ESCAPE');return;}
  if(kind==='block') {b.hp=Math.max(1,b.hp-Math.floor(m.damage*.05));b.blockstun=m.blockstun;b.vx=a.face*m.pushback/8;a.vx=-a.face*2;b.meter=clamp(b.meter+25,0,1000);emit(s,'block',1-slot,m.level==='low'?'LOW BLOCK':'BLOCK');return;}
  if(kind==='armor') {b.hp=Math.max(0,b.hp-Math.floor(m.damage*.5));b.action.armored=true;emit(s,'armor',1-slot,b.character==='chloe'?'VAULT ARMOR':'DIAMOND ARMOR');return;}
  b.combo++;b.comboTimer=70;
  const scaling=Math.max(.35,1-(b.combo-1)*.2),damage=Math.round(m.damage*scaling);
  b.hp=Math.max(0,b.hp-damage);b.stun=m.hitstun;b.action=null;b.buffer=null;b.blockstun=0;b.vx=a.face*m.pushback/5;b.meter=clamp(b.meter+Math.round(damage*.45),0,1000);a.meter=clamp(a.meter+m.meterGain,0,1000);
  if(m.launch){b.vy=m.launch;b.grounded=false;}
  if(m.knockdown||b.combo>=4) {b.knockdown=m.knockdown||28;b.stun=b.knockdown;b.invuln=b.knockdown+12;b.combo=0;emit(s,'knockdown',1-slot,'RESET · WAKE-UP PROTECTED');}
  s.hitstop=Math.max(s.hitstop,m.damage>=120?5:3);emit(s,'hit',slot,`${c.reason} · ${damage}${b.combo>1?` · ${b.combo} HIT`:''}`);
}
/** Return a fresh serializable state. Inputs are bit masks, never positions or damage. */
export function stepFight(previous,rawInputs=[0,0]) {
  const s=structuredClone(previous); s.tick++;s.phaseTick++;
  const inputs=[validMask(rawInputs[0]),validMask(rawInputs[1])];
  if(s.phase==='finished') return s;
  if(s.phase==='intro') {if(s.phaseTick>=90){s.phase='fight';s.phaseTick=0;emit(s,'fight',undefined,'TRADE BLOWS');}return s;}
  if(s.phase==='roundOver') {
    if(s.phaseTick>=120) {
      if(s.wins.some(n=>n>=2)||s.round>=5) {s.phase='finished';s.phaseTick=0;s.winner=s.wins[0]===s.wins[1]?null:s.wins[0]>s.wins[1]?0:1;emit(s,'finish',s.winner,s.winner===null?'MATCH DRAW':'PORTFOLIO RESTORED');}
      else newRound(s);
    }
    return s;
  }
  const cycle=s.phaseTick%1200;
  s.bounds={left:42,right:958,warning:s.stage==='laundromat'&&cycle>=480&&cycle<600,active:s.stage==='laundromat'&&cycle>=600&&cycle<960};
  if(s.bounds.active) {s.bounds.left=160;s.bounds.right=840;}
  if(s.bounds.warning&&cycle===480) emit(s,'warning',undefined,'STEAM LANES CLOSE IN 2 SECONDS');
  s.roundTicks--;
  if(s.hitstop>0) {
    // Sample edges through impact freeze so a correctly timed cancel isn't lost.
    for(let slot=0;slot<2;slot++){const p=s.players[slot],edge=inputs[slot]&~p.previousInput;const request=requestedMove(p,inputs[slot],edge);p.previousInput=inputs[slot];if(request)p.buffer={id:request,ttl:6};}
    s.hitstop--;if(s.roundTicks<=0)finishRound(s);return s;
  }
  s.players.forEach((p,i)=>tickPlayer(s,p,i,inputs[i]));
  for(const p of s.players) p.x=clamp(p.x,s.bounds.left,s.bounds.right);
  const [a,b]=s.players;
  if(Math.abs(a.x-b.x)<45&&Math.abs(a.y-b.y)<90) {
    const sign=a.x<=b.x?1:-1,push=(45-Math.abs(a.x-b.x))/2;
    a.x=clamp(quant(a.x-push*sign),s.bounds.left,s.bounds.right);b.x=clamp(quant(b.x+push*sign),s.bounds.left,s.bounds.right);
  }
  // Gather both before applying either: trades must not depend on player array order.
  const contacts=[attackContact(s,0,inputs),attackContact(s,1,inputs)].filter(Boolean);
  if(contacts.length===2&&contacts.every(c=>c.kind==='grab')) {for(const p of s.players){p.action=null;p.stun=10;p.invuln=20;p.vx=-p.face*5;}emit(s,'tech',undefined,'THROW CLASH');}
  else contacts.filter(c=>c.kind!=='grab'||contacts.length===1).forEach(c=>applyContact(s,c));
  if(s.players.some(p=>p.hp<=0)||s.roundTicks<=0) finishRound(s);
  return s;
}
export function stateHash(state) {
  let h=2166136261; const value=JSON.stringify(state);
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}
/** Explicit practice AI. Deterministic, not advertised as another human. */
export function botInput(s,slot=1) {
  if(s.phase!=='fight') return 0;
  const p=s.players[slot],enemy=s.players[1-slot],distance=Math.abs(p.x-enemy.x),toward=p.x<enemy.x?INPUT.RIGHT:INPUT.LEFT,beat=(s.tick+slot*17)%100;
  if(p.throwPending) return INPUT.THROW;
  if(enemy.action&&distance<170&&beat<72) return INPUT.GUARD|(moveFor(enemy.character,enemy.action.id).level==='low'?INPUT.DOWN:0);
  if(distance>135)return toward|(beat===12?INPUT.DASH:0);
  if(beat===80&&p.meter>=1000)return INPUT.SUPER;
  if(beat===18)return INPUT.JUMP;
  if(beat===30)return INPUT.HEAVY;
  if(beat===52)return INPUT.DOWN|INPUT.SPECIAL;
  if(beat===68)return distance<78?INPUT.THROW:INPUT.SPECIAL;
  if(beat===4)return INPUT.LIGHT;
  return distance>75?toward:0;
}
