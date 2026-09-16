import {stepCampaign,RIGHT,LEFT,JUMP} from '../lib/moon-campaign.mjs';
/** Test-only controller: choose safe jump timing using ordinary-input rollouts.
 * Never changes positions, health, hazards, saves, or browser game state.
 */
export function campaignPilot(s,pilot){
  if(s.boss?.active&&s.boss.hp){
    const delta=s.boss.x+33-s.x,direction=Math.abs(delta)<8?0:delta<0?LEFT:RIGHT;
    const jump=s.grounded||s.jumps===1&&s.vy> -80;
    if(jump&&s.tick>(pilot.until||0)+2)pilot.until=s.tick+21;
    return direction|(s.tick<(pilot.until||0)?JUMP:0);
  }
  if(pilot.plan?.length)return pilot.plan.shift();
  let best=-Infinity,plan;
  const candidates=[{jump:999,second:999,wait:0}];
  for(const jump of [0,12,24,40,60])for(const second of [28,40])candidates.push({jump,second,wait:0});
  for(const wait of [20,40])candidates.push({jump:wait,second:35,wait});
  for(const candidate of candidates){
    let next=s;const inputs=[];
    const start=candidate.jump+(s.previousInput&JUMP?1:0);
    for(let frame=0;frame<100&&!next.ended;frame++){
      const press=frame>=start&&frame<start+22||frame>=start+candidate.second&&frame<start+candidate.second+22;
      const input=(frame<candidate.wait?0:RIGHT)|(press?JUMP:0);inputs.push(input);next=stepCampaign({...next,input});
    }
    const value=(next.won?1e8:0)-(next.dead?1e7:0)-(s.hp-next.hp)*1e6-(Number(s.shield)-Number(next.shield))*3000+(next.x-s.x)+(next.grounded?30:0)-Math.max(0,next.y-470)*10;
    if(value>best){best=value;plan=inputs;}
  }
  pilot.plan=plan;return pilot.plan.shift();
}
