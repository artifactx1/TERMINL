import {mkdir} from 'node:fs/promises';
import sharp from 'sharp';

const output='public/arcade/og';
await mkdir(output,{recursive:true});

const inferno=await sharp('public/arcade/inferno-atlas-v1.webp')
  .extract({left:0,top:505,width:1536,height:519})
  .png()
  .toBuffer();

await sharp(inferno)
  .trim({background:'#00000000'})
  .resize({width:900,height:470,fit:'inside',withoutEnlargement:true})
  .png({compressionLevel:9,palette:true,quality:92})
  .toFile(`${output}/inferno.png`);

for(const name of ['margin-call-max','cold-storage-chloe','buy-high-brian']){
  await sharp(`public/degens/${name}.webp`)
    .png({compressionLevel:9,palette:true,quality:92})
    .toFile(`${output}/${name}.png`);
}
