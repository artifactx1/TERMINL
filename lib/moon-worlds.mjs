// Authored routes, shared by the simulation, renderer and world selector.
// Every ground gap is double-jumpable; elevated paths are optional gem routes.
const destinations = [
  {name:"Degen District",biome:"city",tag:"THE ORIGINAL",brief:"Stomp the candles. Learn the double jump. Catch your first rocket.",sky:["#090e28","#254659"],accent:"#98f6ac",rock:"#233e42",edge:"#8dbb95",hazard:"#ff657c"},
  {name:"Neon Rooftops",biome:"city",tag:"ROOFTOP RUN",brief:"Take the high road for gems. Pink bridges disappear beneath your feet.",sky:["#170d35","#5a3069"],accent:"#ff9bdc",rock:"#322746",edge:"#cb8bd3",hazard:"#ff676f",
    ground:[[0,720],[900,1530],[1740,2390],[2590,3260],[3500,4400]],tiers:[[260,365,150],[510,275,130],[1080,370,180],[1320,280,150],[1900,365,170],[2180,270,150],[2760,370,150],[3000,280,160],[3660,370,170],[3910,275,160]]},
  {name:"Emerald Overgrowth",biome:"forest",tag:"LOST IN THE GREEN",brief:"Follow fireflies through the forgotten forest. Gem trails hide above the roots.",sky:["#061f26","#276f58"],accent:"#a9ff86",rock:"#21443e",edge:"#8edc81",hazard:"#db7398",
    ground:[[0,810],[970,1800],[2000,2750],[2940,3730],[3930,4900]],tiers:[[300,380,190],[550,285,170],[1170,355,180],[1440,260,190],[2130,380,200],[2430,285,160],[3100,355,210],[3420,265,170],[4100,370,190],[4380,275,180]]},
  {name:"Diamond Caverns",biome:"crystal",tag:"GEM HUNTER",brief:"Glowing crystals light the way. Chain double jumps to raid the upper shelves.",sky:["#0c092a","#303a78"],accent:"#bdaaff",rock:"#242b50",edge:"#a39ae2",hazard:"#f176cc",
    ground:[[0,690],[890,1550],[1780,2530],[2740,3510],[3740,4700]],tiers:[[220,375,140],[440,285,160],[1080,370,170],[1350,270,150],[1950,360,180],[2220,260,190],[2900,370,160],[3170,275,180],[3900,365,160],[4170,270,170]]},
  {name:"Sunset Dunes",biome:"desert",tag:"GOLD RUSH",brief:"Cross the sun-baked ruins. Long leaps beat a shortcut into the molten sand.",sky:["#331e43","#da8060"],accent:"#ffdb96",rock:"#68414b",edge:"#e6b878",hazard:"#ff945e",
    ground:[[0,920],[1150,1810],[2050,2860],[3110,3980],[4230,5300]],tiers:[[360,370,180],[650,275,150],[1300,360,200],[1600,270,140],[2240,380,180],[2540,290,180],[3270,365,170],[3590,275,190],[4410,370,180],[4700,270,150]]},
  {name:"Cold Storage",biome:"ice",tag:"FROZEN ASSETS",brief:"A frozen station at the edge of nowhere. Trust the bright platform edges.",sky:["#0b1835","#477e99"],accent:"#b5f7ff",rock:"#294965",edge:"#c0f3f9",hazard:"#fb8aa7",
    ground:[[0,730],[940,1590],[1820,2480],[2720,3390],[3630,4330],[4560,5400]],tiers:[[250,375,150],[490,275,150],[1100,365,170],[1380,270,130],[1980,370,180],[2260,275,140],[2850,375,160],[3110,280,170],[3780,370,150],[4040,275,160],[4750,355,200]]},
  {name:"Liquidation Foundry",biome:"lava",tag:"HOT WALLET",brief:"The floor is literally lava. Keep moving when a bridge starts flashing.",sky:["#220e23","#8a393e"],accent:"#ffbb76",rock:"#3c303d",edge:"#f6a079",hazard:"#ff793f",
    ground:[[0,670],[900,1480],[1720,2350],[2600,3290],[3530,4160],[4420,5300]],tiers:[[220,370,140],[440,275,150],[1050,380,170],[1320,280,130],[1870,365,180],[2140,265,140],[2770,375,160],[3050,275,150],[3690,360,170],[3960,270,150],[4590,370,180],[4880,275,140]]},
  {name:"Cloud Nine",biome:"cloud",tag:"HIGHER THAN ATH",brief:"Run the sky islands. The bridges are temporary; the view is priceless.",sky:["#243a76","#e0adc6"],accent:"#ffe4ff",rock:"#666081",edge:"#f5e6fc",hazard:"#dd6cab",
    ground:[[0,620],[850,1430],[1660,2270],[2510,3100],[3340,3950],[4190,5100]],tiers:[[210,380,150],[430,285,130],[1000,370,160],[1250,270,140],[1820,380,180],[2080,280,130],[2640,365,180],[2920,270,130],[3500,380,150],[3760,285,130],[4370,365,180],[4650,265,150]]},
  {name:"Orbital Shipyard",biome:"station",tag:"FINAL DEPARTURE",brief:"Dash across the orbital docks. Grab a shield before the last boarding call.",sky:["#050f27","#214d68"],accent:"#8cf4eb",rock:"#263d51",edge:"#85d8dc",hazard:"#fa849f",
    ground:[[0,770],[1000,1640],[1890,2530],[2780,3400],[3660,4370],[4620,5600]],tiers:[[250,370,170],[520,270,150],[1160,360,170],[1440,260,150],[2050,375,180],[2320,275,150],[2930,370,170],[3190,270,140],[3820,365,180],[4090,265,170],[4800,375,190],[5080,275,170]]},
  {name:"Tranquility Base",biome:"moon",tag:"THE MOON. FINALLY.",brief:"One final gauntlet across lunar ruins. Plant your flag and bring the terminal home.",sky:["#080c24","#434d7a"],accent:"#e0dcff",rock:"#3d435d",edge:"#c0c6dd",hazard:"#b97bfd",
    ground:[[0,690],[930,1530],[1790,2440],[2700,3330],[3590,4250],[4510,5160],[5420,6400]],tiers:[[230,370,150],[460,270,150],[1090,375,170],[1360,275,130],[1970,360,180],[2220,260,170],[2850,370,180],[3120,270,140],[3760,365,170],[4010,265,150],[4680,375,170],[4930,275,150],[5600,370,190],[5890,270,170]]},
];

export function createMoonWorlds(original) {
  return destinations.map((world,level)=>{
    if(!level)return {...world,...original,level,width:5100,finish:4950};
    const {ground,tiers}=world,width=ground.at(-1)[1];
    const platforms=[
      ...ground.map(([x,end],i)=>({id:`floor-${i}`,x,y:470,w:end-x,h:100})),
      ...tiers.map(([x,y,w],i)=>({id:`p${i}`,x,y,w,h:26})),
      ...ground.slice(0,-1).map(([,end],i)=>({id:`rug${i}`,x:end+45,y:395+(i%2)*10,w:ground[i+1][0]-end-80,h:22,rug:true})),
    ];
    const pickups=[
      ...ground.flatMap(([start,end],i)=>Array.from({length:Math.floor((end-start-160)/100)},(_,j)=>({id:`c-${i}-${j}`,x:start+120+j*100,y:431,kind:"coin"}))),
      ...platforms.filter(p=>!p.id.startsWith("floor")).flatMap(p=>[0,1,2].map(i=>({id:`top-${p.id}-${i}`,x:p.x+p.w*(i+1)/4,y:p.y-32,kind:i===1&&p.y<=290?"gem":"coin"}))),
      ...[tiers[1],tiers[Math.floor(tiers.length/2)]].map(([x,y,w],i)=>({id:`shield${i}`,x:x+w/2,y:y-60,kind:"shield"})),
    ];
    const enemies=ground.flatMap(([start,end],i)=>{
      const homes=[start+Math.min(420,(end-start)*.6)];
      if(level>=5&&i>0&&end-start>750)homes.push(end-180);
      return homes.map((x,j)=>({id:`e${i}-${j}`,home:x,x,y:438,w:32,h:32}));
    });
    return {...world,level,width,finish:width-150,platforms,pickups,enemies,checkpoints:ground.slice(1).map(([start])=>start+70)};
  });
}
