/** Pack generated alpha sprites into consistent 512px cells, preserving proportions. */
import sharp from 'sharp';
const ids=['margin-call-max','diamond-hands-pepe','mev-mia','cold-storage-chloe'];
for(const id of ids){
 const input=`public/arcade/mall-rat/${id}-v1.png`,meta=await sharp(input).metadata(),w=Math.floor(meta.width/2),h=Math.floor(meta.height/2),tiles=[];
 for(let i=0;i<4;i++){
  const crop=await sharp(input).extract({left:i%2*w,top:Math.floor(i/2)*h,width:w,height:h}).png().toBuffer();
  const cell=await sharp(crop).trim({threshold:15}).toBuffer();
  const tile=await sharp(cell).resize(470,470,{fit:'contain',background:'#00000000'}).png().toBuffer();
  tiles.push({input:tile,left:i%2*512+21,top:Math.floor(i/2)*512+21});
 }
 await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(tiles).webp({quality:92,alphaQuality:100}).toFile(`public/arcade/mall-rat/${id}-atlas-v1.webp`);
}
await sharp('public/arcade/mall-rat/storefront-v1.png').resize(1536,1024).webp({quality:90}).toFile('public/arcade/mall-rat/storefront-v1.webp');
const props='public/arcade/mall-rat/props-alpha-v1.png',meta=await sharp(props).metadata();
for(let i=0;i<6;i++){
 const width=Math.floor(meta.width/3),height=Math.floor(meta.height/2);
 const crop=await sharp(props).extract({left:i%3*width,top:Math.floor(i/3)*height,width,height}).png().toBuffer();
 await sharp(crop).trim({threshold:15}).resize(384,512,{fit:'inside'}).webp({quality:90,alphaQuality:100}).toFile(`public/arcade/mall-rat/prop-${i}-v1.webp`);
}
