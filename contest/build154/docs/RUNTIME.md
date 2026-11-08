# Exact runtime acquisition and tested boundary

Obtain `irishealth-community-2026.3.0AI.154.0-docker.tar.gz` (Linux/amd64) through the authorized [InterSystems Early Access Program](https://evaluation.intersystems.com/), choosing AI Hub and Community. Do not use the historical non-Community archive, another build, or a derived image from another contest entry. No restricted image is included here.

```powershell
Get-FileHash -Algorithm SHA256 '<download>/irishealth-community-2026.3.0AI.154.0-docker.tar.gz'
docker load --input '<download>/irishealth-community-2026.3.0AI.154.0-docker.tar.gz'
docker image inspect sha256:bbea4364ab6fbd7810219780fa76730fc2977d8cf76f3e01b92c5d4291a2feae
```

Required archive:5,454,938,112bytes; SHA-256 `38e61f27902592479ee4031878cdab6516eb5730c2a08f194e866ca962bc0407`. Despite its suffix, the qualified archive is an uncompressed Docker/OCI archive. Docker's loader accepts it directly. Required runtime:2026.3.0AI.154.0com,Build154U,Linux/amd64. The launcher references the exact image ID; retagging is unnecessary.

This recovered implementation uses a **separate** Community2026.2build221 FHIR R5 repository. It does not claim that this repository was created in Build154. Authorized acquisition of its existing public image, if not already present:

```powershell
docker pull intersystemsdc/irishealth-community@sha256:471b301127cf37b0fcb91f1e9e8c65cc497318a14a873eb2fece5586b04e9d57
docker image inspect sha256:471b301127cf37b0fcb91f1e9e8c65cc497318a14a873eb2fece5586b04e9d57
```

This is the pinned `2026.2-zpm` image identity used by the accepted fixture. Both services set `pull_policy: never`; startup will not silently acquire newer images. Native image EAP access and user-authorized image/model acquisition remain prerequisites, not bundled redistributable content.

## Pinned model prerequisite

The [official Ollama model page](https://ollama.com/library/gpt-oss:20b) currently identifies a different top-level catalog manifest. Do not assume a mutable tag equals this qualified descriptor. This packet includes only the exact small selected manifest/configuration/template/license/parameters; it includes **no model weights**. The license text is retained at [the original model license blob](../model/blobs/sha256-f60356777647e927149cbd4c0ec1314a90caba9400ad205ddc4ce47ed001c2d6).

An authorized user can separately obtain `gpt-oss:20b` through Ollama's normal acquisition procedure, or provide the already-authorized GGUF. The required blob is13,793,422,816bytes, SHA-256 `8ecb5d4ad6172c63f9cbf1a07a04e525985a8a11a6e516da02b674c4010de716`; its source is recorded in [model provenance](../model/SOURCE.json). Qualification uses an existing supplied blob; it does not claim a new14GB network-download witness. A metadata-only HEAD check confirmed the source blob's availability and length.

Prepare a NEW private store using the included exact metadata, then pass that store to `up`:

```powershell
python contest/build154/scripts/prepare_model.py --weight-file '<authorized GGUF or existing models/blobs/sha256-8ecb5d4ad6172c63f9cbf1a07a04e525985a8a11a6e516da02b674c4010de716>' --model-store '<new private contest model store>'
```

Preparation verifies the whole supplied blob before writing anything. It hardlinks only that file on the same filesystem; use explicit `--copy` for another filesystem and allow14GB additional storage. It never changes weight bytes or an existing model store. Metadata is copied from this packet, giving the exact selected model digest `9ba9cc2b4e02463b933096090530aef679d534dd91ecc9afadfb2dbfdc59f3c5` rather than trusting the current tag. Launcher startup checks the actual Ollama inventory against that digest. If the supplied bytes differ, stop rather than downloading/substituting another model.

The bootstrap reuses the accepted FHIR APIs: Foundation.Install, FHIRServer.InstallNamespace and InstallInstance with `hl7.fhir.r5.core@5.0.0`. Nine approved resources are seeded into its fresh dedicated `R5P001` namespace. The restricted reader receives only `R5P001Evidence:R`; a no-resource user is a denial control. The bootstrap `_SYSTEM` credential is generated for this fresh container, not borrowed from an existing installation.

Fresh FHIR storage assigns server-managed `meta.versionId`/`meta.lastUpdated`. These metadata differ from the historical fixture by design. Qualification compares all source content excluding that top-level server metadata, records the new raw response hashes, then requires those raw hashes to remain unchanged during requests and after restart. No source Study/Series/SOP IDs, values, source geometry or original fixture bytes are rewritten.

The vendor utility at `/usr/irissys/csp/bin/CSPpwd` must match SHA-256 `fd3fd2918b31d5f896547685be68133e8c133a8d4552f80c3301a53c5b00a4cd`. The create hook adds only the previously qualified relative alias when missing, verifies its target, and lets original vendor bootstrap/password/health handling run. The R5 image uses original `/iris-main` rather than its previously failing optional community wrapper. No vendor binary, health suppression, borrowed license or privilege expansion is involved.

Native service:2CPU/4GiB. R5 service:2CPU/8GiB. No swap allowance beyond those caps. Dedicated owned NAT Compose bridge; only R5 web port is published to127.0.0.1. This is not an internal/egress-isolated network: the tested Docker runtime did not realize host publication on an internal bridge even with a requested binding. Vendor health and actual loopback TCP are checked separately before installation. Host bridge/Ollama/relay also bind loopback. No existing container, network, volume, namespace or credential is configured by this packet.

The prebuilt Babylon payload is retained exactly, including attribution. Vite/build-helper notices record its historical build; the launcher does not run a Vite dev server, install npm packages or rebuild the renderer. The broader platform's frontend and dependency-security work remain separate.

## Final-response formatting

The pinned provider can emit malformed free-form JSON despite a JSON-only system prompt. A provider-only discriminator confirmed [Ollama's existing OpenAI-compatible JSON-schema option](https://docs.ollama.com/api/openai-compatibility) returns a valid typed response for the recorded verified tool context. The relay maps only that native context into `response_format`; it does not add another agent loop or claim the ObjectScript wrapper exposes an unverified property. Traces label when the projection is applied. A JSON grammar does not verify facts: exact identity/citation validation and refusal remain native, and clinical correctness is not claimed.

## After an unclean host shutdown

A PC crash can leave `Native005.Production` Troubled. IRIS health and a valid license do not imply that the production can start. The launcher refuses startup when `StartProduction` reports `ErrProductionNotShutdownCleanly`; retain the failed state and logs. A normal `StopProduction` did not clear that observed trouble state.

On the dedicated contest fixture only, inspect the production, queue counts and retained messages before recovery. The supported [InterSystems recovery procedure](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=EGDV_adv) is `Ens.Director.RecoverProduction()`. The witnessed recovery succeeded with empty queues; it preserved all message headers and request/response payloads and marked the interrupted request Suspended. A subsequent production start and normal shutdown succeeded. The request was not replayed, and no model request was made during this recovery check.

Do not use `CleanProduction` as a recovery shortcut: its documented behavior removes queued messages and current production information. Do not purge messages, reset another runtime, silently resubmit an interrupted request or infer a new agent PASS from successful recovery. Identify and authorize any pending-work disposition separately. Routine `stop`/`start` remains the reproducible lifecycle for an orderly shutdown; recovery is a manual crash procedure, not an automatic supervisor implemented by this packet.
