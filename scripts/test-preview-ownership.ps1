$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'preview-process-owner.ps1')
$script=Join-Path $PSScriptRoot 'preview-static.mjs'
$statePath='C:\DICOM3D test\preview.json'
$state=[pscustomobject]@{owner='DICOM3D operator preview';pid=123;script=$script;stateFile=$statePath;node='C:\DevOps\Node\node.exe';root='D:\Demo Build';requestedPort=57980;instance=('a'*32)}
$process=[pscustomobject]@{ProcessId=123;ExecutablePath=$state.node;CommandLine=('"'+$state.node+'" "'+$script+'" --root "'+$state.root+'" --port 57980 --state "'+$statePath+'" --instance '+$state.instance)}
if(-not (Test-DicomPreviewOwnership $state $process $script $statePath)){throw 'Valid preview was not recognized'}
$bad=$process.PSObject.Copy();$bad.CommandLine=$bad.CommandLine.Replace($state.instance,('b'*32))
if(Test-DicomPreviewOwnership $state $bad $script $statePath){throw 'Changed process was accepted'}
$bad=$process.PSObject.Copy();$bad.ExecutablePath='C:\Other\node.exe'
if(Test-DicomPreviewOwnership $state $bad $script $statePath){throw 'Wrong executable was accepted'}
$bad=$state.PSObject.Copy();$bad.instance=''
if(Test-DicomPreviewOwnership $bad $process $script $statePath){throw 'Unbound legacy identity was accepted'}
$bad=$process.PSObject.Copy();$bad.CommandLine=$bad.CommandLine+' --another-argument'
if(Test-DicomPreviewOwnership $state $bad $script $statePath){throw 'Unexpected command was accepted'}
Write-Output 'PASS: preview identity and negative ownership cases'
