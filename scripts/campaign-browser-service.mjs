// Isolated browser-test fixture. Never use for a deployed service.
import {mkdtemp} from 'node:fs/promises';
import {createCampaignService} from '../server/arcade/campaign.mjs';
import {startArcadeServer} from '../server/arcade/index.mjs';
import {DEFAULT_CAMPAIGN} from '../lib/arcade/campaign-rules.mjs';
const dataDir=await mkdtemp('/tmp/terminl-campaign-browser-');
// The browser suite drives a whole six-race cup. A 20x service clock keeps the
// real-time replay check meaningful without a ten-minute wait. Fixture only.
const started=Date.now(),now=()=>started+(Date.now()-started)*20;
const campaign=createCampaignService({dataDir,now,serviceToken:'local-campaign-test',adminToken:'local-admin-test',siteOrigin:'http://127.0.0.1:4005',xClientId:'test-only',xClientSecret:'test-only',
 xIdentity:async({code})=>({id:code,username:'testdegen',name:'Test Degen'}),discordClientId:'123456789012345678',discordClientSecret:'test-only',
 discordIdentity:async()=>({id:'987654321098765432',username:'discorddegen',name:'Discord Degen'})});
campaign.store.run('UPDATE settings SET value=? WHERE id=1',JSON.stringify({...DEFAULT_CAMPAIGN,active:true,addressStartsAt:started-1000,addressEndsAt:started+30*86400000}));
const runtime=await startArcadeServer({host:'127.0.0.1',port:4025,dataDir,campaign});
console.log('Local campaign fixture on 4025; database '+dataDir);
process.on('SIGTERM',()=>void runtime.close().then(()=>process.exit(0)));
