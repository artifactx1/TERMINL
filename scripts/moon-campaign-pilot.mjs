import {campaignWorld,campaignEnemy,hazardPhase,RIGHT,LEFT,JUMP} from '../lib/moon-campaign.mjs';
/** Ordinary control inputs for traversal verification. Does not mutate game state. */
export function campaignPilot(s,pilot){
  const world=campaignWorld(s.level);let direction=RIGHT,wantJump=false;
  if(s.boss?.active&&s.boss.hp){
    const target=s.boss.x+33,delta=target-s.x;
    direction=Math.abs(delta)<8?0:delta<0?LEFT:RIGHT;
    wantJump=s.grounded;
  }else{
    const ahead=s.x+100;
    const next=world.ground.find(([a,b])=>ahead>=a&&ahead<b);
    const gap=!next,step=next&&next[2]<s.y+44-8;
    const enemy=world.enemies.some(raw=>{const e=campaignEnemy(raw,s.tick);return !s.defeated.includes(e.id)&&e.x>s.x-10&&e.x-s.x<115&&Math.abs(e.y-s.y)<100;});
    const hazard=world.hazards.some(h=>h.x>s.x-15&&h.x-s.x<120&&hazardPhase(h,s.tick)!=='idle');
    wantJump=s.grounded&&(gap||step||enemy||hazard);
    if(!s.grounded&&s.jumps===0&&s.vy>0)wantJump=true;
  }
  if(!s.grounded&&s.jumps===1&&s.vy> -80)wantJump=true;
  if(wantJump&&s.tick>(pilot.until||0)+2)pilot.until=s.tick+21;
  return direction|(s.tick<(pilot.until||0)?JUMP:0);
}
