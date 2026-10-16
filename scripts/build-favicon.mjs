import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';

const source='artifacts/brand/terminl-favicon-reference.png';
const mask=Buffer.from('<svg width="726" height="726" xmlns="http://www.w3.org/2000/svg"><circle cx="363" cy="363" r="358" fill="white"/></svg>');
const cropped=await sharp(source).extract({left:37,top:0,width:726,height:726}).ensureAlpha()
  .composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
const square=await sharp(cropped).extract({left:43,top:43,width:640,height:640}).flatten({background:'#050505'}).png().toBuffer();

for(const [size,file] of [[512,'public/icon-512.png'],[180,'public/apple-touch-icon.png'],[32,'public/favicon-32.png'],[16,'public/favicon-16.png']]){
  await sharp(square).resize(size,size,{kernel:sharp.kernel.lanczos3}).png({compressionLevel:9}).toFile(file);
}

// ICO allows PNG image entries, preserving the same favicon on pages whose
// browser requests /favicon.ico directly.
const entries=await Promise.all([16,32].map(size=>readFile(`public/favicon-${size}.png`)));
const header=Buffer.alloc(6+16*entries.length);
header.writeUInt16LE(1,2);header.writeUInt16LE(entries.length,4);
let offset=header.length;
entries.forEach((png,index)=>{
  const at=6+16*index,size=[16,32][index];
  header.writeUInt8(size,at);header.writeUInt8(size,at+1);header.writeUInt16LE(1,at+4);
  header.writeUInt16LE(32,at+6);header.writeUInt32LE(png.length,at+8);header.writeUInt32LE(offset,at+12);
  offset+=png.length;
});
await writeFile('public/favicon.ico',Buffer.concat([header,...entries]));
console.log('Wrote TERMINL icon sizes and favicon.ico');
