/** Isolate connected alpha silhouettes; generated poses can cross nominal grid lines. */
import sharp from 'sharp';
for(const [file,cols,rows,prefix]of [['enemies-separated-v1',3,2,'enemy'],['weapon-separated-v1',2,2,'weapon'],['special-weapons-separated-v1',2,2,'special']]){
 const src=`public/arcade/rug-exe/${file}.png`,{data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=info,seen=new Uint8Array(w*h),parts=[];
 for(let n=0;n<w*h;n++){
  if(seen[n]||data[n*4+3]<32)continue;const pixels=[n];seen[n]=1;let l=w,t=h,r=0,b=0;
  for(let j=0;j<pixels.length;j++){const p=pixels[j],x=p%w,y=Math.floor(p/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);for(const dy of [-1,0,1])for(const dx of [-1,0,1]){const xx=x+dx,yy=y+dy,k=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=h||seen[k]||data[k*4+3]<32)continue;seen[k]=1;pixels.push(k);}}
  parts.push({pixels,l,t,r,b});
 }
 const bodies=parts.filter(p=>p.pixels.length>10000);console.log(prefix,bodies.length);
 if(bodies.length!==cols*rows)throw Error(`Expected ${cols*rows} silhouettes for ${prefix}, got ${bodies.length}`);
 for(const body of bodies)body.cell=Math.floor((body.l+body.r)/2/(w/cols))+Math.floor((body.t+body.b)/2/(h/rows))*cols;
 if(new Set(bodies.map(b=>b.cell)).size!==cols*rows)throw Error(`Ambiguous sprite layout: ${prefix}`);
 for(const part of parts.filter(p=>p.pixels.length<=10000&&p.pixels.length>4)){
  const x=(part.l+part.r)/2,y=(part.t+part.b)/2,distance=p=>Math.hypot(Math.max(p.l-x,0,x-p.r),Math.max(p.t-y,0,y-p.b));const body=[...bodies].sort((a,b)=>distance(a)-distance(b))[0];if(distance(body)>35)continue;body.pixels.push(...part.pixels);body.l=Math.min(body.l,part.l);body.r=Math.max(body.r,part.r);body.t=Math.min(body.t,part.t);body.b=Math.max(body.b,part.b);
 }
 for(const body of bodies){const width=body.r-body.l+5,height=body.b-body.t+5,pixels=Buffer.alloc(width*height*4);for(const n of body.pixels){const x=n%w-body.l+2,y=Math.floor(n/w)-body.t+2;data.copy(pixels,(y*width+x)*4,n*4,n*4+4);}await sharp(pixels,{raw:{width,height,channels:4}}).resize(512,512,{fit:'inside'}).webp({quality:92,alphaQuality:100}).toFile(`public/arcade/rug-exe/${prefix}-${body.cell}-v1.webp`);}
}
await sharp('public/arcade/rug-exe/wall-v1.png').resize(1024,1024).webp({quality:90}).toFile('public/arcade/rug-exe/wall-v1.webp');
