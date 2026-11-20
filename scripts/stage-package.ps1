# Stage the package-owned source, frontend and admitted public research fixture.
param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../.package'), [string]$SourceCommit = 'UNCOMMITTED-PACKAGING-CANDIDATE')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if ($SourceCommit -ne 'UNCOMMITTED-PACKAGING-CANDIDATE') {
  if ($SourceCommit -cnotmatch '^[0-9a-f]{40}$') { throw 'SourceCommit must be the exact lowercase commit SHA or the uncommitted marker' }
  $head = (& git -C $root rev-parse --verify 'HEAD^{commit}')
  if ($LASTEXITCODE -ne 0 -or $head -cne $SourceCommit) { throw 'SourceCommit does not identify this checkout HEAD' }
  $changes = @(& git -C $root status --porcelain=v1 --untracked-files=all)
  if ($LASTEXITCODE -ne 0 -or $changes.Count -ne 0) { throw 'Cannot bind a committed package identity to modified or untracked working sources' }
  $flags = @(& git -C $root ls-files -v)
  if ($LASTEXITCODE -ne 0 -or @($flags | Where-Object { $_ -cnotmatch '^H ' }).Count -ne 0) { throw 'Cannot bind a package while tracked files are hidden from normal Git checks' }
}
$candidateVersion = (Get-Content -Raw (Join-Path $root 'prototypes/alpha/three-prototype/package.json') | ConvertFrom-Json).version
if ($candidateVersion -notin @('0.7.0-alpha.1','0.7.0-alpha.2','0.7.0')) { throw 'Unreviewed alpha version' }
$moduleVersion = ([xml](Get-Content -Raw (Join-Path $root 'module.xml'))).SelectSingleNode('/Export/Document/Module/Version').InnerText
if ($moduleVersion -ne $candidateVersion) { throw 'Module and frontend versions differ' }
& python (Join-Path $root 'scripts/generate-retirement-051.py') --check
if ($LASTEXITCODE) { throw 'Native retirement adapter differs from its exact policy' }
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Use a new empty output directory' }
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
# Current release stages the same reference entry/assets as Core, never local research data.
$publicRoot = Join-Path $OutputDirectory 'public'
Push-Location $root
try {
  & node scripts/build-alpha-distribution.mjs $publicRoot $SourceCommit
  if ($LASTEXITCODE) { throw 'Viewer build failed' }
  & node scripts/test-alpha-distribution.mjs $publicRoot
  if ($LASTEXITCODE) { throw 'Frontend admission failed' }
} finally { Pop-Location }
$classOutput = Join-Path $OutputDirectory 'src/DICOM3D'
New-Item -ItemType Directory -Path $classOutput -Force | Out-Null
foreach ($name in @('Entry.cls','Health.cls','InstallMigration.cls')) {
  $source = Join-Path $root ('src/DICOM3D/' + $name)
  if ((Get-Item -LiteralPath $source -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked package source refused' }
  Copy-Item -LiteralPath $source -Destination $classOutput
}
Copy-Item (Join-Path $root 'module.xml') $OutputDirectory
# A versioned native link escapes still-fresh HTML cached by older packages.
# The shell itself must revalidate; hashed JS assets retain the server's cache policy.
$entryPath = Join-Path $OutputDirectory 'src/DICOM3D/Entry.cls'
$entry = [IO.File]::ReadAllText($entryPath)
$matches = [regex]::Matches($entry,'Parameter VIEWERBUILD = "[^"]+";')
if ($matches.Count -ne 1) { throw 'Missing unique viewer build parameter' }
$placeholder = $matches[0].Value
if (($entry.Split($placeholder).Count - 1) -ne 1) { throw 'Missing unique viewer build placeholder' }
$viewerBuild = (Get-FileHash (Join-Path $OutputDirectory 'public/reference.html') -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText($entryPath,$entry.Replace($placeholder,'Parameter VIEWERBUILD = "'+$viewerBuild+'";'))
# Bind the unchanged retirement policy to this exact staged frontend as well.
# Never relax its path/hash/ownership checks to accommodate a new release.
$migrationPath = Join-Path $OutputDirectory 'src/DICOM3D/InstallMigration.cls'
$migration = [IO.File]::ReadAllText($migrationPath)
$binding = [regex]::Matches($migration,'viewer_sha = "[0-9a-f]{64}"')
if ($binding.Count -ne 1) { throw 'Missing unique retirement frontend binding' }
[IO.File]::WriteAllText($migrationPath,$migration.Replace($binding[0].Value,'viewer_sha = "'+$viewerBuild+'"'))
# Match current hashed build filenames without changing the frozen release.
$manifestPath = Join-Path $OutputDirectory 'module.xml'
$manifest = [IO.File]::ReadAllText($manifestPath)
$publicRoot = Join-Path $OutputDirectory 'public'
$copies = (Get-ChildItem $publicRoot -File -Recurse | Sort-Object FullName | ForEach-Object {
  $relative = [IO.Path]::GetRelativePath($publicRoot,$_.FullName).Replace('\','/')
  '  <FileCopy Name="public/'+$relative+'" Target="{$cspdir}dicom3d/'+$relative+'" />'
}) -join "`n"
$manifest = [regex]::Replace($manifest,'(?m)^\s*<FileCopy Name="[^\r\n]+\r?\n','')
$manifest = $manifest.Replace('  <WebApplication Name="/dicom3d"',$copies+"`n"+'  <WebApplication Name="/dicom3d"')
[IO.File]::WriteAllText($manifestPath,$manifest)
Copy-Item (Join-Path $root 'LICENSE') $OutputDirectory
Copy-Item (Join-Path $root 'NOTICE') $OutputDirectory
Copy-Item (Join-Path $publicRoot 'third-party') $OutputDirectory -Recurse
New-Item -ItemType Directory -Path (Join-Path $OutputDirectory 'docs') | Out-Null
$packageDocs = if ($candidateVersion -eq '0.7.0') {
  @('INSTALL_070.md','FHIR_INTEROP_ALPHA2.md','SMART_SYNTHETIC_FOUNDATION.md','IRIS_FILECOPY_RETIREMENT_051.md')
} else {
  @('INSTALL_070_ALPHA.md','PACKAGING_070_ALPHA.md','IRIS_FILECOPY_RETIREMENT_051.md')
}
foreach ($name in $packageDocs) {
  Copy-Item (Join-Path $root ('docs/'+$name)) (Join-Path $OutputDirectory 'docs')
}
$fileInventory = [ordered]@{}
Get-ChildItem $OutputDirectory -File -Recurse | Sort-Object FullName | ForEach-Object {
  $name = [IO.Path]::GetRelativePath($OutputDirectory,$_.FullName).Replace('\','/')
  $fileInventory[$name] = [ordered]@{ bytes=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower() }
}
$frontendIdentity = Get-Content -LiteralPath (Join-Path $publicRoot 'demo-build-manifest.json') -Raw | ConvertFrom-Json
if ($frontendIdentity.sourceBase -cne $SourceCommit -or $frontendIdentity.buildToolchain.installedTree.sha256 -cnotmatch '^[0-9a-f]{64}$') { throw 'Frontend input identity is missing or does not match the package' }
$packageIdentity = [ordered]@{
  product='DICOM3D'; version=$candidateVersion; profile='three-r3f-alpha'; distribution='IRIS/IPM'; sourceCommit=$SourceCommit
  frontendProfile='three-r3f-alpha'
  approvedPublicResearchFixtures=@($frontendIdentity.approvedPublicResearchFixtures); containsPrivatePatientImaging=$false
  frontendHtmlSha256=$viewerBuild; patientDerivedResearchData=$true; installedBuildDependencyTree=$frontendIdentity.buildToolchain.installedTree
  qualification='Requires the separate exact-artifact qualification receipt'; files=$fileInventory
}
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'package-manifest.json'),($packageIdentity | ConvertTo-Json -Depth 8)+"`n")
Write-Output "Staged package at $OutputDirectory"
