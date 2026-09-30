import assert from 'node:assert/strict';
import test from 'node:test';
import {access} from 'node:fs/promises';
import {ARCADE_SHARES,arcadeShareImage,canonicalArcadeUrl} from '../lib/arcade/share.mjs';

test('every public arcade card has complete social copy and a canonical URL',async()=>{
  for(const [id,card] of Object.entries(ARCADE_SHARES)){
    assert.match(id,/^[a-z0-9-]+$/);
    assert.ok(card.title.length>=12&&card.title.length<=70,`${id} title length`);
    assert.ok(card.description.length>=50&&card.description.length<=200,`${id} description length`);
    assert.ok(card.headline&&card.eyebrow&&card.accent,`${id} presentation`);
    assert.equal(new URL(canonicalArcadeUrl(card.path)).origin,'https://terminl.net');
    const image=new URL(arcadeShareImage(id));
    assert.equal(image.origin,'https://terminl.net');
    assert.equal(image.pathname,`/api/arcade-card/${id}`);
    assert.ok(image.searchParams.get('v'));
    for(const figure of card.figures||[]){
      assert.match(figure,/\.png$/,`${id} uses an ImageResponse-compatible PNG overlay`);
      await access(`public${figure}`);
    }
  }
});
