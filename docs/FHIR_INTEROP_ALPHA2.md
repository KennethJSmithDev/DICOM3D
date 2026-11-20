# FHIR interoperability in DICOM3D

The v0.7.0 release candidate includes these research features. Availability of a live source depends on the installed services, transport configuration and the signed-in reader’s permissions.

## What the local viewer can inspect

The imaging workspace can read a CapabilityStatement from the fixed public SMART FHIR test server, or an R4, R4B or R5 CapabilityStatement or Bundle that the user selects locally. Local files stay on the device. A source version must be selected for a Bundle; ordinary resource JSON does not establish its FHIR version. The capability view describes what the server declares, not what a particular user is authorized to do.

For imaging evidence, the viewer displays selected explicit source references. R4/R4B `DiagnosticReport.imagingStudy` and R5 `DiagnosticReport.study` are treated as different source fields. R5 ImagingSelection subset values remain associated with their source instance; they are not automatically CT frame numbers. A matching subject reference is not patient matching, clinical interpretation, or atlas registration.

The optional **Compare an R4/R4B-to-R5 conversion** control compares two local Bundles after the user selects the original version. It checks selected imaging identifiers, series and instance identities, modality codes, subject references, and report references. A detected difference requires review of the original source. A result with no detected differences is limited to those checks: it is neither a complete loss report nor FHIR profile validation. DICOM3D does not perform the conversion in this control.

## Optional server boundary

An experimental server-side metadata reader accepts only a configured source identifier and requires an authorization callback supplied by its host. It requests only the selected source's `/metadata` (up to 8 MiB) and retains a bounded fingerprint and capability projection. A separate reader can retrieve an explicitly allowlisted `ImagingStudy` by ID, using the same bounded, read-only transport and a host authorization decision for that exact source and study. Its configured FHIR version is a label until the host independently checks the source metadata. An ImagingStudy is metadata, not retrieved DICOM pixels or proof of patient registration. Credentials supplied by the host are not returned to the caller.

The local preview and standalone Core can mount these readers on loopback when configured. The installed IPM viewer also supports the native IRIS binding described below. The offline viewer can open the public example and local files without configuring a FHIR source.

### Local preview and standalone Core

The local preview and standalone Core accept a configuration file through `DICOM3D_LIVE_FHIR_CONFIG`. Set it before startup, keep the file outside the served viewer directory and use the numeric loopback address to open the viewer. The configuration contains source IDs, FHIR versions, HTTPS base URLs and allowed synthetic ImagingStudy IDs. Supply credentials only when the viewer prompts for them.

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

Configured Core listens exclusively on `127.0.0.1:8080` in its network namespace. On a Linux host supporting Docker host networking, mount the configuration read-only and run your locally built Core image in the host network. Use the browser on that computer. For an internal certificate authority, mount its public certificate read-only and set `NODE_EXTRA_CA_CERTS` to the certificate path inside the container.

```sh
docker run --rm --network host --read-only --cap-drop ALL --security-opt no-new-privileges --memory 768m --cpus 2 --pids-limit 64 \
  --mount type=bind,source=/absolute/path/to/fhir.json,target=/run/dicom3d-fhir.json,readonly \
  --env DICOM3D_LIVE_FHIR_CONFIG=/run/dicom3d-fhir.json YOUR_LOCAL_CORE_IMAGE
```

Open `http://127.0.0.1:8080/dicom3d/reference.html`. Requests arriving through ordinary Docker bridge forwarding have a different peer address and are refused for credentialed reads. The standard Compose service serves the standalone viewer with live FHIR disabled.

### Installed IPM viewer on HTTPS

Serve the installed `/dicom3d/` viewer and an authenticated FHIR repository from one HTTPS origin with a trusted certificate. The IPM module installs the binding reader on the existing protected `/dicom3d/DICOM3D.Entry.cls` page. A read uses the same application and browser session as the viewer. A normal visit to the entry continues to open the viewer. The application can be used offline without configuring a FHIR repository.

In the installed API’s namespace (`USER` by default), an administrator may grant a synthetic test reader access to one source key and ImagingStudy ID. For example, assuming that the repository already exists and the reader can access it:

```objectscript
Set ^DICOM3DFHIR("reader","DEMOREADER","example","study-1")=$ListBuild("/synthetic/fhir/r5","5.0.0")
```

Use the exact account name returned by `$USERNAME` for that login. Only administrators should write binding records. Store the path relative to this HTTPS origin, ending in `/fhir`, `/fhir/r4`, `/fhir/r4b` or `/fhir/r5`, and pair it with the repository’s exact version. The supported values are `4.0.1`, `4.3.0` and `5.0.0`. Store neither credentials nor FHIR resource bodies in the binding. Removing that single binding revokes future viewer lookups. The repository owns its own access and revocation policies.

Sign into the viewer, open **Imaging → Read a configured live IRIS study**, and enter the assigned key, study ID and the same reader’s repository credentials. The viewer first uses the installed session to resolve the exact grant. Then it sends the reader’s credentials only to that same-origin repository, verifies the version from `/metadata` and reads the specified ImagingStudy. Missing grants and denied reads leave the source closed. Repository credentials live in memory for this request. A local mock exercises all three declared versions; confirming the installed web gateway, class and repository together requires an authenticated HTTPS installation test.

## Offline read-only OpenAPI template

In Imaging, open **FHIR capability information**, select a local R4, R4B or R5 CapabilityStatement, then choose **Generate read-only OpenAPI template** and **Download OpenAPI JSON**. The viewer processes the file locally. The source checkout provides the same generator as a command-line tool. From the repository root, run:

```text
node scripts/export-fhir-readonly-openapi.mjs --input statement.json --output fhir-template.json
```

The exporter reads at most 8 MiB of CapabilityStatement metadata and will not overwrite an existing file. The separate local imaging-evidence limit is unchanged. It writes read, version-read, type-search, and instance, type and system history protocol templates only where those interactions are declared, with an SHA-256 fingerprint of the input. It makes no network requests and uses a non-routable placeholder server by default; `--base-url` can specify an operator-selected HTTPS endpoint or a loopback HTTP endpoint. Credentials, queries and fragments in that URL are refused. The generated OpenAPI document omits authentication schemes, profiles, search parameters, other system interactions and write operations; omitted declared interactions are listed in its metadata. **An omitted security scheme does not mean a server is public.** Check actual server methods, permissions and security before use; even a declared search method may be rejected. The file is a limited template, not a complete or validated server contract.

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
