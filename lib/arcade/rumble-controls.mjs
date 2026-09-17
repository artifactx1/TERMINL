export const CONTROL_VERSION=2;
export const DEFAULT_KEYS=Object.freeze({a:1,d:2,w:4,s:8,j:16,k:32,l:64,' ':128,u:256,i:512,o:1024,ArrowLeft:1,ArrowRight:2,ArrowUp:4,ArrowDown:8});
const LEGACY_KEYS={ArrowLeft:1,ArrowRight:2,ArrowUp:4,ArrowDown:8,j:16,k:32,l:64,Shift:128,q:256,e:512,r:1024};
export const FIGHT_ACTIONS=Object.freeze([[16,'PUNCH','light'],[32,'KICK','heavy'],[64,'SPECIAL','special'],[128,'BLOCK','guard'],[256,'DASH','dash'],[512,'GRAB','throw'],[1024,'SUPER','super']]);
export const ACTIONS=Object.freeze([[1,'Left'],[2,'Right'],[4,'Jump'],[8,'Crouch'],...FIGHT_ACTIONS.map(([bit,label])=>[bit,label[0]+label.slice(1).toLowerCase()])]);
export function savedRumbleKeys(saved){
  const map=saved?.keys;
  if(!map||typeof map!=='object'||Array.isArray(map))return {...DEFAULT_KEYS};
  const entries=Object.entries(map);
  const legacy=entries.length===Object.keys(LEGACY_KEYS).length&&entries.every(([key,bit])=>LEGACY_KEYS[key]===bit);
  // Upgrade the old defaults automatically; preserve intentional remappings.
  if(legacy&&saved.controlsVersion!==CONTROL_VERSION)return {...DEFAULT_KEYS};
  const valid=entries.filter(([key,bit])=>key&&ACTIONS.some(([value])=>value===bit));
  return valid.length?Object.fromEntries(valid):{...DEFAULT_KEYS};
}
export function keyLabel(keys,bit){
  const key=Object.keys(keys).find(k=>keys[k]===bit);
  return key===' '?'SPACE':({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓'}[key]||key?.toUpperCase()||'—');
}
export function keyboardIdentity(event){return event.code||event.key.toLowerCase();}
