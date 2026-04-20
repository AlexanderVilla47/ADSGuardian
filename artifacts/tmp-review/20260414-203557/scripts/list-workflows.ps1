$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/workflows'
$response = Invoke-RestMethod -Uri $url -Headers $headers
$response.data | Select-Object -First 5 | ForEach-Object {
    Write-Host "ID: $($_.id) - Name: $($_.name) - Active: $($_.active)"
}