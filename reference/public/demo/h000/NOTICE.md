# H000 acquired research example — source and derivative notices

LOCAL PUBLICATION CANDIDATE. Publication is not approved by this artifact.
This is an acquired public research CT and one source segmentation, not synthetic data, a clinical report, a whole-lung segmentation or a validated diagnostic product.

## Source credits

Goldgof, D., Hall, L., Hawkins, S., Schabath, M., Stringfield, O., Garcia, A., Balagurunathan, Y., Kim, J., Eschrich, S., Berglund, A., Gatenby, R., & Gillies, R. (2015). Data From QIN LUNG CT (Version 2) [Data set]. The Cancer Imaging Archive.
https://doi.org/10.7937/K9/TCIA.2015.NPGZYZBZ
https://www.cancerimagingarchive.net/collection/qin-lung-ct/

Kalpathy-Cramer, J., Napel, S., Goldgof, D., & Zhao, B. (2015). QIN multi-site collection of Lung CT data with Nodule Segmentations (Version 3) [Data set]. The Cancer Imaging Archive.
https://doi.org/10.7937/K9/TCIA.2015.1BUVFJR7
https://wiki.cancerimagingarchive.net/pages/viewpage.action?pageId=20644453

Kalpathy-Cramer, J., et al. (2016). A Comparison of Lung Nodule Segmentation Algorithms: Methods and Results from a Multi-institutional Study. Journal of Digital Imaging, 29(4), 476–487.
https://doi.org/10.1007/s10278-016-9859-z

Clark et al. (2013). The Cancer Imaging Archive (TCIA): Maintaining and Operating a Public Information Repository. Journal of Digital Imaging, 26(6), 1045–1057.
https://doi.org/10.1007/s10278-013-9622-7

Fedorov et al. (2023). National Cancer Institute Imaging Data Commons: Toward Transparency, Reproducibility, and Scalability in Imaging Artificial Intelligence. RadioGraphics.
https://doi.org/10.1148/rg.230180

## Input license and policies

Both selected CT and SEG inputs: CC BY 3.0. https://creativecommons.org/licenses/by/3.0/
Retain source credits, titles, DOI/source/license links and applicable notices; identify changes, do not imply endorsement, and preserve applicable TCIA attribution and use-policy notices downstream. Do not identify or contact participants or generate identifying representations.
TCIA use policy: https://www.cancerimagingarchive.net/data-usage-policies-and-restrictions/
TCIA Data Analysis Center guidance: https://www.cancerimagingarchive.net/tcia-data-analysis-center/
Accessible official policy: https://wiki.cancerimagingarchive.net/display/Public/Data+Usage+Policies+and+Restrictions
Accessible official DAC guidance: https://wiki.cancerimagingarchive.net/pages/viewpage.action?pageId=22515655
IDC licensing: https://learn.canceridc.dev/data/licensing
Input licensing does not assign a license to application code.

## Changes and evidence limits

Original CT stored values serialized unchanged into NPY; original binary SEG geometrically aligned without resampling or morphology into boolean NPY; marching-cubes surface mapped reversibly to DICOM3D Model Space v1 and serialized as float32 GLB. Gzip, if admitted, changes only transport encoding. Original DICOM bytes remain unchanged.
Source acquisition was through NCI Imaging Data Commons v24; selected-series licensing and public identity were rechecked against IDC v25 on 2026-10-20.
The public archive alias QIN-LSC-0064 and source UIDs provide provenance, not authority to identify or contact a participant.
All 103 CT frames were locally visually screened in two display mappings; no readable burned-in identifiers were observed. This bounded screening is not comprehensive privacy certification.
Patient/model transforms, source frame correspondence, native samples and semantic ID lesion.lung.mass.001 are preserved. Generalized reference anatomy is a separate unregistered dataset.
Source intensity RescaleType is empty. Display windowing is presentation only; no independent HU calibration, diagnosis or clinical accuracy is claimed.
Original source DICOM, private fields and research receipts are excluded from this five-file subset.
