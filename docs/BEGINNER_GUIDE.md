# Your first five minutes with DICOM3D

DICOM3D helps you see, explore and understand anatomy and its underlying medical images. You can start with the [Live Demo](https://kennethjsmithdev.github.io/DICOM3D/) without installing anything, creating an account or connecting a medical system. Use a desktop browser. The alpha is for education, exploration and feedback, not diagnosis or treatment.

## 1. Explore the body

Let the short introduction assemble the reference and settle into **Scientific** view. This is generalized anatomy, not a scan of you or another patient. Skin starts hidden so that interior structures are easier to see.

Drag with the left mouse button to orbit, use the wheel to zoom, and drag with the right mouse button to pan. **Fit resident anatomy** brings the currently loaded anatomy back into view; **Front** and **Back** give repeatable directions. Some source geometry is loaded on demand. The advanced loading section offers **Load complete reference** when you want all available male bundles.

## 2. Find and inspect a structure

Open the anatomy explorer, search a familiar name such as **heart**, and select a result. You can also pick visible anatomy in the 3D view. Focus makes the selection easier to inspect; isolation hides unrelated geometry. Opacity makes a selection more transparent, and restoration returns the reference presentation.

A source component is one geometry selection. A compound can select several published components together. A proxy identifies anatomy through a larger rendered owner; it is not an independently isolated child. Source details explain which relationship a result represents. These are different records, not interchangeable counts of organs.

Switch between the male reference and **Female · composite** to explore the available alternatives. The female composite shares the BodyParts3D base and uses an approximately fitted HRA supplement; it is not a separate complete female body or a patient-specific model.

## 3. Learn about what you are seeing

Choose **Learn** on the navigation rail. **Beginner** introduces the active subject in plain language; **Explore** adds context; **Evidence** explains source relationships and limitations. The lesson context follows the active anatomy or imaging view. Learning does not require an AI service.

**Scientific** uses source-backed materials. **Holographic** changes appearance. **Materialization** introduces existing data; it does not generate new tissue. Skip and reduced-motion controls are explicit choices. Visibility, opacity and isolation are separate controls, so a transparent structure can still be selected or isolated.

## 4. Explore an actual public CT example

Choose **CT + 3D**, then **Open H000 example**. CT is a sequence of X-ray images through a body. Move through the source frames with the slider or **Previous frame** / **Next frame**.

The colored source SEG overlay comes from a supplied segmentation: a record identifying selected pixels, rather than an AI guess made by this viewer. The linked 3D lesion is a display representation of that source. On a frame that does not intersect the segmentation, the overlay can correctly be absent. The whole-volume view requires WebGPU; WebGL2 has a smaller supported presentation scope.

The 3D volume displays the scan. It does not identify every organ, reconstruct microscopic tissue or create a new diagnosis. A smoothed surface is a derived representation; the original CT values and authoritative segmentation remain separate.

## 5. Compare, restore and share useful feedback

**Compare with general anatomy** opens a reference comparison. The camera and source frame are linked; the divider reveals either side. Reference selection and opacity can help expose the acquired lesion. Reference placement and size are approximate/manual presentation controls, not proof that the atlas matches the patient.

Leave Imaging using **Viewer** or **Anatomy** to return to the reference. Use restoration or camera fit if you lose your place. If something behaves unexpectedly, report the displayed version/backend, your steps and a public-safe screenshot in [GitHub Issues](https://github.com/KennethJSmithDev/DICOM3D/issues). Do not upload personal scans, reports, identifying screenshots or credentials. Use [private vulnerability reporting](https://github.com/KennethJSmithDev/DICOM3D/security/advisories/new) for security/privacy defects.

## What do I need to install?

- **Nothing**, to use the public demo and its public example.
- **Safe Demo ZIP + Node 24**, for the inventory-checked local static copy.
- **Docker**, for standalone Core. Core serves the same viewer without IRIS, Orthanc or AI.
- **An authorized IRIS host + IPM**, only if you want the authenticated IRIS installation. IRIS hosts the application; installing it does not automatically connect a PACS or retrieve your studies.

See [downloads](DOWNLOADS_070_ALPHA.md), [installation](INSTALL_070_ALPHA.md), [current acceptance and limitations](RELEASE_070_ALPHA_ACCEPTANCE.md), and the [roadmap](../ROADMAP.md).
