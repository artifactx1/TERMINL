import {extendPark} from './mall-park.mjs';
// Legacy IDs retain existing saves and character perks.
export const SKATERS=[
 {id:'max',art:'margin-call-max',name:'MARGIN CALL MAX',trait:'Faster meter. Bigger wipeouts.',special:'100X LEVERAGE',color:'#d179e8'},
 {id:'barry',art:'diamond-hands-pepe',name:'DIAMOND HANDS PEPE',trait:'More forgiveness on rails.',special:'DIAMOND LINE',color:'#a7e690'},
 {id:'pigeon',art:'mev-mia',name:'MEV MIA',trait:'More control in the air.',special:'SANDWICH ATTACK',color:'#ffad65'},
 {id:'paul',art:'cold-storage-chloe',name:'COLD STORAGE CHLOE',trait:'Safe banks pay 5% more.',special:'COLD WALLET',color:'#7bdded'}
];
export const ZONES=[{id:'atrium',name:'MAIN ATRIUM',x:0,z:0,color:'#766d76',y:0},{id:'garage',name:'PARKING GARAGE',x:56,z:0,color:'#566168',y:0},{id:'food',name:'FOOD COURT',x:-56,z:0,color:'#8a7060',y:0},{id:'arcade',name:'TERMINL ARCADE',x:-56,z:-56,color:'#514e78',y:0},{id:'store',name:'DEPARTMENT STORE',x:0,z:-56,color:'#806878',y:0},{id:'roof',name:'ROOFTOP',x:56,z:-56,color:'#566b70',y:8},{id:'theater',name:'MOVIE THEATER',x:-56,z:56,color:'#574866',y:0},{id:'service',name:'SERVICE CORRIDORS',x:0,z:56,color:'#4b645e',y:0},{id:'basement',name:'SUB-BASEMENT',x:56,z:56,color:'#364946',y:-4}];
export const MALL_CHALLENGES=[{id:'gap',name:'EXIT LIQUIDITY',hint:'Ollie across the fountain.'},{id:'damage',name:'REKT',hint:'Cause $12,000 property damage.'},{id:'hold',name:'NO SELL',hint:'Hold one combo for 30 seconds.'},{id:'roof',name:'ALL TIME HIGH',hint:'Ride the garage ramp to the rooftop.'},{id:'service',name:'INSIDER',hint:'Find the employee passage.'},{id:'round',name:'ROUND TRIP',hint:'Bank a 10-trick combo near its start.'},{id:'food',name:'FOOD FIGHT',hint:'Break all 3 food signs in one combo.'},{id:'rug',name:'RUGGED',hint:'Unravel 5 carpet displays.'},{id:'grass',name:'TOUCH GRASS',hint:'Find the garden behind the theater.'},{id:'bag',name:'BAGHOLDER',hint:'Collect the bag, carry it through 3 zones.'}];
export function makeMall(){
 const floors=ZONES.map(z=>({...z,w:56,d:56,override:z.id==='basement'}));
 floors.push({x:56,z:-21,w:12,d:20,y:8,rise:-8,color:'#a9ac98'}, {x:56,z:23,w:14,d:20,y:0,rise:-4,override:true,color:'#586456'}, {x:0,z:0,w:10,d:10,y:.1,color:'#65c6bd'});
 const solids=[];
 const rails=[],props=[],ramps=[],tapes=[],labels=[];
 for(const [zi,zone]of ZONES.entries()){
  const {x,z,y}=zone;
  for(const side of [-1,1])solids.push({x:x+side*24,z:z-17,w:2,d:8,h:6,y,color:'#34454e'});
  rails.push({id:`${zone.id}-rail`,x:x-17,z:z+14,bx:x+17,bz:z+14,y:y+.8});
  ramps.push({x:x-12,z:z+5,w:7,d:6,y,rise:2.5,color:'#baa48b'},{x:x+13,z:z-12,w:6,d:5,y:y+2.1,rise:-2.1,color:'#9e9597'});
  labels.push({x,z:z-22,y:y+6,text:zone.name,color:zi===3?'#ed87ff':'#a7ffd2'});
  const kinds={atrium:['bench','planter','glass elevator'],garage:['car','security barrier','shopping cart'],food:['restaurant sign','vending machine','table'],arcade:['WEN LAMBO','REKT RUMBLE','MOON MISSION'],store:['mannequin','clothing rack','perfume counter'],roof:['HVAC','satellite dish','skylight'],theater:['poster case','ticket counter','concessions'],service:['pipes','utility cabinet','loading crate'],basement:['CRT terminal','server','cage']}[zone.id];
  for(let i=0;i<9;i++)props.push({id:`prop-${zi}-${i}`,kind:kinds[i%3],x:x-19+(i%3)*18,z:z-15+Math.floor(i/3)*14,y,w:i%3===0?3:2,d:1.7,h:i%3===0?2.1:1.5,value:250+(i%3)*300,color:['#d0a879','#75baa5','#ac7795'][i%3],zone:zone.id});
  tapes.push({id:zone.id,x:x+20,z:z-18,y:y+1});
 }
 for(let i=0;i<5;i++)props.push({id:`carpet-${i}`,kind:'carpet',x:-20+i*9,z:-43,y:0,w:5,d:8,h:.15,value:1200,color:'#b15686',zone:'store'});
 props.push({id:'rug-cabinet',kind:'RUG.EXE',x:-35,z:-75,y:0,w:2,d:2,h:3,value:0,color:'#7bff32',zone:'arcade',unbreakable:true});
 // A long, continuous beginner rail and roof access create two readable routes.
 rails.push({id:'garage-line',x:24,z:8,bx:78,bz:8,y:.8},{id:'roof-edge',x:34,z:-35,bx:78,bz:-35,y:8.8},{id:'fountain',x:-9,z:4,bx:9,bz:4,y:1.1});
 // A readable opening line: bank over the fountain, land and link the far rail.
 ramps.push({x:0,z:9,w:6,d:5,y:2.2,rise:-2.2},{x:0,z:-9,w:6,d:5,y:0,rise:2.2});
 const entryPlanter=props.find(p=>p.id==='prop-0-7');entryPlanter.x=-8;
 floors.push(...ramps);
 return extendPark({base:0,floors,solids,rails,props,tapes,labels,zones:ZONES.map(z=>({...z,w:56,d:56})),spawn:{x:0,z:20,y:0,yaw:0}});
}
