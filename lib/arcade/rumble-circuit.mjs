import {CHARACTERS,botInput} from './rumble-sim.mjs';
export const CIRCUIT_KEY='terminl:rumble-circuit:v1';
export const CIRCUIT_LENGTH=6;
export function newCircuit(character='max'){if(!Object.hasOwn(CHARACTERS,character))throw Error('Unknown fighter');return {version:1,character,index:0,complete:false};}
export function readCircuit(raw){try{const c=JSON.parse(raw);return c?.version===1&&Object.hasOwn(CHARACTERS,c.character)&&Number.isInteger(c.index)&&c.index>=0&&c.index<6&&typeof c.complete==='boolean'?{version:1,character:c.character,index:c.index,complete:c.complete}:null;}catch{return null;}}
export function circuitOpponent(c){return [...['brian','max','bernie','diamond','mia','chloe'].filter(id=>id!==c.character),c.character][c.index];}
export function circuitStage(c){return c.index%2?'laundromat':'dead-mall';}
export function advanceCircuit(c,winner){return winner!==0?c:c.index===5?{...c,complete:true}:{...c,index:c.index+1};}
/** Later opponents have fewer hesitation windows; health, damage and rules are identical. */
export function circuitInput(state,c){let input=botInput(state,1);if(state.phase==='finishWindow')return input;const pause=Math.max(0,110-c.index*22);if(state.tick%240<pause)input&=~(16|32|64|512|1024);if(c.index<2&&state.tick%100<35)input&=~128;return input;}
