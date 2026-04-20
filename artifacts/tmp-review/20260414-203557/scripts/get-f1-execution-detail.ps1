$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$execution = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/executions/766' -Headers $headers
$execution.data | ConvertTo-Json -Depth 15