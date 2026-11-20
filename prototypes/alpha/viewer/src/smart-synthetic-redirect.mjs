import {createSyntheticSmartHarness} from './smart-synthetic.mjs';
import {SYNTHETIC_PENDING_KEY,SYNTHETIC_SESSION_KEY,SYNTHETIC_CALLBACK_PARAMS as PARAMS} from './smart-synthetic-keys.mjs';

export {SYNTHETIC_PENDING_KEY,SYNTHETIC_SESSION_KEY};
const LIMIT = 8192;
const need = (value, code) => { if (!value) throw Object.assign(new Error(code),{code}); };

function viewerUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Object.assign(new Error('INVALID_REDIRECT'),{code:'INVALID_REDIRECT'}); }
  need(!url.username && !url.password && url.origin !== 'null', 'INVALID_REDIRECT');
  return url;
}
function redirectUri(url) { return `${url.origin}${url.pathname}`; }
function readJson(value) {
  need(typeof value === 'string' && value.length > 0 && value.length <= LIMIT, 'INVALID_CHECKPOINT');
  try { return JSON.parse(value); } catch { throw Object.assign(new Error('INVALID_CHECKPOINT'),{code:'INVALID_CHECKPOINT'}); }
}
function clear(storage, key) {
  try { storage.removeItem(key); } catch { throw Object.assign(new Error('STORAGE_UNAVAILABLE'),{code:'STORAGE_UNAVAILABLE'}); }
}

// Produces a same-viewer callback URL. The fictional authorization server is
// simulated locally; this function never navigates to or contacts an issuer.
export async function prepareSyntheticRedirect({storage,pageUrl,options,now} = {}) {
  const url = viewerUrl(pageUrl);
  need(PARAMS.every(key => !url.searchParams.has(key)), 'INVALID_REDIRECT');
  const harness = createSyntheticSmartHarness({viewerRedirectUri:redirectUri(url),...(now ? {now} : {})});
  const request = await harness.begin(options), callback = harness.issueSyntheticCode(request.authorizationRequest);
  const pending = JSON.stringify(harness.checkpoint(callback));
  need(pending.length <= LIMIT, 'INVALID_CHECKPOINT');
  try { storage.setItem(SYNTHETIC_PENDING_KEY,pending); storage.removeItem(SYNTHETIC_SESSION_KEY); }
  catch { try { storage.removeItem(SYNTHETIC_PENDING_KEY); } catch {} throw Object.assign(new Error('STORAGE_UNAVAILABLE'),{code:'STORAGE_UNAVAILABLE'}); }
  url.searchParams.set(PARAMS[0],callback.state);
  url.searchParams.set(PARAMS[1],callback.code);
  url.searchParams.set(PARAMS[2],callback.issuer);
  url.hash = 'imaging';
  return Object.freeze({mode:'synthetic-only',url:url.href});
}

// Consume before asynchronous work; refresh/replay cannot reuse the pending
// checkpoint. Query parameters are removed even when the callback is invalid.
export async function resumeSyntheticRedirect({storage,pageUrl,history,now} = {}) {
  const url = viewerUrl(pageUrl), present = PARAMS.some(key => url.searchParams.has(key));
  if (!present) return null;
  const valid = PARAMS.every(key => url.searchParams.getAll(key).length === 1);
  const callback = {state:url.searchParams.get(PARAMS[0]),code:url.searchParams.get(PARAMS[1]),issuer:url.searchParams.get(PARAMS[2]),redirectUri:redirectUri(url)};
  for (const key of PARAMS) url.searchParams.delete(key);
  try { history.replaceState(history.state,'',url.href); }
  catch { clear(storage,SYNTHETIC_PENDING_KEY); throw Object.assign(new Error('INVALID_REDIRECT'),{code:'INVALID_REDIRECT'}); }
  let raw;
  try { raw = storage.getItem(SYNTHETIC_PENDING_KEY); storage.removeItem(SYNTHETIC_PENDING_KEY); }
  catch { throw Object.assign(new Error('STORAGE_UNAVAILABLE'),{code:'STORAGE_UNAVAILABLE'}); }
  try {
    need(valid && raw, 'INVALID_CALLBACK');
    const harness = createSyntheticSmartHarness({viewerRedirectUri:callback.redirectUri,...(now ? {now} : {})});
    await harness.restoreCheckpoint(readJson(raw));
    const session = await harness.complete(callback);
    const saved = JSON.stringify({schema:'DICOM3D-synthetic-viewer-session-1',redirectUri:callback.redirectUri,checkpoint:harness.sessionCheckpoint(session)});
    need(saved.length <= LIMIT, 'INVALID_SESSION');
    try { storage.setItem(SYNTHETIC_SESSION_KEY,saved); }
    catch { throw Object.assign(new Error('STORAGE_UNAVAILABLE'),{code:'STORAGE_UNAVAILABLE'}); }
    return Object.freeze({harness,session});
  } catch (error) {
    clear(storage,SYNTHETIC_SESSION_KEY);
    throw error;
  }
}

export function restoreSyntheticViewerSession({storage,pageUrl,now} = {}) {
  const url = viewerUrl(pageUrl);
  let raw;
  try { raw = storage.getItem(SYNTHETIC_SESSION_KEY); }
  catch { throw Object.assign(new Error('STORAGE_UNAVAILABLE'),{code:'STORAGE_UNAVAILABLE'}); }
  if (!raw) return null;
  try {
    const value = readJson(raw), uri = redirectUri(url);
    need(value && typeof value === 'object' && Object.keys(value).length === 3 && value.schema === 'DICOM3D-synthetic-viewer-session-1' && value.redirectUri === uri, 'INVALID_SESSION');
    const harness = createSyntheticSmartHarness({viewerRedirectUri:uri,...(now ? {now} : {})});
    return Object.freeze({harness,session:harness.restoreSession(value.checkpoint)});
  } catch (error) { clear(storage,SYNTHETIC_SESSION_KEY); throw error; }
}

export function clearSyntheticViewerSession(storage) {
  clear(storage,SYNTHETIC_PENDING_KEY);
  clear(storage,SYNTHETIC_SESSION_KEY);
}
