export const MALL_MEDALS=[{name:'BRONZE',score:10000},{name:'SILVER',score:30000},{name:'GOLD',score:75000},{name:'TERMINL',score:150000}];
export const medalFor=score=>[...MALL_MEDALS].reverse().find(m=>score>=m.score)?.name||'UNRANKED';
export const nextMedal=score=>MALL_MEDALS.find(m=>score<m.score);
export function milestones(s){return [
 ['first-line',s.stats.bestCombo>=1000],['five-figure-line',s.stats.bestCombo>=10000],
 ['big-air',(s.stats.longestAir||0)>=2],['long-jump',(s.stats.longestJump||0)>=35],
 ['gap-hunter',(s.gaps?.length||0)>=3],['park-local',s.visited?.length>=17],
 ['night-shift',(s.routesCompleted?.length||0)>0],['gold-run',s.score>=75000],
 ].filter(([,earned])=>earned).map(([id])=>id);}
