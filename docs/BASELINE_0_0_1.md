# 0.0.1 representation baseline

Measured from the H001-A public checkout after `npm ci` and `npm run build`. Generated `node_modules/` and `dist/` are excluded from tracked repository size.

| Measure | Result |
|---|---:|
| Tracked product files | 14 |
| Viewer source files (`viewer/src`) | 2 |
| Browser source bytes by type | HTML 2,446; TypeScript 6,510 |
| Direct production dependencies in package lock | 1 |
| `@babylonjs/lite` | 1.32.0 |
| Frontend framework | None |
| Built output assets | 276 (HTML 1, JS 275) |
| Built output uncompressed bytes by type | HTML 4,102; JS 558,615 |
| Initial static requests implied by entry graph | 23 (HTML document, entry JavaScript, and 22 module-preloaded JavaScript chunks) |
| Tracked repository bytes, excluding `.git` | 46,014 |

The browser-source byte count covers `viewer/index.html` and `viewer/src/*`. Build asset bytes are all emitted files under `viewer/dist`, grouped by extension. The request estimate counts the HTML document and every `script`/`modulepreload` URL in the generated HTML entry; dynamically loaded chunks beyond that entry graph are excluded. WebGPU and browser/runtime requests are not static build assets.

The exact npm build output and a deterministic file-count/byte recount were inspected for this receipt. npm audit results are recorded in the H001-A receipt in the research workspace.
