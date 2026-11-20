# Epic on FHIR sandbox experiment

This optional, local development path uses Epic's public sandbox and its test accounts only. The reference viewer and synthetic demonstration remain usable without Epic, IRIS, or OMOP. The experiment is not a clinical, production, EHR-launch, or diagnostic-imaging integration.

## Register the test app

1. Sign in or create an account at [Epic on FHIR My Apps](https://fhir.epic.com/Developer/Apps), open **Build Apps**, and choose **Create My First App** or **Create**. Use a separate sandbox-only app that will never be activated for customers; Epic recommends this for loopback redirect testing.
2. Name the app, select the patient-facing consumer and default FHIR R4, and choose the public client profile for this browser-based test. Select SMART scope version 2 where Epic offers the setting, because this experiment requests `patient/ImagingStudy.rs`. Do not enable a confidential client or refresh-token workflow for this experiment.
3. Add the exact local redirect URI `http://127.0.0.1:57980/dicom3d/`. The host, port, path, and trailing slash must match. This loopback HTTP address is for sandbox development only.
4. Select only the appropriate patient-facing R4 imaging-study search API if Epic offers it. The sandbox's public CapabilityStatement declares ImagingStudy read/search, but the [public API catalog](https://open.epic.com/Interface/FHIR) lists Media and Binary study APIs under ImagingStudy. Availability for this consumer and the registered client is **not verified**. If the portal does not offer an appropriate ImagingStudy search, do not select unrelated APIs as a substitute; retain the discrepancy for the next integration step.
5. Save and mark the app **Ready for Sandbox**, not production. Epic says a new or edited draft can take up to one hour to synchronize with the sandbox. Use the **non-production client ID**; no client secret is used. See [Epic's registration instructions](https://fhir.epic.com/Documentation?docid=implementing&section=common_build_resources).

## Try it

Serve the qualified candidate at the registered local address before starting. Open **Imaging → Connect Epic sandbox (test data)**, enter the non-production client ID, and connect. Sign in on Epic's own page using only an account listed in [Epic's sandbox test-data documentation](https://fhir.epic.com/Documentation?docId=testpatients). Starting the flow reloads the viewer and resets its unsaved view.

The flow requests patient context and patient-scoped ImagingStudy search, with authorization-code PKCE and per-tab transaction state. Access tokens and patient context are held in memory and discarded on reload or disconnect. It does not persist patient data or fetch image pixels. A returned study reference is metadata, not a scan or evidence of image-retrieval authorization. Ending the local session discards the local token; server-side revocation is not implemented.

The callback is scrubbed from the browser URL as the application starts, but a local web server or browser extensions may independently log request URLs. Use a local preview configured not to log authorization queries and avoid exposing callback URLs in captures. This experimental browser client does not protect against malicious code already running on the same origin.

## Qualification boundary

The initial test uses the fixed public Epic R4 sandbox issuer; arbitrary issuers and production endpoints are rejected. Mocked browser tests exercise the redirect, token exchange, context, search, and disconnect. Public sandbox discovery and metadata were fetched without a patient login. Until a registered client completes the actual sandbox round trip, live authorization, granted scopes, test-data availability, and the real ImagingStudy search response remain unverified. Clinician/EHR launch, R4B/R5 Epic endpoints, clinical registration, DICOMweb retrieval, and production use are outside this experiment.
