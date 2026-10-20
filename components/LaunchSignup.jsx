import {useState} from 'react';
import {campaignRequest} from '../lib/arcade/campaign-client';
import styles from '../styles/Terminl.module.css';

export default function LaunchSignup(){
  const [email,setEmail]=useState('');
  const [website,setWebsite]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const submit=async event=>{
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      await campaignRequest('/subscribe',{email,website});
      setEmail('');setMessage('You’re on the launch updates list.');
    }catch(cause){setError(cause.message||'Could not sign you up. Please try again.');}
    finally{setBusy(false);}
  };
  return <section className={styles.updates} id="updates" aria-labelledby="updates-title">
    <div className={styles.updatesCopy}>
      <span className={styles.accessEyebrow}>LAUNCH SIGNAL</span>
      <h2 id="updates-title">Don&rsquo;t miss the mint.</h2>
      <p>Get the October 29 launch reminder and TERMINL updates by email.</p>
    </div>
    <form className={styles.updatesForm} onSubmit={submit}>
      <label htmlFor="launch-email">EMAIL ADDRESS</label>
      <div className={styles.updatesFields}>
        <input id="launch-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} required disabled={busy}/>
        <button type="submit" disabled={busy}>{busy?'SIGNING UP…':'GET THE PING ↗'}</button>
      </div>
      <div className={styles.updatesTrap} aria-hidden="true"><label htmlFor="launch-website">Website</label><input id="launch-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={event=>setWebsite(event.target.value)}/></div>
      {message&&<p className={styles.updatesSuccess} role="status">{message}</p>}
      {error&&<p className={styles.updatesError} role="alert">{error}</p>}
    </form>
  </section>;
}
