$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=1&includeData=true'
$response = Invoke-RestMethod -Uri $url -Headers $headers
$execId = $response.data[0].id
Write-Host "Execution ID: $execId"
Write-Host "Status: $($response.data[0].status)"
Write-Host "Mode: $($response.data[0].mode)"
Write-Host "Error message:"
$response.data[0].data.resultData.error.message