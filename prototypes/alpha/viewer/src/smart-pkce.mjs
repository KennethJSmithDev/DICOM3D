const need=(value,code)=>{if(!value)throw Object.assign(new Error(code),{code});};
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function randomSmartValue(){
  need(globalThis.crypto?.getRandomValues&&globalThis.crypto?.subtle,'CRYPTO_UNAVAILABLE');
  return base64url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}
export async function pkceS256(verifier){
  need(typeof verifier==='string'&&/^[A-Za-z0-9._~-]{43,128}$/.test(verifier),'INVALID_VERIFIER');
  need(globalThis.crypto?.subtle,'CRYPTO_UNAVAILABLE');
  return base64url(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
}
