param([Parameter(Mandatory=$true)][string]$Build,[int]$Port=0,[string]$NodePath='node',[string]$StatePath=(Join-Path $env:LOCALAPPDATA 'DICOM3D\preview\operator.json'),[switch]$NoBrowser)
$ErrorActionPreference='Stop'
$server=Join-Path $PSScriptRoot 'preview-static.mjs'
$resolvedBuild=(Resolve-Path -LiteralPath $Build).Path
if(Test-Path -LiteralPath $StatePath){
 $existing=Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
 $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($existing.pid)" -ErrorAction SilentlyContinue
 if($process -and $process.CommandLine.Contains($existing.script)){
  if($existing.root -ne $resolvedBuild){throw 'This preview state belongs to another build. Preserve it and use a separate -StatePath.'}
  Write-Output $existing.url
  if(-not $NoBrowser){Start-Process msedge.exe -ArgumentList @('--new-window',$existing.url)}
  exit
 }
}
$null=New-Item -ItemType Directory -Path (Split-Path -Parent $StatePath) -Force
$node=(Get-Command $NodePath -ErrorAction Stop).Source
$arguments=@(('"'+$server+'"'),'--root',('"'+$resolvedBuild+'"'),'--port',[string]$Port,'--state',('"'+$StatePath+'"'))
$child=Start-Process -FilePath $node -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput ($StatePath+'.stdout') -RedirectStandardError ($StatePath+'.stderr')
for($i=0;$i -lt 100;$i++){
 if(Test-Path -LiteralPath $StatePath){
  $state=Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
  if($state.pid -eq $child.Id){
   Write-Output $state.url
   if(-not $NoBrowser){Start-Process msedge.exe -ArgumentList @('--new-window',$state.url)}
   exit
  }
 }
 if($child.HasExited){throw 'Preview host exited; inspect local stderr'}
 Start-Sleep -Milliseconds 100
}
throw 'Preview startup did not confirm; inspect owned process/state before retry'
