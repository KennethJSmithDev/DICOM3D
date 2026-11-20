import {buildR5Evidence} from '../../../viewer/src/interop-r5-evidence.mjs';
import {isVerifiedVolume} from '../../../viewer/src/verified-volume.mjs';
import {boundedStreamBytes, PUBLIC_RESEARCH_ASSETS, PUBLIC_RESEARCH_SOURCE, publicAssetUrl} from '../../../viewer/src/public-source-binding.mjs';

const need = (condition, code) => { if (!condition) throw Object.assign(new Error(code), {code}); };

// The historical mapper owns the source-bound R5 graph; this adapter only obtains
// its pinned public binding and checks that the local volume remains unchanged.
export async function prepareResearchR5Evidence({study, sourceEncoding, generation, currentGeneration, appBase, pageUrl, signal, fetchImpl = globalThis.fetch, recorded = new Date().toISOString()}) {
  const check = () => {
    if (signal?.aborted) throw Object.assign(new Error('CANCELLED'), {code: 'CANCELLED'});
    need(Number.isSafeInteger(generation) && generation > 0 && currentGeneration() === generation, 'STALE_GENERATION');
  };
  check();
  need(isVerifiedVolume(study), 'UNVERIFIED_VOLUME');
  const source = study.descriptor.source;
  need(source.studyIdentity === PUBLIC_RESEARCH_SOURCE.source_study_uid && source.seriesIdentity === PUBLIC_RESEARCH_SOURCE.ct_series_uid &&
    source.frameOfReferenceIdentity === PUBLIC_RESEARCH_SOURCE.frame_of_reference_uid, 'UNSUPPORTED_RESEARCH_SOURCE');
  need(sourceEncoding?.sopClassUid === '1.2.840.10008.5.1.4.1.1.2' &&
    sourceEncoding?.transferSyntaxUid === '1.2.840.10008.1.2' && sourceEncoding?.decoded === true, 'SOURCE_ENCODING_REQUIRED');
  const url = publicAssetUrl(appBase, PUBLIC_RESEARCH_ASSETS.metadata.filename, pageUrl);
  need(typeof fetchImpl === 'function', 'BINDING_UNAVAILABLE');
  await study.assertSourceUnchanged();
  check();

  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', cancel, {once: true});
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => controller.abort('Public binding fetch deadline exceeded'), 15000);
  try {
    const response = await fetchImpl(url, {credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal});
    check();
    need(response.ok && response.url === url, 'BINDING_UNAVAILABLE');
    const encoding = (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase();
    need(['identity', 'gzip', 'br', 'deflate'].includes(encoding), 'BINDING_UNAVAILABLE');
    const length = response.headers.get('content-length');
    if (encoding === 'identity' && length !== null) {
      need(/^\d+$/.test(length) && Number(length) === PUBLIC_RESEARCH_ASSETS.metadata.bytes, 'BINDING_UNAVAILABLE');
    }
    const bytes = await boundedStreamBytes(response.body, PUBLIC_RESEARCH_ASSETS.metadata.bytes, 'Public source binding');
    check();
    const graph = await buildR5Evidence(study, bytes, {generation, currentGeneration, recorded, sourceEncoding});
    await study.assertSourceUnchanged();
    check();
    return graph;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}
