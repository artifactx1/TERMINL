import * as THREE from 'three';
/** A directionally correct 3D board: nose is -Z, wheel axles are X. */
export function makeSkateboard(scene,style='classic'){
 const color={classic:'#cfac79',vhs:'#bd8ae8',mint:'#a6edbb',corrupt:'#c4ff52'}[style]||'#cfac79';
 const root=new THREE.Group(),deck=new THREE.Group();root.add(deck);
 if(!scene.deckGeometry){
  const shape=new THREE.Shape();shape.moveTo(-.4,-.8);shape.bezierCurveTo(-.4,-1.22,.4,-1.22,.4,-.8);shape.lineTo(.4,.8);shape.bezierCurveTo(.4,1.2,-.4,1.2,-.4,.8);shape.closePath();
  scene.deckGeometry=new THREE.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelSize:.025,bevelThickness:.015,bevelSegments:2,steps:1});scene.deckGeometry.rotateX(Math.PI/2);scene.disposables.push(scene.deckGeometry);
 }
 const slab=new THREE.Mesh(scene.deckGeometry,scene.mat(color));slab.position.y=.27;deck.add(slab);
 if(!scene.gripMaterial){
  const c=document.createElement('canvas');c.width=128;c.height=384;const ctx=c.getContext('2d');ctx.fillStyle='#182820';ctx.beginPath();ctx.roundRect(3,3,122,378,45);ctx.fill();ctx.save();ctx.clip();
  let seed=23;for(let i=0;i<6000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%128;seed=(Math.imul(seed,1664525)+1013904223)>>>0;ctx.fillStyle=i%2?'#a8baa126':'#00000044';ctx.fillRect(x,seed%384,1,1);}ctx.fillStyle='#bcebaa';ctx.font='bold 18px monospace';ctx.translate(64,192);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText('TERMINL',0,6);ctx.restore();
  for(const y of [71,313])for(const x of [43,85]){ctx.fillStyle='#d7d5af';ctx.fillRect(x,y,4,4);}
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;scene.disposables.push(map);scene.gripMaterial=new THREE.MeshBasicMaterial({map,alphaTest:.2,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});scene.disposables.push(scene.gripMaterial);
 }
 const grip=scene.plane(deck,0,.305,0,.77,2.15,scene.gripMaterial);grip.rotation.x=-Math.PI/2;
 // Bake the axle orientation into geometry so animation rotates around X only.
 if(!scene.skateWheelGeometry){scene.skateWheelGeometry=new THREE.CylinderGeometry(.11,.11,.12,12);scene.skateWheelGeometry.rotateZ(Math.PI/2);scene.disposables.push(scene.skateWheelGeometry);}
 const wheels=[];
 for(const z of [-.7,.7]){
  scene.mesh(deck,0,.155,z,.66,.085,.14,'#adc0ba');
  for(const x of [-.43,.43]){
   const wheel=new THREE.Mesh(scene.skateWheelGeometry,scene.mat('#dcd6ac'));wheel.position.set(x,.105,z);deck.add(wheel);wheels.push(wheel);
   scene.mesh(deck,x*1.15,.105,z,.028,.05,.05,'#7f9586','sphere');
  }
 }
 root.userData={deck,wheels,slab,grip};return root;
}
