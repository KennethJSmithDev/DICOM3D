# Stage only package-owned sources and generated frontend. No study assets.
param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../.package'))
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
& npm --prefix (Join-Path $root 'viewer') run build
if ($LASTEXITCODE) { throw 'Viewer build failed' }
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Use a new empty output directory' }
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
Copy-Item (Join-Path $root 'src') $OutputDirectory -Recurse
Copy-Item (Join-Path $root 'viewer/dist') (Join-Path $OutputDirectory 'public') -Recurse
Copy-Item (Join-Path $root 'module.xml') $OutputDirectory
# Match current hashed build filenames without changing the frozen release.
$manifestPath = Join-Path $OutputDirectory 'module.xml'
$manifest = [IO.File]::ReadAllText($manifestPath)
$publicRoot = Join-Path $OutputDirectory 'public'
$copies = (Get-ChildItem $publicRoot -File -Recurse | Sort-Object FullName | ForEach-Object {
  $relative = [IO.Path]::GetRelativePath($publicRoot,$_.FullName).Replace('\','/')
  '  <FileCopy Name="public/'+$relative+'" Target="{$cspdir}dicom3d/'+$relative+'" />'
}) -join "`n"
$manifest = [regex]::Replace($manifest,'(?m)^\s*<FileCopy Name="public/[^\r\n]+\r?\n','')
$manifest = $manifest.Replace('  <WebApplication Name="/dicom3d"',$copies+"`n"+'  <WebApplication Name="/dicom3d"')
[IO.File]::WriteAllText($manifestPath,$manifest)
Copy-Item (Join-Path $root 'LICENSE') $OutputDirectory
Copy-Item (Join-Path $root 'NOTICE') $OutputDirectory
Copy-Item (Join-Path $root 'third-party') $OutputDirectory -Recurse
Write-Output "Staged package at $OutputDirectory"
