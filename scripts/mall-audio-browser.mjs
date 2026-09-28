import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005',browser=await chromium.launch({headless:true}),errors=[];
await mkdir('artifacts/mall-contact',{recursive:true});
try{
 // Render the exact sound engine in a real Web Audio implementation, including
 // contact transitions, pause, resume, the result screen and disposal.
 const offline=await browser.newPage();
 const source=await readFile('lib/arcade/after-hours/skate-audio.mjs','utf8');
 await offline.route('**/skate-audio-check.mjs',route=>route.fulfill({contentType:'text/javascript',body:source}));
 await offline.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded'});
 const rendered=await offline.evaluate(async()=>{
  const {SkateAudio}=await import('/skate-audio-check.mjs'),ctx=new OfflineAudioContext(1,44100*7,44100),master=ctx.createGain();master.gain.value=.12;master.connect(ctx.destination);
  const audio=new SkateAudio(ctx,master),state=(time,player,events=[])=>({tick:Math.round(time*60),phase:'playing',player:{speed:0,grounded:true,...player},events});
  audio.update(state(0,{}));
  const phases=[
   [.25,()=>audio.update(state(.25,{speed:6}))],
   [1,()=>audio.update(state(1,{speed:25}))],
   [1.75,()=>audio.update(state(1.75,{speed:25,grounded:false},[{type:'jump'}]))],
   [2.4,()=>audio.update(state(2.4,{speed:25,grounded:false,rail:'line'},[{type:'land',surface:'rail',strength:.6}]))],
   [3.2,()=>audio.update(state(3.2,{speed:25,grounded:false},[{type:'jump'}]))],
   [3.8,()=>audio.update(state(3.8,{speed:20},[{type:'land',strength:1}]))],
   [4.5,()=>audio.pause()],
   [5,()=>audio.update(state(5,{speed:20}))],
   [5.6,()=>audio.update({...state(5.6,{speed:20}),phase:'finished'})],
   [6.2,()=>audio.dispose()],
  ];
  const waits=phases.map(([time,apply])=>ctx.suspend(time).then(()=>{apply();return ctx.resume();}));
  const buffer=await ctx.startRendering();await Promise.all(waits);
  const samples=buffer.getChannelData(0),rms=(from,to)=>{let power=0;for(let i=Math.floor(from*44100);i<to*44100;i++)power+=samples[i]**2;return Math.sqrt(power/((to-from)*44100));};
  const levels={slow:rms(.5,.9),fast:rms(1.2,1.6),air:rms(2.1,2.3),grind:rms(2.6,3),pause:rms(4.8,4.95),resume:rms(5.2,5.5),result:rms(5.9,6.1),disposed:rms(6.5,6.9)};
  return {samples:Array.from(samples),levels,peak:samples.reduce((max,n)=>Math.max(max,Math.abs(n)),0),voices:audio.voices.size};
 });
 assert.ok(rendered.levels.fast>rendered.levels.slow*2);assert.ok(rendered.levels.grind>rendered.levels.fast);assert.ok(rendered.levels.resume>.001);
 for(const name of ['air','pause','result','disposed'])assert.ok(rendered.levels[name]<1e-5,name+' is silent after its fade');
 assert.ok(rendered.peak<.1,'impact and contact audio have headroom');assert.equal(rendered.voices,0);
 const wav=Buffer.alloc(44+rendered.samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);rendered.samples.forEach((n,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,n))*32767),44+i*2));
 await writeFile('artifacts/mall-contact/contact-preview.wav',wav);console.log('PASS rendered contact audio',JSON.stringify({levels:rendered.levels,peak:rendered.peak}));await offline.close();

 for(const viewport of [{width:1280,height:850},{width:375,height:667},{width:844,height:390}]){
  const context=await browser.newContext({viewport,isMobile:viewport.width!==1280,hasTouch:viewport.width!==1280}),page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   Date.now=()=>123;const audit=window.skateAudioAudit={contexts:[],sources:[],connections:new Map(),targets:new Map(),stops:new Set()};
   const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);audit.contexts.push(this);}};
   const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(target,...args){audit.connections.set(this,target);return connect.call(this,target,...args);};
   const target=AudioParam.prototype.setTargetAtTime;AudioParam.prototype.setTargetAtTime=function(value,...args){audit.targets.set(this,value);return target.call(this,value,...args);};
   const create=BaseAudioContext.prototype.createBufferSource;BaseAudioContext.prototype.createBufferSource=function(){const node=create.call(this);audit.sources.push(node);const stop=node.stop;node.stop=function(...args){audit.stops.add(node);return stop.apply(this,args);};return node;};
  });
  await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.mode==='menu');
  await page.getByLabel('Free skate / no timer').check();await page.getByLabel('Free-skate starting spot').selectOption('rails');
  await page.evaluate(()=>{
   let now=performance.now(),id=0;const queue=new Map(),held={};performance.now=()=>now;window.requestAnimationFrame=f=>{queue.set(++id,f);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
   window.contactKeys=input=>{for(const[name,code]of Object.entries({forward:'KeyW',grind:'KeyL'})){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code.slice(3).toLowerCase(),bubbles:true}));held[name]=!!input[name];}};
   window.contactFrame=()=>{now+=1000/60+.000001;const frames=[...queue.values()];queue.clear();frames.forEach(f=>f(now));};
   for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return fn.apply(this,args);};}
  });
  const frames=(n,input={})=>page.evaluate(({n,input})=>{window.contactKeys(input);for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.contactFrame();}window.skipGpu=false;},{n,input});
  const data=()=>page.locator('canvas').evaluate(c=>({...c.dataset}));
  const levels=()=>page.evaluate(()=>{const a=window.skateAudioAudit,channels=a.sources.filter(n=>n.loop).map(n=>a.connections.get(a.connections.get(n)));const master=[...a.connections].find(([,target])=>target===a.contexts[0]?.destination)?.[0];return {channels:channels.map(n=>a.targets.get(n.gain)||0),master:master?.gain.value,contexts:a.contexts.length};});
  await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(300);await frames(3);assert.deepEqual((await levels()).channels,[0,0]);
  await page.getByRole('button',{name:'SOUND ON',exact:true}).click();await frames(2);assert.equal((await levels()).master,0);
  await frames(30,{forward:true});assert.ok((await levels()).channels[0]>0);assert.equal((await levels()).channels[1],0);
  await frames(82,{forward:true,grind:true});assert.equal((await data()).rail,'diamond-1');let sound=await levels();assert.equal(sound.channels[0],0);assert.ok(sound.channels[1]>0);assert.equal(sound.channels.length,2);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')));assert.ok(saved.mall.career.longestAir>.3);assert.ok(saved.mall.career.longestJump>8);assert.equal(saved.mall.records.length,0);
  await page.screenshot({path:`artifacts/mall-contact/catch-${viewport.width}.png`});
  await page.getByRole('button',{name:'PAUSE / HELP'}).click();await frames(4);assert.deepEqual((await levels()).channels,[0,0]);
  await page.getByRole('button',{name:'BACK TO IT →'}).click();await frames(12);assert.equal((await data()).rail,'');assert.deepEqual((await levels()).channels,[0,0]);assert.doesNotMatch((await data()).skateAction,/grind/);
  await page.screenshot({path:`artifacts/mall-contact/release-${viewport.width}.png`});await frames(90);assert.ok((await levels()).channels[0]>0);assert.equal((await levels()).channels[1],0);assert.equal((await data()).manual,'false');
  await page.getByRole('button',{name:'SOUND OFF',exact:true}).click();await frames(2);assert.ok((await levels()).master>.1);
  await page.keyboard.press('r');await page.waitForTimeout(200);await frames(3);sound=await levels();assert.deepEqual(sound.channels,[0,0]);assert.equal(sound.contexts,1);assert.equal((await data()).rail,'');
  await page.locator('header a').click();await page.waitForURL('**/os');await page.waitForFunction(()=>{const a=window.skateAudioAudit,c=a.contexts[0];return c.state==='closed'&&a.sources.filter(n=>n.loop&&n.context===c).every(n=>a.stops.has(n));},null,{polling:50});
  assert.deepEqual(errors,[]);console.log('PASS rail records, contact channels, air/pause silence, mute, retry reuse and disposal',viewport.width);await context.close();
 }
}finally{await browser.close();}
