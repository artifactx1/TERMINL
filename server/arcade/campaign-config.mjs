import {TRACKS,VEHICLES} from '../../lib/arcade/race-sim.mjs';
import {DEFAULT_CAMPAIGN} from '../../lib/arcade/campaign-rules.mjs';

/** Validates admin settings. Older stored settings gain new defaults; retired keys are dropped. */
export function campaignConfig(input){
  const c={...DEFAULT_CAMPAIGN,...input};
  if(typeof c.active!=='boolean'||typeof c.name!=='string'||!c.name.trim()||c.name.length>60)throw new Error('Invalid campaign name or state');
  if(typeof c.cupEnabled!=='boolean'||typeof c.rumbleEnabled!=='boolean')throw new Error('Invalid route setting');
  if(c.active&&!c.cupEnabled&&!c.rumbleEnabled)throw new Error('Enable the Barry Cup or the Rekt Rumble Circuit before opening the campaign');
  if(!Object.hasOwn(TRACKS,c.track)||!Object.hasOwn(VEHICLES,c.vehicle)||!Object.hasOwn(VEHICLES,c.botVehicle))throw new Error('Unknown track or vehicle');
  if(!Number.isFinite(c.botPace)||c.botPace<.55||c.botPace>1.1)throw new Error('Bot pace must be between 0.55 and 1.1');
  if(!Number.isInteger(c.capacity)||c.capacity<1||c.capacity>100000)throw new Error('Capacity must be 1–100,000');
  for(const key of ['startsAt','endsAt','addressStartsAt','addressEndsAt'])if(!Number.isSafeInteger(c[key])||c[key]<0)throw new Error('Invalid campaign date');
  if(c.endsAt&&c.endsAt<=c.startsAt||c.addressEndsAt&&c.addressEndsAt<=c.addressStartsAt)throw new Error('Window must end after it starts');
  if(c.chainId!==4663)throw new Error('This campaign accepts Robinhood Chain mainnet addresses');
  if(c.announcementUrl){let url;try{url=new URL(c.announcementUrl);}catch{throw new Error('Invalid announcement URL');}if(url.protocol!=='https:'||!['x.com','www.x.com','terminl.net','www.terminl.net'].includes(url.hostname))throw new Error('Use a TERMINL or X announcement URL');}
  return Object.fromEntries(Object.keys(DEFAULT_CAMPAIGN).map(k=>[k,c[k]]));
}
