# FHIR interoperability development candidate

This document describes work prepared for a possible **v0.7.0-alpha.2**. It is not a published release or a claim that an installed DICOM3D service can access a FHIR server or PACS. The published alpha.1 and v0.6.5 artifacts remain separate.

## What the local viewer can inspect

The imaging workspace can read a CapabilityStatement from the fixed public SMART FHIR test server, or an R4, R4B or R5 CapabilityStatement or Bundle that the user selects locally. Local files stay on the device. A source version must be selected for a Bundle; ordinary resource JSON does not establish its FHIR version. The capability view describes what the server declares, not what a particular user is authorized to do.

For imaging evidence, the viewer displays selected explicit source references. R4/R4B `DiagnosticReport.imagingStudy` and R5 `DiagnosticReport.study` are treated as different source fields. R5 ImagingSelection subset values remain associated with their source instance; they are not automatically CT frame numbers. A matching subject reference is not patient matching, clinical interpretation, or atlas registration.

The optional **Compare an R4/R4B-to-R5 conversion** control compares two local Bundles after the user selects the original version. It checks selected imaging identifiers, series and instance identities, modality codes, subject references, and report references. A detected difference requires review of the original source. A result with no detected differences is limited to those checks: it is neither a complete loss report nor FHIR profile validation. DICOM3D does not perform the conversion in this control.

## Optional server boundary

An experimental server-side metadata reader accepts only a configured source identifier and requires an authorization callback supplied by its host. It requests only the selected source's `/metadata` (up to 8 MiB) and retains a bounded fingerprint and capability projection. A separate reader can retrieve an explicitly allowlisted `ImagingStudy` by ID, using the same bounded, read-only transport and a host authorization decision for that exact source and study. Its configured FHIR version is a label until the host independently checks the source metadata. An ImagingStudy is metadata, not retrieved DICOM pixels or proof of patient registration. Credentials supplied by the host are not returned to the caller.

These readers are source-level integration sockets. The existing standalone Core server does **not** mount them; no patient-resource, FHIR-write, IRIS, Orthanc or PACS endpoint is exposed by it. An authenticated host, installation, connection policy and actual runtime must be qualified before claiming a live viewer connector.

### Opt-in local IRIS preview

The local preview can optionally expose a narrowly scoped live ImagingStudy read to its own viewer. It requires a local configuration file supplied through `DICOM3D_LIVE_FHIR_CONFIG` before the preview starts. The file defines source IDs, FHIR versions, base URLs and allowed ImagingStudy IDs; it must not contain credentials. For example:

```json
{
  "schema": "dicom3d-loopback-fhir-1",
  "sources": [{
    "id": "example",
    "baseUrl": "https://fhir.example.invalid/r5",
    "fhirVersion": "5.0.0",
    "imagingStudyIds": ["study-1"]
  }]
}
```

The viewer asks the user for their own IRIS username and password for each read; DICOM3D does not store them. The local bridge accepts same-origin browser requests on `127.0.0.1` and forwards those credentials only to the configured source. That source is responsible for enforcing authentication and authorization; a successful response alone does not prove it did so. Credentialed upstream reads require HTTPS with a certificate trusted by the runtime, including on loopback. A previous plain-HTTP local fixture must be given an authenticated HTTPS endpoint before it can be used for live reads; the viewer and public H000 example remain available. The bridge checks the server's actual CapabilityStatement version before presenting the study. It does not supply a service account, infer authorization from metadata, write to FHIR, or accept a browser-selected upstream URL.

When the public H000 CT is open, the viewer can compare the returned study, series and instance IDs with the verified local CT source. An identity match does not establish patient matching, atlas registration or clinical accuracy. FHIR ImagingStudy contains metadata, not the DICOM pixel data. The pixels and SEG in that example remain the separately verified local H000 copies.

This is a local research-preview path, not an installed Core/IPM connector or a public service. It does not establish OAuth, per-patient access policy, arbitrary study discovery, PACS retrieval, or remote-host security. An installed authenticated IRIS integration needs separate host-specific qualification.

## Offline read-only OpenAPI template

The source checkout includes an independently authored, offline export for a single-server R4, R4B or R5 CapabilityStatement. From the repository root, run:

```text
node scripts/export-fhir-readonly-openapi.mjs --input statement.json --output fhir-template.json
```

The exporter reads at most 8 MiB of CapabilityStatement metadata and will not overwrite an existing file. The separate local imaging-evidence limit is unchanged. It writes read, version-read, type-search, and instance, type and system history protocol templates only where those interactions are declared, with an SHA-256 fingerprint of the input. It makes no network requests and uses a non-routable placeholder server by default; `--base-url` can specify an operator-selected HTTPS endpoint or a loopback HTTP endpoint. Credentials, queries and fragments in that URL are refused. The generated OpenAPI document omits authentication schemes, profiles, search parameters, other system interactions and write operations; omitted declared interactions are listed in its metadata. **An omitted security scheme does not mean a server is public.** Check actual server methods, permissions and security before use; even a declared search method may be rejected. The file is a limited template, not a complete or validated server contract. The source-only tool is not included in the current Core or IPM runtime.

## Local HL7 fixture draft

The imaging workspace can inspect a local ASCII HL7 v2.5 `ADT^A01` MSH/EVN test fixture and draft a FHIR R4, R4B or R5 Organization for review. It also accepts one deliberately limited PID segment: one simple identifier, family and given name, an optional complete birth date, and optional administrative sex `M`, `F` or `U`. The patient identifier needs an explicitly supplied system URI; it is never inferred from the sending facility or message control ID. Additional PID fields, repeated values, escapes, non-ASCII text, extra segments and unsupported administrative-sex codes are refused rather than silently dropped. The mapped administrative field is not an assertion about gender identity.

The sending facility is used as the Organization name; its identifier is included only when its system URI is explicitly provided. The source message control ID remains separate from a FHIR resource ID. Input is fingerprinted locally; drafts are not sent to a server or written to a repository. The PID test values are DICOM3D-authored synthetic extensions of ISAIAH's retained header fixture, not patient segments supplied by ISAIAH. This narrow fixture profile is not a general HL7 parser, a complete ADT message conversion, or evidence of live interoperability.

Community-idea implementations must be independently authored. The exporter uses DICOM3D's own capability projection and the published standards; it does not incorporate another contributor's implementation.

## Source and limits

- [HL7 FHIR R4 DiagnosticReport](https://hl7.org/fhir/R4/diagnosticreport.html), [R4B DiagnosticReport](https://hl7.org/fhir/R4B/diagnosticreport.html) and [FHIR R5 DiagnosticReport](https://hl7.org/fhir/R5/diagnosticreport.html) describe the study-reference fields.
- [HL7 FHIR R5 ImagingSelection](https://hl7.org/fhir/R5/imagingselection.html) describes the R5 source selection resource.
- [HL7's PID-to-Patient mapping](https://hl7.org/fhir/uv/v2mappings/ConceptMap-segment-pid-to-patient.html) and [administrative-sex mapping](https://hl7.org/fhir/uv/v2mappings/ConceptMap-table-hl70001-to-administrative-gender.html) provide the standards reference for the limited PID draft; the implementation is original and remains review-required.
- [HL7 FHIR R4 REST](https://hl7.org/fhir/R4/http.html), [FHIR R4B REST](https://hl7.org/fhir/R4B/http.html), [FHIR R5 REST](https://hl7.org/fhir/R5/http.html), and the [OpenAPI 3.0.3 specification](https://spec.openapis.org/oas/v3.0.3) define the protocol conventions used for the read-only template.
- [InterSystems FHIR server installation](https://docs.intersystems.com/irisforhealthlatest/csp/docbook/DocBook.UI.Page.cls?KEY=HXFHIRINS_server_install_new) documents version-dependent server choices and the narrower HealthShare transformation boundary.
- The public H000 example is a separately admitted research dataset. Generalized reference anatomy is not registered to acquired imaging.

These capabilities are for research and education, not clinical diagnosis. The project [NOTICE](../NOTICE), third-party license files and anatomy attribution remain applicable.
