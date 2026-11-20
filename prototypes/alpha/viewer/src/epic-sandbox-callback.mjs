export const EPIC_SANDBOX_PENDING_KEY='DICOM3D.epic-sandbox.pending.1';
export const EPIC_SANDBOX_REDIRECT='http://127.0.0.1:57980/dicom3d/';
export const EPIC_STATE_PREFIX='d3epic_';
const PARAMETERS=['code','state','error','error_description','error_uri','iss','session_state'];

// The authorization response is consumed into memory before React mounts.
// This captures only our tagged sandbox transaction and never logs its values.
export function captureEpicSandboxCallback({pageUrl,history,getStorage}={}) {
  let url;
  try {url=new URL(pageUrl);} catch {return null;}
  const hasResponse=url.searchParams.has('code')||url.searchParams.has('error');
  if(!hasResponse)return null;
  let storage=null,pending=null,storageError=false;
  try {storage=getStorage();pending=storage.getItem(EPIC_SANDBOX_PENDING_KEY);} catch {storageError=true;}
  const marker=url.searchParams.getAll('state').some(value=>value.startsWith(EPIC_STATE_PREFIX));
  if(!pending&&!marker)return null;
  const single=key=>url.searchParams.getAll(key).length<=1;
  const invalid=!PARAMETERS.every(single)||url.searchParams.getAll('state').length!==1||
    (url.searchParams.has('code')===url.searchParams.has('error'));
  const callback={pending,redirectUri:`${url.origin}${url.pathname}`,code:url.searchParams.get('code'),state:url.searchParams.get('state'),
    issuer:url.searchParams.get('iss'),denied:url.searchParams.has('error'),invalid,storageError};
  for(const name of PARAMETERS)url.searchParams.delete(name);
  // Only this known presentation option may survive the redirect; no callback data is copied back.
  try {if(JSON.parse(pending)?.renderer==='webgl')url.searchParams.set('renderer','webgl');} catch {}
  try {history.replaceState(history.state,'',url.href);} catch {callback.invalid=true;}
  try {storage?.removeItem(EPIC_SANDBOX_PENDING_KEY);} catch {callback.storageError=true;}
  return callback;
}
