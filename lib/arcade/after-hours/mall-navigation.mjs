import {floorAt,inside,angleDelta} from './math.mjs';

const CELL=4,grids=new WeakMap();
const moves=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
export function parkGrid(world){
 if(grids.has(world))return grids.get(world);
 const bound=world.bounds-4,size=Math.floor(bound*2/CELL)+1,nodes=[];
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
  const x=col*CELL-bound,z=row*CELL-bound,y=floorAt(world,x,z);
  const clear=!world.solids.some(b=>!b.broken&&inside({x,z},b,1.25)&&y<(b.y||0)+b.h&&y+2>(b.y||0));
  nodes.push({x,z,y,clear,row,col});
 }
 const grid={nodes,size,bound,world};grids.set(world,grid);return grid;
}
function canCross(grid,a,b){
 if(!a?.clear||!b?.clear)return false;
 const distance=Math.hypot(a.x-b.x,a.z-b.z);
 if(Math.abs(a.y-b.y)>distance*.8)return false;
 // Sample narrow walls and ramp edges between cells, not just their endpoints.
 for(let i=1;i<4;i++){
  const t=i/4,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=floorAt(grid.world,x,z);
  if(Math.abs(y-(a.y+(b.y-a.y)*t))>1.5)return false;
  if(grid.world.solids.some(s=>!s.broken&&inside({x,z},s,1.25)&&y<(s.y||0)+s.h&&y+2>(s.y||0)))return false;
 }
 return true;
}
function nearest(grid,point){
 let best=-1,distance=Infinity;
 for(let i=0;i<grid.nodes.length;i++){const n=grid.nodes[i];if(!n.clear)continue;const d=(n.x-point.x)**2+(n.z-point.z)**2;if(d<distance){best=i;distance=d;}}
 return best;
}
export function parkRoute(world,from,zoneId){
 const zone=world.zones.find(z=>z.id===zoneId);if(!zone)return [];
 const grid=parkGrid(world),start=nearest(grid,from),end=nearest(grid,zone);
 if(start<0||end<0)return [];
 const costs=new Float64Array(grid.nodes.length).fill(Infinity),previous=new Int32Array(grid.nodes.length).fill(-1),closed=new Uint8Array(grid.nodes.length);
 const heuristic=i=>Math.hypot(grid.nodes[i].x-grid.nodes[end].x,grid.nodes[i].z-grid.nodes[end].z);
 const open=[{id:start,rank:heuristic(start)}];costs[start]=0;
 while(open.length){
  let best=0;for(let i=1;i<open.length;i++)if(open[i].rank<open[best].rank)best=i;
  const {id}=open.splice(best,1)[0];if(closed[id])continue;if(id===end)break;closed[id]=1;
  const a=grid.nodes[id];
  for(const [dx,dz]of moves){
   const col=a.col+dx,row=a.row+dz;if(col<0||row<0||col>=grid.size||row>=grid.size)continue;
   const next=row*grid.size+col,b=grid.nodes[next];if(closed[next]||!canCross(grid,a,b))continue;
   const cost=costs[id]+Math.hypot(dx,dz)*CELL+Math.abs(a.y-b.y)*.2;
   if(cost>=costs[next])continue;costs[next]=cost;previous[next]=id;open.push({id:next,rank:cost+heuristic(next)});
  }
 }
 if(!Number.isFinite(costs[end]))return [];
 const path=[];for(let at=end;at>=0;at=previous[at]){path.push(grid.nodes[at]);if(at===start)break;}
 path.reverse();
 // Drop collinear intermediate nodes while keeping corners and elevation changes.
 return path.filter((p,i)=>{if(!i||i===path.length-1)return true;const a=path[i-1],b=path[i+1];return (p.x-a.x)*(b.z-p.z)!==(p.z-a.z)*(b.x-p.x)||Math.abs((p.y-a.y)-(b.y-p.y))>.1;}).map(({x,y,z})=>({x,y,z}));
}
export function routeCue(player,path,zone){
 if(!zone)return null;
 const arrived=Math.hypot(player.x-zone.x,player.z-zone.z)<10&&Math.abs(player.y-(path.at(-1)?.y??zone.y??0))<3;
 if(arrived)return {arrived:true,distance:0,angle:0};
 if(!path.length)return {unreachable:true};
 let segment=0,offPath=path.length>1?Infinity:Math.hypot(player.x-path[0].x,player.z-path[0].z),projected=path[0];
 for(let i=0;i<path.length-1;i++){
  const a=path[i],b=path[i+1],dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((player.x-a.x)*dx+(player.z-a.z)*dz)/(dx*dx+dz*dz||1)));
  const point={x:a.x+dx*t,z:a.z+dz*t},distance=Math.hypot(player.x-point.x,player.z-point.z);
  if(distance<=offPath){offPath=distance;segment=i;projected=point;}
 }
 let nextIndex=Math.min(segment+1,path.length-1);
 if(nextIndex<path.length-1&&Math.hypot(player.x-path[nextIndex].x,player.z-path[nextIndex].z)<5)nextIndex++;
 const next=path[nextIndex],angle=angleDelta(Math.atan2(next.x-player.x,-(next.z-player.z)),player.yaw);
 const end=path[Math.min(segment+1,path.length-1)];
 const distance=offPath+Math.hypot(projected.x-end.x,projected.z-end.z)+path.slice(segment+2).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[segment+1+i].x,p.z-path[segment+1+i].z),0);
 return {arrived:false,distance:Math.round(distance),angle,offPath};
}

export function challengeProgress(s,id){
 if(s.challengeTimes[id])return 'COMPLETE / +2,500';
 if(id==='damage')return `$${Math.min(12000,Math.round(s.damage)).toLocaleString('en-US')} / $12,000`;
 if(id==='hold')return `${Math.min(30,s.combo.count?Math.floor((s.tick-s.combo.started)/60):0)} / 30 SECONDS`;
 if(id==='food')return `${Math.min(3,s.combo.signs.length)} / 3 SIGNS IN THIS COMBO`;
 if(id==='rug')return `${Math.min(5,s.rugs||0)} / 5 RUGS`;
 if(id==='bag')return `${s.bagZones.length} / 3 ZONES${s.bag?' / BAG COLLECTED':' / FIND THE BAG'}`;
 if(id==='round')return `${Math.min(10,s.combo.count)} / 10 TRICKS IN THIS COMBO`;
 return id==='gap'?'OLLIE THE FOUNTAIN / +2,500':'FIND IT / +2,500';
}
