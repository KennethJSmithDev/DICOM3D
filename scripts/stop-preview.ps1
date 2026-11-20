param([string]$StatePath=(Join-Path $env:LOCALAPPDATA 'DICOM3D\preview\operator.json'))
$ErrorActionPreference='Stop'
$StatePath=[IO.Path]::GetFullPath($StatePath)
. (Join-Path $PSScriptRoot 'preview-process-owner.ps1')
$state=Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
if([int]$state.pid -le 0){throw 'Invalid preview process identity'}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DicomPreviewProcessHandle {
 [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GetProcessTimes(IntPtr handle, out long created, out long exited, out long kernel, out long user);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool TerminateProcess(IntPtr handle, uint code);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool CloseHandle(IntPtr handle);
}
'@
$handle=[DicomPreviewProcessHandle]::OpenProcess(0x1001,$false,[int]$state.pid)
if($handle -eq [IntPtr]::Zero){throw 'Preview process handle unavailable; no process stopped'}
try {
 $owned=Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
 if(-not $owned){Write-Output 'Preview host already stopped';exit}
 if(-not (Test-DicomPreviewOwnership $state $owned (Join-Path $PSScriptRoot 'preview-static.mjs') $StatePath)){throw 'Preview identity cannot be verified; no process stopped'}
 [long]$created=0;[long]$exited=0;[long]$kernel=0;[long]$user=0
 if(-not [DicomPreviewProcessHandle]::GetProcessTimes($handle,[ref]$created,[ref]$exited,[ref]$kernel,[ref]$user)){throw 'Preview creation identity unavailable; no process stopped'}
 if([math]::Abs($owned.CreationDate.ToUniversalTime().ToFileTimeUtc()-$created) -gt 10){throw 'PID creation identity changed; no process stopped'}
 if(-not [DicomPreviewProcessHandle]::TerminateProcess($handle,0)){throw 'Owned preview process already exited or could not be stopped'}
} finally { [void][DicomPreviewProcessHandle]::CloseHandle($handle) }
Write-Output 'Owned preview host stopped. Close the operator Edge window manually.'
