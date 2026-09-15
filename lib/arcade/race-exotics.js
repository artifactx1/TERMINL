/** Original articulated exotic bodies and cockpit drivers, shared by garage/race.
 * Bodies use a normalized rear view; wheels are drawn separately by the wheel rig.
 */
import {VEHICLES} from './race-sim.mjs';
const polygon=(c,points,color)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();};
const box=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
function driver(c,id,steer,tick){
  c.save();c.translate(-.10,-.52);c.rotate(-steer*.035);
  const chloe=id==='chloe',mia=id==='mia',skin=chloe?'#c58953':mia?'#bc7744':'#ba9470';
  // Visible torso, shoulders, head, hair, and forearms stay seated in the cockpit.
  polygon(c,[[-.085,.085],[-.10,.02],[-.066,-.05],[.062,-.05],[.10,.02],[.085,.085]],chloe?'#397bc6':mia?'#e7dfc4':'#383b33');
  if(chloe){box(c,-.087,-.015,.025,.075,'#6ca2e7');box(c,.061,-.015,.025,.075,'#6ca2e7');box(c,-.055,.025,.11,.012,'#25558e');}
  box(c,-.053,-.132,.106,.105,skin);box(c,-.055,-.135,.11,.035,'#493220');
  box(c,-.062,-.105,.019,.065,'#5a3a25');box(c,.043,-.105,.019,.065,'#5a3a25');
  if(mia){
    const sway=Math.sin(tick*.07)*.01+steer*.012;
    polygon(c,[[.045,-.14],[.12+sway,-.175],[.155+sway,-.10],[.12+sway,-.015],[.085+sway,-.04],[.104+sway,-.105],[.055,-.10]],'#674125');
    box(c,.044,-.135,.027,.018,'#df83b6');box(c,-.046,-.142,.092,.015,'#777fd1');
  }else if(chloe){
    polygon(c,[[-.05,-.135],[-.025,-.17],[.048,-.17],[.065,-.13],[.075,-.015],[.015,.015],[-.032,-.045]],'#6d492a');
    box(c,-.064,-.145,.12,.012,'#dfb76c');
  }else {box(c,-.042,-.15,.025,.03,'#604b32');box(c,-.01,-.155,.055,.034,'#51412c');}
  // Arms follow the wheel, while the head stays anchored instead of tilting the portrait.
  for(const side of [-1,1])polygon(c,[[side*.077,-.015],[side*.105,.02],[side*.048+steer*.014,.04],[side*.039+steer*.014,.018]],skin);
  c.strokeStyle='#0c1720';c.lineWidth=.012;c.beginPath();c.ellipse(steer*.012,.025,.055,.016,0,0,Math.PI*2);c.stroke();
  c.restore();
}
export function drawExoticBody(c,id,{x,y,width,height,steer=0,tick=0,braking=false}={}){
  const v=VEHICLES[id];if(!v?.body)return false;
  c.save();c.translate(x,y);c.scale(width,height);
  const paint=v.color,wedge=v.body==='wedge',hyper=v.body==='hyper';
  // Long angular V12 wedge, rounded wide hypercar, or narrow open track spyder.
  const outline=wedge?[[-.43,-.05],[-.47,-.35],[-.34,-.70],[-.22,-.84],[.22,-.84],[.34,-.70],[.47,-.35],[.43,-.05]]:
    hyper?[[-.43,-.04],[-.48,-.20],[-.44,-.51],[-.30,-.79],[-.17,-.86],[.17,-.86],[.30,-.79],[.44,-.51],[.48,-.20],[.43,-.04]]:
    [[-.41,-.04],[-.43,-.30],[-.25,-.70],[-.17,-.88],[.17,-.88],[.25,-.70],[.43,-.30],[.41,-.04]];
  polygon(c,outline,'#101c25');
  c.save();c.scale(.96,.98);polygon(c,outline,paint);c.restore();
  polygon(c,[[-.28,-.65],[-.20,-.79],[.20,-.79],[.28,-.65],[.25,-.38],[-.25,-.38]],'#0d202b');
  // Windscreen sits ahead of the driver; cockpit stays open and the character visible.
  polygon(c,[[-.22,-.71],[-.17,-.79],[.17,-.79],[.22,-.71]],'#8fc6d2');
  box(c,-.19,-.60,.17,.25,'#293d46');box(c,.055,-.60,.14,.25,'#293d46');
  driver(c,v.driverId,steer,tick);
  polygon(c,[[-.44,-.28],[-.26,-.42],[.26,-.42],[.44,-.28],[.40,-.10],[-.40,-.10]],paint);
  polygon(c,[[-.40,-.12],[-.32,-.04],[.32,-.04],[.40,-.12]],'#14232e');
  if(wedge){
    polygon(c,[[-.34,-.65],[-.26,-.69],[-.23,-.36],[-.39,-.24]],'#b64d91');
    polygon(c,[[.34,-.65],[.26,-.69],[.23,-.36],[.39,-.24]],'#ffc1e2');
    box(c,-.46,-.28,.92,.023,'#ffd4e8');box(c,-.31,-.18,.62,.025,'#8c335f');
    for(const side of [-1,1]){box(c,side<0?-.41:.20,-.22,.21,.022,braking?'#ff5049':'#fa8794');box(c,side<0?-.31:.27,-.09,.04,.04,'#060f16');}
  }else if(hyper){
    polygon(c,[[-.44,-.40],[-.31,-.56],[-.28,-.34],[-.40,-.21]],'#347aaa');
    polygon(c,[[.44,-.40],[.31,-.56],[.28,-.34],[.40,-.21]],'#b9edff');
    box(c,-.40,-.24,.80,.035,braking?'#ff5049':'#dd678b');
    box(c,-.27,-.12,.54,.022,'#142a40');
    for(let i=0;i<7;i++)box(c,-.21+i*.07,-.105,.018,.07,'#365976');
  }else{
    box(c,-.025,-.84,.05,.43,'#172327');box(c,-.02,-.33,.04,.21,'#172327');
    for(const side of [-1,1]){box(c,side<0?-.30:.27,-.38,.03,.24,'#172733');box(c,side<0?-.38:.25,-.22,.13,.04,braking?'#ff5049':'#e87669');}
    box(c,-.48,-.40,.96,.055,'#13222c');box(c,-.47,-.405,.94,.015,'#ffe0a4');
    box(c,-.10,-.10,.07,.04,'#070f17');box(c,.03,-.10,.07,.04,'#070f17');
  }
  // Mirrors and side scoops read independently from body color at race scale.
  for(const side of [-1,1]){box(c,side<0?-.37:.29,-.55,.08,.03,paint);box(c,side<0?-.43:.34,-.33,.09,.045,'#18303b');}
  c.restore();return true;
}
