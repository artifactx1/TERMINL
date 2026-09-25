export const RUG_LEVELS=[
 {id:'presale',name:'PRESALE',subtitle:'Get in line. Break the queue.',color:'#596768',accent:'#b2ce80',mechanic:'Whitelist terminals',objective:'Activate both wallet terminals, then reach the exit.',enemyTypes:['bot','bot','sybil'],switchLabel:'WALLET TERMINAL'},
 {id:'pool',name:'LIQUIDITY POOL',subtitle:'Something is trading down there.',color:'#286b71',accent:'#5df8ba',mechanic:'Drain the pool',objective:'Open both drains. The water conceals a shortcut.',enemyTypes:['bot','sybil','sniper'],switchLabel:'DRAIN CONTROL'},
 {id:'book',name:'ORDER BOOK',subtitle:'The floor has a spread.',color:'#355458',accent:'#e67884',mechanic:'Moving bid / ask floors',objective:'Lock both sides of the order book to stabilize the exit.',enemyTypes:['sniper','bagholder','moderator'],switchLabel:'LOCK ORDER'},
 {id:'mempool',name:'MEMPOOL',subtitle:'Pending. Forever.',color:'#58617b',accent:'#c39bef',mechanic:'Reroute conveyors',objective:'Redirect two routers. Use the belts to outrun the packets.',enemyTypes:['bot','influencer','manager'],switchLabel:'ROUTING SWITCH'},
 {id:'bridge',name:'THE BRIDGE',subtitle:'There is no other side.',color:'#4e5c6b',accent:'#e8ba73',mechanic:'Bridge paused',objective:'Restart both relays, then cross the broken spans.',enemyTypes:['whale','sniper','bagholder'],switchLabel:'CHAIN RELAY'},
 {id:'cold',name:'COLD STORAGE',subtitle:'Power was off for a reason.',color:'#789ca4',accent:'#b7eaf8',mechanic:'Restore power',objective:'Restore two power feeds. The vault will wake up.',enemyTypes:['bagholder','moderator','sybil'],switchLabel:'POWER FEED'},
 {id:'exit',name:'EXIT LIQUIDITY',subtitle:'Everything is fine.',color:'#617f65',accent:'#b7ff8b',mechanic:'False paradise',objective:'Remove both false signals. Follow the cracks.',enemyTypes:['influencer','manager','whale'],switchLabel:'FALSE SIGNAL'},
 {id:'wallet',name:'DEV WALLET',subtitle:'The developer is still here.',color:'#766548',accent:'#ffd58e',mechanic:'THE RUG',objective:'Unlock the vault. Find the DEV. Be ready to run.',enemyTypes:['whale','moderator','sniper'],switchLabel:'VAULT LOCK'},
];
export const ENEMIES={bot:{hp:45,speed:3,damage:5,color:'#b37877'},sybil:{hp:85,speed:3.5,damage:6,color:'#b791d4'},sniper:{hp:70,speed:1,damage:18,color:'#adbf81'},whale:{hp:360,speed:1.7,damage:18,color:'#6aa3b0'},bagholder:{hp:190,speed:2.2,damage:11,color:'#b39c69'},influencer:{hp:100,speed:2.4,damage:5,color:'#e698b4'},moderator:{hp:120,speed:2,damage:9,color:'#bba5d5'},manager:{hp:90,speed:3,damage:5,color:'#93cbbc'}};
export function spawnEnemy(type,x,z,index,y=0){return {...ENEMIES[type],type,x,y,z,id:`enemy-${index}`,hp:ENEMIES[type].hp,cooldown:80+index*13,telegraph:0,split:false};}
export function makeRugWorld(level=0,allTapes=false){
 const spec=RUG_LEVELS[level],floors=Array.from({length:9},(_,i)=>({id:`floor-${i}`,x:0,z:28-i*14,w:70,d:14,y:0,color:spec.color})),solids=[],labels=[{x:0,y:6,z:16,text:spec.name,color:spec.accent}],pickups=[],switches=[],secrets=[],enemies=[];
 const wall=(id,x,z,w,d,h=7,y=0,color='#263b43')=>solids.push({id,x,z,w,d,h,y,color});
 for(const side of [-1,1])for(let i=0;i<3;i++){const z=8-i*34;wall(`boundary-${side}-${i}`,side*35,z+10,2,27,12);wall(`boundary-tail-${side}`,side*35,-85,2,14,12);}for(const side of [-1,1]){wall(`boundary-bottom-${side}`,side*35,-73,2,12,12);wall(`boundary-top-${side}`,side*35,33,2,5,12);}wall('start',0,35,72,2,12);wall('end',0,-91,72,2,12);
 // Three encounter chambers; central and side lanes form real flanking loops.
 for(let room=0;room<3;room++){
  const z=8-room*34;wall(`left-pier-${room}`,-12,z,4,10,5);wall(`right-pier-${room}`,12,z,4,10,5);wall(`divider-left-${room}`,-25,z-14,18,2,7);wall(`divider-right-${room}`,25,z-14,18,2,7);
  floors.push({x:0,z:z-5,w:14,d:8,y:0,rise:2,color:'#8b9d91'},{x:-26,z:z+3,w:10,d:12,y:0,rise:2.5,color:'#768b84'});
  for(let i=0;i<5+level;i++){const x=[0,-22,22,-5,5,-28,28][i%7],ez=z-(i<3?0:8)+(i%2)*4;enemies.push(spawnEnemy(spec.enemyTypes[i%spec.enemyTypes.length],x,ez,enemies.length));}
  for(const [j,type]of ['health','armor','shells','gwei'].entries())pickups.push({id:`pickup-${room}-${j}`,type,x:j%2?-22:22,z:z+7-(j>1?10:0),y:0,amount:type==='health'?30:type==='armor'?35:type==='shells'?12:70});
  const secret={id:`secret-${room}`,secret:true,x:room%2?-31:31,z:z-5,y:0,method:room===0?'shoot':room===1?'jump':'interact'};secrets.push(secret);
  const side=room%2?-1:1;secret.panelId=`secret-door-${room}`;secret.roomX=side*40;secret.roomZ=secret.z;wall(secret.panelId,side*35,secret.z,2,7,6,0,'#66547f');floors.push({id:`secret-floor-${room}`,x:side*40,z:secret.z,w:10,d:10,y:0,color:'#654f78'});wall(`secret-back-${room}`,side*45,secret.z,1,12,7);wall(`secret-side-a-${room}`,side*40,secret.z-5,10,1,7);wall(`secret-side-b-${room}`,side*40,secret.z+5,10,1,7);
  // Seal the unused alcove on the opposite wall.
  wall(`sealed-${room}`,-side*35,secret.z,2,7,12);
  pickups.push({id:`weapon-${room}`,type:'weapon',weapon:Math.min(7,room+1+Math.floor(level/2)),x:room%2?-24:24,z:z-9,y:0,amount:1});
 }
 switches.push({id:'switch-a',x:-27,z:-18,y:0,label:spec.switchLabel},{id:'switch-b',x:27,z:-56,y:0,label:spec.switchLabel});
 const exit={x:0,z:-85,y:0};
 if(level===1){floors.push({id:'pool-water',x:0,z:-27,w:18,d:50,y:.04,color:'#38d6b0'});labels.push({x:0,z:-23,y:7,text:'DRAIN BEFORE DIVING',color:'#9effdb'});wall('drain-gate',0,-42,18,1,2,0,'#476b66');wall('pump-a',-31,-25,3,6,3);wall('pump-b',31,-60,3,6,3);}
 if(level===2){for(let i=0;i<6;i++)floors.push({id:`bid-${i}`,x:i%2?-6:6,z:-12-i*10,w:8,d:6,y:2.4,color:i%2?'#b84e6b':'#59a77b'});}
 if(level===3){for(let i=0;i<3;i++)floors.push({x:i%2?-22:22,z:-10-i*22,w:7,d:24,y:.05,color:'#b79b4f'});}
 if(level===4){floors[0].color='#222d40';for(let i=0;i<7;i++)floors.push({id:`span-${i}`,x:0,z:20-i*15,w:18,d:12,y:.12,color:'#8b929a'});}
 if(level===5){floors.forEach(f=>f.color='#9ecad2');for(let i=0;i<10;i++)wall(`server-${i}`,i%2?-29:29,20-i*10,3,5,4,0,'#59788b');}
 if(level===7){for(let i=0;i<8;i++)wall(`treasure-${i}`,i%2?-19:19,20-i*13,5,5,2,0,'#b29c65');labels.push({x:0,z:-74,y:5,text:'REMOVE LIQUIDITY',color:'#f3a493'});}
 if(allTapes)secrets.push({id:'vhs-room',secret:true,x:0,z:-88,y:0,method:'interact'});
 return {base:0,floors,solids,labels,pickups,switches,secrets,enemies,exit,spawn:{x:0,z:27,y:0,yaw:0,pitch:0},spec};
}
