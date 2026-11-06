# Private 0.6.5 offline Docker qualification

Use the unchanged viewer/package-lock.json and its SHA-512 integrity entries. Seed an independently verified npm cache for Linux x64 musl from local content first, downloading only missing exact registry.npmjs.org tarball URLs. Reject redirects and hash mismatches. Never regenerate the lockfile.

Build with Dockerfile.core.offline, --network=none --pull=false and --build-context npmcache=<verified-cache-directory>. This recipe differs from Dockerfile.core only by copying the supplied cache into the build stage and requiring npm offline mode. No cache enters the final runtime image. The ordinary online recipe remains separate and is not qualified by an offline build.

The Docker context must include the three accepted anatomy catalog/owner/admission JSON files; these remain governed by build-demo.mjs exact asset hashes.

This is a private candidate. Exact source, lock, image and runtime receipts are required; no release or publication is implied.
