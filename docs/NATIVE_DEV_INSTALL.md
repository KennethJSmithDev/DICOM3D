# Native IRIS for Health development shell

This is the bounded V010-B development host, not a qualified v0.1.0 IPM release. Installation/removal through IPM and Docker lifecycle qualification remain separate gates. No patient-derived example is distributed.

Use an authorized, disposable IRIS for Health development target. The observed target is IRISHealthTesting, IRIS for Windows x86-64 2026.2 Build 221U, with web port 52774. Do not change another application's classes, routes, users or roles. Before installation, verify that `DICOM3D.*`, `/dicom3d`, `/dicom3d-api` and the chosen static directory are absent or owned by this exact development deployment.

1. Run `npm ci` and `npm run build` in `viewer/`. The Vite base is `/dicom3d/`.
2. Stage the contents of `viewer/dist/` in a dedicated `dicom3d/` directory under the target's CSP directory. Preserve the generated directory structure and bind file hashes. Never copy source DICOM, CT volumes, masks, manifests or GLBs into the server's web root.
3. Sign in directly to the Management Portal with an authorized development identity. In System Explorer > Classes, import and compile `src/DICOM3D/Health.cls` and `src/DICOM3D/Entry.cls` in `USER`. The portal import dialog must report successful compilation.
4. In System Administration > Security > Applications > Web Applications, create only the two applications below. Leave application roles unchanged. Do not copy the Management Portal's authentication group.

| Setting | `/dicom3d` | `/dicom3d-api` |
|---|---|---|
| Namespace | USER | USER |
| Mode | CSP/ZEN | REST |
| Dispatch class | empty | DICOM3D.Health |
| Required resource | %Development | %Development |
| Allowed authentication | Password only | Password only |
| Group By ID | DICOM3D | DICOM3D |
| Cookie path / SameSite | `/` / Strict | `/` / Strict |
| Physical path | Dedicated staged `dicom3d/` directory | none |
| Serve Files | Use InterSystems security (3) | No (0) |
| Recurse | enabled for generated asset subdirectory | disabled |
| Auto Compile | disabled | not applicable |
| Inbound Web Services / Analytics | disabled | not applicable |

These settings grant no roles and do not enable unauthenticated access. `%Development` is the existing development resource, not a general end-user access design. Do not silently replace it with broader access for release packaging.

Open `/dicom3d/DICOM3D.Entry.cls` and sign in directly. The native entry page links to `index.html`; it exists because security-protected static files return 404 before authentication rather than displaying a login page. The API returns 401 to an unauthenticated request. The two DICOM3D applications share authentication with each other, independently of the Management Portal.

The authenticated `GET /dicom3d-api/health` returns only product/development version, status, nonclinical flag and native IRIS version. It accepts no imaging input, writes no study data and has no OpsDeck dependency. Unknown paths and methods must not produce a successful health response.

## Qualification

Verify authenticated health and static assets; select a local manifest and matching GLB through the unchanged client-only viewer. Check hash validation, visible rendering, semantic selection, clear selection, hide/show and misses. Recheck source hashes. Restart the target gracefully and repeat health/viewer checks; local browser file selections must be made again after reload. Record the exact runtime, input/artifact hashes, build and request costs, screenshots and any unverified conditions.

Do not call this shell v0.1.0 qualified until the campaign's package lifecycle, exact-artifact Docker clean-room, persistence, repository/security and release gates pass.
