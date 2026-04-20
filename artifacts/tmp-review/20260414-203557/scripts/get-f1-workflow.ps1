$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$response = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers
$response | ConvertTo-Json -Depth 20