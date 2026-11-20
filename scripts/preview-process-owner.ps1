function Test-DicomPreviewOwnership {
 param($State, $Process, [string]$ExpectedScript, [string]$ExpectedState)
 if (-not $State -or -not $Process -or $State.owner -cne 'DICOM3D operator preview') { return $false }
 if ([string]$State.instance -cnotmatch '^[a-f0-9]{32}$') { return $false }
 if ($State.pid -ne $Process.ProcessId -or -not $Process.CommandLine -or -not $Process.ExecutablePath) { return $false }
 if (-not $State.node -or -not $State.root -or -not $State.stateFile -or -not $State.script) { return $false }
 try {
  if ([IO.Path]::GetFullPath([string]$State.script) -ine [IO.Path]::GetFullPath($ExpectedScript)) { return $false }
  if ([IO.Path]::GetFullPath([string]$State.stateFile) -ine [IO.Path]::GetFullPath($ExpectedState)) { return $false }
  if ([IO.Path]::GetFullPath([string]$State.node) -ine [IO.Path]::GetFullPath([string]$Process.ExecutablePath)) { return $false }
  if ([IO.Path]::GetFileName([string]$State.node) -ine 'node.exe') { return $false }
  $port = [int]$State.requestedPort
  if ($port -lt 0 -or $port -gt 65535) { return $false }
  $part = { param($value) $escaped=[regex]::Escape([string]$value); '(?:"'+$escaped+'"|'+$escaped+')' }
  $pattern = '^\s*' + (& $part $State.node) + '\s+' + (& $part $ExpectedScript) +
    '\s+--root\s+' + (& $part $State.root) + '\s+--port\s+' + $port +
    '\s+--state\s+' + (& $part $ExpectedState) + '\s+--instance\s+' + $State.instance + '\s*$'
  return $Process.CommandLine -imatch $pattern
 } catch { return $false }
}
