// Authored runups face a useful first feature. Timed runs always use the atrium.
export const PRACTICE_SPOTS=[
 {id:'atrium',x:0,z:20,yaw:0,hint:'Push straight ahead. Hold JUMP off the fountain bank.'},
 {id:'garage',x:44,z:23,yaw:0,hint:'Ollie north onto the long garage rail. Hold GRIND to catch.'},
 {id:'food',x:-56,z:20,yaw:0,hint:'Jump the food-court rail. Link a manual through the tables.'},
 {id:'arcade',x:-56,z:-36,yaw:0,hint:'Catch the rail ahead, then weave between the cabinets.'},
 {id:'store',x:0,z:-36,yaw:0,hint:'Link the front rail and the carpet displays into one combo.'},
 {id:'roof',x:56,z:-36,yaw:0,hint:'Turn along the roof-edge rail or explore the rooftop banks.'},
 {id:'theater',x:-56,z:76,yaw:0,hint:'Ollie onto the rail ahead. Manual into the concessions.'},
 {id:'service',x:0,z:76,yaw:0,hint:'Link the service rail and loading crates. Keep a manual on landing.'},
 {id:'basement',x:56,z:76,yaw:0,hint:'Skate the lower rail, then take an access ramp back outside.'},
 {id:'bowl',x:-140,z:10,yaw:0,hint:'Build speed through the bowl. Hold JUMP on the far transition.'},
 {id:'mega',x:6,z:-94,yaw:0,hint:'Push straight up the big ramp. Hold JUMP at the lip, then flip.'},
 {id:'rails',x:140,z:66,yaw:0,hint:'Push onto the entry ramp holding GRIND. Jump + steer to transfer.'},
 {id:'street',x:-40,z:134,yaw:Math.PI/2,hint:'Push straight across the paired banks. Land beyond the gap.'},
 {id:'garden',x:-180,z:124,yaw:Math.atan2(63,-26),hint:'Ollie toward the diagonal rail. Hold GRIND to catch it.'},
 {id:'canal',x:100,z:129,yaw:Math.PI/2,hint:'Build speed up the wide bank and clear the canal spread.'},
 {id:'roofs',x:140,z:-90,yaw:0,hint:'Jump from the bank ahead. Turn across the central skyline rail.'},
 {id:'snake',x:-140,z:-100,yaw:0,hint:'Ride straight through the paired banks. Jump the middle gap.'},
];
export function practiceStart(world,id){
 const spot=PRACTICE_SPOTS.find(s=>s.id===id)||PRACTICE_SPOTS[0];
 return {...spot,name:world.zones.find(z=>z.id===spot.id).name};
}
