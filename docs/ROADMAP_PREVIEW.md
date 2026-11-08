# Interactive roadmap review candidate

The canonical milestone text is [ROADMAP.md](../ROADMAP.md). The separate interactive preview is generated from its structured milestone sections, without adding dependencies or modifying the viewer.

Run from the repository root:

```sh
node scripts/build-roadmap.mjs
```

Open `docs/roadmap/index.html` locally in a browser. This single-file document uses no server, API, analytics or external script. Its links to the actual live viewer, releases and evidence are explicit external navigation. Use the status buttons and expandable acceptance sections with mouse or keyboard.

This candidate is not deployed. A future `/DICOM3D/roadmap/` route would require a separately reviewed Pages artifact/deployment change; it must leave the frozen viewer payload intact. No existing Pages workflow or public deployment is changed here.

The footer records the canonical roadmap SHA-256. Regeneration must produce identical bytes from identical inputs. Dates are intentionally absent: milestones advance through evidence and approval, not a calendar promise. Released screenshots, demonstrated-work recordings and future concept media must keep distinct labels.
