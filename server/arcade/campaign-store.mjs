import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {DEFAULT_CAMPAIGN,POINTS} from '../../lib/arcade/campaign-rules.mjs';

/** One transactional database on the existing single-writer Railway volume. */
export function openCampaignStore(directory){
  mkdirSync(directory,{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(directory,'campaign.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL, name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'x',
      public_profile INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, anon_id TEXT NOT NULL, user_id TEXT REFERENCES users(id),
      ref_code TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, anon_id TEXT NOT NULL, challenge TEXT NOT NULL,
      started_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, completed_at INTEGER,
      result TEXT, replay_hash TEXT, flags TEXT NOT NULL DEFAULT '[]',
      code TEXT UNIQUE NOT NULL, ref_code TEXT, user_id TEXT REFERENCES users(id),
      invalidated INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'sprint',
      progress BLOB, segments INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0,
      last_segment_at INTEGER);
    CREATE INDEX IF NOT EXISTS runs_anon ON runs(anon_id,started_at);
    CREATE INDEX IF NOT EXISTS runs_replay ON runs(replay_hash);
    CREATE INDEX IF NOT EXISTS runs_user ON runs(user_id,completed_at);
    CREATE TABLE IF NOT EXISTS spots (
      user_id TEXT NOT NULL REFERENCES users(id), route TEXT NOT NULL,
      run_id TEXT UNIQUE NOT NULL REFERENCES runs(id), status TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,route));
    CREATE INDEX IF NOT EXISTS spots_status ON spots(status,created_at);
    CREATE TABLE IF NOT EXISTS replay_hashes (
      hash TEXT NOT NULL, anon_id TEXT NOT NULL, run_id TEXT NOT NULL, PRIMARY KEY(hash,anon_id));
    CREATE TABLE IF NOT EXISTS referrals (
      referred_id TEXT PRIMARY KEY REFERENCES users(id), referrer_id TEXT NOT NULL REFERENCES users(id),
      run_id TEXT NOT NULL REFERENCES runs(id), created_at INTEGER NOT NULL,
      CHECK(referred_id<>referrer_id));
    CREATE TABLE IF NOT EXISTS oauth_states (
      state_hash TEXT PRIMARY KEY, session_hash TEXT NOT NULL, run_id TEXT,
      verifier TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'x',
      public_profile INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id), address TEXT UNIQUE NOT NULL,
      chain_id INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor TEXT NOT NULL,
      action TEXT NOT NULL, detail TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, at INTEGER NOT NULL, name TEXT NOT NULL,
      anon_id TEXT, user_id TEXT, run_id TEXT, detail TEXT NOT NULL DEFAULT '{}');
    CREATE INDEX IF NOT EXISTS events_time ON events(at,name);
    CREATE TABLE IF NOT EXISTS event_once (
      key TEXT PRIMARY KEY, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
  `);
  // SQLite's CREATE TABLE IF NOT EXISTS does not add columns to campaign databases
  // already on disk, so keep these additive migrations idempotent.
  const columns=table=>new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column=>column.name));
  if(!columns('users').has('provider'))db.exec("ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'x'");
  if(!columns('oauth_states').has('provider'))db.exec("ALTER TABLE oauth_states ADD COLUMN provider TEXT NOT NULL DEFAULT 'x'");
  const runColumns=columns('runs');
  if(!runColumns.has('kind'))db.exec("ALTER TABLE runs ADD COLUMN kind TEXT NOT NULL DEFAULT 'sprint'");
  if(!runColumns.has('progress'))db.exec('ALTER TABLE runs ADD COLUMN progress BLOB');
  if(!runColumns.has('segments'))db.exec('ALTER TABLE runs ADD COLUMN segments INTEGER NOT NULL DEFAULT 0');
  if(!runColumns.has('last_segment_at'))db.exec('ALTER TABLE runs ADD COLUMN last_segment_at INTEGER');
  if(!runColumns.has('points')){
    db.exec('ALTER TABLE runs ADD COLUMN points INTEGER NOT NULL DEFAULT 0');
    db.prepare("UPDATE runs SET points=?,last_segment_at=completed_at WHERE kind='sprint' AND json_extract(result,'$.qualified')=1").run(POINTS.legacySprint);
  }
  // The retired single-race campaign kept one qualification per account. Those
  // remain honored as `sprint` spots; the old table is left in place, unused.
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='qualifications'").get())
    db.exec("INSERT OR IGNORE INTO spots(user_id,route,run_id,status,created_at) SELECT user_id,'sprint',run_id,status,created_at FROM qualifications");
  db.prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(1,?)').run(JSON.stringify(DEFAULT_CAMPAIGN));
  // Settings saved before the two-route release carry the old default cap of 2048, the
  // collection size rather than a WL decision. FCFS spots are now unlimited unless set.
  const stored=JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
  if(!('cupEnabled' in stored)&&stored.capacity===2048){
    db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify({...stored,capacity:0}));
    db.prepare('INSERT INTO audit(at,actor,action,detail) VALUES(?,?,?,?)').run(Date.now(),'migration','settings',JSON.stringify({capacity:{previous:2048,next:0}}));
  }
  const get=(sql,...args)=>db.prepare(sql).get(...args);
  const all=(sql,...args)=>db.prepare(sql).all(...args);
  const run=(sql,...args)=>db.prepare(sql).run(...args);
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
  const event=(name,{anonId=null,userId=null,runId=null,detail={},once=null}={},now=Date.now())=>{
    if(once&&!run('INSERT OR IGNORE INTO event_once(key,at) VALUES(?,?)',once,now).changes)return;
    run('INSERT INTO events(at,name,anon_id,user_id,run_id,detail) VALUES(?,?,?,?,?,?)',now,name,anonId,userId,runId,JSON.stringify(detail));
  };
  const rate=(key,limit,windowMs,now=Date.now())=>transaction(()=>{
    const row=get('SELECT * FROM rate_limits WHERE key=?',key);
    if(!row||row.reset_at<=now){run('INSERT OR REPLACE INTO rate_limits(key,count,reset_at) VALUES(?,1,?)',key,now+windowMs);return true;}
    if(row.count>=limit)return false;
    run('UPDATE rate_limits SET count=count+1 WHERE key=?',key);return true;
  });
  const audit=(actor,action,detail,now=Date.now())=>run('INSERT INTO audit(at,actor,action,detail) VALUES(?,?,?,?)',now,actor,action,JSON.stringify(detail));
  const cleanup=(now=Date.now())=>transaction(()=>{
    run('DELETE FROM oauth_states WHERE expires_at<?',now);
    run('DELETE FROM sessions WHERE expires_at<?',now);
    run('DELETE FROM rate_limits WHERE reset_at<?',now);
    // Aggregate metrics are retained; only unused anonymous attempts expire.
    run('DELETE FROM replay_hashes WHERE run_id IN (SELECT id FROM runs WHERE user_id IS NULL AND completed_at IS NULL AND expires_at<?)',now-7*86400000);
    run('DELETE FROM runs WHERE user_id IS NULL AND completed_at IS NULL AND expires_at<?',now-7*86400000);
  });
  return {db,get,all,run,transaction,event,rate,audit,cleanup,config:()=>JSON.parse(get('SELECT value FROM settings WHERE id=1').value),close:()=>db.close()};
}
