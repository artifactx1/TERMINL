export const MALL_MEDALS=[{name:'BRONZE',score:10000},{name:'SILVER',score:30000},{name:'GOLD',score:75000},{name:'TERMINL',score:150000}];
export const medalFor=score=>[...MALL_MEDALS].reverse().find(m=>score>=m.score)?.name||'UNRANKED';
export const nextMedal=score=>MALL_MEDALS.find(m=>score<m.score);
export {milestones} from './mall-career.mjs';
