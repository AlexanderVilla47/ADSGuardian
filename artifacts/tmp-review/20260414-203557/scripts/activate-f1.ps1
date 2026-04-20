$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}

$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

Write-Host "Current versionId: $($workflow.versionId)"
Write-Host "Active versionId: $($workflow.activeVersionId)"

$activateUrl = "http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB/activate"
$body = @{
    versionId = $workflow.versionId
    name = $workflow.name
} | ConvertTo-Json

$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$activateResult = Invoke-RestMethod -Uri $activateUrl -Headers $headers -Method POST -Body $utf8Bytes -ContentType 'application/json'
Write-Host "Activated: $($activateResult.active)"