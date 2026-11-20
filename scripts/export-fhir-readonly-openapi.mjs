import { createHash } from 'node:crypto';
import { open, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createReadOnlyOpenApi } from './fhir-readonly-openapi.mjs';
import { MAX_CAPABILITY_BYTES } from '../prototypes/alpha/viewer/src/fhir-capability-model.mjs';

const MAX_INPUT = MAX_CAPABILITY_BYTES;

async function main() {
  const { values } = parseArgs({ strict: true, options: {
    input: { type: 'string' }, output: { type: 'string' }, 'base-url': { type: 'string' }
  } });
  if (!values.input || !values.output) throw new Error('Provide --input and --output');
  const handle = await open(values.input, 'r');
  let bytes;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_INPUT) throw new Error('Input must be a file no larger than 8 MiB');
    const buffer = Buffer.alloc(MAX_INPUT + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > MAX_INPUT) throw new Error('Input grew beyond the 8 MiB limit');
    bytes = buffer.subarray(0, used);
  } finally { await handle.close(); }
  const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
  let statement;
  try { statement = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error('Input is not valid UTF-8 JSON'); }
  const document = createReadOnlyOpenApi({ statement, sourceSha256, baseUrl: values['base-url'] });
  const result = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(values.output, result, { flag: 'wx' });
  const operations = Object.values(document.paths).reduce((total, item) => total + Object.keys(item).length, 0);
  console.log(JSON.stringify({ status: 'created', sourceSha256, fhirVersion: statement.fhirVersion,
    operations, bytes: Buffer.byteLength(result), networkRequests: 0 }));
}

main().catch(error => {
  const message = error.code ? 'Cannot read the input or create a new output file' : error.message;
  console.error(`Export failed: ${message}`); process.exitCode = 1;
});
