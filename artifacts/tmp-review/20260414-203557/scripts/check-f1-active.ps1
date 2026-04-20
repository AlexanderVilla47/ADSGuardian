$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB'
$response = Invoke-RestMethod -Uri $url -Headers $headers
Write-Host "F1 Active: $($response.active)"
Write-Host "F1 Name: $($response.name)"