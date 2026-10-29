import test from 'node:test';
import assert from 'node:assert/strict';
import { localTestUrl, rehearsalEnv } from './mint-rehearsal-safety.mjs';

test('only explicit loopback targets are accepted', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) assert.equal(localTestUrl(`http://${host}:4007`), `http://${host}:4007`);
  for (const url of ['https://terminl.net', 'http://terminl.net:4007', 'http://127.0.0.1.evil.example:4007', 'http://127.0.0.1', 'http://user:password@127.0.0.1:4007', 'http://127.0.0.1:4007/api', 'http://127.0.0.1:4007?target=production']) assert.throws(() => localTestUrl(url));
});
test('credentials and production endpoints cannot leak into test processes', () => {
  const env = rehearsalEnv({ PATH: '/bin', DATABASE_URL: 'secret', GITHUB_TOKEN: 'secret', RPC_URL: 'https://production.invalid', NEXT_PUBLIC_TERMINL_CONTRACT: 'production' }, 'http://127.0.0.1:4007', 'http://127.0.0.1:4008');
  assert.equal(env.DATABASE_URL, undefined);
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.RPC_URL, 'http://127.0.0.1:4008');
  assert.equal(env.NEXT_PUBLIC_TERMINL_CONTRACT, '0x00000000000000000000000000000000f1c70000');
  assert.equal(env.NEXT_PUBLIC_REOWN_PROJECT_ID, '');
});
