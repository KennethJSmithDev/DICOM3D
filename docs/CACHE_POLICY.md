# IRIS viewer cache policy

The mutable HTML shell and content-hashed JavaScript have different freshness rules. The installed `%CSP.StreamServer` uses `Security.Applications.ServeFilesTimeout`; its default 3600 seconds allowed a browser to reuse an obsolete shell without asking the server. A captured normal navigation confirmed `fromDiskCache=true`, the old entry bundle and no service-worker handling. Conditional HTTP requests to the server returned the current shell.

The package configures only its own routes:

| Application | Static timeout | Purpose |
| --- | ---: | --- |
| `/dicom3d` | 0 | Mutable HTML and unhashed notices; this IRIS build emits `no-store, no-cache` |
| `/dicom3d/assets` | 3600 | Content-hashed assets retain caching |
| `/dicom3d-api` | unchanged | Existing read-only health API |

All three require `%Development` and password authentication (32), use USER and remain package-owned. No global IRIS/Apache/browser cache setting is changed. No cache purge or service worker is introduced. The package still owns only two native classes.

Staging hashes the exact generated `public/index.html` and binds the native `DICOM3D.Entry.cls` link to `index.html?build=<HTML SHA-256>`. The entry response also requires revalidation. This content identity changes when the shell changes, including during repeated builds with the same release version. Hashed asset URLs are preserved.

Upgrade through `/dicom3d/DICOM3D.Entry.cls`. An already-fresh legacy cache entry cannot receive changed server headers until the browser makes a request. The content-bound native entry handles that transition without a site-wide purge. A legacy direct `index.html` bookmark may need one ordinary reload or its previous expiry; after that request the new shell policy applies. Reload and subsequent revisits were verified to stay current. No hard reload or cache-disable setting was required.

The frozen candidate was tested in a reused browser and a fresh origin/authentication session. Network traces show current HTML fetched again and unchanged hashed assets reused from cache. Served shell and asset hashes match the archive. This IRIS build returned a fresh 200 body for the tested conditional shell request; qualification checks its exact hash rather than requiring a 304 response.
