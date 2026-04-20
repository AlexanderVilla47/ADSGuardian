$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$executions = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=1' -Headers $headers
$execId = $executions.data[0].id
Write-Host "Latest execution ID: $execId"
$execution = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/executions/$execId" -Headers $headers
Write-Host "Status: $($execution.data.status)"
Write-Host "Error:"
$execution.data.data.resultData.error | ConvertTo-Json -Depth 5