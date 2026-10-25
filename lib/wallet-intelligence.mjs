// Shared, deterministic model. All affordability comparisons use integer wei.
export const WEI = 10n ** 18n;
export const DEFAULT_SCENARIO = Object.freeze({price:'0.01',supply:2048,reserved:0,gtdCap:1,otherCap:1,rhReserve:'0.0001',bridgeReserve:'0.001',participation:25});
export const PRICE_POINTS = ['0.0005','0.001','0.0025','0.005','0.01','0.02','0.05'];
export const REVIEW_LABELS = {likely_bot:'During burst · no note',review_during_burst:'During burst · with note',outside_burst:'Before burst',review_after_protection:'After protection'};
export function parseEth(value){
  if(!/^\d{1,10}(?:\.\d{0,18})?$/.test(String(value)))throw new Error('Enter ETH amounts using up to 18 decimal places.');
  const [whole,fraction='']=String(value).split('.');return BigInt(whole)*WEI+BigInt(fraction.padEnd(18,'0'));
}
export function scenarioInputs(raw){
  const value={...DEFAULT_SCENARIO,...raw};
  for(const key of ['supply','gtdCap','otherCap']){value[key]=Number(value[key]);if(!Number.isSafeInteger(value[key])||value[key]<1||value[key]>100000)throw new Error('Supply and wallet caps must be whole numbers between 1 and 100,000.');}
  value.reserved=Number(value.reserved);if(!Number.isSafeInteger(value.reserved)||value.reserved<0||value.reserved>=value.supply)throw new Error('Reserved supply must be smaller than total supply.');
  value.participation=Number(value.participation);if(!Number.isFinite(value.participation)||value.participation<0||value.participation>100)throw new Error('Participation must be between 0% and 100%.');
  value.priceWei=parseEth(value.price);if(value.priceWei<=0n)throw new Error('Mint price must be greater than zero.');
  value.rhReserveWei=parseEth(value.rhReserve);value.bridgeReserveWei=parseEth(value.bridgeReserve);value.available=value.supply-value.reserved;
  return value;
}
export function hydrateWallet(row,sourceNames=[]){
  const [native,weth,usdc,usdt,type,nonce,nonce30]=row.eth;
  const [rhNative,rhWeth,usdg,rhType,rhNonce,rhNonce30]=row.rh;
  return {...row,eligible:row.gtd||row.fcfs,sources:(row.sources||[]).map(i=>sourceNames[i]||'Unknown source'),
    ethereum:{native:BigInt(native),weth:BigInt(weth),usdc:BigInt(usdc),usdt:BigInt(usdt),type,nonce,nonce30},
    robinhood:{native:BigInt(rhNative),weth:BigInt(rhWeth),usdg:BigInt(usdg),type:rhType,nonce:rhNonce,nonce30:rhNonce30},
    active:(nonce30||0)>0||(rhNonce30||0)>0,checked:!!row.check,
    application:row.app?{id:row.app[0],status:row.app[1],requested:row.app[2],awarded:row.app[3],reviewGroup:row.app[4],createdAt:row.app[5]}:null};
}
const positive=value=>value>0n?value:0n;
const cappedUnits=(funds,price,cap)=>Number(funds/price>BigInt(cap)?BigInt(cap):funds/price);
export function fundingFor(wallet,scenario){
  const e=wallet.ethereum,r=wallet.robinhood;
  if(r.type==='contract')return {ready:0,bridge:0,converted:0,route:'contract',shortfall:scenario.priceWei+scenario.rhReserveWei};
  const cap=wallet.gtd?scenario.gtdCap:scenario.otherCap;
  const contribution=e.type==='contract'?0n:positive(e.native-scenario.bridgeReserveWei);
  const native=positive(r.native-scenario.rhReserveWei);
  const bridge=positive(r.native+contribution-scenario.rhReserveWei);
  // WETH conversion needs native gas. The configured reserves cover those actions.
  const l1Weth=e.type!=='contract'&&e.native>=scenario.bridgeReserveWei?e.weth:0n;
  const rhWeth=r.native+contribution+l1Weth>=scenario.rhReserveWei?r.weth:0n;
  const converted=positive(r.native+contribution+l1Weth+rhWeth-scenario.rhReserveWei);
  const readyUnits=cappedUnits(native,scenario.priceWei,cap),bridgeUnits=cappedUnits(bridge,scenario.priceWei,cap),convertedUnits=cappedUnits(converted,scenario.priceWei,cap);
  return {ready:readyUnits,bridge:bridgeUnits,converted:convertedUnits,
    route:readyUnits?'ready':bridgeUnits?'bridge':convertedUnits?'convert':'underfunded',
    shortfall:positive(scenario.priceWei+scenario.rhReserveWei-r.native)};
}
export function inPool(wallet,pool){
  if(pool==='all')return true;
  if(pool==='eligible')return wallet.eligible;
  if(pool==='gtd')return wallet.gtd;
  if(pool==='fcfs')return wallet.fcfs;
  if(pool==='fcfs-only')return wallet.fcfs&&!wallet.gtd;
  if(pool==='applications')return !!wallet.application;
  if(pool==='new-applicants')return !!wallet.application&&!wallet.eligible;
  if(pool==='pending-new')return wallet.application?.status==='pending'&&!wallet.eligible;
  if(pool==='checked')return wallet.checked;
  return false;
}
export function analyzeWallets(wallets,scenario){
  const result={wallets:wallets.length,ready:0,bridge:0,converted:0,readyUnits:0,bridgeUnits:0,convertedUnits:0,active:0,checked:0,readyActive:0,readyChecked:0,contracts:0,
    routes:{ready:0,bridge:0,convert:0,underfunded:0,contract:0},gtd:0,fcfs:0,both:0,applications:0,newApplicants:0,unknownActivity:0};
  for(const wallet of wallets){
    const f=fundingFor(wallet,scenario);result.routes[f.route]++;
    for(const mode of ['ready','bridge','converted']){result[mode]+=Number(f[mode]>0);result[mode+'Units']+=f[mode];}
    result.active+=Number(wallet.active);result.checked+=Number(wallet.checked);result.readyActive+=Number(wallet.active&&f.ready>0);result.readyChecked+=Number(wallet.checked&&f.ready>0);
    result.gtd+=Number(wallet.gtd);result.fcfs+=Number(wallet.fcfs);result.both+=Number(wallet.gtd&&wallet.fcfs);result.applications+=Number(!!wallet.application);result.newApplicants+=Number(!!wallet.application&&!wallet.eligible);
    result.contracts+=Number(wallet.ethereum.type==='contract'||wallet.robinhood.type==='contract');result.unknownActivity+=Number(wallet.ethereum.nonce30===null||wallet.robinhood.nonce30===null);
  }
  return result;
}
export function allocationRisk(wallets,scenario){
  const gtd=wallets.filter(w=>w.gtd).length,eligible=wallets.filter(w=>w.eligible).length;
  return {gtd,eligible,gtdCommitment:gtd*scenario.gtdCap,excess:Math.max(0,gtd*scenario.gtdCap-scenario.available),
    maximumFcfsAfterGtd:Math.max(0,scenario.available-gtd*scenario.gtdCap),ratio:eligible/scenario.available};
}
export function balanceMatrix(wallets){
  const limits=[0n,10n**15n,10n**16n,10n**17n];
  const band=n=>n===0n?0:n<limits[1]?1:n<limits[2]?2:n<limits[3]?3:4;
  const cells=Array.from({length:5},()=>Array(5).fill(0));
  for(const w of wallets)cells[band(w.ethereum.native)][band(w.robinhood.native)]++;
  return {labels:['0','<0.001','0.001–0.01','0.01–0.1','≥0.1'],cells};
}
export function ethAmount(wei,decimals=5){return (Number(wei)/1e18).toLocaleString('en-US',{maximumFractionDigits:decimals});}
export function csvFor(wallets,scenario){
  const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const decimal=(raw,places=18)=>{const n=BigInt(raw),scale=10n**BigInt(places);return `${n/scale}.${(n%scale).toString().padStart(places,'0')}`;};
  const rows=[['Wallet','GTD','FCFS','Application status','Application review period','ETH mainnet ETH','Robinhood ETH','Mainnet WETH','Mainnet USDC','Mainnet USDT','Robinhood WETH','Robinhood USDG','Mainnet lifetime nonce','Mainnet 30d nonce change','Robinhood lifetime nonce','Robinhood 30d nonce change','Observed 30d activity','Recorded WL check','Funding route','Ready units','Units after bridge','Units after WETH conversion','Sources']];
  for(const w of wallets){const f=fundingFor(w,scenario);rows.push([w.address,w.gtd,w.fcfs,w.application?.status,w.application?REVIEW_LABELS[w.application.reviewGroup]:null,decimal(w.ethereum.native),decimal(w.robinhood.native),decimal(w.ethereum.weth),decimal(w.ethereum.usdc,6),decimal(w.ethereum.usdt,6),decimal(w.robinhood.weth),decimal(w.robinhood.usdg,6),w.ethereum.nonce,w.ethereum.nonce30,w.robinhood.nonce,w.robinhood.nonce30,w.active,w.checked,f.route,f.ready,f.bridge,f.converted,w.sources.join('; ')]);}
  return rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
