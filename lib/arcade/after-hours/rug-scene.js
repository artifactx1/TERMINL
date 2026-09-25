import * as THREE from 'three';
import {AfterHoursScene} from './scene';
import {batchScenery} from './batch-scenery';
const TYPES={bot:0,sybil:0,bagholder:1,sniper:2,whale:3,influencer:4,moderator:5,manager:5,dev:5};
export class RugScene extends AfterHoursScene{
 constructor(...args){super(...args);batchScenery(this,[this.exit]);}
 texture(path){const t=new THREE.TextureLoader().load(path);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());this.disposables.push(t);return t;}
 build(s){
  this.enemyTextures=new Map();
  const wall=this.texture('/arcade/rug-exe/wall-v1.webp');wall.wrapS=wall.wrapT=THREE.RepeatWrapping;
  this.wallMaterial=new THREE.MeshBasicMaterial({map:wall,color:s.level===5?'#c4eafa':s.level===7?'#ffdda3':'#c0dac7'});this.disposables.push(this.wallMaterial);
  super.build(s);
  for(const b of s.world.solids){
   const m=this.dynamic.get(b.id);if(!m)continue;
   const g=this.geometry('box').clone(),uv=g.attributes.uv;
   const dimensions=[[b.d,b.h],[b.d,b.h],[b.w,b.d],[b.w,b.d],[b.w,b.h],[b.w,b.h]];
   for(let face=0;face<6;face++)for(let corner=0;corner<4;corner++){const i=face*4+corner;uv.setXY(i,uv.getX(i)*dimensions[face][0]/8,uv.getY(i)*dimensions[face][1]/8);}
   this.disposables.push(g);m.geometry=g;m.material=this.wallMaterial;
  }
  this.weapon.visible=false;
  // Overhead cable runs, structural arches and lit service trenches.
  for(let i=0;i<9;i++){
   const z=28-i*14;
   for(const side of [-1,1]){
    this.mesh(this.root,side*32,6,z,1.1,12,.8,'#293f38');
    this.mesh(this.root,side*32,5.8,z,.12,9,.92,s.world.spec.accent,'box',true);
    this.mesh(this.root,side*17,8.5,z,.5,.5,14,'#726548','cylinder').rotation.x=Math.PI/2;
    this.mesh(this.root,side*8,.035,z,.12,.03,12,s.world.spec.accent,'box',true);
   }
   this.mesh(this.root,0,11.7,z,66,.5,.8,'#415349');
   this.mesh(this.root,0,11.35,z,14,.06,.6,'#c3d8a9','box',true);
  }
  this.scene.background.set('#061514');this.scene.fog=new THREE.Fog('#071a18',23,100);
 }
 floor(f){
  if(!this.floorMaterials)this.floorMaterials=new Map();
  const key=f.color||'#35534a';let material=this.floorMaterials.get(key);
  if(!material){
   const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=key;g.fillRect(0,0,256,256);g.fillStyle='#03171099';g.fillRect(0,0,256,256);
   for(let y=0;y<4;y++)for(let x=0;x<4;x++){g.strokeStyle='#90a78a55';g.strokeRect(x*64+2,y*64+2,60,60);g.fillStyle='#bdd5a942';for(const px of [7,55])for(const py of [7,55])g.fillRect(x*64+px,y*64+py,2,2);for(let n=12;n<54;n+=8){g.fillStyle='#03171277';g.fillRect(x*64+12,y*64+n,40,2);}}
   const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;this.disposables.push(map);material=new THREE.MeshBasicMaterial({map});this.disposables.push(material);this.floorMaterials.set(key,material);
  }
  const g=new THREE.PlaneGeometry(f.w,f.d);g.rotateX(-Math.PI/2);const pos=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<pos.count;i++){pos.setY(i,f.y+(f.rise||0)*(pos.getZ(i)/f.d+.5));uv.setXY(i,uv.getX(i)*f.w/12,uv.getY(i)*f.d/12);}g.computeVertexNormals();this.disposables.push(g);const mesh=new THREE.Mesh(g,material);mesh.position.set(f.x,0,f.z);this.root.add(mesh);if(f.id)this.dynamic.set(f.id,mesh);
 }
 makeEnemy(e){
  const index=TYPES[e.type]??0;
  if(!this.enemyTextures.has(index))this.enemyTextures.set(index,this.texture(`/arcade/rug-exe/enemy-${index}-v1.webp`));
  const material=new THREE.SpriteMaterial({map:this.enemyTextures.get(index),alphaTest:.16,color:e.type==='sybil'?'#bd9fe9':'#ffffff'});this.disposables.push(material);
  const sprite=new THREE.Sprite(material),height=e.type==='whale'?3.6:e.type==='bagholder'?2.7:2.2;sprite.center.set(.5,0);sprite.scale.set(height*(index===3?1:index===2?.95:.83),height,1);
  const g=new THREE.Group();g.add(sprite);g.userData.sprite=sprite;return g;
 }
 draw(s,options){
  // Telegraph and hit response remain visible on the illustrated silhouettes.
  for(const e of s.enemies){const m=this.enemyMeshes.get(e.id);if(m?.userData.sprite){const sprite=m.userData.sprite;sprite.material.color.set(e.hit>0?'#ffbd99':e.telegraph>0?'#ffd07c':e.type==='sybil'?'#bd9fe9':'#ffffff');sprite.material.rotation=this.reducedMotion?0:Math.sin(s.tick*.13+e.x)*.022;sprite.position.y=this.reducedMotion?0:Math.abs(Math.sin(s.tick*.11+e.x))*.045;}}
  super.draw(s,options);
 }
}
