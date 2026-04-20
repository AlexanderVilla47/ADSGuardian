param(
  [string]$SmokeScriptPath = $(Join-Path $PSScriptRoot "flow3-smoke-regression.ps1"),
  [string]$ArtifactsDir = $(Join-Path (Split-Path -Parent $PSScriptRoot) "artifacts/flow3-hypercare")
)

$ErrorActionPreference = "Stop"

function Get-SecretFingerprint {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return "missing"
  }

  $clean = $Value.Trim()
  if ($clean.Length -le 8) {
    return "set(len=$($clean.Length))"
  }

  $prefix = $clean.Substring(0, 4)
  $suffix = $clean.Substring($clean.Length - 4, 4)
  return "$prefix...$suffix(len=$($clean.Length))"
}

if (-not (Test-Path -Path $SmokeScriptPath)) {
  Write-Error "No existe el script smoke: $SmokeScriptPath"
  exit 2
}

if (-not (Test-Path -Path $ArtifactsDir)) {
  New-Item -Path $ArtifactsDir -ItemType Directory -Force | Out-Null
}

$startedAt = Get-Date
$stamp = $startedAt.ToString("yyyyMMdd-HHmmss")
$runId = "flow3-hypercare-$stamp"

$logPath = Join-Path $ArtifactsDir "$runId.log"
$jsonPath = Join-Path $ArtifactsDir "$runId.json"
$mdPath = Join-Path $ArtifactsDir "$runId.md"

$smokeOutput = @()
$smokeExitCode = 99

try {
  $smokeOutput = & $SmokeScriptPath *>&1
  $smokeExitCode = $LASTEXITCODE
  if ($null -eq $smokeExitCode) {
    $smokeExitCode = 0
  }
} catch {
  $smokeOutput += "[hypercare] error al ejecutar smoke: $($_.Exception.Message)"
  $smokeExitCode = 99
}

$endedAt = Get-Date
$status = if ($smokeExitCode -eq 0) { "GREEN" } else { "RED" }

@(
  "run_id=$runId"
  "started_at=$($startedAt.ToString('o'))"
  "ended_at=$($endedAt.ToString('o'))"
  "status=$status"
  "exit_code=$smokeExitCode"
  "api_key_fingerprint=$(Get-SecretFingerprint -Value $env:N8N_API_KEY)"
  "api_base_url=$(if ($env:N8N_API_BASE_URL) { $env:N8N_API_BASE_URL } else { 'default' })"
  "workflow_id=$(if ($env:N8N_FLOW3_WORKFLOW_ID) { $env:N8N_FLOW3_WORKFLOW_ID } else { 'BFHHQwYFfmcpqshb' })"
  "---"
) + $smokeOutput | Out-File -FilePath $logPath -Encoding UTF8

$summary = [ordered]@{
  run_id = $runId
  started_at = $startedAt.ToString("o")
  ended_at = $endedAt.ToString("o")
  status = $status
  exit_code = $smokeExitCode
  workflow_id = if ($env:N8N_FLOW3_WORKFLOW_ID) { $env:N8N_FLOW3_WORKFLOW_ID } else { "BFHHQwYFfmcpqshb" }
  api_base_url = if ($env:N8N_API_BASE_URL) { $env:N8N_API_BASE_URL } else { "http://168.138.125.21:5678/api/v1" }
  api_key_fingerprint = Get-SecretFingerprint -Value $env:N8N_API_KEY
  smoke_log = $logPath
}

$summary | ConvertTo-Json -Depth 8 | Out-File -FilePath $jsonPath -Encoding UTF8

$markdown = @(
  "# Flow3 hypercare daily report"
  ""
  "- run_id: $runId"
  "- status: **$status**"
  "- started_at: $($startedAt.ToString('o'))"
  "- ended_at: $($endedAt.ToString('o'))"
  "- exit_code: $smokeExitCode"
  "- workflow_id: $($summary.workflow_id)"
  "- api_key_fingerprint: $($summary.api_key_fingerprint)"
  "- smoke_log: $logPath"
  ""
  "## Smoke output"
  ""
  "~~~text"
) + ($smokeOutput | ForEach-Object { [string]$_ }) + @(
  "~~~"
)

$markdown | Out-File -FilePath $mdPath -Encoding UTF8

Write-Host "[hypercare] status=$status exit_code=$smokeExitCode"
Write-Host "[hypercare] evidence:"
Write-Host "  - $logPath"
Write-Host "  - $jsonPath"
Write-Host "  - $mdPath"

exit $smokeExitCode
