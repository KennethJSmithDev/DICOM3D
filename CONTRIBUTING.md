# Contributing

Please discuss substantial changes before starting work, keep changes focused, and run the relevant checks. Preserve source identity, spatial geometry and attribution when changing imaging or anatomy code. Use approved public or synthetic fixtures; never include patient data, credentials or private evidence in a contribution. Explain tests and limitations in the pull request.

Keep the source inventory current. For this alpha, stage the intended files, run `python scripts/update-source-manifest.py --profile alpha`, stage the refreshed manifest, then run `python scripts/test-alpha-publication.py --base <verified-destination-SHA>`. The default legacy inventory/publication commands describe v0.6.5 and must not relabel an alpha candidate.

Respect separate software and anatomy asset licenses and existing source notices. Do not represent research visualization as clinical validation.
