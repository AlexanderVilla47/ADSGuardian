$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=1&includeData=true'
$response = Invoke-RestMethod -Uri $url -Headers $headers
$response | ConvertTo-Json -Depth 20