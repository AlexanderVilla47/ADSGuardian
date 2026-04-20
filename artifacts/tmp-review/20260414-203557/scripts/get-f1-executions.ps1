$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$executions = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=5' -Headers $headers
$executions | ConvertTo-Json -Depth 10