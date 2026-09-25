// Broad, connected districts surrounding the original mall. Coordinates are also
// used by the map, route markers and deterministic course checks.
export const PARK_BOUNDS=196;
export const PARK_ZONES=[
 {id:'bowl',name:'LIQUIDITY BOWL',x:-140,z:0,w:112,d:168,y:0,color:'#365f61'},
 {id:'mega',name:'ATH TRANSFER',x:0,z:-140,w:168,d:112,y:0,color:'#867459'},
 {id:'rails',name:'DIAMOND RAIL YARD',x:140,z:0,w:112,d:168,y:0,color:'#4e655f'},
 {id:'street',name:'AFTERMARKET PLAZA',x:0,z:140,w:168,d:112,y:0,color:'#71666d'},
 {id:'garden',name:'TOUCH GRASS',x:-140,z:140,w:112,d:112,y:0,color:'#476751'},
 {id:'canal',name:'THE ORDER BOOK',x:140,z:140,w:112,d:112,y:0,color:'#3b5c67'},
 {id:'roofs',name:'SKYLINE',x:140,z:-140,w:112,d:112,y:0,color:'#5a627d'},
 {id:'snake',name:'SNAKE RUN',x:-140,z:-140,w:112,d:112,y:0,color:'#685b76'},
];
export const PARK_GAPS=[
 {id:'ath',name:'ALL TIME HANGTIME',axis:'z',line:-139,cross:'x',min:-12,max:12,width:8,points:1800},
 {id:'fountain',name:'EXIT LIQUIDITY',axis:'z',line:0,cross:'x',min:-7,max:7,width:10,points:1200},
 {id:'street',name:'CLOSED MARKET',axis:'x',line:0,cross:'z',min:125,max:143,width:10,points:1000},
 {id:'canal',name:'BRIDGE THE SPREAD',axis:'x',line:140,cross:'z',min:119,max:139,width:10,points:1600},
 {id:'snake',name:'SNAKE EYES',axis:'z',line:-140,cross:'x',min:-153,max:-127,width:9,points:1300},
];
export const PARK_ROUTES=[
 {id:'concourse',name:'MIDNIGHT EXPRESS',color:'#c4ed9b',points:2500,gates:[{x:0,z:30},{x:-44,z:30},{x:-90,z:30},{x:-105,z:-45},{x:0,z:-94},{x:88,z:-28},{x:90,z:45},{x:0,z:80}]},
 {id:'outer',name:'AFTER HOURS TOUR',color:'#ddb1f6',points:5000,gates:[{x:0,z:102},{x:-100,z:140},{x:-178,z:54},{x:-178,z:-95},{x:-70,z:-177},{x:95,z:-177},{x:176,z:-60},{x:176,z:100},{x:60,z:176}]},
];
export function extendPark(world){
 const {floors,rails,props,labels}=world;
 world.bounds=PARK_BOUNDS;world.zones=[...world.zones,...PARK_ZONES];world.gaps=PARK_GAPS;world.routes=PARK_ROUTES;
 for(const z of PARK_ZONES){floors.push({...z,surface:z.id,override:true,...(z.id==='bowl'?{bowl:{radius:30,depth:7.5}}:{})});labels.push({x:z.x,z:z.z-35,y:9,text:z.name,color:z.id==='mega'?'#efd699':'#b5ecd3'});}
 const ramp=(id,x,z,w,d,height,axis='z',reverse=false,curve='linear')=>floors.push({id,x,z,w,d,y:reverse?height:0,rise:reverse?-height:height,axis,curve,color:'#987957'});
 ramp('roof-north-access',56,-96,18,24,8);ramp('roof-east-access',96,-56,24,18,8,'x',true);
 floors.push({id:'basement-east-access',x:88,z:56,w:24,d:18,y:-4,rise:4,axis:'x',override:true},{id:'basement-south-access',x:56,z:88,w:18,d:24,y:-4,rise:4,override:true});
 // Generous transfer decks with long runups and matching landings.
 ramp('ath-takeoff',0,-120,24,28,7,'z',true,'quarter');ramp('ath-landing',0,-158,28,28,7);
 ramp('street-takeoff',-13,134,16,18,3.2,'x');ramp('street-landing',13,134,16,18,3.2,'x',true);
 ramp('spread-takeoff',126,129,18,22,4.8,'x');ramp('spread-landing',154,129,18,22,4.8,'x',true);
 ramp('snake-takeoff',-140,-128,24,14,4,'z',true);ramp('snake-landing',-140,-152,24,14,4);
 for(const x of [-170,-110])ramp(`snake-bank-${x}`,x,-169,18,22,3,'z');
 for(const z of [-164,-110])ramp(`sky-bank-${z}`,140,z,32,20,5,'z',z===-164);
 // Runoff banks return the perimeter to play; no sudden invisible boundary bail.
 for(const v of [-140,-56,28,112]){
  ramp(`north-${v}`,v,-188,78,16,6,'z',true,'quarter');ramp(`south-${v}`,v,188,78,16,6,'z',false,'quarter');
  ramp(`west-${v}`,-188,v,16,78,6,'x',true,'quarter');ramp(`east-${v}`,188,v,16,78,6,'x',false,'quarter');
 }
 for(const [i,x]of [113,140,167].entries()){
  rails.push({id:`diamond-${i}`,x,z:-45,bx:x,bz:40,y:1+i*.35});
  ramp(`rail-entry-${i}`,x,48,10,12,1.6+i*.35,'z',true);
 }
 for(const side of [-1,1])for(let i=0;i<5;i++)floors.push({id:`plaza-step-${side}-${i}`,x:side*35,z:111+i*1.8,w:18,d:1.8,y:.24+i*.24,surface:'street'});
 rails.push({id:'plaza-ledge',x:-64,z:159,bx:61,bz:159,y:1.1},{id:'garden-line',x:-172,z:127,bx:-109,bz:153,y:1.1},{id:'skyline',x:108,z:-140,bx:172,bz:-140,y:1.2});
 for(const [i,z]of PARK_ZONES.entries())for(const side of [-1,1]){
  props.push({id:`park-prop-${i}-${side}`,kind:i%2?'bench':'planter',x:z.x+side*(z.w/2-12),z:z.z+z.d/2-18,y:0,w:3,d:2,h:2,value:300,color:'#9ba57e',zone:z.id});
 }
 return world;
}
