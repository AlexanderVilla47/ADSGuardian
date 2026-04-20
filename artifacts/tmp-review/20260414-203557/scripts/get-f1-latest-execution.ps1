$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$executions = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=3' -Headers $headers
$executions.data | ForEach-Object { Write-Host "ID: $($_.id) - Status: $($_.status) - Mode: $($_.mode)" }
$executions.data[0].id