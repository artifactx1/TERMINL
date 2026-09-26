import {parentPort,workerData} from 'node:worker_threads';
import {replayChallenge} from '../../lib/arcade/bot-challenge.mjs';
try{parentPort.postMessage({result:replayChallenge(workerData.challenge,workerData.replay)});}
catch(error){parentPort.postMessage({error:error.message});}
