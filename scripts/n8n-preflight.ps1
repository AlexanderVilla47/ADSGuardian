[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$WorkflowId,

    [Parameter(Mandatory = $false)]
    [string]$BaseUrl = $env:N8N_BASE_URL,

    [Parameter(Mandatory = $false)]
    [string]$ApiKey = $env:N8N_API_KEY,

    [int]$TimeoutSec = 30
)

$ErrorActionPreference = 'Stop'

function Write-Pass {
    param([string]$Message)
    Write-Host "PASS: $Message" -ForegroundColor Green
}

function Write-WarnMsg {
    param([string]$Message)
    Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 1
}

function Get-HttpStatusCode {
    param($ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) { return $null }

    try {
        return [int]$response.StatusCode
    }
    catch {
        return $null
    }
}

function Fail-Auth {
    param(
        [int]$StatusCode,
        [string]$Context
    )

    if ($StatusCode -eq 401) {
        Write-Host "FAIL: $Context devolvió 401. La key no sirve para API REST o no tiene scope workflows read/write." -ForegroundColor Red
        Write-Host "ACCION: pedir una API key con permisos de workflows read/write y reintentar." -ForegroundColor Yellow
        exit 2
    }

    if ($StatusCode -eq 403) {
        Write-Host "FAIL: $Context devolvió 403. La key fue reconocida, pero el rol no tiene permisos suficientes." -ForegroundColor Red
        Write-Host "ACCION: revisar rol/permisos del usuario o emitir una key con privilegios adecuados." -ForegroundColor Yellow
        exit 3
    }

    return $false
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    Write-Fail "Falta N8N_BASE_URL. Definí `$env:N8N_BASE_URL antes de correr el preflight."
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Fail "Falta N8N_API_KEY. Definí `$env:N8N_API_KEY antes de correr el preflight."
}

$baseUrlNormalized = $BaseUrl.TrimEnd('/')
$headers = @{
    'X-N8N-API-KEY' = $ApiKey
    'Content-Type'  = 'application/json'
}

Write-Host "Iniciando preflight n8n API directa..." -ForegroundColor Cyan
Write-Host "Base URL: $baseUrlNormalized"
if ($WorkflowId) {
    Write-Host "Workflow ID: $WorkflowId"
}

Write-Host "Etapa 1/3: HEALTH" -ForegroundColor Cyan
$healthEndpoints = @('/healthz', '/healthz/readiness')
$healthOk = $false

foreach ($endpoint in $healthEndpoints) {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrlNormalized$endpoint" -Method GET -TimeoutSec $TimeoutSec
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
            Write-Pass "Health check OK en $endpoint (HTTP $($response.StatusCode))."
            $healthOk = $true
            break
        }
    }
    catch {
        # probar próximo endpoint
    }
}

if (-not $healthOk) {
    Write-WarnMsg "No respondió health endpoint estándar. Continuo con auth/API check."
}

if ([string]::IsNullOrWhiteSpace($WorkflowId)) {
    Write-Fail "Falta WorkflowId. El chequeo crítico requiere GET /api/v1/workflows/{id}."
}

Write-Host "Etapa 2/3: AUTH CHECK DETALLE" -ForegroundColor Cyan
try {
    $workflow = Invoke-RestMethod -Uri "$baseUrlNormalized/api/v1/workflows/$WorkflowId" -Method GET -Headers $headers -TimeoutSec $TimeoutSec
    $nodesCount = @($workflow.nodes).Count
    Write-Pass "GET detail OK. name='$($workflow.name)' nodes=$nodesCount"
}
catch {
    $statusCode = Get-HttpStatusCode $_
    if ($statusCode -in 401, 403) {
        [void](Fail-Auth -StatusCode $statusCode -Context "GET /api/v1/workflows/$WorkflowId")
    }
    Write-Fail "No se pudo obtener workflow '$WorkflowId'. Error: $($_.Exception.Message)"
}

Write-Host "Etapa 3/3: LISTADO OPCIONAL" -ForegroundColor Cyan
try {
    $list = Invoke-RestMethod -Uri "$baseUrlNormalized/api/v1/workflows?limit=1" -Method GET -Headers $headers -TimeoutSec $TimeoutSec
    $count = 0
    if ($null -ne $list.data) {
        $count = @($list.data).Count
    }
    Write-Pass "Listado OK en /api/v1/workflows?limit=1 (solo conectividad/listado, items: $count)."
}
catch {
    $statusCode = Get-HttpStatusCode $_
    if ($statusCode -in 401, 403) {
        [void](Fail-Auth -StatusCode $statusCode -Context "GET /api/v1/workflows?limit=1")
    }
    Write-Fail "Falló el listado /api/v1/workflows?limit=1. Verificá conectividad o base URL. Error: $($_.Exception.Message)"
}

Write-Host "PASS: Preflight completo. Sesión lista para backup/PUT mínimo." -ForegroundColor Green
