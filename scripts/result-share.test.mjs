import test from 'node:test';
import assert from 'node:assert/strict';
import {resultShareText,resultShareIntent} from '../lib/arcade/result-share.mjs';

test('share copy describes verified partial, lost and cleared runs honestly',()=>{
  const partial={kind:'cup',code:'AbCdEfGhIjKlMnOp',points:10,progress:{races:2},result:null};
  const lost={...partial,result:{qualified:false,points:[42,54]}};
  const cleared={...partial,result:{qualified:true,points:[60,54]}};
  const rumble={kind:'rumble',code:partial.code,points:110,result:{qualified:true,losses:1}};
  const rumblePartial={...rumble,result:null,progress:{index:2}};
  assert.match(resultShareText(partial),/2\/6 Barry Cup races/);
  assert.match(resultShareText(lost),/BarryBot took the cup 54–42/);
  assert.match(resultShareText(rumble),/6 Rekt Rumble fights with 1 retry/);
  for(const run of [partial,lost,cleared,rumble,rumblePartial])assert.doesNotMatch(resultShareText(run),/#ad\b/i);
  const intent=new URL(resultShareIntent(partial,'https://terminl.test'));
  assert.equal(intent.hostname,'x.com');
  assert.equal(intent.searchParams.get('url'),'https://terminl.test/challenge/AbCdEfGhIjKlMnOp');
});
