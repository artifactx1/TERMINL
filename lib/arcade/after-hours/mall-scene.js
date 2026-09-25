import * as THREE from 'three';
import {AfterHoursScene} from './scene';
import {SKATERS} from './mall-world.mjs';
import {batchScenery} from './batch-scenery';

/** Illustrated degen sprites in a continuous, skateable architectural space. */
export class MallScene extends AfterHoursScene {
 constructor(...args){
  super(...args);batchScenery(this,[this.playerShadow,this.gate,this.rugHole]);
  this.scene.background.set('#081c20');this.scene.fog=new THREE.Fog('#183937',35,125);
  this.renderer.setClearColor('#081c20');this.camera.fov=62;this.camera.updateProjectionMatrix();
 }
 texture(path){
  const t=new THREE.TextureLoader().load(path);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());this.disposables.push(t);return t;
 }
 plane(parent,x,y,z,w,h,material,rotation=0){
  if(!this.panelGeometry){this.panelGeometry=new THREE.PlaneGeometry(1,1);this.disposables.push(this.panelGeometry);}
  const m=new THREE.Mesh(this.panelGeometry,material);m.position.set(x,y,z);m.scale.set(w,h,1);m.rotation.y=rotation;parent.add(m);return m;
 }
 floor(f){
  if(!this.tileMaterial){
   const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
   g.fillStyle='#203e3d';g.fillRect(0,0,512,512);
   for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    g.fillStyle=(x+y)%2?'#53655a':'#364f49';g.fillRect(x*128+2,y*128+2,124,124);
    g.strokeStyle='#8e998041';g.strokeRect(x*128+4,y*128+4,120,120);
   }
   // Seeded mineral flecks and hairline scratches prevent a flat gray floor.
   let seed=619;for(let i=0;i<9000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%512;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%512;g.fillStyle=i%2?'#d7d4b314':'#001d2420';g.fillRect(x,y,1+i%3,1);}
   const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(7,7);map.anisotropy=4;this.disposables.push(map);
   this.tileMaterial=new THREE.MeshStandardMaterial({map,roughness:.48,metalness:.25});this.disposables.push(this.tileMaterial);
  }
  const rise=f.rise||0,g=new THREE.PlaneGeometry(f.w,f.d);g.rotateX(-Math.PI/2);
  const pos=g.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,rise*(pos.getZ(i)/f.d+.5));g.computeVertexNormals();this.disposables.push(g);
  const mat=rise?this.mat('#997656'):this.tileMaterial;
  const m=new THREE.Mesh(g,mat);m.position.set(f.x,f.y,f.z);this.root.add(m);if(f.id)this.dynamic.set(f.id,m);
 }
 makeSkater(id){
  const entry=SKATERS.find(c=>c.id===id);if(!entry){if(id==='security'){const g=new THREE.Group();g.add(this.propSprite(4,2.8));return g;}return super.makeSkater(id);}
  const g=new THREE.Group();const map=this.texture(`/arcade/mall-rat/${entry.art}-atlas-v1.webp`);map.repeat.set(.5,.5);map.offset.set(0,.5);
  const material=new THREE.SpriteMaterial({map,transparent:true,alphaTest:.1,depthWrite:true});this.disposables.push(material);
  const sprite=new THREE.Sprite(material);sprite.center.set(.5,.06);sprite.scale.set(4.6,4.6,1);g.add(sprite);g.userData.sprite=sprite;
  return g;
 }
 propSprite(index,height){
  if(!this.propMaterials)this.propMaterials=new Map();
  if(!this.propMaterials.has(index)){const map=this.texture(`/arcade/mall-rat/prop-${index}-v1.webp`),mat=new THREE.SpriteMaterial({map,alphaTest:.18});this.propMaterials.set(index,mat);this.disposables.push(mat);}
  const sprite=new THREE.Sprite(this.propMaterials.get(index));sprite.center.set(.5,0);sprite.scale.set(height*(index===2?1.55:index===4?.68:.85),height,1);return sprite;
 }
 buildMall(s){
  // Retain real collision, rails, destructible props, secrets and event actors.
  super.buildMall(s);
  for(const child of [...this.root.children])if(child.isMesh&&child.scale.x===.1&&child.scale.y===3&&child.scale.z===18)this.root.remove(child);
  for(const o of s.world.props){
   const index=/planter/.test(o.kind)?0:/RUMBLE|LAMBO|MOON|RUG.EXE|CRT/.test(o.kind)?1:/bench|table|counter/.test(o.kind)?2:/vending|server|utility/.test(o.kind)?3:/elevator|mannequin|rack|perfume|sign|poster/.test(o.kind)?5:null;
   if(index!==null){const group=this.dynamic.get(o.id);group.clear();group.add(this.propSprite(index,index===0?5.5:index===2?2:index===5?4.3:3.4));}
  }
  this.shopMaterial=new THREE.MeshBasicMaterial({map:this.texture('/arcade/mall-rat/storefront-v1.webp'),side:THREE.DoubleSide});this.disposables.push(this.shopMaterial);
  const glass=new THREE.MeshBasicMaterial({color:'#6dceb2',transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false});this.disposables.push(glass);
  const sky=new THREE.MeshBasicMaterial({color:'#39726b',side:THREE.DoubleSide});this.disposables.push(sky);
  for(const zone of s.world.zones){
   const {x,z,y}=zone,accent=zone.id==='arcade'?'#d694ee':zone.id==='food'?'#edbf79':'#b5ebc9';
   for(const side of [-1,1]){
    // Shop windows follow the existing solid walls; the middle stays open.
    for(const dz of [-12,0])this.plane(this.root,x+side*23.42,y+4.1,z+dz-6,12,8.2,this.shopMaterial,-side*Math.PI/2);
    this.mesh(this.root,x+side*24,y+8.5,z-6,4,.5,26,'#b9ac7c');
    this.mesh(this.root,x+side*22,y+8.8,z-6,.12,.12,26,accent,'box',true);
    this.plane(this.root,x+side*22,y+9.6,z-6,26,1.5,glass,Math.PI/2);
    for(let dz=-18;dz<=7;dz+=5)this.mesh(this.root,x+side*22,y+9.6,z+dz,.08,1.8,.08,'#a59f78');
    for(const dz of [-19,7]){
     this.mesh(this.root,x+side*23,y+6.3,z+dz,.85,12.6,.85,'#173d37','cylinder');
     for(const h of [.2,3.8,8.2,12.5])this.mesh(this.root,x+side*23,y+h,z+dz,1,.18,1,'#b69861','cylinder');
    }
    // Inlaid concourse edges frame the navigable route.
    this.mesh(this.root,x+side*20,y+.035,z, .35,.035,51,'#c6ad75');
    this.mesh(this.root,x+side*19.5,y+.035,z,.08,.035,51,'#84cba4','box',true);
   }
   if(zone.id!=='roof'){
    const canopy=this.plane(this.root,x,y+15,z-6,43,27,sky);canopy.rotation.x=Math.PI/2;
    for(let dz=-19;dz<=8;dz+=4.5){
     this.mesh(this.root,x,y+14.8,z+dz,46,.2,.22,'#849185');
     this.mesh(this.root,x,y+14.55,z+dz,20,.05,.09,'#e3f4c3','box',true);
    }
    for(const dx of [-14,0,14])this.mesh(this.root,x+dx,y+14.7,z-6,.2,.2,28,'#849185');
   }
   // Shop light spills and a contact shadow under every destructible prop.
   for(const o of s.world.props.filter(o=>o.zone===zone.id))this.shadow(o.x,o.y+.035,o.z,o.w*1.3,o.d*1.5,.3);
   for(const dx of [-18,18])this.shadow(x+dx,y+.03,z-5,5,22,.15,'#b8e6b5');
  }
  // Fountain: concentric stone coping, luminous water, brass sculpture and jets.
  const ring=new THREE.TorusGeometry(5.7,.18,8,48);ring.rotateX(Math.PI/2);this.disposables.push(ring);const coping=new THREE.Mesh(ring,this.mat('#c3b584'));coping.position.set(0,.92,0);this.root.add(coping);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;this.mesh(this.root,Math.sin(a)*3.4,1.4,Math.cos(a)*3.4,.035,1.5,.035,'#b3eed5','cylinder',true);}
  const coin=this.mesh(this.root,0,3,0,1.3, .2,1.3,'#d7b777','cylinder');coin.rotation.x=Math.PI/2;
  this.playerShadow=this.shadow(0,.04,20,3.4,2,.65,({vhs:'#d29cff',mint:'#aaffbf',corrupt:'#d5ff40'})[s.board]||'#021614');
  this.ghost.traverse(o=>{if(o.isSprite){o.material.opacity=.24;}});
 }
 shadow(x,y,z,w,h,opacity,color='#021614'){
  if(!this.shadowTexture){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'#ffffffff');r.addColorStop(1,'#ffffff00');g.fillStyle=r;g.fillRect(0,0,64,64);this.shadowTexture=new THREE.CanvasTexture(c);this.disposables.push(this.shadowTexture);}
  if(!this.shadowMaterials)this.shadowMaterials=new Map();const key=`${color}:${opacity}`;if(!this.shadowMaterials.has(key)){const mat=new THREE.MeshBasicMaterial({map:this.shadowTexture,color,transparent:true,opacity,depthWrite:false});this.shadowMaterials.set(key,mat);this.disposables.push(mat);}const mat=this.shadowMaterials.get(key);const mesh=this.plane(this.root,x,y,z,w,h,mat);mesh.rotation.x=-Math.PI/2;return mesh;
 }
 animateSkater(s){
  const p=s.player,sprite=this.skater.userData.sprite;this.skater.position.set(p.x,p.y+.04,p.z);
  const frame=p.bail?3:!p.grounded?(s.combo.last.includes('FLIP')||s.combo.last.includes('INDY')?3:2):Math.abs(p.speed)>1&&s.tick%40<12?1:0;
  sprite.material.map.offset.set(frame%2*.5,frame<2?.5:0);sprite.material.rotation=p.bail?-1.1:p.rail?.08:Math.sin(p.yaw)*.08;
  const ground=s.world.zones.find(z=>Math.abs(p.x-z.x)<28&&Math.abs(p.z-z.z)<28)?.y||0;
  this.playerShadow.position.set(p.x,ground+.06,p.z);this.playerShadow.material.opacity=.6/(1+Math.max(0,p.y-ground)*.25);
 }

}
