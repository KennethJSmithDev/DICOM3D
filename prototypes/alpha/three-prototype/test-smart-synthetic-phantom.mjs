import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSyntheticSmartHarness} from '../viewer/src/smart-synthetic.mjs';
import {syntheticStudyBundle,syntheticViewerPhantom} from '../viewer/src/smart-synthetic-fixture.mjs';
import {isVerifiedVolume,verifiedFrameRgba} from '../viewer/src/verified-volume.mjs';

async function session(version) {
  const harness=createSyntheticSmartHarness();
  const request=await harness.begin({tenantKey:'synthetic-a',persona:'patient',launchKind:'standalone',fhirVersion:version});
  const context=await harness.complete(harness.issueSyntheticCode(request.authorizationRequest));
  return {harness,context};
}

test('synthetic study links and generated volume reach the verified viewer-input contract for R4, R4B and R5', async () => {
  for (const version of ['4.0.1','4.3.0','5.0.0']) {
    const {harness,context}=await session(version), bundle=syntheticStudyBundle(context);
    const before=JSON.stringify(bundle), {reference,input}=await syntheticViewerPhantom(harness,context);
    assert.equal(JSON.stringify(bundle),before);
    assert.equal(reference.resource,'ImagingStudy/synthetic-viewer-study');
    assert.equal(reference.links[0].status,'SAME_SUBJECT_REFERENCE');
    assert.equal(reference.fhirVersion,version);
    assert.equal(input.kind,'verified-volume');
    assert.equal(input.patientMatch,'not-established');
    assert.equal(input.atlasRegistration,'not-established');
    assert.equal(isVerifiedVolume(input.volume),true);
    assert.deepEqual(input.volume.descriptor.shape,[8,32,32]);
    assert.equal(input.volume.descriptor.source.studyIdentity,reference.dicomStudyUid);
    assert.equal(await input.volume.assertSourceUnchanged(),true);
    const rgba=verifiedFrameRgba(input.volume,0,600,1200,new Uint8ClampedArray(32*32*4));
    assert.ok(new Set(rgba.filter((_,i)=>i%4===0)).size >= 3);
  }
});

test('a closed synthetic session cannot generate a viewer phantom', async () => {
  const {harness,context}=await session('4.0.1');harness.closeSession(context);
  await assert.rejects(syntheticViewerPhantom(harness,context),{code:'INVALID_SESSION'});
});
