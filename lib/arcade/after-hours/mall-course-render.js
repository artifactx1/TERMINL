import * as THREE from 'three';
import {floorAt,surfaceHeight} from './math.mjs';
export function parkSurfaceMaterial(scene,kind){
 scene.parkMaterials??=new Map();if(scene.parkMaterials.has(kind))return scene.parkMaterials.get(kind);
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
 const palette={bowl:['#879f8b','#b6c1a4'],mega:['#4e5f57','#bcc19b'],rails:['#414e50','#b7b098'],street:['#796f66','#b9ae8c'],garden:['#566b51','#95aa7c'],canal:['#3d626a','#85aca5'],roofs:['#555d6b','#a2a9ac'],snake:['#635b70','#b4a1b7']}[kind];
 g.fillStyle=palette[0];g.fillRect(0,0,512,512);let seed=79;
 for(let i=0;i<20000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%512;seed=(Math.imul(seed,1664525)+1013904223)>>>0;g.fillStyle=i%2?'#ffffff0b':'#00000013';g.fillRect(x,seed%512,i%3+1,1);}
 g.strokeStyle=palette[1]+'55';g.lineWidth=2;
 if(kind==='street'||kind==='garden'){for(let y=0;y<512;y+=64)for(let x=-(y%128);x<512;x+=128)g.strokeRect(x,y,128,64);}
 else if(kind==='rails'||kind==='roofs'){g.setLineDash([30,22]);g.strokeStyle=palette[1]+'a0';g.lineWidth=4;g.beginPath();g.moveTo(24,0);g.lineTo(24,512);g.stroke();}
 else if(kind!=='bowl'){g.strokeRect(1,1,510,510);g.strokeRect(6,6,500,500);}
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(7,7);map.anisotropy=4;
 const mat=new THREE.MeshStandardMaterial({map,roughness:kind==='bowl'?.78:.65,metalness:.08});scene.disposables.push(map,mat);scene.parkMaterials.set(kind,mat);return mat;
}
export function addRampSkirt(scene,f){
 const base=Math.min(f.y,f.y+f.rise),positions=[],halfW=f.w/2,halfD=f.d/2;
 for(const [a,b]of [[[-halfW,-halfD],[halfW,-halfD]],[[halfW,-halfD],[halfW,halfD]],[[halfW,halfD],[-halfW,halfD]],[[-halfW,halfD],[-halfW,-halfD]]])for(let i=0;i<16;i++){
  const x1=f.x+a[0]+(b[0]-a[0])*i/16,z1=f.z+a[1]+(b[1]-a[1])*i/16,x2=f.x+a[0]+(b[0]-a[0])*(i+1)/16,z2=f.z+a[1]+(b[1]-a[1])*(i+1)/16,y1=surfaceHeight(f,x1,z1),y2=surfaceHeight(f,x2,z2);
  positions.push(x1,base,z1,x2,base,z2,x1,y1,z1,x1,y1,z1,x2,base,z2,x2,y2,z2);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();scene.disposables.push(geometry);
 const material=scene.mat('#495348');material.side=THREE.DoubleSide;scene.root.add(new THREE.Mesh(geometry,material));
 const alongX=f.axis==='x',high=(f.rise>0?1:-1);scene.mesh(scene.root,f.x+(alongX?high*halfW:0),Math.max(f.y,f.y+f.rise)+.025,f.z+(alongX?0:high*halfD),alongX?.09:f.w,.08,alongX?f.d:.09,'#bac1a5');
}
export function buildParkScenery(scene,s){
 const root=scene.root,b=s.world.bounds;
 // Low lit perimeter keeps the edge readable without closing off sightlines.
 for(const side of [-1,1]){
  scene.mesh(root,side*b,3,0,.5,6,b*2,'#173933');scene.mesh(root,0,3,side*b,b*2,6,.5,'#173933');
  scene.mesh(root,side*(b-.4),6.2,0,.15,.15,b*2,'#a6d590','box',true);scene.mesh(root,0,6.2,side*(b-.4),b*2,.15,.15,'#a6d590','box',true);
 }
 // The bowl's coping follows its true circular lip; the lower bands describe depth.
 const bowl=s.world.floors.find(f=>f.bowl);
 for(const [radius,color]of [[30,'#c3c8b0'],[27,'#d8c996'],[22,'#37645c']]){
  const y=surfaceHeight(bowl,bowl.x+radius,bowl.z)+.12;
  const g=new THREE.TorusGeometry(radius,.1,5,96);g.rotateX(-Math.PI/2);scene.disposables.push(g);const m=new THREE.Mesh(g,scene.mat(color));m.position.set(-140,y,0);root.add(m);
 }
 // Lit shop fronts, brass cornices and upper windows enclose the expanded park.
 // They sit beyond the runoff banks, leaving the whole riding floor open.
 for(let v=-176;v<=176;v+=32)for(const side of [-1,1]){
  const height=15+(Math.abs(v)%4)*2;
  for(const axis of ['x','z']){
   const x=axis==='x'?side*(b+.4):v,z=axis==='z'?side*(b+.4):v;
   scene.mesh(root,x,9,z,axis==='x'?2:31,18,axis==='z'?2:31,'#223e36');
   scene.plane(root,x-(axis==='x'?side*1.1:0),7,z-(axis==='z'?side*1.1:0),29,12,scene.shopMaterial,axis==='x'?-side*Math.PI/2:side<0?0:Math.PI);
   scene.mesh(root,x,14,z,axis==='x'?3:32,.5,axis==='z'?3:32,'#a79264');
   scene.mesh(root,x,15,z,axis==='x'?2.4:30,.12,axis==='z'?2.4:30,'#b5d69c','box',true);
   scene.mesh(root,x,18+height/2,z,axis==='x'?9:29,height,axis==='z'?9:29,'#203b35');
   for(let j=-10;j<=10;j+=5)for(let h=19;h<18+height;h+=4)scene.mesh(root,x+(axis==='z'?j:-side*4.6),h,z+(axis==='x'?j:-side*4.6),axis==='x'?.08:2.4,1.8,axis==='z'?.08:2.4,(j+h)%3?'#8ca98b':'#38564d','box',true);
  }
 }
 // Inlaid strips and pools of light identify the fast connecting concourses.
 for(const v of [-92,92]){
  scene.mesh(root,v,.035,0,.14,.025,345,'#acb989');scene.mesh(root,0,.035,v,345,.025,.14,'#acb989');
  for(const n of [-150,-75,0,75,150]){
   for(const [x,z]of [[v,n],[n,v]]){scene.mesh(root,x,5.5,z,.28,11,.28,'#526c59');scene.mesh(root,x,11,z,4,.2,1,'#e5d6a2','box',true);scene.shadow(x,.025,z,16,18,.12,'#dddfac');}
  }
 }
 for(const z of s.world.zones.filter(z=>z.w!==56)){
  const accent=z.id==='mega'?'#ead192':z.id==='snake'?'#c4a2e0':'#a8d7b8';
  // Freestanding entry gantries are above the skating line, with columns outside it.
  scene.mesh(root,z.x,10,z.z+z.d/2-6,30,.35,.5,'#547068');
  for(const side of [-1,1])scene.mesh(root,z.x+side*16,5,z.z+z.d/2-6,.55,10,.55,'#466659');
  scene.label(root,z.name,z.x,10,z.z+z.d/2-6,accent,1.3);
  for(const side of [-1,1]){
   scene.mesh(root,z.x+side*(z.w/2-8),5,z.z-24,.3,10,.3,'#526f62');
   scene.mesh(root,z.x+side*(z.w/2-8),10,z.z-24,4,.2,1,accent,'box',true);
  }
 }
 // Street ledge and stair banks; all ridable tops are terrain patches.
 for(const side of [-1,1])for(let i=0;i<5;i++)scene.mesh(root,side*35, .12+i*.12,111+i*1.8,18,.24+i*.24,1.8,'#71897c');
 for(const side of [-1,1]){
  scene.label(root,side<0?'TAKEOFF / HOLD OLLIE':'LANDING / KEEP ROLLING',side<0?-17:17,2.4,-119,'#e5c99e',.65);
  for(let i=0;i<6;i++)scene.mesh(root,side*15,.04,-103+i*4,.25,.035,1.8,'#d6bb80');
 }
 for(const gap of s.world.gaps){const x=gap.axis==='x'?gap.line:(gap.min+gap.max)/2,z=gap.axis==='z'?gap.line:(gap.min+gap.max)/2;scene.label(root,gap.name,x,5,z,'#dab9ec',.7);}
 scene.routeMarkers=[];
 for(const route of s.world.routes){
  const g=new THREE.Group();scene.scene.add(g);
  const geometry=new THREE.TorusGeometry(3,.11,6,36);geometry.rotateX(-Math.PI/2);scene.disposables.push(geometry);
  const material=new THREE.MeshBasicMaterial({color:route.color,transparent:true,opacity:.85,depthWrite:false});scene.disposables.push(material);
  const ring=new THREE.Mesh(geometry,material);g.add(ring);const label=scene.label(g,route.name,0,3,0,route.color,.65);scene.routeMarkers.push({id:route.id,group:g,ring,label});
 }
}
export function updateRouteMarkers(scene,s){
 for(const marker of scene.routeMarkers||[]){const route=s.world.routes.find(r=>r.id===marker.id),progress=s.routeProgress?.[marker.id],gate=route.gates[progress?.index||0];marker.group.position.set(gate.x,floorAt(s.world,gate.x,gate.z)+.1,gate.z);marker.ring.scale.setScalar(1+Math.sin(s.tick*.05)*.06);marker.group.visible=!(progress?.cooldown>s.tick);}
}
