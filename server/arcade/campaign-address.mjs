import {keccak_256} from '@noble/hashes/sha3';
export function normalizeAddress(value){
  if(typeof value!=='string')throw new Error('Paste a public wallet address');
  const address=value.trim();
  if(!/^0x[0-9a-fA-F]{40}$/.test(address)||/^0x0{40}$/.test(address))throw new Error('Enter a valid public 0x wallet address');
  const body=address.slice(2),lower=body.toLowerCase();
  if(body!==lower&&body!==body.toUpperCase()){
    const digest=Buffer.from(keccak_256(Buffer.from(lower))).toString('hex');
    const checksum=[...lower].map((c,i)=>parseInt(digest[i],16)>=8?c.toUpperCase():c).join('');
    if(checksum!==body)throw new Error('The address checksum is invalid. Copy it again from your wallet.');
  }
  return '0x'+lower;
}
