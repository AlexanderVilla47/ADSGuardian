[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$WorkflowId,

    [Parameter(Mandatory = $false)]
    [string]$SourceFile,

    [Parameter(Mandatory = $false)]
    [string]$BaseUrl = $env:N8N_BASE_URL,

    [Parameter(Mandatory = $false)]
    [string]$ApiKey = $env:N8N_API_KEY,

    [Parameter(Mandatory = $false)]
    [string]$BackupDir = "workflows/backups",

    [switch]$DryRun,

    [int]$TimeoutSec = 60
)

$ErrorActionPreference = 'Stop'

function Fail {
    param([string]$Message)
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 1
}

function Info {
    param([string]$Message)
    Write-Host "INFO: $Message" -ForegroundColor Cyan
}

function Pass {
    param([string]$Message)
    Write-Host "PASS: $Message" -ForegroundColor Green
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
        Fail "$Context devolvió 401. La API key no alcanza para API REST o falta scope workflows read/write. Rotá o reemplazá la key y reintentá."
    }

    if ($StatusCode -eq 403) {
        Fail "$Context devolvió 403. La key fue reconocida pero el rol no tiene permisos de escritura. Revisá permisos/rol antes de seguir."
    }
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    Fail "Falta N8N_BASE_URL. Definí `$env:N8N_BASE_URL antes de ejecutar."
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Fail "Falta N8N_API_KEY. Definí `$env:N8N_API_KEY antes de ejecutar."
}

$baseUrlNormalized = $BaseUrl.TrimEnd('/')
$headers = @{
    'X-N8N-API-KEY' = $ApiKey
    'Content-Type'  = 'application/json'
}

Info "GET workflow actual para backup..."
try {
    $current = Invoke-RestMethod -Uri "$baseUrlNormalized/api/v1/workflows/$WorkflowId" -Method GET -Headers $headers -TimeoutSec $TimeoutSec
}
catch {
    $statusCode = Get-HttpStatusCode $_
    if ($statusCode -in 401, 403) {
        Fail-Auth -StatusCode $statusCode -Context "GET /api/v1/workflows/$WorkflowId"
    }
    Fail "No se pudo obtener el workflow '$WorkflowId'. Error: $($_.Exception.Message)"
}

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $BackupDir "$WorkflowId-$stamp-before.json"
$current | ConvertTo-Json -Depth 100 | Set-Content -Path $backupPath -Encoding UTF8
Pass "Backup generado: $backupPath"

$source = $current

if (-not [string]::IsNullOrWhiteSpace($SourceFile)) {
    if (-not (Test-Path -Path $SourceFile)) {
        Fail "SourceFile no existe: $SourceFile"
    }

    Info "Cargando SourceFile: $SourceFile"
    try {
        $sourceRaw = Get-Content -Raw -Path $SourceFile
        $source = $sourceRaw | ConvertFrom-Json
    }
    catch {
        Fail "No se pudo parsear SourceFile como JSON válido. Error: $($_.Exception.Message)"
    }
}

if ($null -eq $source.nodes) {
    Fail "El source no contiene 'nodes'."
}

if ($null -eq $source.connections) {
    Fail "El source no contiene 'connections'."
}

$nameValue = $current.name
if ($source.PSObject.Properties.Name -contains 'name' -and -not [string]::IsNullOrWhiteSpace($source.name)) {
    $nameValue = $source.name
}

$settingsValue = @{}
if ($source.PSObject.Properties.Name -contains 'settings' -and $null -ne $source.settings) {
    $settingsValue = $source.settings
}

$payload = @{
    name        = $nameValue
    nodes       = @($source.nodes)
    connections = $source.connections
    settings    = $settingsValue
}

if ($source.PSObject.Properties.Name -contains 'staticData' -and $null -ne $source.staticData) {
    $payload.staticData = $source.staticData
}

$payloadJson = $payload | ConvertTo-Json -Depth 100
$previewPath = Join-Path $BackupDir "$WorkflowId-$stamp-payload-minimo.json"
$payloadJson | Set-Content -Path $previewPath -Encoding UTF8
Info "Payload mínimo generado: $previewPath"

if ($DryRun) {
    Pass "DryRun activo: no se ejecutó PUT."
    exit 0
}

if ($PSCmdlet.ShouldProcess("workflow/$WorkflowId", "PUT payload mínimo")) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrlNormalized/api/v1/workflows/$WorkflowId" -Method PUT -Headers $headers -Body $payloadJson -TimeoutSec $TimeoutSec
        $nodeCount = @($payload.nodes).Count
        Pass "PUT OK. id=$($response.id) name='$($response.name)' nodes=$nodeCount"
    }
    catch {
        $statusCode = Get-HttpStatusCode $_
        if ($statusCode -in 401, 403) {
            Fail-Auth -StatusCode $statusCode -Context "PUT /api/v1/workflows/$WorkflowId"
        }
        Fail "Falló PUT workflow. Error: $($_.Exception.Message)"
    }
}

try {
    $verify = Invoke-RestMethod -Uri "$baseUrlNormalized/api/v1/workflows/$WorkflowId" -Method GET -Headers $headers -TimeoutSec $TimeoutSec
    $verifyNodes = @($verify.nodes).Count
    Pass "Verificación GET OK. name='$($verify.name)' nodes=$verifyNodes"
}
catch {
    $statusCode = Get-HttpStatusCode $_
    if ($statusCode -in 401, 403) {
        Fail-Auth -StatusCode $statusCode -Context "GET verify /api/v1/workflows/$WorkflowId"
    }
    Fail "PUT pudo haber aplicado, pero falló la verificación GET. Error: $($_.Exception.Message)"
}
