$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$body = @{
    action = "consulta"
    dias_proximos = 30
    correlation_id = "ak-chain-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
} | ConvertTo-Json

$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$response = Invoke-WebRequest -Uri 'http://168.138.125.21:5678/webhook/contract-ui-management' -Headers $headers -Method POST -Body $utf8Bytes -ContentType 'application/json'
Write-Host "Status Code: $($response.StatusCode)"
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10