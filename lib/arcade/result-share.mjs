/** Copy is specific to the verified progress; the player can edit it in X. */
export function resultShareText(run){
  const points=run.points||0;
  if(run.kind==='rumble'){
    if(run.result?.qualified)return `I cleared all 6 Rekt Rumble fights${run.result.losses?` with ${run.result.losses} ${run.result.losses===1?'retry':'retries'}`:''}. ${points} verified arcade points. Your turn.`;
    return `${run.progress?.index||0}/6 Rekt Rumble fights won. ${points} verified arcade points so far. Think you can finish the circuit?`;
  }
  if(run.result){
    const [mine,barry]=run.result.points||[0,0];
    return run.result.qualified?`I took the Barry Cup ${mine}–${barry} across 6 races. Your turn to race BarryBot.`:`BarryBot took the cup ${barry}–${mine}, but I banked ${points} verified arcade points. Can you beat him?`;
  }
  return `${run.progress?.races||0}/6 Barry Cup races done. ${points} verified arcade points so far. Think you can beat my run?`;
}

export function resultShareIntent(run,origin,text=resultShareText(run)){
  const url=new URL(`/challenge/${run.code}`,origin).toString();
  return 'https://x.com/intent/post?'+new URLSearchParams({text,url});
}
