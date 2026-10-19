// Resolve 10 AM in New York on the chosen date, including that date's DST offset.
export function easternMintTime(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;
  const [year,month,day]=date.split('-').map(Number);
  const noon=new Date(Date.UTC(year,month-1,day,12));
  if(noon.toISOString().slice(0,10)!==date)return null;
  const zone=Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(noon).find(part=>part.type==='timeZoneName')?.value;
  const offset=/^GMT([+-]\d{1,2})(?::(\d{2}))?$/.exec(zone||'');
  if(!offset)return null;
  const hours=Number(offset[1]),minutes=Number(offset[2]||0)*Math.sign(hours);
  return Date.UTC(year,month-1,day,10)-((hours*60+minutes)*60000);
}
