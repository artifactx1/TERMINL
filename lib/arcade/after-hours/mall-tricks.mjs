import {clamp,floorAt} from './math.mjs';
import {trick} from './mall-score.mjs';
export const AIR_TRICKS={
 kickflip:{name:'KICKFLIP',points:180,ticks:26,roll:1},
 heelflip:{name:'HEELFLIP',points:220,ticks:26,roll:-1},
 shuvit:{name:'POP SHUVIT',points:200,ticks:26,yaw:1},
 varial:{name:'VARIAL KICKFLIP',points:450,ticks:32,roll:1,yaw:1},
 tre:{name:'TRE FLIP',points:700,ticks:36,roll:1,yaw:2},
 hardflip:{name:'HARDFLIP',points:550,ticks:34,roll:-1,yaw:1,pitch:1},
 indy:{name:'INDY',points:220,ticks:20,grab:true},
 melon:{name:'MELON',points:280,ticks:22,grab:true,roll:-.35},
 method:{name:'METHOD',points:360,ticks:24,grab:true,roll:.5},
 nosegrab:{name:'NOSEGRAB',points:300,ticks:22,grab:true,pitch:.45},
 frontflip:{name:'FRONTFLIP',points:900,ticks:42,somersault:1},
 backflip:{name:'BACKFLIP',points:900,ticks:42,somersault:-1},
};
export function remainingAir(s){const p=s.player,h=Math.max(0,p.y-floorAt(s.world,p.x,p.z));return (p.vy+Math.sqrt(p.vy*p.vy+46*h))/23*60;}
export function clearAir(p){p.airMove=null;p.spinMove=null;p.trickType=null;p.trickStarted=null;p.trickCooldown=0;p.spin=0;p.visualSpin=0;}
export function startAir(s,id){
 const p=s.player,m=AIR_TRICKS[id];if(!m||p.airMove||p.grounded||p.rail||(m.somersault&&p.spinMove))return false;
 if(remainingAir(s)<m.ticks*.8+3){s.trickHint={text:'MORE AIR',until:s.tick+35};return false;}
 p.airMove={id,started:s.tick,duration:m.ticks,scored:false};
 p.trickType=m.grab?'grab':m.somersault?'somersault':'flip';p.trickStarted=s.tick;p.trickDuration=m.ticks;p.trickCooldown=m.ticks;
 return true;
}
export function stepAir(s,input,edge,steering){
 const p=s.player;
 if(p.airMove){const a=p.airMove,m=AIR_TRICKS[a.id];if(!a.scored&&s.tick-a.started>=a.duration*.8){trick(s,m.name,m.points);a.scored=true;}if(s.tick-a.started>=a.duration){p.airMove=null;p.trickType=null;}}
 if(p.spinMove){const a=p.spinMove,progress=clamp((s.tick-a.started)/a.duration,0,1);p.spin=a.from+a.amount*(progress*progress*(3-2*progress));if(progress===1)p.spinMove=null;}
 else if(!AIR_TRICKS[p.airMove?.id]?.somersault&&(input.flip||input.grab)&&Math.abs(steering)>.2)p.spin+=steering*.115;
 if(edge('spin')&&!p.spinMove&&!AIR_TRICKS[p.airMove?.id]?.somersault){const available=remainingAir(s);if(available>24)p.spinMove={started:s.tick,duration:Math.min(44,Math.floor(available-5)),from:p.spin,amount:Math.PI*2*(steering<-.2?-1:1)};else s.trickHint={text:'MORE AIR',until:s.tick+35};}
 p.visualSpin=p.spin;
 let id;
 if(edge('hardflip'))id='hardflip';else if(edge('tre'))id='tre';else if(edge('heelflip'))id='heelflip';else if(edge('frontflip'))id='frontflip';else if(edge('backflip'))id='backflip';else if(edge('varial'))id=input.back?'tre':'varial';else if(edge('shuvit'))id='shuvit';
 else if(edge('flip')||edge('airAction'))id=input.back?'heelflip':steering<-.45?'varial':steering>.45?'tre':'kickflip';
 else if(edge('grab'))id=input.back?'nosegrab':steering<-.45?'melon':steering>.45?'method':'indy';
 if(id)startAir(s,id);
}
export function landAir(s){
 const p=s.player;
 const turns=Math.floor((Math.abs(p.spin)+.22)/Math.PI);
 if(turns)trick(s,`${turns*180} SPIN`,turns*220);
 const unfinished=p.airMove&&!p.airMove.scored;
 if(unfinished){s.trickHint={text:'EARLY CATCH',until:s.tick+45};s.combo.base=Math.max(0,s.combo.base-80);}
 clearAir(p);
}
