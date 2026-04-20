[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $false)]
    [string]$ApiKey,

    [Parameter(Mandatory = $false)]
    [string]$WorkflowId,

    [Parameter(Mandatory = $false)]
    [int]$TimeoutSec = 20
)

$ErrorActionPreference = 'Stop'

function Write-Check {
    param(
        [ValidateSet('PASS', 'FAIL', 'INFO')]
        [string]$Level,
        [string]$Message,
        [string]$Color = 'White'
    )

    Write-Host ("{0}: {1}" -f $Level, $Message) -ForegroundColor $Color
}

function Get-HttpStatusCode {
    param([Parameter(Mandatory = $true)]$ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) { return $null }

    try {
        $statusCode = $response.StatusCode
        if ($statusCode -is [int]) { return $statusCode }
        return [int]$statusCode.value__
    }
    catch {
        return $null
    }
}

function Show-Summary {
    param(
        [string]$BaseUrl,
        [string]$WorkflowId,
        [hashtable]$Results
    )

    Write-Host ''
    Write-Host '=== SESSION SUMMARY ===' -ForegroundColor Cyan
    Write-Host "baseUrl: $BaseUrl"
    Write-Host "workflowId: $WorkflowId"
    Write-Host "healthz: $($Results.healthz)"
    Write-Host "workflows_list: $($Results.workflows_list)"
    Write-Host "workflow_detail: $($Results.workflow_detail)"
}

function Fail-Session {
    param(
        [int]$ExitCode,
        [string]$Message,
        [string]$BaseUrl,
        [string]$WorkflowId,
        [hashtable]$Results
    )

    Write-Check -Level 'FAIL' -Message $Message -Color Red
    Show-Summary -BaseUrl $BaseUrl -WorkflowId $WorkflowId -Results $Results
    exit $ExitCode
}

function Invoke-SessionRequest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [ValidateSet('GET')]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [hashtable]$Headers,

        [Parameter(Mandatory = $true)]
        [int]$TimeoutSec,

        [switch]$Critical
    )

    try {
        if ($Name -eq 'healthz') {
            Invoke-WebRequest -Uri $Uri -Method $Method -TimeoutSec $TimeoutSec | Out-Null
            Write-Check -Level 'PASS' -Message 'GET /healthz OK' -Color Green
            return $true
        }

        $null = Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -TimeoutSec $TimeoutSec
        if ($Name -eq 'workflows_list') {
            Write-Check -Level 'PASS' -Message 'GET /api/v1/workflows?limit=1 OK' -Color Green
        }
        elseif ($Name -eq 'workflow_detail') {
            Write-Check -Level 'PASS' -Message 'GET /api/v1/workflows/{id} OK' -Color Green
        }
        return $true
    }
    catch {
        $statusCode = Get-HttpStatusCode -ErrorRecord $_

        if ($Critical -and $statusCode -eq 401) {
            throw [System.Exception]::new('401 en check critico: pedi una API key con scope workflows read/write.')
        }

        if ($Critical -and $statusCode -eq 403) {
            throw [System.Exception]::new('403 en check critico: el rol es insuficiente para leer/escribir workflows.')
        }

        if ($null -ne $statusCode) {
            throw [System.Exception]::new("$Name fallo con HTTP $statusCode.")
        }

        throw [System.Exception]::new("$Name fallo por error de red o API: $($_.Exception.Message)")
    }
}

# Use params or env vars
$baseUrl = if ([string]::IsNullOrWhiteSpace($BaseUrl)) { $env:N8N_BASE_URL } else { $BaseUrl }
$apiKey = if ([string]::IsNullOrWhiteSpace($ApiKey)) { $env:N8N_API_KEY } else { $ApiKey }
if ([string]::IsNullOrWhiteSpace($WorkflowId)) { $WorkflowId = $env:WORKFLOW_ID }

$results = [ordered]@{
    healthz = 'PENDING'
    workflows_list = 'PENDING'
    workflow_detail = 'PENDING'
}

$baseUrlDisplay = if ([string]::IsNullOrWhiteSpace($baseUrl)) { '<missing>' } else { $baseUrl }
$workflowIdDisplay = if ([string]::IsNullOrWhiteSpace($WorkflowId)) { '<missing>' } else { $WorkflowId }

if ([string]::IsNullOrWhiteSpace($baseUrl) -or [string]::IsNullOrWhiteSpace($apiKey) -or [string]::IsNullOrWhiteSpace($WorkflowId)) {
    $missing = @()
    if ([string]::IsNullOrWhiteSpace($baseUrl)) { $missing += 'N8N_BASE_URL' }
    if ([string]::IsNullOrWhiteSpace($apiKey)) { $missing += 'N8N_API_KEY' }
    if ([string]::IsNullOrWhiteSpace($WorkflowId)) { $missing += 'WORKFLOW_ID / -WorkflowId' }

    Fail-Session -ExitCode 1 -Message "Faltan variables requeridas: $($missing -join ', ')." -BaseUrl $baseUrlDisplay -WorkflowId $workflowIdDisplay -Results $results
}

$baseUrlNormalized = $baseUrl.TrimEnd('/')
$headers = @{ 'X-N8N-API-KEY' = $apiKey }

Write-Host '=== n8n session bootstrap ===' -ForegroundColor Cyan
Write-Host "baseUrl: $baseUrlNormalized"
Write-Host "workflowId: $WorkflowId"
Write-Host "timeoutSec: $TimeoutSec"

try {
    $results.healthz = 'RUNNING'
    Invoke-SessionRequest -Name 'healthz' -Uri "$baseUrlNormalized/healthz" -Method GET -Headers $headers -TimeoutSec $TimeoutSec | Out-Null
    $results.healthz = 'PASS'

    $results.workflows_list = 'RUNNING'
    Invoke-SessionRequest -Name 'workflows_list' -Uri "$baseUrlNormalized/api/v1/workflows?limit=1" -Method GET -Headers $headers -TimeoutSec $TimeoutSec | Out-Null
    $results.workflows_list = 'PASS'

    $results.workflow_detail = 'RUNNING'
    try {
        Invoke-SessionRequest -Name 'workflow_detail' -Uri "$baseUrlNormalized/api/v1/workflows/$WorkflowId" -Method GET -Headers $headers -TimeoutSec $TimeoutSec -Critical | Out-Null
        $results.workflow_detail = 'PASS'
    }
    catch {
        $message = $_.Exception.Message
        if ($message -like '*scope workflows read/write*') {
            $results.workflow_detail = 'FAIL (401)'
            Fail-Session -ExitCode 2 -Message $message -BaseUrl $baseUrlNormalized -WorkflowId $WorkflowId -Results $results
        }

        if ($message -like '*rol es insuficiente*') {
            $results.workflow_detail = 'FAIL (403)'
            Fail-Session -ExitCode 3 -Message $message -BaseUrl $baseUrlNormalized -WorkflowId $WorkflowId -Results $results
        }

        if ($message -like '*HTTP*' -or $message -like '*error de red*') {
            $results.workflow_detail = 'FAIL'
            Fail-Session -ExitCode 4 -Message $message -BaseUrl $baseUrlNormalized -WorkflowId $WorkflowId -Results $results
        }

        $results.workflow_detail = 'FAIL'
        Fail-Session -ExitCode 4 -Message $message -BaseUrl $baseUrlNormalized -WorkflowId $WorkflowId -Results $results
    }
}
catch {
    $results.healthz = if ($results.healthz -eq 'RUNNING') { 'FAIL' } else { $results.healthz }
    $results.workflows_list = if ($results.workflows_list -eq 'RUNNING') { 'FAIL' } else { $results.workflows_list }
    $results.workflow_detail = if ($results.workflow_detail -eq 'RUNNING') { 'FAIL' } else { $results.workflow_detail }
    Fail-Session -ExitCode 4 -Message $_.Exception.Message -BaseUrl $baseUrlNormalized -WorkflowId $WorkflowId -Results $results
}

Show-Summary -BaseUrl $baseUrlNormalized -WorkflowId $WorkflowId -Results $results
exit 0
