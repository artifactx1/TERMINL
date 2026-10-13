/** The hash keeps the scoped room token out of HTTP requests and page previews. */
export function roomLink(origin,path,seat,watch=false){
  const url=new URL(path,origin);
  url.hash=new URLSearchParams({room:seat.code,token:seat.token,...(watch?{watch:'1'}:{})}).toString();
  return url.toString();
}

export function parseRoomLink(value,origin){
  try{
    const url=new URL(value,origin),params=new URLSearchParams(url.hash.slice(1));
    const code=params.get('room'),token=params.get('token');
    if(!/^[a-f0-9]{8}$/i.test(code||'')||!/^[A-Za-z0-9_-]{32}$/.test(token||''))return null;
    return {code,token,watch:params.get('watch')==='1'};
  }catch{return null;}
}
