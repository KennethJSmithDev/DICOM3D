// Current owner decision, separate from immutable historical source metadata.
// This module grants only the named Safe Demo profile; no arbitrary dataset/URL.
export const H000_PUBLIC_ADMISSION = Object.freeze({
  id: 'H000-SAFE-DEMO-060-FIVE-FILES',
  status: 'ADMITTED_CURATED_PUBLIC_DEMO_PENDING_EXACT_BUILD_QUALIFICATION',
  decisionSha256: '7ef56b825f0b8bfffacecdb0f556a91a3454d718b611450f0577ccd23bd474bf',
  profile: 'curated-h000',
  authority: 'Direct owner instruction admitting the existing five assessed H000 files as the optional built-in public research study.',
  scope: 'Safe Demo web profile only; baseline Core/native installers remain reference-only.',
  publicationApproved: true,
  deployedVerification: 'Separate exact-artifact and deployed readback receipt required.',
  screenshotAdmitted: false,
  originalSourceBytesChanged: false,
  historicalSourceAssessmentUnchanged: true,
});
export const APPROVED_H000_ASSETS = Object.freeze({
  'ct.npy.bin': Object.freeze({bytes:32972849,sha256:'645c9ebaf383bb447e415e0a400973aabb2da50e147033fb710180fa0b179b88'}),
  'mask.npy.bin': Object.freeze({bytes:28346,sha256:'44c55da565e520ee2d1eee25710650d23ada10bfb510c2e39e1cabb06ec0399c'}),
  'lesion.glb': Object.freeze({bytes:263976,sha256:'0e77bfb887791614b5fcb15c614c4948ae4d48e24ab6e9fa289aa0603c66076d'}),
  'source-binding.json': Object.freeze({bytes:22129,sha256:'605073678ef244b7ebd44995d01789e79f5cb31a715c66a21d4b76b12161d73e'}),
  'NOTICE.md': Object.freeze({bytes:3865,sha256:'0dfff975e61696fd4b570e32b38e84ef4515ebb812906196169aab0818081d2a'}),
});
export const EXCLUDED_STUDY_SCREENSHOT_SHA256 = 'fcfdacfeaf8fd78e929f313a7d33abf34e214de6b2ad3c813ecf2ebcade13335';
