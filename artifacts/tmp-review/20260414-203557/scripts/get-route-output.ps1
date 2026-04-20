$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=1&includeData=true'
$response = Invoke-RestMethod -Uri $url -Headers $headers

$runData = $response.data[0].data.resultData.runData
Write-Host "Route Action output (main 0):"
$runData.'Route Action'[0].data.main[0] | ConvertTo-Json -Depth 5