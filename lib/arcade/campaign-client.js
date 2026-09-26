export async function campaignRequest(path,body){
  const response=await fetch('/api/campaign'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await response.json();}catch{throw new Error('The challenge service did not respond. Please retry.');}
  if(!response.ok)throw Object.assign(new Error(data.error||'Could not complete the request'),{status:response.status});
  return data;
}
export function campaignEvent(name,code){void campaignRequest('/events',{name,...(code?{code}:{})}).catch(()=>{});}
