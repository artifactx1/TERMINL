import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_WORLDS,newCampaignLevel,stepCampaign,readCampaign,clearCampaignLevel,platformAt,hazardPhase,hazardAt,RIGHT,JUMP} from '../lib/moon-campaign.mjs';
import {campaignPilot} from './moon-campaign-pilot.mjs';
import {drawCampaign} from '../lib/moon-campaign-draw.js';

test('ten long, distinct routes introduce harder mechanics and safe checkpoints',()=>{
  assert.equal(CAMPAIGN_WORLDS.length,10);assert.equal(new Set(CAMPAIGN_WORLDS.map(w=>JSON.stringify(w.ground))).size,10);
  for(const w of CAMPAIGN_WORLDS){assert.ok(w.width>13000);assert.ok(w.timeLimit>=18000);for(const p of w.checkpoints)assert.ok(w.ground.some(([a,b,y])=>p.x>=a&&p.x+30<=b&&p.y+44===y));for(const key of ['platforms','pickups','enemies','hazards'])assert.equal(new Set(w[key].map(p=>p.id)).size,w[key].length);}
  assert.ok(CAMPAIGN_WORLDS[6].hazards.length>0);assert.ok(CAMPAIGN_WORLDS[7].platforms.some(p=>p.move));assert.ok(CAMPAIGN_WORLDS[9].arena);
});
test('ordinary controls and at most three checkpoint retries clear every level and the boss',()=>{
  let save=readCampaign(null);const results=[];
  for(const w of CAMPAIGN_WORLDS){let s=newCampaignLevel(w.level),twin=newCampaignLevel(w.level),pilot={},retries=0,totalTicks=0;
    while(totalTicks<25000){const input=campaignPilot(s,pilot);const before=JSON.stringify(s);const next=stepCampaign({...s,input});assert.equal(JSON.stringify(s),before);s=next;twin=stepCampaign({...twin,input});totalTicks++;
      if(s.ended){assert.deepEqual(s,twin);if(s.won||retries===3)break;retries++;s=newCampaignLevel(w.level,s.checkpointIndex);twin=newCampaignLevel(w.level,twin.checkpointIndex);pilot={};}
    }
    assert.equal(s.won,true,w.name);assert.deepEqual(s,twin);if(w.arena)assert.equal(s.boss.hp,0);
    save=clearCampaignLevel(save,s);assert.equal(save.unlocked,Math.min(9,w.level+1));results.push({level:w.level+1,seconds:Math.round(totalTicks/60),health:s.hp,retries});
  }
  assert.equal(readCampaign(JSON.stringify(save)).completed.length,10);console.log('Campaign traversal:',JSON.stringify(results));
});
test('final rocket stays locked until the boss is defeated; armor rejects early stomps',()=>{
  const world=CAMPAIGN_WORLDS[9];let s=newCampaignLevel(9);s.x=world.finish;
  assert.equal(stepCampaign(s).won,false);
  s=newCampaignLevel(9);s.boss={...s.boss,active:true,tick:20};s.x=s.boss.x+30;s.y=s.boss.y-44;s.vy=150;s.grounded=false;
  assert.equal(stepCampaign(s).boss.hp,6);
  s.boss.tick=200;const hit=stepCampaign(s);assert.equal(hit.boss.hp,5);assert.ok(hit.vy<0);assert.equal(hit.won,false);
});
test('checkpoints survive reload, retries reset health, and corrupted saves cannot skip unlocks',()=>{
  let save=readCampaign(JSON.stringify({completed:[-1,0,0,'2',99],current:9,checkpoint:999,best:[Infinity]}));
  assert.deepEqual(save.completed,[0]);assert.equal(save.unlocked,1);assert.equal(save.current,1);assert.equal(save.checkpoint,-1);
  save=readCampaign(JSON.stringify({...save,current:1,checkpoint:3}));const s=newCampaignLevel(save.current,save.checkpoint);
  assert.equal(s.x,CAMPAIGN_WORLDS[1].checkpoints[3].x);assert.equal(s.hp,3);
  const failed=stepCampaign({...s,y:650,hp:1});assert.equal(failed.dead,true);assert.equal(clearCampaignLevel(save,failed),save);
});
test('ice changes braking, moving platforms move, and vents have warning before damage',()=>{
  const ice=stepCampaign({...newCampaignLevel(5),vx:245}),normal=stepCampaign({...newCampaignLevel(0),vx:245});assert.ok(ice.vx>normal.vx);
  const p=CAMPAIGN_WORLDS[7].platforms.find(p=>p.move);assert.notEqual(platformAt(p,0).y,platformAt(p,45).y);
  const h={...CAMPAIGN_WORLDS[6].hazards.find(h=>h.type==='vent'),offset:0};assert.equal(hazardPhase(h,10),'warning');assert.equal(hazardPhase(h,h.warning),'active');assert.equal(hazardPhase(h,h.warning+h.active),'idle');
  const first=stepCampaign({...newCampaignLevel(),input:RIGHT|JUMP});assert.ok(first.vy<0);
});
test('every level increases trap density, narrows high routes, and punishes blind running',()=>{
  let density=0,ledgeWidth=Infinity;
  for(const w of CAMPAIGN_WORLDS){
    const next=w.hazards.length/w.width;assert.ok(next>density,`level ${w.level+1} trap density`);density=next;
    const ledge=w.platforms.find(p=>p.id.startsWith('ledge'));assert.ok(ledge.w<ledgeWidth);ledgeWidth=ledge.w;
    let s=newCampaignLevel(w.level);for(let i=0;i<300&&!s.ended;i++)s=stepCampaign({...s,input:RIGHT});assert.ok(s.hp<3,`${w.name} requires active evasion`);
  }
  assert.deepEqual([...new Set(CAMPAIGN_WORLDS[0].hazards.map(h=>h.type))],['spikes']);
  assert.equal(new Set(CAMPAIGN_WORLDS[9].hazards.map(h=>h.type)).size,4);
  assert.ok(CAMPAIGN_WORLDS[9].hazards.length>=90);
});
test('all trap types deal damage only when active, including spikes hit from above',()=>{
  const world=CAMPAIGN_WORLDS[6];
  for(const type of ['spikes','vent','saw','cannon']){
    const h=world.hazards.find(h=>h.type===type),tick=h.period-h.offset+h.warning+10,p=hazardAt(h,tick+1);
    const s={...newCampaignLevel(6),tick,x:p.x,y:p.y-44,vy:120,defeated:world.enemies.map(e=>e.id)};
    assert.equal(stepCampaign(s).hp,2,`${type} collision`);
    assert.equal(stepCampaign({...s,invulnerable:40}).hp,3,`${type} invulnerability`);
    assert.equal(stepCampaign({...s,shield:true}).hp,3,`${type} shield`);
    if(type==='vent'||type==='cannon'){
      const warning=h.period-h.offset+5;assert.equal(hazardPhase(h,warning),'warning');
      assert.equal(stepCampaign({...s,tick:warning}).hp,3,`${type} warning is safe`);
    }
  }
  const saw=world.hazards.find(h=>h.type==='saw');assert.notEqual(hazardAt(saw,0).y,hazardAt(saw,40).y);
  const cannon=world.hazards.find(h=>h.type==='cannon');const fire=cannon.period-cannon.offset+cannon.warning;
  assert.ok(hazardAt(cannon,fire+30).x<hazardAt(cannon,fire).x);
});
test('checkpoint respawns stay clear of traps and enemies at every campaign checkpoint',()=>{
  for(const world of CAMPAIGN_WORLDS)for(let checkpoint=-1;checkpoint<world.checkpoints.length;checkpoint++){
    let s=newCampaignLevel(world.level,checkpoint);for(let tick=0;tick<30;tick++)s=stepCampaign(s);
    assert.equal(s.hp,3,`${world.name}, checkpoint ${checkpoint}`);assert.equal(s.dead,false);
  }
});
test('the Warden tightens its opening and adds successive shockwaves as health drops',()=>{
  const initial=newCampaignLevel(9),arena=CAMPAIGN_WORLDS[9].arena;
  const prepare=(hp,tick)=>({...initial,x:arena.start+10,boss:{...initial.boss,active:true,hp,tick}});
  assert.equal(stepCampaign(prepare(6,139)).shots.length,2);
  assert.equal(stepCampaign(prepare(6,164)).shots.length,0);
  assert.equal(stepCampaign(prepare(4,164)).shots.length,2);
  assert.equal(stepCampaign(prepare(2,189)).shots.length,2);
  assert.equal(stepCampaign(prepare(2,229)).boss.phase,'guard');
});
test('campaign scenes and boss phases render finite geometry without mutating simulation',()=>{
  let depth=0;const ctx=new Proxy({},{get:(_,key)=>(...args)=>{if(key==='save')depth++;if(key==='restore')depth--;args.forEach(a=>{if(typeof a==='number')assert.ok(Number.isFinite(a),key);});return key.startsWith('create')?{addColorStop(){}}:undefined;},set:()=>true});
  for(const world of CAMPAIGN_WORLDS)for(const width of [280,960,1700]){const s=newCampaignLevel(world.level);s.x=world.arena?.start||world.width/2;if(s.boss){s.boss.active=true;s.boss.phase='exposed';}const before=JSON.stringify(s);drawCampaign(ctx,s,width);assert.equal(JSON.stringify(s),before);assert.equal(depth,0);}
});
