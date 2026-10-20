# Stage only package-owned sources and generated frontend. No study assets.
param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../.package'))
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Use a new empty output directory' }
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
# Current release stages the same reference entry/assets as Core, never local research data.
$publicRoot = Join-Path $OutputDirectory 'public'
Push-Location (Join-Path $root 'viewer')
try {
  & node node_modules/vite/bin/vite.js build --config vite.reference.config.mjs --outDir $publicRoot --logLevel warn
  if ($LASTEXITCODE) { throw 'Viewer build failed' }
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
# Match current hashed build filenames without changing the frozen release.
$manifestPath = Join-Path $OutputDirectory 'module.xml'
$manifest = [IO.File]::ReadAllText($manifestPath)
$publicRoot = Join-Path $OutputDirectory 'public'
$copies = (Get-ChildItem $publicRoot -File -Recurse | Sort-Object FullName | ForEach-Object {
  $relative = [IO.Path]::GetRelativePath($publicRoot,$_.FullName).Replace('\','/')
  '  <FileCopy Name="public/'+$relative+'" Target="{$cspdir}dicom3d/'+$relative+'" />'
}) -join "`n"
$manifest = [regex]::Replace($manifest,'(?m)^\s*<FileCopy Name="(?:public/|reference/public/)[^\r\n]+\r?\n','')
$manifest = $manifest.Replace('  <WebApplication Name="/dicom3d"',$copies+"`n"+'  <WebApplication Name="/dicom3d"')
[IO.File]::WriteAllText($manifestPath,$manifest)
Copy-Item (Join-Path $root 'LICENSE') $OutputDirectory
Copy-Item (Join-Path $root 'NOTICE') $OutputDirectory
Copy-Item (Join-Path $root 'third-party') $OutputDirectory -Recurse
Write-Output "Staged package at $OutputDirectory"
