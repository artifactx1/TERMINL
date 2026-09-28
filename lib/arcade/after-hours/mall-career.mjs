import {ZONES} from './mall-world.mjs';
import {PARK_ZONES,PARK_GAPS,PARK_ROUTES} from './mall-park.mjs';
export const CAREER_ZONES=[...ZONES,...PARK_ZONES];
export const CAREER_GOALS=[
 {id:'first-line',name:'FIRST PAYDAY',metric:'bestCombo',target:1000,unit:'POINTS',goal:'Bank 1,000 points in one combo.',hint:'Ollie into a rail, then jump out with a flip. Land and coast to bank.',destination:'rails'},
 {id:'five-figure-line',name:'RENT MONEY',metric:'bestCombo',target:10000,unit:'POINTS',goal:'Bank a 10,000-point combo.',hint:'Link rails and change grind styles. Hold a manual on landing to keep the line alive.',destination:'rails'},
 {id:'big-air',name:'FLIGHT RISK',metric:'longestAir',target:2,unit:'SECONDS',goal:'Stay airborne for two seconds and land it.',hint:'Build speed on the ATH ramp. Hold JUMP as you leave the lip.',destination:'mega'},
 {id:'long-jump',name:'INSIDER AIR',metric:'longestJump',target:35,unit:'METRES',goal:'Travel 35 metres in one jump and land it.',hint:'Take a fast run at the mega ramp. Carry your speed through the landing.',destination:'mega'},
 {id:'gap-hunter',name:'MIND THE GAPS',metric:'gaps',target:3,unit:'GAPS',goal:'Clear three different named gaps.',hint:'Start with the fountain, then try the plaza and ATH transfer. Each new gap counts across runs.',destination:'atrium'},
 {id:'park-local',name:'UNPAID SECURITY',metric:'districts',target:17,unit:'DISTRICTS',goal:'Visit all seventeen districts.',hint:'Check the districts below and pick somewhere you haven’t been. Visits carry between runs.',destination:'garden'},
 {id:'night-shift',name:'DELIVERY GUY',metric:'routes',target:1,unit:'ROUTES',goal:'Finish a marked route.',hint:'Find the green ring south of the fountain. Follow each green ring in order.',destination:'atrium'},
 {id:'gold-run',name:'NIGHT SHIFT LEGEND',metric:'bestRunScore',target:75000,unit:'POINTS',goal:'Bank 75,000 points in one run.',hint:'Mix gaps, rails and session goals. Timed runs and free skate both count here.',destination:'rails'},
];
export const GAP_GUIDES=[
 {id:'fountain',destination:'atrium',hint:'Ride north through the atrium. Clear the fountain from the wooden bank.'},
 {id:'ath',destination:'mega',hint:'Build speed heading north up the mega ramp. Land beyond the transfer.'},
 {id:'street',destination:'street',hint:'Approach from the west and clear the paired banks in the plaza.'},
 {id:'canal',destination:'canal',hint:'Approach from the west. Use the wide bank to cross the canal spread.'},
 {id:'snake',destination:'snake',hint:'Head north through the middle of Snake Run’s paired banks.'},
].map(g=>({...PARK_GAPS.find(p=>p.id===g.id),...g}));
export const ROUTE_GUIDES=PARK_ROUTES.map(r=>({...r,destination:r.id==='outer'?'street':'atrium',hint:r.id==='outer'?'Start at the purple ring just south of the mall. Follow purple around the outer districts.':'Start at the green ring south of the fountain. Follow green through the mall.'}));
const metrics=['bestCombo','longestAir','longestJump','bestRunScore'];
const nonnegative=value=>Number.isFinite(value)&&value>=0?value:0;
const unique=values=>[...new Set(values)];
export function readCareer(raw={},legacyScore=0){
 const values=Object.fromEntries(metrics.map(key=>[key,nonnegative(raw?.[key])]));
 values.bestRunScore=Math.max(values.bestRunScore,nonnegative(legacyScore));
 return {...values,districts:unique((Array.isArray(raw?.districts)?raw.districts:[]).filter(id=>CAREER_ZONES.some(z=>z.id===id)))};
}
export function mergeCareer(saved,state){
 const c=readCareer(saved);if(!state)return c;
 for(const [key,value]of Object.entries({bestCombo:state.stats.bestCombo,longestAir:state.stats.longestAir,longestJump:state.stats.longestJump,bestRunScore:state.score}))c[key]=Math.max(c[key],nonnegative(value));
 c.districts=unique([...c.districts,...state.visited.filter(id=>CAREER_ZONES.some(z=>z.id===id))]);return c;
}
export function careerGoals(mall={},state){
 const values=mergeCareer(mall.career,state);
 values.gaps=unique([...(mall.gaps||[]),...(state?.gaps||[])]).filter(id=>PARK_GAPS.some(g=>g.id===id)).length;
 values.routes=unique([...Object.keys(mall.routes||{}),...(state?.routesCompleted||[]).map(r=>r.id)]).filter(id=>PARK_ROUTES.some(r=>r.id===id)).length;
 values.districts=values.districts.length;
 return CAREER_GOALS.map(goal=>{const value=values[goal.metric],earned=!!mall.milestones?.includes(goal.id)||value>=goal.target;return {...goal,earned,value:earned?goal.target:Math.min(value,goal.target)};});
}
export function milestones(state,mall={}){return careerGoals(mall,state).filter(g=>g.earned).map(g=>g.id);}
/** Only banked results, landed jumps and discoveries trigger career checkpoints. */
export function careerCheckpoint(s){
 const routes=PARK_ROUTES.map(r=>Math.min(...(s.routesCompleted||[]).filter(done=>done.id===r.id).map(done=>done.seconds),Infinity));
 return [s.stats.bestCombo||0,s.stats.longestAir||0,s.stats.longestJump||0,s.score,s.tapes.join(','),(s.gaps||[]).join(','),s.visited.join(','),...routes].join('|');
}
