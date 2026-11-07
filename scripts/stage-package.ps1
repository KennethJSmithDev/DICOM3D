# Stage only package-owned sources and generated frontend. No study assets.
param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../.package'), [string]$SourceCommit = 'UNCOMMITTED-PACKAGING-CANDIDATE')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
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
Copy-Item (Join-Path $root 'src') $OutputDirectory -Recurse
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
Copy-Item (Join-Path $root 'third-party') $OutputDirectory -Recurse
New-Item -ItemType Directory -Path (Join-Path $OutputDirectory 'docs') | Out-Null
foreach ($name in @('INSTALL_070_ALPHA.md','PACKAGING_070_ALPHA.md','IRIS_FILECOPY_RETIREMENT_051.md')) {
  Copy-Item (Join-Path $root ('docs/'+$name)) (Join-Path $OutputDirectory 'docs')
}
$fileInventory = [ordered]@{}
Get-ChildItem $OutputDirectory -File -Recurse | Sort-Object FullName | ForEach-Object {
  $name = [IO.Path]::GetRelativePath($OutputDirectory,$_.FullName).Replace('\','/')
  $fileInventory[$name] = [ordered]@{ bytes=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower() }
}
$packageIdentity = [ordered]@{
  product='DICOM3D'; version='0.7.0-alpha.1'; profile='three-r3f-alpha'; distribution='IRIS/IPM'; sourceCommit=$SourceCommit
  frontendProfile='three-r3f-alpha'
  approvedPublicResearchFixtures=@('H000'); containsPrivatePatientImaging=$false
  frontendHtmlSha256=$viewerBuild; patientDerivedResearchData=$true
  qualification='Requires the separate exact-artifact qualification receipt'; files=$fileInventory
}
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'package-manifest.json'),($packageIdentity | ConvertTo-Json -Depth 8)+"`n")
Write-Output "Staged package at $OutputDirectory"
