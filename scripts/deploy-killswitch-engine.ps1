<#
.SYNOPSIS
  Deploya F2 + F1 + Mock con los cambios del Killswitch_Engine.

.USAGE
  # Con key hardcodeada (una sola vez):
  $env:N8N_API_KEY = "eyJhbGciO..."
  .\scripts\deploy-killswitch-engine.ps1

  # O directo:
  $env:N8N_API_KEY = "eyJ..." ; .\scripts\deploy-killswitch-engine.ps1
#>

param(
  [string]$ApiKey = $env:N8N_API_KEY
)

if (-not $ApiKey) {
  Write-Error "Falta N8N_API_KEY. Ejemplo: `$env:N8N_API_KEY = 'eyJ...' ; .\scripts\deploy-killswitch-engine.ps1"
  exit 1
}

$N8N_BASE = "http://168.138.125.21.nip.io:5678"
$ROOT = Split-Path $PSScriptRoot -Parent
$HEADERS = @{ "X-N8N-API-KEY" = $ApiKey; "Content-Type" = "application/json" }

$ALLOWED_SETTINGS = @("executionOrder","callerPolicy","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","saveExecutionProgress","timezone","errorWorkflow")

function Filter-Settings($raw) {
  $s = @{}
  foreach ($k in $ALLOWED_SETTINGS) {
    if ($raw.PSObject.Properties.Name -contains $k) { $s[$k] = $raw.$k }
  }
  return $s
}

function Deploy-Workflow($wfId, $localPath, $label) {
  Write-Host "`n[$label] Deploying..."
  $wf = Get-Content $localPath -Raw | ConvertFrom-Json

  $body = @{
    name        = $wf.name
    nodes       = $wf.nodes
    connections = $wf.connections
    settings    = Filter-Settings($wf.settings)
    staticData  = $wf.staticData
  } | ConvertTo-Json -Depth 50 -Compress

  try {
    $resp = Invoke-RestMethod -Uri "$N8N_BASE/api/v1/workflows/$wfId" `
      -Method PUT -Headers $HEADERS -Body $body -ContentType "application/json"
    Write-Host "  OK: $($resp.nodes.Count) nodes deployed"
    return $true
  } catch {
    Write-Host "  ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      Write-Host "  Body: $($reader.ReadToEnd().Substring(0, [Math]::Min(300, $reader.ReadToEnd().Length)))"
    }
    return $false
  }
}

Write-Host "AdsKiller - Deploy Killswitch Engine"
Write-Host "====================================="

# Verify local files exist
$F2_PATH   = Join-Path $ROOT "workflows\contract-guard-daily-killswitch.json"
$F1_PATH   = Join-Path $ROOT "workflows\contract-ui-management.json"
$MOCK_PATH = Join-Path $ROOT "workflows\adskiller-meta-mock-gsheet.json"

foreach ($p in @($F2_PATH, $F1_PATH, $MOCK_PATH)) {
  if (-not (Test-Path $p)) { Write-Error "Not found: $p"; exit 1 }
}

# Quick check: verify F2 has Killswitch_Engine
$f2 = Get-Content $F2_PATH | ConvertFrom-Json
$hasEngine = $f2.nodes | Where-Object { $_.name -eq "Killswitch_Engine" }
if (-not $hasEngine) {
  Write-Error "F2 does not have Killswitch_Engine! Run: node scripts/patch-killswitch-engine.js --local-only first"
  exit 1
}
Write-Host "`nF2 node count: $($f2.nodes.Count) (Killswitch_Engine: present)"

$ok1 = Deploy-Workflow "8mlwAxLtJVrwpLhi" $F2_PATH "F2 - contract-guard-daily-killswitch"
$ok2 = Deploy-Workflow "cFBr6GavlSWDsUFz" $F1_PATH "F1 - contract-ui-management"
$ok3 = Deploy-Workflow "JwVHYsLLnoVMgvyI" $MOCK_PATH "Mock - adskiller-meta-mock-gsheet"

Write-Host "`n====================================="
if ($ok1 -and $ok2 -and $ok3) {
  Write-Host "All 3 workflows deployed successfully."
  Write-Host ""
  Write-Host "Proximos pasos:"
  Write-Host "  1. Verificar que AK-2026-04-17-BHZD tiene Status_Contrato=Activo en GSheet"
  Write-Host "  2. Verificar que ads de Farid Dieck tienen status=ACTIVE en Mock_Ads"
  Write-Host "  3. Ejecutar run_now desde el frontend"
  Write-Host "  4. Verificar en GSheet que BHZD pasa a Finalizado"
} else {
  Write-Host "Some deployments failed. Check errors above."
}
