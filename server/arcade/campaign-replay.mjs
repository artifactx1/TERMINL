import {parentPort,workerData} from 'node:worker_threads';
import {cupSegment} from '../../lib/arcade/bot-challenge.mjs';
import {rumbleSegment} from '../../lib/arcade/rumble-challenge.mjs';
const {challenge,progress,replay}=workerData;
try{
  const verify=challenge?.kind==='cup'?cupSegment:challenge?.kind==='rumble'?rumbleSegment:null;
  if(!verify)throw new Error('This challenge version has expired. Start a new run.');
  parentPort.postMessage({result:verify(challenge,progress,replay)});
}catch(error){parentPort.postMessage({error:error.message});}
