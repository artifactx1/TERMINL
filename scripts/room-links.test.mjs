import test from 'node:test';
import assert from 'node:assert/strict';
import {roomLink,parseRoomLink} from '../lib/arcade/room-links.mjs';

const seat={code:'a1b2c3d4',token:'abcdefghijklmnopqrstuvwxyzABCDEF'};

test('player and watch links keep scoped tokens in the URL fragment',()=>{
  const play=roomLink('https://terminl.example','/os/rumble',seat);
  const watch=roomLink('https://terminl.example','/os/rumble',seat,true);
  assert.equal(new URL(play).search,'');
  assert.deepEqual(parseRoomLink(play,'https://terminl.example'),{...seat,watch:false});
  assert.deepEqual(parseRoomLink(watch,'https://terminl.example'),{...seat,watch:true});
});

test('invalid room invitations are rejected',()=>{
  assert.equal(parseRoomLink('https://terminl.example/os/rumble#room=bad&token=short','https://terminl.example'),null);
  assert.equal(parseRoomLink('https://terminl.example/os/rumble','https://terminl.example'),null);
});
