/** Original rear-chase wheel rig. Rotation is distance-driven by the caller, never a clock. */
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;

/** All y values are tire contact points relative to the body's bottom-center anchor. */
export const WHEEL_RIG=Object.freeze({
  front:Object.freeze({x:.345,y:-.30,diameter:.225,thickness:.054}),
  rear:Object.freeze({x:.365,y:0,diameter:.27,thickness:.135}),
  maxSteerRadians:.58,
});

function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,Math.max(.001,rx),Math.max(.001,ry),0,0,TAU);c.fillStyle=color;c.fill();}
function line(c,x1,y1,x2,y2,color,width){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function polygon(c,points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}

function wheel(c,{x,y,diameter,thickness,yaw,rotation,side}){
  const ry=diameter*.5,turn=Math.sin(yaw),axle=Math.cos(yaw),rx=Math.max(diameter*.055,Math.abs(turn)*diameter*.43);
  const shift=thickness*.5*Math.max(.4,Math.abs(axle)),out=turn<-.025?-1:turn>.025?1:side;
  // A yawed tire is a cylinder: two rounded shoulders joined by a visible tread barrel.
  // Its outward sidewall widens continuously with steering, revealing the rotating rim.
  c.save();c.translate(x,y-ry);c.lineJoin='round';c.lineCap='round';
  ellipse(c,2,ry*.95,thickness*.86+rx,diameter*.065,'#07121b66');
  const tread=c.createLinearGradient(-shift-rx,0,shift+rx,0);tread.addColorStop(0,'#040b13');tread.addColorStop(.24,'#26343e');tread.addColorStop(.56,'#15242d');tread.addColorStop(1,'#030a12');
  ellipse(c,-shift,0,rx,ry,'#040911');ellipse(c,shift,0,rx,ry,'#060d15');
  polygon(c,[[-shift,-ry],[shift,-ry],[shift,ry],[-shift,ry]],tread);
  // The contact tread is projected around the tire circumference. It reverses naturally
  // when rotation is negative, and is bit-for-bit stationary when rotation does not change.
  c.save();c.beginPath();c.rect(-shift-rx,-ry-.5,(shift+rx)*2,ry*2+1);c.clip();
  for(let i=0;i<16;i++){
    const a=rotation+i*TAU/16,front=Math.cos(a);if(front<=0)continue;
    const yy=Math.sin(a)*ry*.94,xx=turn*front*diameter*.19,band=Math.max(.7,diameter*.021*front);
    line(c,xx-shift,yy-band,xx,yy+band,'#40515a',band);
    line(c,xx,yy+band,xx+shift,yy-band,'#354650',band);
    if(front>.35)line(c,xx-shift*.75,yy+band*2,xx+shift*.75,yy+band*2,'#070f17',band*.7);
  }
  c.restore();
  const face=out*shift,faceRx=rx*.94;
  ellipse(c,face,0,faceRx,ry*.97,'#060c14');ellipse(c,face,0,faceRx*.92,ry*.88,'#1b2932');ellipse(c,face,0,faceRx*.75,ry*.74,'#06121b');
  // Polished rim lip, inner barrel and six actual rotating spokes; this is not a static
  // wheel pasted onto a steering body. The two-tone spokes make slow rolling readable.
  ellipse(c,face,0,faceRx*.78,ry*.76,'#7d9da8');ellipse(c,face,0,faceRx*.65,ry*.66,'#172b38');
  for(let i=0;i<6;i++){
    const a=rotation+i*TAU/6,cos=Math.cos(a),sin=Math.sin(a),outerX=face+cos*faceRx*.64,outerY=sin*ry*.65;
    line(c,face+cos*faceRx*.10,sin*ry*.12,outerX,outerY,i%2?'#bad2d8':'#6f909e',Math.max(.65,diameter*.036));
    line(c,face+cos*faceRx*.20,sin*ry*.20,outerX,outerY-.4,'#e2ece9',Math.max(.4,diameter*.012));
  }
  ellipse(c,face,0,faceRx*.25,ry*.24,'#091822');ellipse(c,face,0,faceRx*.15,ry*.13,'#c5d6d6');
  // One valve-stem marker gives an unambiguous orientation even with symmetric spokes.
  const marker=rotation+.45;ellipse(c,face+Math.cos(marker)*faceRx*.67,Math.sin(marker)*ry*.66,Math.max(.4,diameter*.012),Math.max(.65,diameter*.022),'#dfb466');
  // The shoulder highlights follow the real cylinder silhouette, not the spinning tread.
  line(c,-shift,-ry*.94,shift,-ry*.94,'#53606a',Math.max(.7,diameter*.016));
  c.restore();
}

/**
 * Paint before the wheel-less body; front/rear switches also allow split depth layers.
 * steer: continuous normalized steering [-1,1]. rotation: accumulated wheel radians.
 * view: signed chassis/camera yaw in radians (zero is directly behind).
 * Input objects and context transforms are never retained or mutated.
 */
export function drawRaceWheels(ctx,{x=0,y=0,width=260,height=width*.62,steer=0,rotation=0,view=0,front=true,rear=true}={}){
  if(!ctx||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
  x=finite(x);y=finite(y);steer=clamp(finite(steer),-1,1);rotation=finite(rotation)%TAU;view=clamp(finite(view),-1.1,1.1);
  const bodySkew=Math.sin(view)*width*.11;
  ctx.save();
  try{
    for(const axle of ['front','rear']){
      if(axle==='front'?!front:!rear)continue;
      const rig=WHEEL_RIG[axle];
      for(const side of [-1,1]){
        const perspective=clamp(1-side*Math.sin(view)*.09,.88,1.12);
        wheel(ctx,{x:x+side*width*rig.x+bodySkew*(axle==='front'?1:-.3),y:y+height*rig.y+side*Math.sin(view)*height*.05,
          diameter:height*rig.diameter*perspective,thickness:width*rig.thickness*perspective,
          yaw:axle==='front'?view+steer*WHEEL_RIG.maxSteerRadians:0,rotation,side});
      }
    }
  }finally{ctx.restore();}
}
