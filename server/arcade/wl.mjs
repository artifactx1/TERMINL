import {createHash,randomBytes} from 'node:crypto';
import {normalizeAddress} from './campaign-address.mjs';

const KINDS=new Set(['gtd','fcfs','both']);
const parts=kind=>kind==='both'?['gtd','fcfs']:[kind];
const masterDigest=rows=>createHash('sha256').update(rows.map(row=>`${row.address},${row.kind}`).sort().join('\n')).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const walletAddress=value=>{try{return normalizeAddress(value);}catch(error){fail(error.message);}};

function emailAddress(value){
  const email=typeof value==='string'?value.trim().toLowerCase():'';
  if(email.length>254||!/^[^\s@<>]{1,64}@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email))fail('Enter a valid email address.');
  return email;
}

export function createWlService(store,now=Date.now){
  function check(raw){
    const address=walletAddress(raw);
    const entries=store.all('SELECT kind,source FROM wl_entries WHERE address=? ORDER BY kind',address);
    const master=store.all('SELECT kind FROM wl_master_entries WHERE address=? ORDER BY kind',address);
    const exclusions=new Set(store.all('SELECT kind FROM wl_exclusions WHERE address=?',address).map(row=>row.kind));
    const arcadeFcfs=store.get(`SELECT 1 FROM wallets w JOIN users u ON u.id=w.user_id
      JOIN spots sp ON sp.user_id=u.id JOIN runs r ON r.id=sp.run_id
      WHERE w.address=? AND u.status='active' AND sp.status='qualified' AND r.invalidated=0 LIMIT 1`,address);
    const arcadeGtd=store.get(`SELECT 1 FROM wallets w JOIN users u ON u.id=w.user_id
      JOIN gtd g ON g.user_id=u.id JOIN gtd_close c ON c.id=1
      WHERE w.address=? AND u.status='active' LIMIT 1`,address);
    const found=new Map(entries.map(row=>[row.kind,row.source]));
    for(const row of master)if(!found.has(row.kind))found.set(row.kind,'master');
    if(arcadeFcfs&&!found.has('fcfs'))found.set('fcfs','arcade');
    if(arcadeGtd&&!found.has('gtd'))found.set('gtd','arcade');
    for(const kind of exclusions)found.delete(kind);
    return {address,eligible:found.size>0,lists:[...found].map(([kind,source])=>({kind,source})).sort((a,b)=>a.kind.localeCompare(b.kind)),
      status:'offchain',updatedAt:now()};
  }

  function submit(body){
    const address=walletAddress(body.address),email=emailAddress(body.email);
    const requested=body.requestedKind;
    if(!KINDS.has(requested))fail('Choose GTD, FCFS, or both.');
    if(body.emailConsent!==true)fail('Confirm that we may email you about your WL application.');
    if(body.socialConfirmed!==true)fail('Confirm the X follow, like, and repost steps.');
    const note=typeof body.note==='string'?body.note.trim():'';
    if(note.length>500)fail('Keep your application note under 500 characters.');
    const id=randomBytes(16).toString('hex'),at=now();
    const inserted=store.run(`INSERT OR IGNORE INTO wl_applications
      (id,address,email,requested_kind,note,status,created_at,updated_at)
      VALUES(?,?,?,?,?,'pending',?,?)`,id,address,email,requested,note,at,at);
    if(inserted.changes)store.audit('applicant','wl_application_received',{id,address,requested},at);
    return {received:true};
  }

  function review(body){
    if(typeof body.id!=='string'||!/^[a-f0-9]{32}$/.test(body.id))fail('Choose an application.');
    if(!['approved','rejected'].includes(body.status))fail('Choose approve or reject.');
    if(body.status==='approved'&&!KINDS.has(body.awardedKind))fail('Choose an awarded list.');
    const reason=typeof body.reason==='string'?body.reason.trim():'';
    if(reason.length<5||reason.length>300)fail('Give a review reason (5–300 characters).');
    return store.transaction(()=>{
      const row=store.get('SELECT * FROM wl_applications WHERE id=?',body.id);
      if(!row)fail('Application not found.',404);
      const at=now();
      store.run("DELETE FROM wl_entries WHERE address=? AND source='application'",row.address);
      if(body.status==='approved')for(const kind of parts(body.awardedKind)){
        store.run("INSERT OR IGNORE INTO wl_entries(address,kind,source,created_at) VALUES(?,?,'application',?)",row.address,kind,at);
      }
      store.run('UPDATE wl_applications SET status=?,awarded_kind=?,updated_at=?,reviewed_at=? WHERE id=?',
        body.status,body.status==='approved'?body.awardedKind:null,at,at,row.id);
      store.audit('admin','wl_application_review',{id:row.id,address:row.address,status:body.status,awardedKind:body.status==='approved'?body.awardedKind:null,reason},at);
      return {ok:true};
    });
  }

  function setEntry(body){
    const address=walletAddress(body.address),kind=body.kind;
    if(!['gtd','fcfs'].includes(kind)||!['add','remove'].includes(body.action))fail('Choose a list and action.');
    const reason=typeof body.reason==='string'?body.reason.trim():'';
    if(reason.length<5||reason.length>300)fail('Give a change reason (5–300 characters).');
    return store.transaction(()=>{
      if(body.action==='add'){
        store.run('DELETE FROM wl_exclusions WHERE address=? AND kind=?',address,kind);
        store.run(`INSERT INTO wl_entries(address,kind,source,created_at) VALUES(?,?,'manual',?)
          ON CONFLICT(address,kind) DO UPDATE SET source='manual'`,address,kind,now());
      }else{
        store.run('DELETE FROM wl_entries WHERE address=? AND kind=?',address,kind);
        store.run('INSERT OR IGNORE INTO wl_exclusions(address,kind,created_at) VALUES(?,?,?)',address,kind,now());
      }
      store.audit('admin','wl_entry_changed',{address,kind,action:body.action,reason},now());
      return {ok:true};
    });
  }

  function importMaster(body){
    if(!Array.isArray(body.entries)||body.entries.length<1||body.entries.length>20000)fail('Provide 1–20,000 master entries.');
    const reason=typeof body.reason==='string'?body.reason.trim():'';
    if(reason.length<5||reason.length>300)fail('Give an import reason (5–300 characters).');
    const normalized=new Map();
    for(const [index,row] of body.entries.entries()){
      if(!row||!['gtd','fcfs'].includes(row.kind))fail(`Invalid list at master row ${index+1}.`);
      let address;try{address=walletAddress(row.address);}catch{fail(`Invalid wallet at master row ${index+1}.`);}
      normalized.set(address+':'+row.kind,{address,kind:row.kind});
    }
    const at=now();
    return store.transaction(()=>{
      store.run('DELETE FROM wl_master_entries');
      for(const row of normalized.values())store.run('INSERT INTO wl_master_entries(address,kind,imported_at) VALUES(?,?,?)',row.address,row.kind,at);
      const counts=store.all('SELECT kind,count(*) AS count FROM wl_master_entries GROUP BY kind ORDER BY kind');
      const digest=masterDigest([...normalized.values()]);
      store.audit('admin','wl_master_import',{counts,digest,reason,submitted:body.entries.length,deduplicated:normalized.size},at);
      return {ok:true,counts,digest,submitted:body.entries.length,deduplicated:normalized.size};
    });
  }

  function mergeMaster(body){
    if(!Array.isArray(body.entries)||body.entries.length<1||body.entries.length>20000)fail('Provide 1–20,000 master entries.');
    const reason=typeof body.reason==='string'?body.reason.trim():'';
    if(reason.length<5||reason.length>300)fail('Give a merge reason (5–300 characters).');
    const normalized=new Map();
    for(const [index,row] of body.entries.entries()){
      if(!row||!['gtd','fcfs'].includes(row.kind))fail(`Invalid list at master row ${index+1}.`);
      let address;try{address=walletAddress(row.address);}catch{fail(`Invalid wallet at master row ${index+1}.`);}
      normalized.set(address+':'+row.kind,{address,kind:row.kind});
    }
    const at=now();
    return store.transaction(()=>{
      let added=0;
      for(const row of normalized.values())added+=store.run(
        'INSERT OR IGNORE INTO wl_master_entries(address,kind,imported_at) VALUES(?,?,?)',
        row.address,row.kind,at).changes;
      const counts=store.all('SELECT kind,count(*) AS count FROM wl_master_entries GROUP BY kind ORDER BY kind');
      const digest=masterDigest(store.all('SELECT address,kind FROM wl_master_entries'));
      store.audit('admin','wl_master_merge',{counts,digest,reason,submitted:body.entries.length,deduplicated:normalized.size,added},at);
      return {ok:true,counts,digest,submitted:body.entries.length,deduplicated:normalized.size,added};
    });
  }

  function admin(){
    return {applications:store.all(`SELECT id,address,email,requested_kind,note,status,awarded_kind,
      created_at,updated_at,reviewed_at FROM wl_applications
      ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 2000`),
      entries:store.all('SELECT address,kind,source,created_at FROM wl_entries ORDER BY created_at DESC LIMIT 2000'),
      counts:store.all('SELECT kind,count(*) AS count FROM wl_entries GROUP BY kind'),
      masterCounts:store.all('SELECT kind,count(*) AS count FROM wl_master_entries GROUP BY kind ORDER BY kind'),
      masterDigest:masterDigest(store.all('SELECT address,kind FROM wl_master_entries')),
      excludedCounts:store.all('SELECT kind,count(*) AS count FROM wl_exclusions GROUP BY kind ORDER BY kind')};
  }

  function contacts(){
    return {contacts:store.all(`SELECT a.email,a.address,a.awarded_kind,a.reviewed_at
      FROM wl_applications a WHERE a.status='approved'
      AND EXISTS(SELECT 1 FROM wl_entries e WHERE e.address=a.address AND e.source='application'
        AND NOT EXISTS(SELECT 1 FROM wl_exclusions x WHERE x.address=e.address AND x.kind=e.kind))
      ORDER BY a.reviewed_at DESC`)};
  }

  return {check,submit,review,setEntry,importMaster,mergeMaster,admin,contacts};
}
