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
Write-Output "Staged package at $OutputDirectory"
