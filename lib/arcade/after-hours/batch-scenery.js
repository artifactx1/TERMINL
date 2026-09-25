import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Batch only immutable direct-child scenery; gameplay objects retain identity. */
export function batchScenery(scene,extra=[]){
 const moving=new Set([...scene.dynamic.values(),...extra]),groups=new Map();
 for(const mesh of [...scene.root.children]){
  if(!mesh.isMesh||moving.has(mesh)||!mesh.visible||Array.isArray(mesh.material))continue;
  mesh.updateMatrix();const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrix);
  // Box, plane and floor geometries have differing attribute layouts.
  const key=`${mesh.material.uuid}:${Object.keys(geometry.attributes).sort().join(',')}:${!!geometry.index}`;
  if(!groups.has(key))groups.set(key,{material:mesh.material,parts:[],meshes:[]});
  groups.get(key).parts.push(geometry);groups.get(key).meshes.push(mesh);
 }
 for(const {material,parts,meshes}of groups.values()){
  if(parts.length>1){const geometry=mergeGeometries(parts);if(geometry){scene.disposables.push(geometry);scene.root.add(new THREE.Mesh(geometry,material));for(const mesh of meshes)scene.root.remove(mesh);}}
  for(const part of parts)part.dispose();
 }
}
