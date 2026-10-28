param([string]$StatePath=(Join-Path $env:LOCALAPPDATA 'DICOM3D\preview\operator.json'))
$ErrorActionPreference='Stop'
$state=Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
$owned=Get-CimInstance Win32_Process -Filter "ProcessId=$($state.pid)" -ErrorAction SilentlyContinue
if(-not $owned){Write-Output 'Preview host already stopped';exit}
if(-not $owned.CommandLine.Contains($state.script)){throw 'PID ownership changed; no process stopped'}
Stop-Process -Id $state.pid
Write-Output 'Owned preview host stopped. Close the operator Edge window manually.'
