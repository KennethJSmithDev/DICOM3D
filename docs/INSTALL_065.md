# v0.6.5 distribution and qualification

The [published GitHub v0.6.5 release](https://github.com/KennethJSmithDev/DICOM3D/releases/tag/v0.6.5) provides the Safe Demo and Core source ZIPs. See [release notes](RELEASE_NOTES_065.md) for their exact names, sizes and GitHub-recorded SHA-256 digests. GitHub publication is separate from Pages deployment and registry installation.

**Open Exchange observation (October 29, 2026):** the [listing](https://openexchange.intersystems.com/package/DICOM3D) displays **0.6.5, October 28, 2026**, while its [download archive link](https://pm.community.intersystems.com/download/dicom3d/-/dicom3d-0.1.0.tgz) still names `dicom3d-0.1.0.tgz`. This is a listing/link observation only. The linked archive's contents, equivalence to a GitHub artifact and registry installation were not inspected or qualified here. Do not infer package identity from the listing version; use the explicit GitHub download for the distribution described below.

The Safe Demo ZIP is a static frontend with a loopback preview script; extract it and run `node scripts/preview-static.mjs --root public --port 0` with a compatible installed Node runtime. Ctrl+C stops that host. No IRIS or AI service is required.

The Core source ZIP contains source, not a qualified built Core ZIP. Docker and IPM were separately qualified locally against frozen source f55623f6. The IPM browser witness used an authenticated loopback harness; ordinary interactive sign-in was not independently qualified. An installer, Open Exchange update and a distributable live IRIS adapter have no v0.6.5 qualification implied here. Check the release's external artifact identities before distribution.
