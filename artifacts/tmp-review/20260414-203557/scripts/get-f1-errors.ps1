$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=2&includeData=true'
$response = Invoke-RestMethod -Uri $url -Headers $headers
$response.data | ForEach-Object {
    Write-Host "=== Execution $($_.id) ==="
    Write-Host "Status: $($_.status) - Mode: $($_.mode)"
    if ($_.data.resultData.error) {
        Write-Host "Error: $($_.data.resultData.error.message)"
        Write-Host "Node: $($_.data.resultData.lastNodeExecuted)"
    }
}