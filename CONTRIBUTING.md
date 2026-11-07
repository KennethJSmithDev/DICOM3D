# Contributing

Please discuss substantial changes before starting work, keep changes focused, and run the relevant checks. Preserve source identity, spatial geometry and attribution when changing imaging or anatomy code. Use approved public or synthetic fixtures; never include patient data, credentials or private evidence in a contribution. Explain tests and limitations in the pull request.

Keep the source inventory current. For this alpha, stage the intended files, run `python scripts/update-source-manifest.py --profile alpha`, stage the refreshed manifest, then run `python scripts/test-alpha-publication.py --base <verified-destination-SHA>`. The default legacy inventory/publication commands describe v0.6.5 and must not relabel an alpha candidate.

Respect separate software and anatomy asset licenses and existing source notices. Do not represent research visualization as clinical validation.

## Medical imaging guidelines

1. **Patient privacy:** Do not upload identifiable medical records, scans, reports, or screenshots containing patient information in issues, pull requests, logs, or assets. Use approved public or synthetic fixtures; keep private imaging and derived private data local.

2. **Clinical accuracy and anatomical evidence:** Support medical claims and anatomical corrections with appropriate evidence, citing the source and dataset version. Distinguish source-backed observations from hypotheses, generalized reference anatomy, and presentation effects.

3. **Relevant validation:** Contributions affecting imaging or anatomy must include validation proportional to the change, including source identity, spatial geometry, and affected selection or rendering behavior where applicable. Describe the checks, observed results, and remaining limitations in the pull request.

4. **Responsible reporting:** Report security or privacy vulnerabilities through [GitHub's private vulnerability reporting](https://github.com/KennethJSmithDev/DICOM3D/security/advisories/new), rather than public issues or discussions. Provide the minimum reproduction details needed, without patient information, credentials, or private medical files.

5. **Experimental features:** Clearly label research functionality, uncertainty, and known limitations. Do not present experimental visualization, reconstruction, segmentation, or atlas alignment as clinically validated or make unsupported diagnostic or treatment claims.
