# Synthetic SMART foundation

This is an offline research demonstration for planning a shared patient-facing and clinician-facing SMART launch. It is not a production SMART client, an Epic/MyChart integration, an identity provider, or a clinical authorization service. In the candidate viewer, open **Imaging → Try a synthetic SMART launch**. The demonstration is loaded on demand; standalone anatomy, H000 and the existing viewer do not need a synthetic session.

The harness uses fixed `.invalid` tenant and authorization-server names, synthetic resource IDs and Web Crypto. Discovery and authorization are simulated locally: no provider request, real token exchange or access token exists. Do not supply patient records or credentials.

The simulated callback performs an actual same-viewer navigation in a loopback or `.invalid` preview. A five-minute synthetic transaction checkpoint and the resulting synthetic session are kept in per-tab `sessionStorage`, and callback parameters are removed from the address bar. The pending checkpoint is consumed before completion; ending the session clears these entries. Starting a simulation reloads the viewer and resets the current unsaved view. A real provider redirect needs a separately designed and reviewed transaction-storage, issuer and callback mechanism; this client-side simulation is not proof of authorization or security against a malicious same-origin script.

## Boundaries

- `discovery` returns a fixed synthetic FHIR base, configuration location and separate authorization-server endpoints. The FHIR base and authorization-server issuer have different roles.
- `begin`, `issueSyntheticCode` and `complete` model an authorization-code transaction with S256 PKCE, state, redirect, issuer, audience and a one-time synthetic code. The mock requires an issuer in its callback; real provider behavior and mix-up protections need independent verification.
- Patient versus clinician is a presentation profile, not an authorization grant. EHR versus standalone launch is a separate choice. Context and exact requested scopes are negotiated by the synthetic fixture; broad access and offline tokens are not modeled.
- Sessions expire and can be closed or cleared. Pending launches are bounded and can be cancelled. A session or reference from another harness, tenant, patient or session cannot be substituted.
- `clinicalStudyReference` reuses the existing R4, R4B and R5 evidence projection. It preserves the selected FHIR version, source, explicit study identity, optional DICOM study UID and relationship status. Missing or mismatched links remain unresolved. This is a scoped fixture projection, not FHIR conformance or automatic conversion between versions.
- `viewerStudyInput` either returns metadata-only or accepts an existing verified volume with a matching synthetic study UID. A UID match alone does not establish patient identity, image-retrieval authorization or atlas registration; the return value explicitly says so.
- The optional test image is an algorithmically generated phantom, not an acquired DICOM object. Its frame and source-file hash fields identify generated raw frame bytes. No original DICOM source file or patient record is claimed.
- The harness retains only the supplied synthetic context in memory. This is not a privacy certification for a future clinical integration.

## Optional OMOP research path

OMOP may be evaluated later as a separate, optional research projection for authorized data. It is not needed for SMART launch, image retrieval, source verification or standalone viewing. A future evaluation must preserve source FHIR and imaging identities, identify terminology and mapping losses, use synthetic data first, and verify service availability, version support, authorization, governance and cost. No OMOP dependency or service is configured here.

## Running the focused checks

From `prototypes/alpha/three-prototype`:

```text
node --max-old-space-size=512 --test test-smart-synthetic.mjs test-smart-synthetic-redirect.mjs test-smart-synthetic-phantom.mjs test-fhir-evidence-projection.mjs test-verified-volume.mjs
```

The H000 graph test in the existing evidence suite is skipped unless its separate fixture is configured. The SMART harness tests use generated synthetic metadata and an eight-voxel synthetic verified volume.

An optional browser witness uses an already installed Playwright module; it installs nothing. Set `DICOM3D_PLAYWRIGHT_MODULE` to that module's `index.mjs`, then run `node --test test-smart-synthetic-browser.mjs`. It opens an automation-owned headed Edge session and fulfills only the synthetic page and module files through Playwright routing. It starts no application server and makes no provider request. The witness is a module/cryptography check, not a test of the running viewer.

## Before any real provider connection

An independently reviewed integration must verify current provider registration, discovery metadata, endpoints, redirect handling, issuer binding, actual scopes, token/session handling, transport, consent and patient isolation. It must separately establish an authorized imaging source and preserve the viewer's verified-volume boundary. R4/R4B/R5 fixture tests here do not prove a provider supports those versions. No production or clinical claim follows from this harness.

Standards references used for the synthetic model and the public PKCE test vector:

- SMART App Launch 2.2: https://hl7.org/fhir/smart-app-launch/app-launch.html
- SMART scopes and launch context: https://hl7.org/fhir/smart-app-launch/scopes-and-launch-context.html
- PKCE: https://www.rfc-editor.org/rfc/rfc7636.html
- OAuth security best current practice: https://www.rfc-editor.org/rfc/rfc9700.html
