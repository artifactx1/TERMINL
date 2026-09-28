/** Resolve only the line that was alive at the buzzer, once. */
export function resolveOvertime(s,result){
 if(!s.overtime||s.overtime.ended!==null)return;
 s.overtime={...s.overtime,...result,ended:s.tick};
}

export function stepTimedSession(s,duration){
 if(s.practice||s.tick<duration)return;
 if(!s.overtime&&s.combo.count&&!s.player.bail){
  s.overtime={started:s.tick,ended:null,landed:false,banked:0,lost:0};
  s.callout={text:'LAST LINE',detail:'Clock’s out. Your combo isn’t.',until:s.tick+120};
  s.events.push({type:'overtime'});
 }
 if(s.overtime){
  if(s.overtime.ended===null&&(!s.combo.count||s.player.bail))resolveOvertime(s,{landed:false});
  if(s.overtime.ended===null)return;
 }
 s.phase='finished';
}
