/** Exposed tire surfaces in atlas pixels. Bodywork, shoes and axles stay in front.
 * The rear camera sees tread, so rotation travels around a projected cylinder.
 * No image files are changed; the moving surface replaces only painted rubber.
 */
const TAU=Math.PI*2;
const mirror=points=>points.map(([x,y])=>[1536-x,y]);
const mirage=[[366,282],[374,348],[407,426],[442,452],[496,460],[487,484],[371,485],[357,472],[350,430],[352,352]];
const glacier=[[366,292],[376,349],[390,375],[407,427],[448,444],[492,459],[485,484],[373,484],[361,470],[355,428],[356,350]];
const inferno=[[322,329],[335,399],[356,454],[375,455],[378,438],[419,448],[451,473],[466,474],[459,489],[344,489],[330,474],[320,424]];
export const SPRITE_TIRES=Object.freeze({
  mirage:[{outline:mirage,cx:425,cy:366,rx:76,ry:121},{outline:mirror(mirage),cx:1111,cy:366,rx:76,ry:121}],
  glacier:[{outline:glacier,cx:424,cy:368,rx:70,ry:118},{outline:mirror(glacier),cx:1112,cy:368,rx:70,ry:118}],
  inferno:[{outline:inferno,cx:394,cy:376,rx:75,ry:115},{outline:mirror(inferno),cx:1142,cy:376,rx:75,ry:115}],
  'bike-tyson':[{cx:769,cy:331,rx:18,ry:153}],
});

export function drawSpriteTires(c,id,{rotation=0}={}){
  rotation=Number.isFinite(rotation)?rotation:0;
  for(const tire of SPRITE_TIRES[id]||[]){
    const {cx,cy,rx,ry,outline}=tire;
    c.save();c.beginPath();
    if(outline){outline.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
    else c.ellipse(cx,cy,rx,ry,0,0,TAU);
    c.clip();
    const rubber=c.createLinearGradient(cx-rx,0,cx+rx,0);
    rubber.addColorStop(0,'#0a0d10');rubber.addColorStop(.3,'#293037');rubber.addColorStop(.65,'#1a2026');rubber.addColorStop(1,'#080b0e');
    c.fillStyle=rubber;c.fillRect(cx-rx-2,cy-ry-2,rx*2+4,ry*2+4);
    // Broad, asymmetric tread blocks avoid an imperceptible perfectly repeating tire.
    for(let i=0;i<13;i++){
      const phase=rotation+i*TAU/13,depth=Math.cos(phase);if(depth<=0)continue;
      const y=cy+Math.sin(phase)*ry,bend=ry*.07*depth;
      c.beginPath();c.moveTo(cx-rx,y-bend);c.lineTo(cx-rx*.1,y+bend);c.lineTo(cx+rx,y-bend*.5);
      c.lineWidth=Math.max(1.5,ry*.038*depth);c.strokeStyle=i%3===0?'#73828d':'#47555f';c.stroke();
      c.beginPath();c.moveTo(cx-rx,y-bend+3);c.lineTo(cx-rx*.1,y+bend+3);c.lineTo(cx+rx,y-bend*.5+3);
      c.lineWidth=Math.max(1,ry*.025*depth);c.strokeStyle='#080c10';c.stroke();
    }
    c.restore();
  }
}
