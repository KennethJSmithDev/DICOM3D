# Optional non-AI imaging interoperability — v0.6.5 scope

The workstation starts and operates without IRIS, Orthanc or AI. No browser-to-PACS proxy, protected credential path, admin session, clinical endpoint or service configuration is bundled. Local verified-volume import is transport-independent: a verified versioned source-admission request, immutable decoded pixel payload, original source encoding, per-frame identities, geometry and provenance enter one imaging boundary.

## Preserved local research

A local research run verified authenticated retrieval of 103 public H000 CT instances, Implicit VR Little Endian decoding, source hashes, frame order, spatial geometry, and admission and display of the decoded volume. The original objects and decoded pixel packet remain outside the distributions. This result covers CT retrieval and display for that series.

Retrieval, decoding, volume admission and display have separate evidence. The frozen qualification harness is not a deployable adapter. The v0.6.5 distributions provide local verified-volume import. DICOMweb, DIMSE, installation, authenticated non-admin clients, full cancellation/retry and independent reproduction require their own declared scope.

## Requirements for a future adapter

A future optional adapter must use an independently owned, authorized production/REST boundary on the installed and verified IRIS version. IRIS, not the browser, retrieves original objects from the approved PACS using its established protected credential reference. The operator provisions credentials through the environment's owning mechanism; never through source, logs or a public browser route.

The request must name a bounded selected study/series, correlation and cancellation generation. Responses preserve original source syntax and hashes separately from decoded storage. Missing, unauthorized, incomplete/duplicate, unsupported, timed-out or stale data must fail closed. Complete stored values, geometry and provenance must pass the same imaging-core contract before atomic publication. AI remains optional and inactive. No actual credentials, local protected paths, original DICOMs or patient metadata are needed in a distributable setup guide.

Before claiming distribution: produce a reproducible supported import/deployment package, authenticate an authorized DICOM3D client through the installed production, qualify real retrieval and negative paths, and reproduce on an independently owned environment. If unavailable, retain research status and keep standalone Core fully functional.

## Installer and registry history

The qualified v0.6.0 corrected native packaging source isbb7d34f250bd09852273924fa6f711e190c49c2c. Its nativeTGZ SHA256 is8da730335a080048a1e861e740183550a8a99a39acce98eb38df8610667b8e30. The original v0.6.0 tag and historical Core/installer receipts remain unchanged. Earlier OEX displayed0.5.0 while its archive button still targeted0.1.0; registry0.5.0 bytes were independently qualified. A label change or timeout did not prove downloadable content or rollback. Historical readback on October 28, 2026: the OEX listing displays0.6.0, but its download archive link still resolves to https://pm.community.intersystems.com/download/dicom3d/-/dicom3d-0.1.0.tgz . The binary was not downloaded or installed by this check; registry latest payload identity remains unverified. See the [distribution guide](INSTALL_065.md) for the published GitHub downloads.
