/** Generated showroom/rear sprites. Coordinates are source pixels, not physics. */
import {drawSpriteTires} from './race-sprite-wheels.js';
export const VEHICLE_ART=Object.freeze({
  mirage:{src:'/arcade/mirage-atlas-v1.webp',rear:[340,8,858,488],garage:[76,498,1378,510]},
  glacier:{src:'/arcade/glacier-atlas-v1.webp',rear:[348,8,842,488],garage:[106,498,1328,502]},
  inferno:{src:'/arcade/inferno-atlas-v1.webp',rear:[310,4,916,496],garage:[74,502,1374,480]},
  'bike-tyson':{src:'/arcade/bike-tyson-atlas-v1.webp',rear:[600,0,335,492],garage:[326,498,888,526],raceWidth:.40},
});
const images=new Map();
let loading;
export function preloadVehicleArt(){
  if(typeof Image==='undefined')return Promise.resolve();
  if(!loading)loading=Promise.all(Object.entries(VEHICLE_ART).map(([id,{src}])=>new Promise(resolve=>{
    const image=new Image();image.onload=()=>{images.set(id,image);resolve();};image.onerror=()=>resolve();image.src=src;
  })));
  return loading;
}
/** Animate only the exposed tire surfaces, preserving the generated body silhouette. */
export function drawVehicleArt(c,id,{x,y,width,height=Infinity,view='rear',rotation=0}={}){
  const art=VEHICLE_ART[id],image=images.get(id);if(!art||!image)return false;
  const [sx,sy,sw,sh]=art[view],scale=Math.min(width/sw,height/sh),w=sw*scale,h=sh*scale;
  c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  c.drawImage(image,sx,sy,sw,sh,x-w/2,y-h,w,h);
  if(view==='rear'){c.translate(x-w/2-sx*scale,y-h-sy*scale);c.scale(scale,scale);drawSpriteTires(c,id,{rotation});}
  c.restore();return true;
}
