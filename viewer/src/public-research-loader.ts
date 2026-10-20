import {
  PUBLIC_RESEARCH_ASSETS, publicAssetUrl, boundedStreamBytes, verifyPublicBytes,
  parsePublicMetadata, decodePublicGzip, projectPublicResearch,
} from './public-source-binding.mjs';

// An explicit UI action calls this module. Importing it never connects or fetches.
// WHY: source ownership and integrity must be established before the viewer sees data.
// BOUNDARY: same-origin five-file local publication candidate, no Connect integration.
// INVARIANT: no caller-selected dataset/URL or fallback to a research directory.
// EVIDENCE: scripts/test-public-research-data.mjs and public-admission source receipts.
// REGRESSION: Content-Encoding auto-decode and repeated retained buffers can change costs.
export async function loadPublicResearchFixture(base: string) {
  if (typeof globalThis.DecompressionStream !== 'function') {
    throw Error('This research example requires native gzip decompression support.');
  }
  const started = performance.now();
  const files: Record<string, any> = {};
  const pageUrl = globalThis.location?.href;
  // Validate every fixed URL before any request.
  const urls = Object.fromEntries(Object.entries(PUBLIC_RESEARCH_ASSETS)
    .map(([key, asset]: [string, any]) => [key, publicAssetUrl(base, asset.filename, pageUrl)]));

  async function fetchAdmitted(key: keyof typeof PUBLIC_RESEARCH_ASSETS): Promise<Uint8Array> {
    const asset: any = PUBLIC_RESEARCH_ASSETS[key];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('Public research fetch deadline exceeded'), 30000);
    const start = performance.now();
    try {
      const response = await fetch(urls[key], {
        credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok || response.url !== urls[key]) throw Error(`${asset.filename}: unexpected asset response`);
      // Fetch exposes transport-decoded bytes. Their exact file identity is authoritative,
      // including the retained gzip container for .npy.bin; wire length is not decoded length.
      const encoding = (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase();
      if (!['identity', 'gzip', 'br', 'deflate'].includes(encoding)) {
        throw Error(`${asset.filename}: unexpected HTTP Content-Encoding`);
      }
      const declared = response.headers.get('content-length');
      if (encoding === 'identity' && declared !== null && (!/^\d+$/.test(declared) || Number(declared) !== asset.bytes)) {
        throw Error(`${asset.filename}: unexpected Content-Length`);
      }
      const bytes = await boundedStreamBytes(response.body, asset.bytes, asset.filename);
      await verifyPublicBytes(bytes, asset, asset.filename);
      files[key] = {
        bytes: bytes.byteLength, sha256: asset.sha256, transportEncoding: encoding,
        fetchAndVerifyMs: performance.now() - start,
      };
      return bytes;
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }
  const metadata = await parsePublicMetadata(await fetchAdmitted('metadata'));
  await fetchAdmitted('notice'); // The notice is integrity-bound even when the panel is closed.

  async function decoded(key: 'ct' | 'mask') {
    let compressed: Uint8Array | null = await fetchAdmitted(key);
    const start = performance.now();
    try {
      const result = await decodePublicGzip(compressed, key);
      Object.assign(files[key], {
        decodeAndVerifyMs: performance.now() - start, decodedBytes: result.byteLength,
        decodedSha256: PUBLIC_RESEARCH_ASSETS[key].decodedSha256,
      });
      return result;
    } finally { compressed = null; }
  }
  // Sequential decode releases the CT compressed object before loading the mask.
  const ct = await decoded('ct');
  const mask = await decoded('mask');
  const glb = await fetchAdmitted('mesh');
  const projectStarted = performance.now();
  const projected = await projectPublicResearch(metadata, ct, mask, glb);
  return {
    ...projected,
    metrics: {
      status: 'LOCAL_PUBLICATION_CANDIDATE', publicationApproved: false,
      loadAndVerifyMs: performance.now() - started,
      projectionAndSourceChecksMs: performance.now() - projectStarted,
      files,
      compressedRetention: 'Sequential fetch/decode; compressed references released after each decode',
      retainedDecodedNpyBytes: ct.byteLength + mask.byteLength,
      retainedGlbBytes: glb.byteLength,
      gpuMemoryBytes: null,
      totalBrowserMemoryBytes: null,
    },
    noticeUrl: urls.notice,
  };
}
