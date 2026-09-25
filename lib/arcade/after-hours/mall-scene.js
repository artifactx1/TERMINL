import * as THREE from 'three';
import {AfterHoursScene} from './scene';
import {SKATERS} from './mall-world.mjs';
import {batchScenery} from './batch-scenery';
import {MALL_MOTION} from './mall-motion-data.mjs';
import {sampleSkatePose} from './mall-animation.mjs';
import {makeSkateboard} from './skateboard';
import {angleDelta,clamp,floorAt,inside} from './math.mjs';

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
  if(rise&&!this.rampMaterial){
   const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#886c4c';g.fillRect(0,0,256,256);
   for(let i=0;i<100;i++){g.strokeStyle=i%3?'#362c211b':'#dab68c30';g.beginPath();g.moveTo(i*19%256,0);g.lineTo(i*19%256+Math.sin(i)*5,256);g.stroke();}
   for(const y of [3,127,253]){g.fillStyle='#3b342b';g.fillRect(0,y,256,2);for(const x of [8,128,248])g.fillRect(x,y+5,3,3);}
   g.fillStyle='#dfc99a';g.font='bold 29px monospace';g.textAlign='center';g.fillText('TERMINL',128,91);g.font='16px monospace';g.fillText('AFTER HOURS',128,111);
   const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;this.disposables.push(map);this.rampMaterial=new THREE.MeshLambertMaterial({map});this.disposables.push(this.rampMaterial);
  }
  const mat=rise?this.rampMaterial:this.tileMaterial;
  const m=new THREE.Mesh(g,mat);m.position.set(f.x,f.y,f.z);this.root.add(m);if(f.id)this.dynamic.set(f.id,m);
  if(rise){
   const side=new THREE.BufferGeometry();side.setAttribute('position',new THREE.Float32BufferAttribute([-f.w/2,0,-f.d/2,-f.w/2,0,f.d/2,-f.w/2,rise,f.d/2,f.w/2,0,-f.d/2,f.w/2,rise,f.d/2,f.w/2,0,f.d/2],3));side.computeVertexNormals();this.disposables.push(side);const sides=new THREE.Mesh(side,this.mat('#514535'));sides.position.set(f.x,f.y,f.z);this.root.add(sides);
   this.mesh(this.root,f.x,f.y+rise+.02,f.z+f.d/2,f.w,.07,.1,'#b4c0ad');
  }
 }
 makeSkater(id){
  const entry=SKATERS.find(c=>c.id===id);if(!entry){if(id==='security'){const g=new THREE.Group();g.add(this.propSprite(4,2.8));return g;}return super.makeSkater(id);}
  const g=new THREE.Group(),sheet=MALL_MOTION[entry.art],map=this.texture(sheet.src);
  const material=new THREE.SpriteMaterial({map,transparent:true,alphaTest:.1,depthWrite:true});this.disposables.push(material);
  const sprite=new THREE.Sprite(material),board=makeSkateboard(this,this.boardStyle);g.add(board,sprite);g.userData={sprite,board,sheet};
  return g;
 }
 propSprite(index,height){
  if(!this.propMaterials)this.propMaterials=new Map();
  if(!this.propMaterials.has(index)){const map=this.texture(`/arcade/mall-rat/prop-${index}-v1.webp`),mat=new THREE.SpriteMaterial({map,alphaTest:.18});this.propMaterials.set(index,mat);this.disposables.push(mat);}
  const sprite=new THREE.Sprite(this.propMaterials.get(index));sprite.center.set(.5,0);sprite.scale.set(height*(index===2?1.55:index===4?.68:.85),height,1);return sprite;
 }
 buildMall(s){
  // Retain real collision, rails, destructible props, secrets and event actors.
  this.boardStyle=s.board;super.buildMall(s);
  for(const child of [...this.root.children])if(child.isMesh&&child.scale.x===.1&&child.scale.y===3&&child.scale.z===18)this.root.remove(child);
  for(const o of s.world.props){
   const index=/planter/.test(o.kind)?0:/RUMBLE|LAMBO|MOON|RUG.EXE|CRT/.test(o.kind)?1:/bench|table|counter/.test(o.kind)?2:/vending|server|utility/.test(o.kind)?3:/elevator|mannequin|rack|perfume|sign|poster/.test(o.kind)?5:null;
   if(index!==null){const group=this.dynamic.get(o.id);group.clear();const sprite=this.propSprite(index,index===0?4.3:index===2?2:index===5?4.3:3.4);sprite.material=sprite.material.clone();sprite.material.transparent=true;this.disposables.push(sprite.material);group.add(sprite);}
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
  const ring=new THREE.TorusGeometry(5.7,.18,8,48);ring.rotateX(Math.PI/2);this.disposables.push(ring);const coping=new THREE.Mesh(ring,this.mat('#c3b584'));coping.position.set(0,.92,0);this.fountainScenery.add(coping);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;this.mesh(this.fountainScenery,Math.sin(a)*3.4,1.4,Math.cos(a)*3.4,.035,1.5,.035,'#b3eed5','cylinder',true);}
  const coin=this.mesh(this.fountainScenery,0,3,0,1.3, .2,1.3,'#d7b777','cylinder');coin.rotation.x=Math.PI/2;this.fountainScenery.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;this.disposables.push(o.material);}});
  this.playerShadow=this.shadow(0,.04,20,3.4,2,.65,({vhs:'#d29cff',mint:'#aaffbf',corrupt:'#d5ff40'})[s.board]||'#021614');
  this.ghost.traverse(o=>{if(o.isSprite){o.material.opacity=.24;}});
 }
 shadow(x,y,z,w,h,opacity,color='#021614'){
  if(!this.shadowTexture){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'#ffffffff');r.addColorStop(1,'#ffffff00');g.fillStyle=r;g.fillRect(0,0,64,64);this.shadowTexture=new THREE.CanvasTexture(c);this.disposables.push(this.shadowTexture);}
  if(!this.shadowMaterials)this.shadowMaterials=new Map();const key=`${color}:${opacity}`;if(!this.shadowMaterials.has(key)){const mat=new THREE.MeshBasicMaterial({map:this.shadowTexture,color,transparent:true,opacity,depthWrite:false});this.shadowMaterials.set(key,mat);this.disposables.push(mat);}const mat=this.shadowMaterials.get(key);const mesh=this.plane(this.root,x,y,z,w,h,mat);mesh.rotation.x=-Math.PI/2;return mesh;
 }
 updateMallCamera(s){
  const p=s.player,dt=Math.min(.1,Math.max(1,s.tick-(this.cameraTick??s.tick))/60);this.cameraTick=s.tick;
  if(!this.cameraReady){this.cameraYaw=p.yaw;this.cameraReady=true;}
  const turnBlend=1-Math.exp(-8*dt);this.cameraYaw+=angleDelta(p.yaw,this.cameraYaw)*turnBlend;
  const ground=floorAt(s.world,p.x,p.z),air=Math.max(0,p.y-ground),speed=clamp(p.speed/21,0,1),distance=8.5+speed*1.6;
  const desired=new THREE.Vector3(p.x-Math.sin(this.cameraYaw)*distance,ground+4.6+air*.65,p.z+Math.cos(this.cameraYaw)*distance);
  // Pull in before a wall can obscure the skater or clip through the lens.
  for(let i=1;i<=16;i++){const t=i/16,x=p.x+(desired.x-p.x)*t,z=p.z+(desired.z-p.z)*t,y=p.y+2+(desired.y-p.y-2)*t;if(s.world.solids.some(b=>!b.broken&&y<(b.y||0)+b.h&&y>(b.y||0)&&inside({x,z},b,.35))){desired.x=p.x+(desired.x-p.x)*Math.max(.3,t-.1);desired.z=p.z+(desired.z-p.z)*Math.max(.3,t-.1);break;}}
  if(!this.ready){this.camera.position.copy(desired);this.ready=true;}else this.camera.position.lerp(desired,1-Math.exp(-10*dt));
  this.camera.lookAt(p.x+Math.sin(this.cameraYaw)*3.6,ground+1.35+air*.65,p.z-Math.cos(this.cameraYaw)*3.6);
  const fov=(this.camera.aspect<.8?67:61)+speed*6+(s.boost?3:0);this.camera.fov+=(fov-this.camera.fov)*(1-Math.exp(-4*dt));this.camera.updateProjectionMatrix();
 }
 animateRig(rig,s){
  const p=s.player,{sprite,board,sheet}=rig.userData;if(!sprite||!sheet)return;
  const cameraYaw=Math.atan2(p.x-this.camera.position.x,-(p.z-this.camera.position.z)),pose=sampleSkatePose(s,cameraYaw),frame=sheet.frames[pose.frame];
  rig.position.set(p.x,p.y+.035,p.z);rig.rotation.set(0,0,0);
  sprite.material.map.repeat.set(frame.width/sheet.width,frame.height/sheet.height);sprite.material.map.offset.set(frame.x/sheet.width,1-(frame.y+frame.height)/sheet.height);
  const scale=3.15/sheet.standingHeight;sprite.scale.set(frame.width*scale,frame.height*scale,1);sprite.center.set(frame.footX/frame.width,1-frame.footY/frame.height);
  sprite.position.set(0,.29+pose.bodyLift,0);sprite.material.rotation=pose.bail?-1.35:pose.lean;
  if(p.bail)sprite.position.y=.25;
  board.rotation.set(0,pose.bodyYaw,0);for(const wheel of board.userData.wheels)wheel.rotation.x=p.wheelAngle||0;board.userData.deck.rotation.set(pose.boardPitch,0,pose.boardRoll);
  board.position.y=pose.bail?.05:0;board.position.x=pose.bail?.9:0;
  rig.userData.pose=pose;
 }
 animateSkater(s){
  this.animateRig(this.skater,s);
  // Fade only scenery crossing the camera-to-rider sightline.
  const camera=this.camera.position,pivot=new THREE.Vector3(s.player.x,s.player.y+1.5,s.player.z),line=pivot.clone().sub(camera),lengthSq=line.lengthSq();
  if(!this.occlusionRay)this.occlusionRay=new THREE.Raycaster();
  this.occlusionRay.set(camera,line.clone().normalize());this.occlusionRay.far=Math.sqrt(lengthSq);this.fountainScenery.updateMatrixWorld(true);
  const fountainBlocked=this.occlusionRay.intersectObject(this.fountainScenery,true).length>0;
  this.fountainScenery.traverse(o=>{if(o.isMesh){o.material.opacity=fountainBlocked?.12:1;o.material.depthWrite=!fountainBlocked;}});
  for(const o of s.world.props){const group=this.dynamic.get(o.id),sprite=group?.children.find(c=>c.isSprite);if(!sprite)continue;
   const center=new THREE.Vector3(o.x,o.y+sprite.scale.y*.5,o.z),along=center.clone().sub(camera).dot(line)/lengthSq,nearest=camera.clone().addScaledVector(line,clamp(along,0,1));
   const obstructs=along>0&&along<1.05&&center.distanceTo(nearest)<sprite.scale.y*.48;
   sprite.material.opacity=obstructs?.12:1;sprite.material.depthWrite=!obstructs;
  }
  if(!this.skateFx){this.skateFx=[];for(let i=0;i<14;i++){const mesh=this.mesh(this.scene,0,-100,0,.04,.04,.18,'#ffe0a0','box',true);mesh.visible=false;this.skateFx.push({mesh,born:-100});}}
  if(this.fxTick!==s.tick){this.fxTick=s.tick;
   if(s.player.rail&&s.tick%3===0){const fx=this.skateFx[Math.floor(s.tick/3)%this.skateFx.length];fx.born=s.tick;fx.mesh.position.set(s.player.x,s.player.y+.18,s.player.z);fx.yaw=s.player.yaw;}
   for(const fx of this.skateFx){const age=s.tick-fx.born;fx.mesh.visible=age>=0&&age<12;if(fx.mesh.visible){fx.mesh.position.x-=Math.sin(fx.yaw)*.08;fx.mesh.position.z+=Math.cos(fx.yaw)*.08;fx.mesh.position.y-=.015;fx.mesh.scale.y=.04*(1-age/12);}}
  }
  const p=s.player,ground=floorAt(s.world,p.x,p.z);this.playerShadow.position.set(p.x,ground+.05,p.z);this.playerShadow.material.opacity=.6/(1+Math.max(0,p.y-ground)*.25);
  this.canvas.dataset.skatePose=this.skater.userData.sheet.frames[this.skater.userData.pose.frame].name;this.canvas.dataset.bodyYaw=this.skater.userData.pose.bodyYaw.toFixed(3);this.canvas.dataset.boardYaw=this.skater.userData.board.rotation.y.toFixed(3);this.canvas.dataset.boardRoll=this.skater.userData.board.userData.deck.rotation.z.toFixed(3);this.canvas.dataset.wheelAngle=(p.wheelAngle||0).toFixed(3);
 }
 animateGhost(s,ghost){
  this.ghost.visible=!!ghost?.length;if(!this.ghost.visible)return;
  const i=Math.min(ghost.length-1,Math.floor(s.tick/6)),f=ghost[i],prev=ghost[Math.max(0,i-1)];
  this.animateRig(this.ghost,{tick:s.tick,player:{x:f[1],y:f[2],z:f[3],yaw:f[4],speed:Math.hypot(f[1]-prev[1],f[3]-prev[3])*10,grounded:f[2]<=floorAt(s.world,f[1],f[3])+.2}});
 }
}
