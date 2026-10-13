import {useEffect,useState} from 'react';
import {roomLink} from '../../lib/arcade/room-links.mjs';
import s from '../../styles/RoomShare.module.css';

export function IncomingRoomInvite({watch,onJoin,game}){
  return <section className={s.incoming} aria-label={`${game} invitation`}>
    <div><small>YOUR FRIEND SENT A LIVE ROOM</small><h2>{watch?'Watch the action.':'Take the open seat.'}</h2><p>Open the room as a player while a seat is free, or watch without controlling the game.</p></div>
    <div className={s.actions}><button onClick={()=>onJoin(watch?'watch':'join')}>{watch?'WATCH LIVE →':'JOIN GAME →'}</button><button onClick={()=>onJoin(watch?'join':'watch')}>{watch?'JOIN IF OPEN →':'WATCH INSTEAD →'}</button></div>
  </section>;
}

export default function RoomShare({path,title,seat,canJoin=true}){
  const [fallback,setFallback]=useState(''),[message,setMessage]=useState('');
  if(!seat)return null;
  const share=async watch=>{
    const url=roomLink(window.location.origin,path,seat,watch);
    setFallback('');setMessage('');
    if(navigator.share){
      try{await navigator.share({title,text:watch?`Watch us play ${title} live.`:`Join me in ${title}.`,url});setMessage('Shared.');return;}
      catch(error){if(error?.name==='AbortError')return;}
    }
    try{await navigator.clipboard.writeText(url);setMessage(watch?'Watch link copied. Send it to your friends.':'Player link copied. Send it to a friend.');}
    catch{setFallback(url);setMessage('Select and copy the link below.');}
  };
  return <div className={s.share} aria-label='Share this live room'>
    <strong>BRING THE GROUP CHAT IN</strong><p>{canJoin?'Invite one more player, or let friends watch live.':'The match is underway. Share a live watch link.'}</p>
    <div className={s.actions}>{canJoin&&<button onClick={()=>share(false)}>SHARE PLAYER LINK ↗</button>}<button onClick={()=>share(true)}>SHARE WATCH LINK ↗</button></div>
    {message&&<small role='status'>{message}</small>}{fallback&&<input aria-label='Room link to copy' readOnly value={fallback} onFocus={e=>e.target.select()}/>}
    <small>Room links expire when the room closes. Spectators cannot control the match.</small>
  </div>;
}

export function RoomShareDialog({path,title,seat,canJoin,onClose}){
  useEffect(()=>{const close=event=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose]);
  return <div className={s.backdrop} onClick={onClose}>
    <section className={s.dialog} role='dialog' aria-modal='true' aria-label='Share live room' onClick={event=>event.stopPropagation()}>
      <button className={s.close} onClick={onClose} aria-label='Close share options'>×</button>
      <RoomShare path={path} title={title} seat={seat} canJoin={canJoin}/>
      <small className={s.liveNote}>The live game continues while this is open.</small>
    </section>
  </div>;
}
