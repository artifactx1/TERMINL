import {lineBlocked} from './math.mjs';

/** Walkable grid for objective guidance: 2m cells inside the arena walls. */
const STEP=2,MIN_X=-34,MAX_X=34,MIN_Z=-92,MAX_Z=34,PAD=.8;
const grids=new WeakMap();
function gridFor(world){
  const broken=world.solids.filter(b=>b.broken).length,cached=grids.get(world);
  if(cached&&cached.broken===broken)return cached;
  const cols=(MAX_X-MIN_X)/STEP+1,rows=(MAX_Z-MIN_Z)/STEP+1,open=new Uint8Array(cols*rows);
  for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){
    const x=MIN_X+c*STEP,z=MIN_Z+r*STEP;
    open[c*rows+r]=world.solids.some(b=>!b.broken&&Math.abs(x-b.x)<b.w/2+PAD&&Math.abs(z-b.z)<b.d/2+PAD)?0:1;
  }
  const grid={cols,rows,open,broken};grids.set(world,grid);return grid;
}
/** Clear for a body, not just a line: checks the centre line and both shoulders. */
function walkable(a,b,solids){
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,ox=-dz/len*.7,oz=dx/len*.7;
  return [0,1,-1].every(side=>!lineBlocked({...a,x:a.x+ox*side,z:a.z+oz*side},{...b,x:b.x+ox*side,z:b.z+oz*side},solids));
}
const cellOf=(grid,p)=>({c:Math.max(0,Math.min(grid.cols-1,Math.round((p.x-MIN_X)/STEP))),r:Math.max(0,Math.min(grid.rows-1,Math.round((p.z-MIN_Z)/STEP)))});
const pointOf=(c,r)=>({x:MIN_X+c*STEP,z:MIN_Z+r*STEP});
/** The point to head for next on the way to `goal`: the farthest step of the walkable
 * route that is in plain sight, so guidance turns corners instead of pointing into
 * walls. Falls back to the goal itself when no route is found. */
export function nextWaypoint(world,from,goal){
  const eye={x:from.x,y:(from.y||0)+1.4,z:from.z},target={...goal,y:(goal.y||0)+1.2};
  if(walkable(eye,target,world.solids))return goal;
  const grid=gridFor(world),start=cellOf(grid,from),end=cellOf(grid,goal),key=(c,r)=>c*grid.rows+r;
  const previous=new Int32Array(grid.cols*grid.rows).fill(-1),queue=[key(start.c,start.r)];previous[queue[0]]=queue[0];
  let found=-1;
  for(let i=0;i<queue.length;i++){
    const k=queue[i],c=Math.floor(k/grid.rows),r=k%grid.rows;
    if(c===end.c&&r===end.r){found=k;break;}
    for(const [dc,dr]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nc=c+dc,nr=r+dr,n=key(nc,nr);
      if(nc<0||nr<0||nc>=grid.cols||nr>=grid.rows||previous[n]!==-1)continue;
      // The goal cell may sit beside a wall (terminals do); everything else must be open.
      if(!grid.open[n]&&!(nc===end.c&&nr===end.r))continue;
      previous[n]=k;queue.push(n);
    }
  }
  if(found<0)return goal;
  const path=[];for(let k=found;k!==previous[k];k=previous[k])path.unshift(pointOf(Math.floor(k/grid.rows),k%grid.rows));
  let next=path[0]||goal;
  for(const point of path){if(!walkable(eye,{...point,y:eye.y},world.solids))break;next=point;}
  return next;
}
