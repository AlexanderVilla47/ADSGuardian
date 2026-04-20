$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$body = @{
    action = "consulta"
    dias_proximos = 7
    correlation_id = "ak-chain-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
} | ConvertTo-Json

$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
try {
    $response = Invoke-WebRequest -Uri 'http://168.138.125.21:5678/webhook/contract-ui-management' -Headers $headers -Method POST -Body $utf8Bytes -ContentType 'application/json' -TimeoutSec 30
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}