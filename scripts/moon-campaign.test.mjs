import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_WORLDS,newCampaignLevel,stepCampaign,readCampaign,clearCampaignLevel,platformAt,hazardPhase,RIGHT,JUMP} from '../lib/moon-campaign.mjs';
import {campaignPilot} from './moon-campaign-pilot.mjs';
import {drawCampaign} from '../lib/moon-campaign-draw.js';

test('ten long, distinct routes introduce harder mechanics and safe checkpoints',()=>{
  assert.equal(CAMPAIGN_WORLDS.length,10);assert.equal(new Set(CAMPAIGN_WORLDS.map(w=>JSON.stringify(w.ground))).size,10);
  for(const w of CAMPAIGN_WORLDS){assert.ok(w.width>13000);assert.ok(w.timeLimit>=18000);for(const p of w.checkpoints)assert.ok(w.ground.some(([a,b,y])=>p.x>=a&&p.x+30<=b&&p.y+44===y));for(const key of ['platforms','pickups','enemies','hazards'])assert.equal(new Set(w[key].map(p=>p.id)).size,w[key].length);}
  assert.ok(CAMPAIGN_WORLDS[6].hazards.length>0);assert.ok(CAMPAIGN_WORLDS[7].platforms.some(p=>p.move));assert.ok(CAMPAIGN_WORLDS[9].arena);
});
test('ordinary controls clear the entire campaign and defeat all six boss health points',()=>{
  let save=readCampaign(null);const results=[];
  for(const w of CAMPAIGN_WORLDS){let s=newCampaignLevel(w.level),twin=newCampaignLevel(w.level),pilot={};
    while(!s.ended&&s.tick<16000){const input=campaignPilot(s,pilot);const before=JSON.stringify(s);const next=stepCampaign({...s,input});assert.equal(JSON.stringify(s),before);s=next;twin=stepCampaign({...twin,input});}
    assert.equal(s.won,true,w.name);assert.deepEqual(s,twin);if(w.arena)assert.equal(s.boss.hp,0);
    save=clearCampaignLevel(save,s);assert.equal(save.unlocked,Math.min(9,w.level+1));results.push({level:w.level+1,seconds:Math.round(s.tick/60),health:s.hp});
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
  const h=CAMPAIGN_WORLDS[6].hazards[0];assert.equal(hazardPhase({...h,offset:0},10),'warning');assert.equal(hazardPhase({...h,offset:0},60),'active');assert.equal(hazardPhase({...h,offset:0},110),'idle');
  const first=stepCampaign({...newCampaignLevel(),input:RIGHT|JUMP});assert.ok(first.vy<0);
});
test('campaign scenes and boss phases render finite geometry without mutating simulation',()=>{
  let depth=0;const ctx=new Proxy({},{get:(_,key)=>(...args)=>{if(key==='save')depth++;if(key==='restore')depth--;args.forEach(a=>{if(typeof a==='number')assert.ok(Number.isFinite(a),key);});return key.startsWith('create')?{addColorStop(){}}:undefined;},set:()=>true});
  for(const world of CAMPAIGN_WORLDS)for(const width of [280,960,1700]){const s=newCampaignLevel(world.level);s.x=world.arena?.start||world.width/2;if(s.boss){s.boss.active=true;s.boss.phase='exposed';}const before=JSON.stringify(s);drawCampaign(ctx,s,width);assert.equal(JSON.stringify(s),before);assert.equal(depth,0);}
});
