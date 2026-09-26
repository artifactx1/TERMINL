import {clamp,inside,nearestRail,floorAt,moveSolid,angleDelta} from './math.mjs';
import {trick,bank,bail} from './mall-score.mjs';
import {clearAir,stepAir,landAir} from './mall-tricks.mjs';
export const MALL_TUNING={duration:180*60,speed:25,acceleration:30,turn:2.4,jump:11.5,gravity:23,railSnap:1.5};
function launch(s,vy){const p=s.player;p.airOrigin={x:p.x,z:p.z,y:p.y};p.airDistance=0;p.airPeak=p.y;p.vy=vy;p.grounded=false;p.rail=null;p.manual=false;p.railCooldown=18;p.coyote=0;p.jumpedAt=s.tick;clearAir(p);s.events.push({type:'jump'});}
function releaseRail(s){const p=s.player;p.rail=null;p.railCooldown=24;p.vy=2;p.jumpedAt=s.tick;}
export function skate(s,input,edge){
 const p=s.player,t=MALL_TUNING,dt=1/60,steering=clamp(input.steer??(Number(!!input.right)-Number(!!input.left)),-1,1);
 const grind=!!(input.grind||input.link),manual=!!(input.manual||input.link);
 if(!manual&&!grind)p.linkBlocked=false;
 p.railCooldown=Math.max(0,(p.railCooldown||0)-1);p.jumpBuffer=Math.max(0,(p.jumpBuffer||0)-1);
 p.coyote=p.grounded||p.rail?5:Math.max(0,(p.coyote||0)-1);
 p.steer+=(steering-p.steer)*.22;
 if(!p.rail)p.yaw+=p.steer*t.turn*dt*(p.grounded?clamp(p.speed/6,0,1):s.character==='pigeon'?.28:.16);
 if(p.grounded)p.visualSpin=angleDelta(p.visualSpin||0,0)*.76;
 if(edge('turn')&&p.grounded&&p.speed>2){p.yaw+=Math.PI;p.visualSpin=-Math.PI;if(s.combo.count)trick(s,'REVERT',70);}
 p.pushing=!!input.forward&&!input.back&&p.grounded&&!p.rail&&!p.manual;
 if(p.pushing)p.pushPhase=(p.pushPhase||0)+1;
 const cap=(s.character==='pigeon'?.96:1)*t.speed*(s.boost?1.2:1);
 p.speed=clamp(p.speed+(p.grounded||p.rail?(input.back?-38:input.forward?t.acceleration:-1.8):0)*dt,0,cap);
 if(s.boost>0)s.boost--;
 if(edge('special')&&s.meter>=100){s.events.push({type:'special'});s.meter=0;trick(s,{barry:'DIAMOND LINE',paul:'COLD WALLET',max:'100X LEVERAGE',pigeon:'SANDWICH ATTACK'}[s.character],1000);if(s.character==='paul')bank(s);else{s.boost=240;launch(s,15);}}
 const airborneAction=edge('action')&&!p.grounded&&!p.rail;
 if(edge('jump')||(edge('action')&&!airborneAction))p.jumpBuffer=8;
 if(p.jumpBuffer&&(p.grounded||p.rail||p.coyote)){const rail=p.rail;launch(s,t.jump+(rail?2:0)+Math.max(0,p.rampSlope||0)*p.speed*.55);p.jumpBuffer=0;trick(s,'OLLIE',60);}
 if(!p.grounded&&!p.rail)stepAir(s,input,k=>k==='airAction'?airborneAction:edge(k),steering);
 if(p.rail){
  const r=s.world.rails.find(r=>r.id===p.rail),q=r&&nearestRail(p,r);
  if(!grind||!r||q.t<=.001||q.t>=.999)releaseRail(s);
  else{p.x=q.x;p.z=q.z;p.y=r.y;p.vy=0;p.speed=Math.max(8,p.speed);const a=Math.atan2(r.bx-r.x,-(r.bz-r.z));p.yaw=Math.cos(p.yaw-a)>=0?a:a+Math.PI;p.grounded=false;s.combo.base+=p.speed*dt*9;s.combo.grace=85;}
 }
 const oldX=p.x,oldZ=p.z,oldFloor=floorAt(s.world,p.x,p.z),dx=Math.sin(p.yaw)*p.speed*dt,dz=-Math.cos(p.yaw)*p.speed*dt;
 moveSolid(p,dx,dz,s.world.solids,.4);
 const actualX=p.x-oldX,actualZ=p.z-oldZ,travel=Math.hypot(actualX,actualZ);
 if(Math.abs(actualX-dx)+Math.abs(actualZ-dz)>.06){
  // Glancing contact slides along shop fronts instead of deleting the whole line.
  const xBlocked=Math.abs(actualX-dx)>.03,zBlocked=Math.abs(actualZ-dz)>.03;
  p.yaw=xBlocked&&!zBlocked?(dz<0?0:Math.PI):!xBlocked&&zBlocked?(dx<0?-Math.PI/2:Math.PI/2):p.yaw+Math.PI;
  p.speed*=.82;if(input.wallride&&!p.grounded&&!(p.wallrideAt>s.tick-60)){p.wallrideAt=s.tick;p.vy=Math.max(3,p.vy);trick(s,'WALLRIDE',200);}
 }
 p.wheelAngle=((p.wheelAngle||0)+travel/.11)%(Math.PI*2);
 if(!p.rail){
  const floor=floorAt(s.world,p.x,p.z),slope=travel>.001?clamp((floor-oldFloor)/travel,-1.4,1.4):0;
  const onSlope=s.world.floors.some(f=>(f.rise||f.bowl)&&inside({x:oldX,z:oldZ},f)&&inside(p,f));
  if(p.grounded&&((!onSlope&&floor<oldFloor-.12&&(p.rampSlope||0)>=-.02)||((p.rampSlope||0)>.3&&slope<.08&&p.speed>12))){p.y=Math.max(p.y,floor);launch(s,Math.min(24,Math.max(0,p.rampSlope||0)*p.speed*1.05));p.airOrigin={x:oldX,z:oldZ,y:oldFloor};if(p.vy>2)trick(s,'RAMP TRANSFER',150);}
  if(p.grounded){p.rampSlope=slope;p.y=floor;p.vy=0;p.speed=clamp(p.speed-slope*.12,0,cap);}
  else{
   const held=(input.jump||input.action)&&s.tick-p.jumpedAt<17&&p.vy>0;
   p.vy-=t.gravity*dt*(held?.52:1);p.y+=p.vy*dt;p.airDistance=(p.airDistance||0)+travel;p.airPeak=Math.max(p.airPeak||p.y,p.y);
   // Catch before ground collision, with both height and travel alignment checks.
   if(grind&&!p.linkBlocked&&!p.railCooldown&&p.vy<=0)for(const r of s.world.rails){const q=nearestRail(p,r),a=Math.atan2(r.bx-r.x,-(r.bz-r.z));if(q.distance<t.railSnap+(s.character==='barry'?.45:0)&&p.y>=r.y-.15&&p.y<r.y+.7&&q.t>.01&&q.t<.99&&p.speed>3&&Math.abs(Math.cos(p.yaw-a))>.5){landAir(s);p.rail=r.id;p.y=r.y;p.balance=0;p.balanceAge=0;trick(s,'50-50',250);break;}}
   if(!p.rail&&p.y<=floor){
    const impact=Math.abs(p.vy),landingSlope=Math.max(0,-slope*p.speed);
    if(impact-landingSlope>32)bail(s,'HEAVY LANDING');else{landAir(s);awardGaps(s);p.landedAt=s.tick;s.events.push({type:'land',strength:Math.min(1,impact/18)});}
    p.y=floor;p.vy=0;p.grounded=true;p.rampSlope=slope;
   }
  }
 }
 const wasManual=p.manual;p.manual=manual&&!p.linkBlocked&&p.grounded&&!p.rail&&p.speed>2;
 if(p.manual&&!wasManual){p.balance=0;p.balanceAge=0;trick(s,'MANUAL',100);}
 if(p.rail||p.manual){
  p.balanceAge=(p.balanceAge||0)+1;
  // Countersteering has a stable direction; drift increases during long holds.
  const drift=(p.balance||0)>=0?1:-1;
  p.balance=clamp((p.balance||0)+drift*(.0015+p.balanceAge*.000008)-steering*(input.touchAssist?.009:.018),-1.1,1.1);
  if(input.touchAssist)p.balance*=.993;
  if(Math.abs(p.balance)>1)bail(s,'LOST BALANCE');
  else if(p.manual){s.combo.base+=travel*5;s.combo.grace=85;}
 }else{p.balance=0;p.balanceAge=0;}
 const bound=(s.world.bounds||86)-2;
 if(Math.abs(p.x)>bound||Math.abs(p.z)>bound){
  const xEdge=Math.abs(p.x)>bound;p.x=clamp(p.x,-bound,bound);p.z=clamp(p.z,-bound,bound);
  p.yaw=xEdge?-p.yaw:Math.PI-p.yaw;p.speed*=.82;p.visualSpin=0;
 }
}
function awardGaps(s){
 const p=s.player,a=p.airOrigin;if(!a)return;
 s.stats.longestAir=Math.max(s.stats.longestAir||0,(s.tick-p.jumpedAt)/60);s.stats.longestJump=Math.max(s.stats.longestJump||0,p.airDistance||0);
 for(const g of s.world.gaps||[]){
  const from=a[g.axis]-g.line,to=p[g.axis]-g.line;
  if(from*to<0&&Math.abs(from)>=g.width/2&&Math.abs(to)>=g.width/2&&a[g.cross]>g.min&&a[g.cross]<g.max&&p[g.cross]>g.min&&p[g.cross]<g.max){
   trick(s,g.name,g.points);s.gaps??=[];if(!s.gaps.includes(g.id))s.gaps.push(g.id);s.callout={text:g.name,detail:`GAP +${g.points.toLocaleString('en-US')}`,until:s.tick+110};if(g.id==='fountain')s.completed.gap=true;
  }
 }
 p.airOrigin=null;
}
