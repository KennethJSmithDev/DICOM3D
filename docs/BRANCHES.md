# Branch ownership

`main` contains accepted integration and qualified releases. `recovery` starts at `efdb0cafcd41543bd49c64728c5b0db371ecab61` and contains installation recovery and qualification work. Its promotion requires review; a branch push is not a release.

Release boundary, October 20, 2026: v0.5.1 is published at `f03162cdec8b89a522dd4032e3815ea7d3ed0401`. `codex/visual-workstation-060` starts from that base. Its approved promotion scope is reference-only v0.6.0 GitHub source/tag/release and Pages; completion is established by the final remote receipt. Earlier CT-inclusive candidate files/evidence are preserved outside public Git/Pages. No OEX/IPM operation or replacement installation archive belongs to this promotion. Historical branches and dirty research/product workspaces remain preserved.

`experimental` initially retains `2d32518dd310c30698e7177107b31d96a4063253`, including its parent `e233718da4dab117a08e650ee6e7636fdf7018f4`. Its merge base with main is `38ed849349abbe2ef4ba8cc04244173777616b7a`. This preserves the original visual/profile prototype and provider-neutral planning history without reverting the later accepted viewer or mixing R&D into recovery. The branch deliberately starts from that historical prototype; it is not the current release source.

Temporary task branches may be used. No old branch or outstanding PR is deleted/closed by this policy. Review actual content and preserved commit identities before any cleanup. Changes already superseded in main should not be merged as an obsolete tree snapshot.
